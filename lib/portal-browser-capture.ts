/**
 * Rekam permintaan login yang SEBENARNYA dikirim halaman (tangga uji, langkah terakhir).
 *
 * Deteksi statis tidak bisa melihat apa yang dilakukan handler submit SPA. Di sini
 * Browserless `/function` mengisi kredensial uji, menekan Enter pada field password,
 * lalu merekam request non-GET yang membawa kredensial itu. Yang dikembalikan hanya
 * URL, method, content-type, dan NAMA kunci body — nilai kredensial tidak pernah
 * keluar dari container browser. Nama field username/password diketahui dari kunci
 * yang nilainya sama persis dengan kredensial uji, jadi tidak ada tebakan.
 */

export interface CapturedLogin {
    url: string;
    method: string;
    /** "form" = application/x-www-form-urlencoded; "json" = application/json. */
    encoding: "form" | "json" | "other";
    bodyKeys: string[];
    usernameKey: string | null;
    passwordKey: string | null;
    status: number | null;
}

export interface CaptureResult {
    login: CapturedLogin | null;
    /** True bila field password masih tampil setelah submit (indikasi ditolak). */
    stillOnLogin: boolean;
    note: string;
}

// Dijalankan di dalam Browserless (Node + Puppeteer). Jangan pakai closure luar.
const CAPTURE_BODY = String.raw`async ({ page, context }) => {
    const { url, username, password, waitMs } = context;
    const captured = [];
    page.on("request", (req) => {
        const method = req.method();
        const body = req.postData() || "";
        if (method === "GET" || !body || !body.includes(password) && !body.includes(encodeURIComponent(password))) return;
        captured.push({ req, url: req.url(), method, contentType: (req.headers()["content-type"] || "").toLowerCase(), body });
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: waitMs });
    const passSel = 'input[type="password"]';
    const pass = await page.waitForSelector(passSel, { visible: true, timeout: waitMs }).catch(() => null);
    if (!pass) return { data: { login: null, stillOnLogin: false, note: "Field password tidak muncul di browser." }, type: "application/json" };

    // Field identitas = input teks/email terlihat terakhir sebelum field password.
    await page.evaluate((sel) => {
        const pwd = document.querySelector(sel);
        const all = Array.from(document.querySelectorAll("input"));
        const before = all.slice(0, all.indexOf(pwd)).filter((el) =>
            /^(?:text|email|tel|)$/i.test(el.type) && el.getClientRects().length > 0 && !el.disabled && !el.readOnly);
        const user = before[before.length - 1];
        if (user) user.setAttribute("data-portal-capture-user", "1");
    }, passSel);
    const user = await page.$('[data-portal-capture-user="1"]');
    if (user) { await user.click({ clickCount: 3 }); await user.type(username, { delay: 15 }); }
    await pass.click({ clickCount: 3 });
    await pass.type(password, { delay: 15 });
    await pass.press("Enter");

    const deadline = Date.now() + waitMs;
    while (!captured.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    await new Promise((r) => setTimeout(r, 1500));

    const hit = captured[0];
    let login = null;
    if (hit) {
        const enc = hit.contentType.includes("json") ? "json" : hit.contentType.includes("x-www-form-urlencoded") ? "form" : "other";
        let entries = [];
        try {
            if (enc === "json") entries = Object.entries(JSON.parse(hit.body)).map(([k, v]) => [k, String(v)]);
            else entries = Array.from(new URLSearchParams(hit.body).entries());
        } catch {}
        const resp = hit.req.response();
        login = {
            url: hit.url,
            method: hit.method,
            encoding: enc,
            bodyKeys: entries.map(([k]) => k),
            usernameKey: (entries.find(([, v]) => v === username) || [null])[0],
            passwordKey: (entries.find(([, v]) => v === password) || [null])[0],
            status: resp ? resp.status() : null,
        };
    }
    const stillOnLogin = Boolean(await page.$(passSel).then((el) => el && el.boundingBox()).catch(() => null));
    return {
        data: { login, stillOnLogin, note: login ? "Permintaan login terekam." : "Tidak ada permintaan yang membawa kredensial uji." },
        type: "application/json",
    };
}`;

/** v1 (`browserless/chrome`) memakai CommonJS, v2 memakai ESM default export. */
const CODE_VARIANTS = [`module.exports = ${CAPTURE_BODY};`, `export default ${CAPTURE_BODY};`];

export async function captureLoginRequest(
    url: string,
    username: string,
    password: string,
    timeoutMs = 25_000,
): Promise<CaptureResult | null> {
    const endpoint = process.env.PORTAL_BROWSER_URL?.trim().replace(/\/+$/, "");
    if (!endpoint) return null;
    const context = { url, username, password, waitMs: Math.max(3_000, Math.floor(timeoutMs / 2) - 1_000) };

    for (const code of CODE_VARIANTS) {
        try {
            const res = await fetch(`${endpoint}/function`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ code, context }),
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!res.ok) continue; // kontrak tidak dikenali → coba varian berikutnya
            const result = (await res.json()) as CaptureResult;
            if (result && typeof result === "object" && "stillOnLogin" in result) return result;
        } catch {
            return null; // timeout / layanan mati
        }
    }
    return null;
}
