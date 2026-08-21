import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectLoginFields } from "@/lib/portal-login-detect";
import { fetchLoginPage, FetchError } from "@/lib/portal-fetch-html";
import { classifySsoMode } from "@/lib/portal-sso-mode";

// POST /api/portal-apps/detect-fields — SuperAdmin & ADMIN. Body { url }
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const url = body?.url;
        if (typeof url !== "string" || url.length > 500) {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        let parsed: URL;
        try {
            parsed = new URL(url.trim());
        } catch {
            return NextResponse.json({ error: "Format URL tidak valid" }, { status: 400 });
        }

        const { html, finalUrl, setCookies, redirected, loopDetected, hopChain } = await fetchLoginPage(parsed.href);

        const cookieNames = setCookies.map((c) => c.split("=")[0].trim()).filter(Boolean);
        const result = detectLoginFields(html);

        // Mode ditentukan dari bukti halaman (token, cookie pasangan, rantai federasi,
        // pola aplikasi), bukan dari "deteksi gagal → VAULT".
        const verdict = classifySsoMode({
            html,
            finalUrl,
            hopChain,
            cookieNames,
            detected: result,
            redirected,
            loopDetected: loopDetected ?? false,
        });

        if (!result.passwordField) {
            // Gagal menemukan form. Loop redirect turut dijelaskan agar admin paham
            // bahwa server hidup tapi URL yang diisi tidak mengarah ke formulir.
            const loopNote = loopDetected
                ? ` URL memantul dalam loop pengalihan (berakhir di ${finalUrl}) — server tampak hidup, tapi halaman tidak pernah berhenti dialihkan.`
                : "";
            const detail = !loopDetected && redirected
                ? ` Halaman dialihkan ke ${finalUrl}. Salin URL login LENGKAP dari address bar browser bila halaman ini bukan formulir login.`
                : "";
            return NextResponse.json(
                {
                    error: `Tidak ditemukan form login (input password) di halaman tersebut.${loopNote}${detail}`,
                    finalUrl,
                    redirected,
                    loopDetected: loopDetected ?? false,
                    recommendedMode: verdict.mode,
                    recommendationReason: verdict.reason,
                    detectionSignals: verdict.signals,
                },
                { status: 422 }
            );
        }

        const warnings = [...(result.warnings ?? []), ...verdict.warnings];

        return NextResponse.json({
            ...result,
            warnings,
            finalUrl,
            redirected,
            loopDetected: loopDetected ?? false,
            cookiePaired: verdict.mode === "POST",
            recommendedMode: verdict.mode,
            recommendationReason: verdict.reason,
            detectionSignals: verdict.signals,
        });
    } catch (err) {
        if (err instanceof FetchError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        console.error("POST /api/portal-apps/detect-fields:", err);
        return NextResponse.json({ error: "Gagal mengambil halaman login" }, { status: 422 });
    }
}