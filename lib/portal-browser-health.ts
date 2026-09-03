export interface BrowserHealth {
    ok: boolean;
    reason: string | null;
}

/**
 * Health check Browserless: GET /json/version dengan timeout pendek.
 * Endpoint /json/version adalah kontrak stabil Browserless v1 dan v2.
 */
export async function checkBrowserHealth(endpoint?: string, timeoutMs = 3000): Promise<BrowserHealth> {
    const base = (endpoint ?? process.env.PORTAL_BROWSER_URL ?? "").trim().replace(/\/+$/, "");
    if (!base) return { ok: false, reason: "BROWSER_URL kosong — lapis browser nonaktif, isi PORTAL_BROWSER_URL" };
    try {
        const res = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(Math.max(300, timeoutMs)) });
        if (!res.ok) return { ok: false, reason: `Browserless menjawab HTTP ${res.status} di /json/version — kontrak tak dikenal` };
        return { ok: true, reason: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        if (/aborted|timeout|Timeout/i.test(message)) {
            return { ok: false, reason: `Browserless timeout (${timeoutMs}ms) — container lambat/overload` };
        }
        return { ok: false, reason: `Browserless tidak terjangkau di ${base} — container mati/belum jalan (${message.slice(0, 80)})` };
    }
}
