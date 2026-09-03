/**
 * Self-check untuk lib/portal-browser-render.ts (tanpa Chromium sungguhan).
 * Run: npx tsx scripts/test-browser-render.ts
 */
import http from "http";
import { AddressInfo } from "net";
import { renderLoginPage } from "../lib/portal-browser-render";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

interface Stub {
    server: http.Server;
    port: number;
    /** Body JSON terakhir yang diterima — dipakai memeriksa kontrak permintaan. */
    lastBody: () => Record<string, unknown> | null;
    lastPath: () => string | null;
    /** Semua body yang diterima, untuk memeriksa urutan percobaan payload. */
    bodies: () => Array<Record<string, unknown>>;
}

function startStub(
    status: number,
    body: string,
    headers: Record<string, string> = {},
    /** Balas per-permintaan (mis. 400 untuk kontrak v2, 200 untuk v1). */
    responder?: (received: Record<string, unknown> | null) => { status: number; body: string } | null
): Promise<Stub> {
    return new Promise((resolve) => {
        const received: Array<Record<string, unknown>> = [];
        let path: string | null = null;
        const server = http.createServer((req, res) => {
            path = req.url ?? null;
            let raw = "";
            req.on("data", (chunk) => (raw += chunk));
            req.on("end", () => {
                let parsed: Record<string, unknown> | null = null;
                try {
                    parsed = JSON.parse(raw) as Record<string, unknown>;
                } catch {
                    parsed = null;
                }
                if (parsed) received.push(parsed);

                const override = responder?.(parsed) ?? null;
                res.statusCode = override?.status ?? status;
                res.setHeader("content-type", "text/html");
                for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
                res.end(override?.body ?? body);
            });
        });
        server.listen(0, () => {
            const port = (server.address() as AddressInfo).port;
            resolve({
                server,
                port,
                lastBody: () => received[received.length - 1] ?? null,
                lastPath: () => path,
                bodies: () => received,
            });
        });
    });
}

async function main() {
    delete process.env.PORTAL_BROWSER_URL;
    assertEq(await renderLoginPage("https://x/"), null, "env kosong → null");

    process.env.PORTAL_BROWSER_URL = "http://127.0.0.1:1";
    const stub = await startStub(
        200,
        `<html><body><form><input name="u"><input type="password" name="p"></form></body></html>`,
        { "x-response-url": "https://target.app/auth/signin" }
    );
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${stub.port}`;
    const ok = await renderLoginPage("https://target.app/login");
    assertEq(ok !== null, true, "stub 200 → hasil non-null");
    assertEq(ok?.html.includes("type=\"password\""), true, "HTML hasil render terbaca");

    // URL akhir dari browser dipakai ladder untuk form action & probe API. Tanpa ini,
    // aplikasi yang mengalihkan di sisi klien diproses dengan URL yang salah.
    assertEq(ok?.finalUrl, "https://target.app/auth/signin", "finalUrl diambil dari header x-response-url");

    // Browserless lama/konfigurasi tertentu tidak mengirim x-response-url.
    // Untuk hash-router, URL pemanggil tetap menjadi bukti route browser yang dibuka.
    const hashStub = await startStub(
        200,
        `<html><body><div data-testid="login-root"><textarea aria-label="PIN"></textarea></div></body></html>`,
    );
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${hashStub.port}`;
    const hashResult = await renderLoginPage("https://spa.app/#/signin?next=/home");
    assertEq(hashResult?.finalUrl, "https://spa.app/#/signin?next=/home", "hash URL dipertahankan tanpa x-response-url");
    assertEq(hashResult?.html.includes("data-testid"), true, "HTML hasil render mempertahankan metadata test ID");

    // Kontrak permintaan: menunggu form yang bisa dikirim, bukan sekadar event load.
    const payload = stub.lastBody() ?? {};
    assertEq(stub.lastPath(), "/content", "endpoint /content dipanggil");
    assertEq(payload.url, "https://target.app/login", "url target diteruskan");
    assertEq(payload.bestAttempt, true, "bestAttempt aktif agar snapshot terakhir tetap kembali");
    const waitForFunction = payload.waitForFunction as { fn?: string; timeout?: number } | undefined;
    assertEq(typeof waitForFunction?.fn, "string", "waitForFunction dikirim");
    assertEq(typeof waitForFunction?.timeout === "number" && waitForFunction.timeout > 0, true, "waitForFunction punya timeout");
    assertEq(/shadowRoot/.test(waitForFunction?.fn ?? ""), true, "predikat memeriksa Shadow DOM");
    assertEq(/IFRAME/.test(waitForFunction?.fn ?? ""), true, "predikat memeriksa iframe");
    assertEq(/autocomplete.includes\("username"\)/.test(waitForFunction?.fn ?? ""), true, "predikat menerima input autocomplete tanpa name/id");
    assertEq(/data-testid/.test(waitForFunction?.fn ?? ""), true, "predikat memeriksa test ID komponen");
    assertEq(/document.createElement\("textarea"\)/.test(waitForFunction?.fn ?? ""), true, "snapshot memproyeksikan textarea");
    assertEq(/if \(nativeAction\)/.test(waitForFunction?.fn ?? ""), true, "snapshot hanya menyalin action form eksplisit");
    assertEq(/inferredName/.test(waitForFunction?.fn ?? ""), true, "snapshot memberi nama sintetis pada input SPA");

    // Fungsi ini dieksekusi di Chromium, jadi salah sintaksis tidak akan terlihat di
    // build TypeScript. Diuji di sini supaya kegagalan tidak muncul sebagai "form
    // tidak ditemukan" di produksi.
    let evaluated: unknown = null;
    try {
        evaluated = new Function(`"use strict"; return (${waitForFunction?.fn ?? "null"});`)();
    } catch (e) {
        evaluated = null;
        console.log(`FAIL | predikat waitForFunction harus JavaScript valid | ${(e as Error).message}`);
        process.exitCode = 1;
    }
    assertEq(typeof evaluated, "function", "predikat waitForFunction dapat dievaluasi sebagai fungsi");

    // Timeout tunggu form harus lebih pendek dari timeout HTTP portal, kalau tidak
    // AbortSignal memutus koneksi sebelum Browserless mengirim snapshot apa pun.
    const shortTimeout = await startStub(200, "<html></html>");
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${shortTimeout.port}`;
    await renderLoginPage("https://target.app/login", 6_000);
    const shortPayload = shortTimeout.lastBody() ?? {};
    const shortWait = (shortPayload.waitForFunction as { timeout?: number } | undefined)?.timeout ?? 0;
    assertEq(shortWait < 6_000, true, "timeout tunggu form lebih pendek dari timeout HTTP");

    // Image lama (browserless/chrome v1) menolak kontrak v2. Klien harus turun ke
    // payload `waitFor`, bukan menyerah dan melaporkan "layanan tidak tersedia".
    const legacyStub = await startStub(200, "", {}, (received) => {
        if (received && "waitForFunction" in received) {
            return { status: 400, body: "unknown property waitForFunction" };
        }
        if (received && "waitFor" in received) {
            return {
                status: 200,
                body: `<html><body><form><input name="u"><input type="password" name="p"></form></body></html>`,
            };
        }
        return { status: 400, body: "bad request" };
    });
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${legacyStub.port}`;
    const legacy = await renderLoginPage("https://legacy.app/login");
    assertEq(legacy?.html.includes("type=\"password\""), true, "kontrak v1 dipakai saat v2 ditolak");
    const legacyBodies = legacyStub.bodies();
    assertEq(legacyBodies.length, 2, "hanya dua percobaan sampai berhasil");
    assertEq("waitForFunction" in (legacyBodies[0] ?? {}), true, "percobaan pertama memakai kontrak v2");
    assertEq(typeof (legacyBodies[1] as { waitFor?: string })?.waitFor, "string", "percobaan kedua memakai waitFor v1");

    // Layanan menolak semua kontrak tunggu → jatuh ke payload minimal (perilaku lama),
    // supaya perbaikan ini tidak pernah membuat hasil lebih buruk dari sebelumnya.
    const strictStub = await startStub(200, "", {}, (received) => {
        const keys = Object.keys(received ?? {});
        if (keys.length === 1 && keys[0] === "url") {
            return { status: 200, body: `<html><body><form><input name="p" type="password"></form></body></html>` };
        }
        return { status: 400, body: "rejected" };
    });
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${strictStub.port}`;
    const minimal = await renderLoginPage("https://strict.app/login");
    assertEq(minimal?.html.includes("type=\"password\""), true, "payload minimal sebagai jaring terakhir");
    assertEq(strictStub.bodies().length, 3, "tiga percobaan payload dijalankan");

    const errStub = await startStub(500, "boom");
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${errStub.port}`;
    assertEq(await renderLoginPage("https://x/"), null, "semua kontrak gagal → null");

    const deadStub = await startStub(200, "");
    const deadPort = (deadStub.server.address() as AddressInfo).port;
    deadStub.server.close();
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${deadPort}`;
    assertEq(await renderLoginPage("https://x/"), null, "layanan mati → null");

    stub.server.close();
    hashStub.server.close();
    shortTimeout.server.close();
    legacyStub.server.close();
    strictStub.server.close();
    errStub.server.close();
    console.log("=== ALL PASS ===");
}
main().catch((e) => { console.error("THROWN:", e.message); process.exitCode = 1; });
