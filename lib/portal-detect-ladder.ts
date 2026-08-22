import { fetchLoginPage, type FetchedPage } from "@/lib/portal-fetch-html";
import { detectLoginFields, type DetectedFields } from "@/lib/portal-login-detect";
import { classifySsoMode, type ModeEvidence, type ModeVerdict } from "@/lib/portal-sso-mode";
import { renderLoginPage } from "@/lib/portal-browser-render";

export type DetectionLayer = "HTTP" | "BROWSER";

export interface LadderResult {
    html: string;
    finalUrl: string;
    setCookies: string[];
    cookieNames: string[];
    hopChain?: string[];
    redirected: boolean;
    loopDetected: boolean;
    detected: DetectedFields;
    verdict: ModeVerdict;
    layer: DetectionLayer;
    /** Catatan proses — kenapa memilih lapis ini; degradasi jujur bila layanan mati. */
    layerNotes: string[];
}

export interface LadderDeps {
    fetchPage?: typeof fetchLoginPage;
    render?: typeof renderLoginPage;
}

/**
 * Deteksi berlapis: berhenti di lapis pertama yang menemukan form login.
 * Lapis 1 = HTTP + parse HTML (aplikasi klasik). Lapis 2 = render Chromium,
 * HANYA bila lapis 1 gagal (SPA / form dirakit JS).
 */
export async function detectWithLadder(url: string, deps: LadderDeps = {}): Promise<LadderResult> {
    const fetchPage = deps.fetchPage ?? fetchLoginPage;
    const render = deps.render ?? renderLoginPage;
    const notes: string[] = [];

    const page: FetchedPage = await fetchPage(url);
    const detected = detectLoginFields(page.html);
    const cookieNames = page.setCookies.map((c) => c.split("=")[0].trim()).filter(Boolean);

    const evidence: Omit<ModeEvidence, "detected"> & { detected: DetectedFields } = {
        html: page.html,
        finalUrl: page.finalUrl,
        hopChain: page.hopChain,
        cookieNames,
        detected,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
    };

    if (!detected.passwordField) {
        const rendered = await render(url);
        if (rendered) {
            const jsDetected = detectLoginFields(rendered.html);
            if (jsDetected.passwordField) {
                notes.push("Form login tidak ada di HTML statis; terdeteksi setelah render JavaScript.");
                return {
                    html: rendered.html,
                    finalUrl: page.finalUrl,
                    setCookies: page.setCookies,
                    cookieNames,
                    hopChain: page.hopChain,
                    redirected: page.redirected,
                    loopDetected: page.loopDetected ?? false,
                    detected: jsDetected,
                    verdict: classifySsoMode({ ...evidence, html: rendered.html, detected: jsDetected }),
                    layer: "BROWSER",
                    layerNotes: notes,
                };
            }
            notes.push("Halaman dirender dengan browser tetapi tidak memuat form login.");
        } else {
            notes.push("Layanan render browser tidak tersedia; deteksi terbatas pada HTML statis.");
        }
    }

    return {
        html: page.html,
        finalUrl: page.finalUrl,
        setCookies: page.setCookies,
        cookieNames,
        hopChain: page.hopChain,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
        detected,
        verdict: classifySsoMode(evidence),
        layer: "HTTP",
        layerNotes: notes,
    };
}