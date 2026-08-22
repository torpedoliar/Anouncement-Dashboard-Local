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

function startStub(status: number, body: string): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            res.statusCode = status;
            res.setHeader("content-type", "text/html");
            res.end(body);
        });
        server.listen(0, () => {
            const port = (server.address() as AddressInfo).port;
            resolve({ server, port });
        });
    });
}

async function main() {
    delete process.env.PORTAL_BROWSER_URL;
    assertEq(await renderLoginPage("https://x/"), null, "env kosong → null");

    process.env.PORTAL_BROWSER_URL = "http://127.0.0.1:1";
    const stub = await startStub(200, `<html><body><form><input name="u"><input type="password" name="p"></form></body></html>`);
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${stub.port}`;
    const ok = await renderLoginPage("https://target.app/login");
    assertEq(ok !== null, true, "stub 200 → hasil non-null");
    assertEq(ok?.html.includes("type=\"password\""), true, "HTML hasil render terbaca");

    const errStub = await startStub(500, "boom");
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${errStub.port}`;
    assertEq(await renderLoginPage("https://x/"), null, "stub 500 → null");

    const deadStub = await startStub(200, "");
    const deadPort = (deadStub.server.address() as AddressInfo).port;
    deadStub.server.close();
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${deadPort}`;
    assertEq(await renderLoginPage("https://x/"), null, "layanan mati → null");

    stub.server.close();
    errStub.server.close();
    console.log("=== ALL PASS ===");
}
main().catch((e) => { console.error("THROWN:", e.message); process.exitCode = 1; });