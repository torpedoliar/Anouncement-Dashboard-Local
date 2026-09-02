import { fetchLoginPage, type CookieJar, type FetchedPage } from "@/lib/portal-fetch-html";
import { detectLoginFields, type DetectedFields } from "@/lib/portal-login-detect";
import { classifySsoMode, type ModeEvidence, type ModeVerdict } from "@/lib/portal-sso-mode";
import { renderLoginPage } from "@/lib/portal-browser-render";
import { probeApiLayer, type ApiProbe } from "@/lib/portal-api-probe";
import { looksLikeClientRenderedApp } from "@/lib/portal-sso-relay";

export type DetectionLayer = "HTTP" | "BROWSER";

export interface LadderResult {
    html: string;
    finalUrl: string;
    setCookies: string[];
    /** Cookie hidup hasil fetch ladder; dipakai langsung oleh POST relay dan tidak dipersistenkan. */
    cookieJar?: CookieJar;
    cookieNames: string[];
    hopChain?: string[];
    redirected: boolean;
    loopDetected: boolean;
    detected: DetectedFields;
    verdict: ModeVerdict;
    layer: DetectionLayer;
    /** Catatan proses — kenapa memilih lapis ini; degradasi jujur bila layanan mati. */
    layerNotes: string[];
    /**
     * Lapis 3: probe OpenAPI/Swagger same-origin. Dimuat hanya saat HTTP dan BROWSER
     * keduanya gagal menemukan passwordField DAN halaman terlihat SPA.
     * Selalu ada di respons (default NONE) agar UI tidak perlu null-check berlapis.
     */
    apiProbe: ApiProbe;
}

export interface LadderDeps {
    fetchPage?: typeof fetchLoginPage;
    render?: typeof renderLoginPage;
    probe?: typeof probeApiLayer;
}

/**
 * Deteksi berlapis: berhenti di lapis pertama yang menemukan form login.
 * Lapis 1 = HTTP + parse HTML (aplikasi klasik).
 * Lapis 2 = render Chromium, HANYA bila lapis 1 gagal (SPA / form dirakit JS).
 * Lapis 3 = probe OpenAPI/Swagger, HANYA bila lapis 2 juga gagal dan halaman
 *           terlihat seperti SPA — karena target SPA lazimnya mengekspos
 *           /openapi.json yang memuat endpoint login.
 *
 * Per §4 keputusan: mode TIDAK pernah berubah karena probe. SPA tetap VAULT,
 * probe hanya menambahkan sinyal & kontrak opsional untuk tombol "Uji JSON".
 */
export async function detectWithLadder(url: string, deps: LadderDeps = {}): Promise<LadderResult> {
    const fetchPage = deps.fetchPage ?? fetchLoginPage;
    const render = deps.render ?? renderLoginPage;
    const probe = deps.probe ?? probeApiLayer;
    const notes: string[] = [];

    const page: FetchedPage = await fetchPage(url);
    const detected = detectLoginFields(page.html);
    const cookieNames = page.setCookies.map((cookie) => cookie.split("=")[0].trim()).filter(Boolean);

    const evidence: Omit<ModeEvidence, "detected"> & { detected: DetectedFields } = {
        html: page.html,
        finalUrl: page.finalUrl,
        hopChain: page.hopChain,
        cookieNames,
        detected,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
    };

    // Lapis 1 sudah menemukan form → tidak perlu naik lapis.
    if (detected.passwordField) {
        return {
            html: page.html,
            finalUrl: page.finalUrl,
            setCookies: page.setCookies,
            cookieJar: page.cookieJar,
            cookieNames,
            hopChain: page.hopChain,
            redirected: page.redirected,
            loopDetected: page.loopDetected ?? false,
            detected,
            verdict: classifySsoMode(evidence),
            layer: "HTTP",
            layerNotes: notes,
            apiProbe: { layer: "NONE", contracts: [], specUrl: null, note: "Form login ditemukan di lapis HTTP; probe OpenAPI tidak diperlukan" },
        };
    }

    // Lapis 2: render Chromium. Renderer menunggu form yang dapat dikirim,
    // termasuk kontrol di open Shadow DOM dan iframe same-origin.
    const rendered = await render(url);
    const renderedDetected = rendered ? detectLoginFields(rendered.html) : null;
    const renderedFinalUrl = rendered?.finalUrl ?? page.finalUrl;
    if (rendered && renderedDetected && renderedDetected.passwordField) {
        notes.push("Form login tidak ada di HTML statis; terdeteksi setelah render JavaScript.");
        return {
            html: rendered.html,
            finalUrl: renderedFinalUrl,
            setCookies: page.setCookies,
            cookieJar: page.cookieJar,
            cookieNames,
            hopChain: page.hopChain,
            redirected: page.redirected,
            loopDetected: page.loopDetected ?? false,
            detected: renderedDetected,
            verdict: classifySsoMode({
                ...evidence,
                html: rendered.html,
                finalUrl: renderedFinalUrl,
                detected: renderedDetected,
            }),
            layer: "BROWSER",
            layerNotes: notes,
            apiProbe: { layer: "NONE", contracts: [], specUrl: null, note: "Form login ditemukan setelah render JS; probe OpenAPI tidak diperlukan" },
        };
    }
    if (rendered) {
        notes.push("Halaman dirender dengan browser tetapi tidak memuat form login yang dapat dikirim.");
    } else {
        notes.push("Layanan render browser tidak tersedia; deteksi terbatas pada HTML statis.");
    }

    // Gunakan snapshot browser juga saat gagal menemukan form. Ini membuat alasan
    // fallback dan probe API mencerminkan DOM aktual, bukan hanya shell SPA awal.
    const fallbackHtml = rendered?.html ?? page.html;
    const fallbackFinalUrl = renderedFinalUrl;
    const fallbackDetected = renderedDetected ?? detected;

    // Lapis 3: probe OpenAPI/Swagger — hanya saat halaman adalah SPA dan tidak
    // ada form login di kedua lapis sebelumnya. Bukti SPA dari HTML mentah sudah
    // cukup (tidak perlu render ulang): looksLikeClientRenderedApp memeriksa
    // <div id="root"> + tidak ada <form> + script≥3.
    let apiProbe: ApiProbe = { layer: "NONE", contracts: [], specUrl: null, note: "Lapis 3 tidak dijalankan (bukan SPA atau form ditemukan)" };
    if (looksLikeClientRenderedApp(page.html) || looksLikeClientRenderedApp(fallbackHtml)) {
        apiProbe = await probe(fallbackFinalUrl);
        if (apiProbe.layer === "OPENAPI") {
            notes.push(apiProbe.note);
        } else if (apiProbe.note) {
            notes.push(`Probe OpenAPI: ${apiProbe.note}`);
        }
    }

    return {
        html: fallbackHtml,
        finalUrl: fallbackFinalUrl,
        setCookies: page.setCookies,
        cookieJar: page.cookieJar,
        cookieNames,
        hopChain: page.hopChain,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
        detected: fallbackDetected,
        verdict: classifySsoMode({
            ...evidence,
            html: fallbackHtml,
            finalUrl: fallbackFinalUrl,
            detected: fallbackDetected,
        }),
        layer: rendered ? "BROWSER" : "HTTP",
        layerNotes: notes,
        apiProbe,
    };
}
