/**
 * Self-check untuk lib/portal-detect-ladder.ts (tanpa jaringan — memakai fake deps).
 * Run: npx tsx scripts/test-detect-ladder.ts
 */
import { detectWithLadder, type LadderDeps } from "../lib/portal-detect-ladder";
import type { FetchedPage } from "../lib/portal-fetch-html";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

function fakePage(html: string, extra: Partial<FetchedPage> = {}): FetchedPage {
    return {
        html,
        finalUrl: "https://k2prodapp/",
        setCookies: ["a=1"],
        statusCode: 200,
        redirected: false,
        ...extra,
    };
}

async function main() {
    // Lapis 1 berhasil → layer HTTP, render TIDAK dipanggil
    let renderCalls = 0;
    const deps: LadderDeps = {
        fetchPage: async () =>
            fakePage(`<form><input name="UserName" type="text"><input name="Password" type="password"></form>`),
        render: async () => { renderCalls++; return null; },
    };
    const r1 = await detectWithLadder("https://k2prodapp", deps);
    assertEq(r1.layer, "HTTP", "form ditemukan di HTML statis → layer HTTP");
    assertEq(r1.detected.usernameField, "UserName", "username terdeteksi");
    assertEq(r1.detected.passwordField, "Password", "password terdeteksi");
    assertEq(renderCalls, 0, "render TIDAK dipanggil saat lapis 1 berhasil");

    // Lapis 1 gagal + render berhasil → layer BROWSER
    const deps2: LadderDeps = {
        fetchPage: async () => fakePage(`<html><body><div id="root"></div></body></html>`),
        render: async () => ({
            html: `<html><body><form><input name="email"><input name="passwd" type="password"></form></body></html>`,
        }),
    };
    const r2 = await detectWithLadder("https://spa.app", deps2);
    assertEq(r2.layer, "BROWSER", "HTML statis tanpa form + render ada form → layer BROWSER");
    assertEq(r2.detected.passwordField, "passwd", "field dari hasil render");

    // Lapis 1 gagal + render null (layanan mati) → layer HTTP + note degradasi jujur
    const deps3: LadderDeps = {
        fetchPage: async () => fakePage(`<html><body><p>JS only</p></body></html>`),
        render: async () => null,
    };
    const r3 = await detectWithLadder("https://spa.app", deps3);
    assertEq(r3.layer, "HTTP", "layanan render mati → tetap layer HTTP");
    assertEq(r3.detected.passwordField, null, "tanpa render, form SPA tidak ditemukan");
    assertEq(r3.layerNotes.some((n) => /tidak tersedia/i.test(n)), true, "note degradasi jujur ada");

    console.log("=== ALL PASS ===");
}
main().catch((e) => { console.error("THROWN:", e.message); process.exitCode = 1; });