/**
 * Self-check untuk lib/portal-sso-mode.ts (tanpa DB, tanpa jaringan).
 * Run: npx tsx scripts/test-sso-mode.ts
 *
 * Kasus diambil dari bukti NYATA k2prodapp: token antiforgery terikat cookie
 * (`__RequestVerificationToken_L0lkZW50aXR5...`) → POST; form polos → FORM.
 */
import { adoptRememberedConfig, classifySsoMode, type ModeEvidence } from "../lib/portal-sso-mode";
import { looksLikeClientRenderedApp } from "../lib/portal-sso-relay";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

function base(): ModeEvidence {
    return {
        html: `<form method="post"><input name="UserName" type="text"><input name="Password" type="password"></form>`,
        finalUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login",
        hopChain: ["https://k2prodapp", "https://k2prodapp/Runtime/Runtime/Form/BPM"],
        cookieNames: [],
        detected: {
            usernameField: "UserName",
            passwordField: "Password",
            httpMethod: "POST",
            extraFields: { __RequestVerificationToken: "abc" },
        },
        redirected: true,
        loopDetected: false,
    };
}

// K2: token antiforgery + cookie pasangan → POST (bukan VAULT, bukan FORM)
{
    const b = base();
    b.cookieNames = ["AspxAutoDetectCookieSupport", "__RequestVerificationToken_L0lkZW50aXR5L1NUUy9Gb3Jtcw2"];
    const v = classifySsoMode(b);
    assertEq(v.mode, "POST", "K2 cookie-paired token → POST");
    assertEq(v.warnings.length > 0, true, "K2 warning: FORM pasti ditolak");
}

// Form polos tanpa token → FORM
{
    const b = base();
    b.detected.extraFields = {};
    b.redirected = false; // tanpa pengalihan → tidak ada warning lateral
    const v = classifySsoMode(b);
    assertEq(v.mode, "FORM", "polos tanpa token → FORM");
    assertEq(v.warnings.length, 0, "polos tanpa token → tanpa warning");
}

// Token dinamis tanpa cookie pasangan → FORM + warning refresh
{
    const b = base();
    b.detected.extraFields = { __VIEWSTATE: "x" };
    const v = classifySsoMode(b);
    assertEq(v.mode, "FORM", "volatile token tanpa cookie → FORM");
    assertEq(v.warnings.length > 0, true, "volatile token → warning refresh");
}

// Tidak ada password field → VAULT (tapi alasan bisa spesifik)
{
    const b = base();
    b.detected.passwordField = null;
    b.detected.usernameField = null;
    assertEq(classifySsoMode(b).mode, "VAULT", "tanpa form → VAULT");
}

// Client-rendered app tanpa form → VAULT dengan sinyal JS
{
    const b = base();
    b.detected.passwordField = null;
    b.detected.usernameField = null;
    b.html = `<html><head><script src="/app.js"></script><script src="/2.js"></script><script src="/3.js"></script></head><body><div id="root"></div></body></html>`;
    const v = classifySsoMode(b);
    assertEq(v.mode, "VAULT", "SPA tanpa form → VAULT");
    assertEq(v.signals.some((s) => /JavaScript|dirakit/i.test(s)), true, "SPA memberi sinyal client-render");
}

// Vite/React production shell target 192.168.2.3: satu module script + modulepreload,
// bukan tiga script tag. Tetap harus dikenali sebagai SPA agar OpenAPI probe berjalan.
{
    const viteShell = `<html><head><script type="module" crossorigin src="/assets/index.js"></script><link rel="modulepreload" href="/assets/react.js"></head><body><div id="root"></div></body></html>`;
    assertEq(looksLikeClientRenderedApp(viteShell), true, "Vite shell dengan satu module script → SPA");
}

// Oracle EBS → REROUTE
{
    const b = base();
    b.html = `<script>function submitCredentials(){var f=document.getElementById('login');...AppsLocalLogin}`;
    b.finalUrl = "https://appsprod.local:8000/OA_HTML/AppsLocalLogin.jsp";
    assertEq(classifySsoMode(b).mode, "REROUTE", "Oracle EBS → REROUTE");
}

// Federasi dalam chain tapi form polos ditemukan → POST (rantai diikuti server)
{
    const b = base();
    b.hopChain = ["https://k2prodapp", "https://k2prodapp/Identity/sts/Forms/wsfed?wa=wsignin1.0"];
    b.detected.extraFields = {};
    const v = classifySsoMode(b);
    assertEq(v.mode, "POST", "chain federasi + form → POST");
}

// Koreksi admin tersimpan menang atas VAULT "tidak ada password field"
{
    const b = base();
    b.detected.passwordField = null;
    b.detected.usernameField = "email";
    b.detected.multiStep = true;
    const v = classifySsoMode(b);
    assertEq(v.mode, "VAULT", "tanpa password field → VAULT sebelum memori");
    const remembered = { usernameField: "email", passwordField: "pwd", httpMethod: "POST", ssoMode: "POST" };
    assertEq(adoptRememberedConfig(b.detected, v, remembered, "koreksi"), true, "koreksi diadopsi");
    assertEq([v.mode, b.detected.passwordField, b.detected.multiStep], ["POST", "pwd", false], "mode & field dari koreksi");
    assertEq(adoptRememberedConfig(b.detected, v, remembered, "koreksi"), false, "tidak menimpa field yang sudah ada");
    const b2 = base();
    b2.detected.passwordField = null;
    assertEq(adoptRememberedConfig(b2.detected, classifySsoMode(b2), { usernameField: "u", passwordField: null, httpMethod: null, ssoMode: "VAULT" }, "x"), false, "koreksi tanpa password tidak diadopsi");
}

console.log("=== ALL PASS ===");
