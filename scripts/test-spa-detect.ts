/**
 * Self-check deteksi SPA shell + interpretasi bukti endpoint dikenal.
 * Run: npx tsx scripts/test-spa-detect.ts
 *
 * Latar: UniFi OS (AngularJS) gagal dikenali sebagai SPA — HTML statisnya hanya
 * judul + script tanpa div#root, sehingga lapis probe API tidak pernah jalan.
 */
import { looksLikeClientRenderedApp } from "../lib/portal-sso-relay";
import { knownEndpointEvidence } from "../lib/portal-api-probe";

let failed = 0;
function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

// Shell UniFi OS: judul + script AngularJS, tanpa form/input/root id standar.
const unifiShell = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>UniFi OS</title><link rel="stylesheet" href="/angular/app.css">
<script src="/angular/vendor.js"></script><script src="/angular/app.js"></script>
</head><body class="unifi"><div class="page"><div ui-view></div></div></body></html>`;
check(looksLikeClientRenderedApp(unifiShell) === true, "spa: shell UniFi (ui-view) dikenali");

// React shell standar tetap dikenali (regresi).
const reactShell = `<html><body><div id="root"></div><script src="/assets/index-abc.js"></script><script src="/assets/vendor.js"></script><script src="/assets/chunk.js"></script></body></html>`;
check(looksLikeClientRenderedApp(reactShell) === true, "spa: shell React (id=root) tetap dikenali");

// Halaman klasik dengan form login BUKAN SPA.
const classic = `<html><body><form action="/login"><input name="user"><input type="password" name="pass"></form><script src="/app.js"></script></body></html>`;
check(looksLikeClientRenderedApp(classic) === false, "spa: form klasik bukan SPA");

// Halaman error polos tanpa script bukan SPA.
check(looksLikeClientRenderedApp("<html><body><h1>502 Bad Gateway</h1></body></html>") === false, "spa: halaman error tanpa script bukan SPA");

// Bukti endpoint dikenal (GET-only).
check(knownEndpointEvidence(405, "POST, OPTIONS", "") === true, "evidence: 405 + Allow POST");
check(knownEndpointEvidence(405, "GET, HEAD", "") === false, "evidence: 405 tanpa Allow POST ditolak");
check(knownEndpointEvidence(400, null, '{"error":"username is required"}') === true, "evidence: 400 sebut username");
check(knownEndpointEvidence(200, null, '{"ok":true}') === false, "evidence: 200 bukan bukti");
check(knownEndpointEvidence(404, null, "not found") === false, "evidence: 404 bukan bukti");

console.log(failed === 0 ? "\nSemua lolos." : `\n${failed} gagal.`);
if (failed > 0) process.exit(1);
