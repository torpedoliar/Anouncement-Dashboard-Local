import { fetchLoginPage, type CookieJar, type FetchedPage } from "@/lib/portal-fetch-html";
import { detectLoginFields, type DetectedFields } from "@/lib/portal-login-detect";
import { classifySsoMode, type ModeEvidence, type ModeVerdict } from "@/lib/portal-sso-mode";
import { renderLoginPage } from "@/lib/portal-browser-render";
import { probeApiLayer, type ApiProbe } from "@/lib/portal-api-probe";
import { looksLikeClientRenderedApp } from "@/lib/portal-sso-relay";
import { clientRouteFromUrl } from "@/lib/portal-client-route";
import { checkBrowserHealth } from "@/lib/portal-browser-health";

export type DetectionLayer = "HTTP" | "BROWSER";

export interface LadderResult {
    html: string;
    finalUrl: string;
    /** Safe path-only hash route, e.g. /signin for #/signin. */
    clientRoute: string | null;
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
    /** True bila health check browser gagal — hasil hanya dari HTML statis. */
    browserUnavailable?: boolean;
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
    checkHealth?: typeof checkBrowserHealth;
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
    const checkHealth = deps.checkHealth ?? checkBrowserHealth;
    const notes: string[] = [];

    const health = await checkHealth();
    const browserUp = health.ok;
    if (!browserUp) {
        notes.push(`Render browser tidak tersedia: ${health.reason}. Hasil memakai HTML statis; SPA mungkin tidak terdeteksi.`);
    }

    const page: FetchedPage = await fetchPage(url);
    const detected = detectLoginFields(page.html, { pageUrl: page.finalUrl || url, layer: "HTTP" });
    const cookieNames = page.setCookies.map((cookie) => cookie.split("=")[0].trim()).filter(Boolean);

    const evidence: Omit<ModeEvidence, "detected"> & { detected: DetectedFields } = {
        html: page.html,
        finalUrl: page.finalUrl,
        hopChain: page.hopChain,
        cookieNames,
        detected,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
        clientRoute: clientRouteFromUrl(url) ?? clientRouteFromUrl(page.finalUrl),
        layer: "HTTP",
    };

    // Lapis 1 sudah menemukan form → tidak perlu naik lapis.
    if (detected.passwordField) {
        return {
            html: page.html,
            finalUrl: page.finalUrl,
            clientRoute: clientRouteFromUrl(url) ?? clientRouteFromUrl(page.finalUrl),
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
            browserUnavailable: !browserUp,
            apiProbe: { layer: "NONE", contracts: [], specUrl: null, note: "Form login ditemukan di lapis HTTP; probe OpenAPI tidak diperlukan" },
        };
    }

    // Lapis 2 + 3 paralel untuk shell SPA: render Chromium dan probe API jalan
    // bersamaan (bukan probe menunggu render gagal). Di luar shell SPA,
    // perilaku lama dipertahankan (render dulu, probe hanya bila perlu).
    const spaShell = looksLikeClientRenderedApp(page.html);
    const renderPromise = !detected.passwordField && browserUp ? render(url) : Promise.resolve(null);
    const earlyProbePromise =
        spaShell ? probe(page.finalUrl || url) : Promise.resolve<ApiProbe | null>(null);
    const [rendered, earlyProbe] = await Promise.all([renderPromise, earlyProbePromise]);
    const renderedFinalUrl = rendered?.finalUrl ?? (url.includes("#") ? url : page.finalUrl);
    const renderedDetected = rendered
        ? detectLoginFields(rendered.html, { pageUrl: renderedFinalUrl, layer: "BROWSER" })
        : null;
    if (rendered && renderedDetected && renderedDetected.passwordField) {
        notes.push("Form login tidak ada di HTML statis; terdeteksi setelah render JavaScript.");
        return {
            html: rendered.html,
            finalUrl: renderedFinalUrl,
            clientRoute: clientRouteFromUrl(renderedFinalUrl) ?? clientRouteFromUrl(url),
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
                clientRoute: clientRouteFromUrl(renderedFinalUrl) ?? clientRouteFromUrl(url),
                layer: "BROWSER",
            }),
            layer: "BROWSER",
            layerNotes: notes,
            browserUnavailable: !browserUp,
            apiProbe: { layer: "NONE", contracts: [], specUrl: null, note: "Form login ditemukan setelah render JS; probe OpenAPI tidak diperlukan" },
        };
    }
    if (rendered) {
        notes.push("Halaman dirender dengan browser tetapi tidak memuat form login yang dapat dikirim.");
    } else if (browserUp) {
        // browserUp tapi render null = layanan sempat hidup lalu gagal menjawab.
        notes.push("Layanan render browser tidak menjawab; deteksi terbatas pada HTML statis.");
    }
    // browserUp=false: alasan spesifik sudah dicatat di awal (tanpa pesan ganda).

    // Gunakan snapshot browser juga saat gagal menemukan form. Ini membuat alasan
    // fallback dan probe API mencerminkan DOM aktual, bukan hanya shell SPA awal.
    const fallbackHtml = rendered?.html ?? page.html;
    const fallbackFinalUrl = renderedFinalUrl;
    const fallbackDetected = renderedDetected ?? detected;

    // Lapis 3: probe OpenAPI/Swagger — hanya saat halaman adalah SPA dan tidak
    // ada form login di kedua lapis sebelumnya. Hasil probe paralel (earlyProbe)
    // dipakai ulang agar tidak ada round-trip ganda ke target — KECUALI render
    // mengubah URL akhir (redirect JS), maka probe diulang dengan URL baru
    // karena kontrak API terikat origin/path akhir.
    let apiProbe: ApiProbe = { layer: "NONE", contracts: [], specUrl: null, note: "Lapis 3 tidak dijalankan (bukan SPA atau form ditemukan)" };
    const needProbe = looksLikeClientRenderedApp(page.html) || looksLikeClientRenderedApp(fallbackHtml);
    if (needProbe) {
        const renderMovedUrl = Boolean(rendered?.finalUrl) && rendered!.finalUrl !== page.finalUrl && rendered!.finalUrl !== (url.includes("#") ? url : page.finalUrl);
        apiProbe = earlyProbe && !renderMovedUrl ? earlyProbe : await probe(fallbackFinalUrl);
        if (apiProbe.layer === "OPENAPI" || apiProbe.layer === "KNOWN_ENDPOINT") {
            notes.push(apiProbe.note);
        } else if (apiProbe.note) {
            notes.push(`Probe OpenAPI: ${apiProbe.note}`);
        }
    }

    return {
        html: fallbackHtml,
        finalUrl: fallbackFinalUrl,
        clientRoute: clientRouteFromUrl(fallbackFinalUrl) ?? clientRouteFromUrl(url),
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
            clientRoute: clientRouteFromUrl(fallbackFinalUrl) ?? clientRouteFromUrl(url),
            layer: rendered ? "BROWSER" : "HTTP",
        }),
        layer: rendered ? "BROWSER" : "HTTP",
        layerNotes: notes,
        browserUnavailable: !browserUp,
        apiProbe,
    };
}
