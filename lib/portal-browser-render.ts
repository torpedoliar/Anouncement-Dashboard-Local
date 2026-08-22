export interface RenderResult {
    html: string;
}

/**
 * Render halaman login dengan browser sungguhan (container Chromium terpisah).
 *
 * Kontrak: POST JSON {url} ke `${PORTAL_BROWSER_URL}/content`; respons text/html
 * adalah HTML hasil render setelah JavaScript jalan. Env kosong / layanan mati /
 * status non-2xx / timeout → null. Pemanggil wajib memperlakukan null sebagai
 * "lapis browser tidak tersedia" (degradasi jujur), bukan "form tidak ditemukan".
 */
export async function renderLoginPage(url: string, timeoutMs = 10000): Promise<RenderResult | null> {
    const endpoint = process.env.PORTAL_BROWSER_URL?.trim();
    if (!endpoint) return null;

    try {
        const res = await fetch(`${endpoint}/content`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return null;
        const html = await res.text();
        return { html: html.slice(0, 512 * 1024) };
    } catch {
        return null;
    }
}