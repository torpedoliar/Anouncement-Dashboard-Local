import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchLoginPage, CookieJar } from "@/lib/portal-fetch-html";
import { detectLoginFields } from "@/lib/portal-login-detect";
import { relayLogin } from "@/lib/portal-sso-relay";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { verifyLoginSchema } from "@/lib/validation-schemas";
import { checkVerifyLimit, type VerifySlot } from "@/lib/verify-rate-limit";

const VERIFY_MAX = 5;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const verifyAttempts = new Map<string, VerifySlot>();

// POST /api/portal-apps/verify-login — SuperAdmin only.
// Kredensial uji TIDAK disimpan & TIDAK dicatat; hanya hasilnya yang masuk audit.
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }
        const adminId = session.user.id;

        const limit = checkVerifyLimit(verifyAttempts, adminId, VERIFY_MAX, VERIFY_WINDOW_MS);
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Terlalu banyak percobaan uji login. Coba lagi beberapa menit." },
                { status: 429 }
            );
        }

        const body = await request.json().catch(() => null);
        const validation = verifyLoginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Validasi gagal" }, { status: 400 });
        }
        const { url, appId, usernameField, passwordField, testUsername, testPassword } = validation.data;

        const page = await fetchLoginPage(url);
        const jar = page.cookieJar ?? new CookieJar();
        const fresh = detectLoginFields(page.html);
        const userField = fresh.usernameField ?? usernameField;
        const passField = fresh.passwordField ?? passwordField;
        const actionUrl = fresh.formAction ? new URL(fresh.formAction, page.finalUrl).href : page.finalUrl;

        const params = new URLSearchParams();
        params.append(userField, testUsername);
        params.append(passField, testPassword);
        for (const [k, v] of Object.entries(fresh.extraFields)) params.append(k, v);

        const outcome = await relayLogin({
            actionUrl,
            body: params.toString(),
            jar,
            referer: page.finalUrl,
            allowInsecureTLS: true,
        });

        // Catat HASIL saja, tanpa nilai kredensial.
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: adminId,
            category: "PORTAL",
            action: "SSO_VERIFY_LOGIN",
            entityType: "PORTAL_APP",
            outcome: outcome.ok ? "SUCCESS" : "FAILURE",
            errorMessage: outcome.failureReason ?? undefined,
            metadata: { url, ssoMode: "verify", handoff: !!outcome.handoff },
            request,
        }).catch(() => {});

        // Persist bukti verifikasi pada aplikasi (khusus alur EDIT; saat CREATE app belum ada).
        if (appId) {
            await prisma.portalApp
                .update({
                    where: { id: appId },
                    data: outcome.ok
                        ? { loginVerifiedAt: new Date(), loginVerifyError: null }
                        : { loginVerifyError: outcome.failureReason ?? "Login ditolak aplikasi." },
                })
                .catch(() => {});
        }

        // Pesan mengikuti 4 baris tabel Lapis 3 di spec, bukan sekadar sukses/gagal.
        return NextResponse.json({
            ok: outcome.ok,
            handoff: !!outcome.handoff,
            message: outcome.ok
                ? outcome.handoff
                    ? "Login berhasil — konfigurasi terbukti (mode POST/federasi)."
                    : "Login berhasil. Bila aplikasi berbeda domain dari portal, pastikan PORTAL_SSO_COOKIE_DOMAIN sesuai atau aplikasi memakai federasi."
                : (outcome.failureReason ?? "Login ditolak aplikasi."),
        });
    } catch (err) {
        console.error("verify-login error:", err);
        return NextResponse.json({ error: "Gagal menjalankan uji login" }, { status: 422 });
    }
}