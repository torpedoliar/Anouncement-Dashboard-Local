import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { detectWithLadder } from "@/lib/portal-detect-ladder";
import {
    getSafeLoginProfileDiscoveryPresentation,
    recordLoginProfileCandidate,
} from "@/lib/portal-login-profile";
import { FetchError } from "@/lib/portal-fetch-html";

// POST /api/portal-apps/detect-fields — SuperAdmin & ADMIN. Body { url }
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const url = body?.url;
        // 4000: URL login WS-Federation/SAML membawa query bersarang yang panjang.
        if (typeof url !== "string" || url.length > 4000) {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        let parsed: URL;
        try {
            parsed = new URL(url.trim());
        } catch {
            return NextResponse.json({ error: "Format URL tidak valid" }, { status: 400 });
        }

        // Deteksi berlapis: HTTP → (bila perlu) browser. Semua evidence yang
        // dikembalikan ke editor telah disaring agar tidak dapat dipersistenkan
        // kembali sebagai query redirect atau metadata cookie.
        const result = await detectWithLadder(parsed.href);
        const { detected, verdict } = result;
        const presentation = getSafeLoginProfileDiscoveryPresentation(result);

        // Candidate disimpan terpisah dari PortalApp. Kegagalan persistence tidak
        // boleh membuat fungsi diagnosis hilang; admin tetap mendapat hasil ladder.
        let profile = null;
        let profilePersistenceWarning: string | undefined;
        try {
            profile = await recordLoginProfileCandidate({
                result,
                entryUrl: parsed.href,
                source: "DISCOVERY",
            });
            if (profile && (profile.created || profile.changed)) {
                await logAudit({
                    actorType: "ADMIN_USER",
                    actorId: user.id,
                    category: "PORTAL",
                    action: profile.becameStale
                        ? "PORTAL_LOGIN_PROFILE_STALE"
                        : profile.created
                          ? "PORTAL_LOGIN_PROFILE_DISCOVERED"
                          : "PORTAL_LOGIN_PROFILE_UPDATED",
                    severity: profile.becameStale ? "WARNING" : "INFO",
                    entityType: "PORTAL_LOGIN_PROFILE",
                    entityId: profile.profile.id,
                    changes: {
                        origin: profile.profile.origin,
                        entryPath: profile.profile.entryPath,
                        fingerprint: profile.profile.currentFingerprint,
                        layer: profile.profile.detectionLayer,
                        state: profile.profile.state,
                    },
                    request,
                });
            }
        } catch (error) {
            console.error("POST /api/portal-apps/detect-fields profile persistence:", error);
            profilePersistenceWarning = "Hasil deteksi tersedia, tetapi kandidat profile belum dapat disimpan.";
        }

        if (!detected.passwordField) {
            // Gagal menemukan form. Loop redirect turut dijelaskan agar admin paham
            // bahwa server hidup tapi URL yang diisi tidak mengarah ke formulir.
            const safeFinalUrl = presentation.finalUrl ?? "target tersebut";
            const loopNote = result.loopDetected
                ? ` URL memantul dalam loop pengalihan (berakhir di ${safeFinalUrl}) — server tampak hidup, tapi halaman tidak pernah berhenti dialihkan.`
                : "";
            const detail = !result.loopDetected && result.redirected
                ? ` Halaman dialihkan ke ${safeFinalUrl}. Periksa kembali halaman login yang sebenarnya sebelum menerapkan konfigurasi.`
                : "";
            return NextResponse.json(
                {
                    error: `Tidak ditemukan form login (input password) di halaman tersebut.${loopNote}${detail}`,
                    finalUrl: presentation.finalUrl,
                    redirected: result.redirected,
                    loopDetected: result.loopDetected,
                    recommendedMode: verdict.mode,
                    recommendationReason: verdict.reason,
                    detectionSignals: presentation.discoverySignals,
                    detectionLayer: result.layer,
                    layerNotes: presentation.layerNotes,
                    // Kontrak API JSON dari lapis 3 probe — biar admin tahu opsi
                    // "Uji JSON" tersedia walau form login tidak terdeteksi.
                    apiLayer: result.apiProbe.layer,
                    apiContracts: result.apiProbe.contracts,
                    apiProbeNote: result.apiProbe.note,
                    profile: profile?.profile ?? null,
                    profilePersistenceWarning,
                },
                { status: 422 },
            );
        }

        return NextResponse.json({
            // Explicit allowlist: detector output also contains live hidden/token
            // values and raw form actions, which must remain request-local.
            usernameField: detected.usernameField,
            passwordField: detected.passwordField,
            httpMethod: detected.httpMethod ?? "POST",
            warnings: presentation.warnings,
            finalUrl: presentation.finalUrl,
            redirected: result.redirected,
            loopDetected: result.loopDetected,
            cookiePaired: verdict.mode === "POST",
            recommendedMode: verdict.mode,
            recommendationReason: verdict.reason,
            detectionSignals: presentation.discoverySignals,
            detectionConfidence: detected.confidence ?? 0,
            detectionLayer: result.layer,
            layerNotes: presentation.layerNotes,
            // Lapis 3 probe. NONE saat form login ditemukan di HTTP/BROWSER —
            // apiContracts kosong sehingga UI tidak menampilkan tombol "Uji JSON".
            apiLayer: result.apiProbe.layer,
            apiContracts: result.apiProbe.contracts,
            apiProbeNote: result.apiProbe.note,
            profile: profile?.profile ?? null,
            profilePersistenceWarning,
        });
    } catch (err) {
        if (err instanceof FetchError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        console.error("POST /api/portal-apps/detect-fields:", err);
        return NextResponse.json({ error: "Gagal mengambil halaman login" }, { status: 422 });
    }
}
