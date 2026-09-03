import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { detectWithLadder } from "@/lib/portal-detect-ladder";
import { analyzeLoginWithLlm } from "@/lib/portal-llm-analyze";
import { getLearnedSuggestion } from "@/lib/portal-detection-feedback";
import { recallLoginMemory } from "@/lib/portal-memory-recall";
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

        // MEMORI dulu: koreksi admin sebelumnya pada origin/path yang sama.
        // (Tanpa HTML — hanya koreksi yang bisa di-recall sebelum fetch.)
        const learned = await getLearnedSuggestion(parsed.href);

        // Deteksi berlapis: HTTP → (bila perlu) browser. Semua evidence yang
        // dikembalikan ke editor telah disaring agar tidak dapat dipersistenkan
        // kembali sebagai query redirect atau metadata cookie.
        const result = await detectWithLadder(parsed.href);
        const { detected, verdict } = result;
        const presentation = getSafeLoginProfileDiscoveryPresentation(result);

        // Recall penuh dengan HTML hasil ladder: fingerprint generik dan
        // registry produk ikut dipertimbangkan setelah koreksi.
        const memory = learned
            ? null
            : await recallLoginMemory({ loginUrl: parsed.href, html: result.html });

        // Lapis LLM opsional: hanya saat heuristik belum yakin (tanpa password
        // field, multi-step, atau confidence rendah). Dilewati bila recall
        // koreksi admin sudah memberi jawaban penuh (hemat biaya).
        const LOW_CONFIDENCE = 400;
        const skipLlmForMemory = Boolean(
            learned?.usernameField && learned?.passwordField,
        );
        const needsLlm =
            !skipLlmForMemory &&
            (!detected.passwordField || detected.multiStep === true || (detected.confidence ?? 0) < LOW_CONFIDENCE);
        const llmOutcome = needsLlm
            ? await analyzeLoginWithLlm({
                  url: result.finalUrl,
                  html: result.html,
                  layer: result.layer,
                  heuristic: detected,
              })
            : null;
        const llm = llmOutcome?.analysis ?? null;
        // Alasan AI tidak berkontribusi — ditampilkan ke admin supaya masalah
        // konfigurasi/koneksi terlihat, bukan diam-diam dilewati.
        const llmNote = llmOutcome?.note ?? null;

        // Heuristik gagal menemukan form tetapi LLM menemukan field yang
        // terverifikasi ada di DOM → adopsi sebagai hasil deteksi.
        let adoptedLlm = false;
        if (!detected.passwordField && llm?.passwordField) {
            detected.usernameField = llm.usernameField ?? learned?.usernameField ?? detected.usernameField;
            detected.passwordField = llm.passwordField;
            detected.httpMethod = llm.httpMethod ?? detected.httpMethod;
            if (llm.formAction) detected.formAction = llm.formAction;
            detected.confidence = Math.max(detected.confidence ?? 0, llm.confidence);
            adoptedLlm = true;
            if (llm.recommendedMode && llm.recommendedMode !== verdict.mode) {
                verdict.mode = llm.recommendedMode;
                verdict.reason = `Dianalisis AI: ${llm.rationale || verdict.reason}`;
                verdict.signals.push("Field login ditemukan oleh analisis AI (terverifikasi ada di DOM).");
            }
        }

        const llmBlock = llm
            ? {
                  assisted: adoptedLlm,
                  usernameField: llm.usernameField,
                  passwordField: llm.passwordField,
                  formAction: llm.formAction,
                  httpMethod: llm.httpMethod,
                  multiStep: llm.multiStep,
                  loginApiEndpoint: llm.loginApiEndpoint,
                  recommendedMode: llm.recommendedMode,
                  confidence: llm.confidence,
                  rationale: llm.rationale,
              }
            : null;

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
            const multiStepNote = detected.multiStep
                ? " Halaman ini memakai login dua langkah (identifier dulu, password menyusul) — pengiriman form tunggal tidak bisa menyelesaikannya."
                : "";
            const detail = !result.loopDetected && result.redirected && !detected.multiStep
                ? ` Halaman dialihkan ke ${safeFinalUrl}. Periksa kembali halaman login yang sebenarnya sebelum menerapkan konfigurasi.`
                : "";
            return NextResponse.json(
                {
                    error: `Tidak ditemukan form login (input password) di halaman tersebut.${loopNote}${multiStepNote}${detail}`,
                    finalUrl: presentation.finalUrl,
                    clientRoute: presentation.clientRoute,
                    redirected: result.redirected,
                    loopDetected: result.loopDetected,
                    multiStep: detected.multiStep ?? false,
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
                    llm: llmBlock,
                    llmNote,
                    learned,
                    memory,
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
            clientRoute: presentation.clientRoute,
            redirected: result.redirected,
            loopDetected: result.loopDetected,
            cookiePaired: verdict.mode === "POST",
            recommendedMode: verdict.mode,
            recommendationReason: verdict.reason,
            detectionSignals: presentation.discoverySignals,
            detectionConfidence: detected.confidence ?? 0,
            detectionLayer: result.layer,
            layerNotes: presentation.layerNotes,
            multiStep: detected.multiStep ?? false,
            llm: llmBlock,
            llmNote,
            learned,
            memory,
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
