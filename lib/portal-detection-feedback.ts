import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Feedback belajar deteksi login.
 *
 * Setiap kali admin menyimpan PortalApp dengan konfigurasi field yang BERBEDA
 * dari kandidat hasil deteksi otomatis (PortalLoginProfile), perbedaan itu
 * dicatat sebagai koreksi. Deteksi berikutnya pada origin/path yang sama
 * menyarankan konfigurasi koreksi tersebut, sehingga portal "belajar" dari
 * perbaikan admin tanpa mengubah kode heuristik.
 *
 * Tidak ada kredensial di sini — hanya nama field, method, mode, dan action.
 */

export interface CorrectedLoginConfig {
    usernameField: string | null;
    passwordField: string | null;
    httpMethod: string | null;
    ssoMode: string | null;
}

export interface LearnedSuggestion extends CorrectedLoginConfig {
    correctedAt: Date;
}

function originAndPath(url: string): { origin: string; entryPath: string } | null {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
        return { origin: parsed.origin.toLowerCase(), entryPath: path };
    } catch {
        return null;
    }
}

/** Catat koreksi admin. Non-fatal: kegagalan pencatatan tidak menggagalkan simpan. */
export async function recordDetectionCorrection(input: {
    loginUrl: string;
    detected: CorrectedLoginConfig | null;
    corrected: CorrectedLoginConfig;
    createdBy?: string | null;
}): Promise<void> {
    try {
        const parts = originAndPath(input.loginUrl);
        if (!parts) return;

        // Tidak ada perbedaan berarti tidak ada yang dipelajari.
        if (
            input.detected &&
            input.detected.usernameField === input.corrected.usernameField &&
            input.detected.passwordField === input.corrected.passwordField &&
            (input.detected.httpMethod ?? "POST") === (input.corrected.httpMethod ?? "POST") &&
            input.detected.ssoMode === input.corrected.ssoMode
        ) {
            return;
        }

        await prisma.portalDetectionFeedback.create({
            data: {
                origin: parts.origin,
                entryPath: parts.entryPath,
                detected: (input.detected ?? undefined) as Prisma.InputJsonValue | undefined,
                corrected: input.corrected as unknown as Prisma.InputJsonValue,
                createdBy: input.createdBy ?? null,
            },
        });
    } catch (error) {
        console.error("recordDetectionCorrection:", error);
    }
}

/**
 * Dipanggil saat admin menyimpan PortalApp. Membandingkan konfigurasi final
 * dengan kandidat deteksi otomatis terbaru (PortalLoginProfile) pada origin
 * yang sama; perbedaan dicatat sebagai koreksi. Non-fatal.
 */
export async function recordPortalAppCorrection(input: {
    loginUrl: string;
    corrected: CorrectedLoginConfig;
    createdBy?: string | null;
}): Promise<void> {
    try {
        // Hanya berarti bila admin benar-benar memilih field login.
        if (!input.corrected.usernameField && !input.corrected.passwordField) return;
        const parts = originAndPath(input.loginUrl);
        if (!parts) return;

        const latestProfile = await prisma.portalLoginProfile.findFirst({
            where: { origin: parts.origin },
            orderBy: { updatedAt: "desc" },
            select: { usernameField: true, passwordField: true, httpMethod: true },
        });

        await recordDetectionCorrection({
            loginUrl: input.loginUrl,
            detected: latestProfile
                ? {
                      usernameField: latestProfile.usernameField,
                      passwordField: latestProfile.passwordField,
                      httpMethod: latestProfile.httpMethod,
                      ssoMode: null,
                  }
                : null,
            corrected: input.corrected,
            createdBy: input.createdBy,
        });
    } catch (error) {
        console.error("recordPortalAppCorrection:", error);
    }
}

/**
 * Saran hasil belajar untuk URL login: koreksi terbaru pada entryPath yang sama,
 * fallback koreksi terbaru pada origin yang sama.
 */
export async function getLearnedSuggestion(loginUrl: string): Promise<LearnedSuggestion | null> {
    try {
        const parts = originAndPath(loginUrl);
        if (!parts) return null;

        const rows = await prisma.portalDetectionFeedback.findMany({
            where: { origin: parts.origin },
            orderBy: { createdAt: "desc" },
            take: 10,
        });
        const row = rows.find((r) => r.entryPath === parts.entryPath) ?? rows[0];
        if (!row) return null;

        const corrected = row.corrected as unknown as CorrectedLoginConfig;
        return {
            usernameField: corrected.usernameField ?? null,
            passwordField: corrected.passwordField ?? null,
            httpMethod: corrected.httpMethod ?? null,
            ssoMode: corrected.ssoMode ?? null,
            correctedAt: row.createdAt,
        };
    } catch (error) {
        console.error("getLearnedSuggestion:", error);
        return null;
    }
}
