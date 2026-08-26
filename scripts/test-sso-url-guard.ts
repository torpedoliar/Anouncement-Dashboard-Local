/**
 * Self-check assertSafeHttpUrl — validator URL pusat SSO (QA AC-2 bagian 3,
 * tabel kasus sso-modes-qa-plan.md). Run: npx tsx scripts/test-sso-url-guard.ts
 * Tanpa jaringan, tanpa DB.
 */
import { assertSafeHttpUrl } from "../lib/portal-url-guard";

function expectAccept(raw: string, label: string) {
    const res = assertSafeHttpUrl(raw);
    const ok = res.ok === true;
    console.log(`${ok ? "PASS" : "FAIL"} | ACCEPT | ${label}${ok ? "" : ` | got=${JSON.stringify(res)}`}`);
    if (!ok) process.exitCode = 1;
}

function expectReject(raw: string, label: string, want?: string) {
    const res = assertSafeHttpUrl(raw);
    const ok = res.ok === false && (want === undefined || (res as { error: string }).error === want);
    console.log(`${ok ? "PASS" : "FAIL"} | REJECT | ${label}${ok ? "" : ` | got=${JSON.stringify(res)}`}`);
    if (!ok) process.exitCode = 1;
}

// --- ACCEPT ---
expectAccept("https://intranet-wia.santos.co.id/login", "URL https normal");
expectAccept("http://intranet-wia.santos.co.id/", "skema http diizinkan (pinning host yang menjaga)");
expectAccept("https://intranet.santos.co.id/app?a=b#x", "query/fragment harmless");
expectAccept("https://xn--mnchen-3ya.de/", "IDN sudah berbentuk punycode");

// --- REJECT: skema non-http(s) ---
expectReject("javascript:alert(1)", "javascript:", "scheme_not_allowed");
expectReject("data:text/html;base64,PHNjcmlwdD4=", "data:", "scheme_not_allowed");
expectReject("file:///etc/passwd", "file:", "scheme_not_allowed");

// --- REJECT: trik authority ---
expectReject("https://app.santos.co.id@evil.com/", "userinfo menyembunyikan host", "userinfo_forbidden");
expectReject("https://user:pass@host.example/", "userinfo dengan password", "userinfo_forbidden");
expectReject("https://evil.com\\@santos.co.id/", "backslash spoof authority", "invalid_url");

// --- REJECT: host metadata/non-routable (selaras blocklist portal-fetch-html) ---
expectReject("http://169.254.169.254/latest/meta-data/", "AWS metadata", "blocked_host");
expectReject("http://0.0.0.0/", "host all-zeros", "blocked_host");
expectReject("http://metadata.google.internal/", "GCP metadata", "blocked_host");

// --- REJECT: bentuk rusak ---
expectReject("not a url at all", "bukan URL", "invalid_url");

// --- Normalisasi IDN → ASCII (QA AC-2: "ACCEPT hanya setelah normalisasi exact-match").
// Dengan ICU, URL parser menormalkan münchen.de → xn--mnchen-3ya.de sebelum guard
// membandingkan; runtime tanpa ICU jatuh ke cabang invalid_url di guard (fail-closed).
const idnRaw = assertSafeHttpUrl("https://münchen.de/");
const idnUpper = assertSafeHttpUrl("https://XN--MNCHEN-3YA.de/");
const idnOk =
    ((idnRaw.ok && idnRaw.host === "xn--mnchen-3ya.de") ||
        (!idnRaw.ok && idnRaw.error === "invalid_url")) &&
    idnUpper.ok && idnUpper.host === "xn--mnchen-3ya.de";
console.log(
    `${idnOk ? "PASS" : "FAIL"} | NORMALIZE | IDN → punycode lowercase | raw=${JSON.stringify(idnRaw)} upper=${JSON.stringify(idnUpper)}`
);
if (!idnOk) process.exitCode = 1;

// Pinning F-1 memakai authority (host + port non-default)
const pinned = assertSafeHttpUrl("https://intranet.santos.co.id:8443/");
console.log(
    `${pinned.ok && pinned.authority === "intranet.santos.co.id:8443" ? "PASS" : "FAIL"} | PIN | authority membawa port non-default | got=${pinned.ok ? pinned.authority : JSON.stringify(pinned)}`
);
if (!pinned.ok || pinned.authority !== "intranet.santos.co.id:8443") process.exitCode = 1;

if (process.exitCode !== 1) console.log("=== ALL PASS ===");
