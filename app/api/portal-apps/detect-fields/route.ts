import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectWithLadder } from "@/lib/portal-detect-ladder";
import { FetchError } from "@/lib/portal-fetch-html";

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

        // Deteksi berlapis: HTTP → (bila perlu) browser. Berhenti di lapis pertama
        // yang menemukan form; mode ditentukan dari bukti halaman oleh classifySsoMode.
        const result = await detectWithLadder(parsed.href);
        const { detected, verdict } = result;

        if (!detected.passwordField) {
            // Gagal menemukan form. Loop redirect turut dijelaskan agar admin paham
            // bahwa server hidup tapi URL yang diisi tidak mengarah ke formulir.
            const loopNote = result.loopDetected
                ? ` URL memantul dalam loop pengalihan (berakhir di ${result.finalUrl}) — server tampak hidup, tapi halaman tidak pernah berhenti dialihkan.`
                : "";
            const detail = !result.loopDetected && result.redirected
                ? ` Halaman dialihkan ke ${result.finalUrl}. Salin URL login LENGKAP dari address bar browser bila halaman ini bukan formulir login.`
                : "";
            return NextResponse.json(
                {
                    error: `Tidak ditemukan form login (input password) di halaman tersebut.${loopNote}${detail}`,
                    finalUrl: result.finalUrl,
                    redirected: result.redirected,
                    loopDetected: result.loopDetected,
                    recommendedMode: verdict.mode,
                    recommendationReason: verdict.reason,
                    detectionSignals: verdict.signals,
                    detectionLayer: result.layer,
                    layerNotes: result.layerNotes,
                },
                { status: 422 }
            );
        }

        const warnings = [...(detected.warnings ?? []), ...verdict.warnings];

        return NextResponse.json({
            ...detected,
            warnings,
            finalUrl: result.finalUrl,
            redirected: result.redirected,
            loopDetected: result.loopDetected,
            cookiePaired: verdict.mode === "POST",
            recommendedMode: verdict.mode,
            recommendationReason: verdict.reason,
            detectionSignals: verdict.signals,
            detectionConfidence: detected.confidence ?? 0,
            detectionLayer: result.layer,
            layerNotes: result.layerNotes,
        });
    } catch (err) {
        if (err instanceof FetchError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        console.error("POST /api/portal-apps/detect-fields:", err);
        return NextResponse.json({ error: "Gagal mengambil halaman login" }, { status: 422 });
    }
}