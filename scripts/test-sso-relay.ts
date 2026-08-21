/**
 * Self-check untuk lib/portal-sso-relay.ts (tanpa DB, tanpa jaringan).
 * Run: npx tsx scripts/test-sso-relay.ts
 *
 * Kasus dipakai dari chains NYATA yang sudah teramati lewat probe ke k2prodapp:
 * sukses (guest/sja123) vs gagal (kredensial sapa) — bukan dari tebakan.
 */
import {
    classifyRedirect,
    findFederationAutoPost,
    stillOnLoginForm,
    sharedCookieDomain,
} from "../lib/portal-sso-relay";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

// --- klasifikasi tujuan pengalihan ---

// Sukses K2 teramati: 302 → /Identity/sts/Forms/wsfed?wa=wsignin1.0&wtrealm=...&wctx=...
assertEq(classifyRedirect("https://k2prodapp/Identity/sts/Forms/wsfed?wa=wsignin1.0&wtrealm=https%3a%2f%2fk2prodapp%2fRuntime%2f&wctx=rm%3d1"), "FEDERATION_STEP", "K2 success wsfed = federation step");

// Sukses K2 hop 2: RP serahkan form auto-POST dengan action direk /Runtime/
assertEq(classifyRedirect("https://k2prodapp/Runtime/"), "NEUTRAL", "K2 RP root = neutral");
assertEq(classifyRedirect("https://k2prodapp/Runtime/Runtime/Form/BPM"), "NEUTRAL", "K2 BPM app path = neutral");

// Gagal K2 teramati (probe kredensial sapa): 302 → /Identity/STS/Forms/Error?error=...
assertEq(classifyRedirect("https://k2prodapp/Identity/STS/Forms/Error?error=V9V4G6..."), "REJECTED", "K2 /Error?error= = rejected");
assertEq(classifyRedirect("https://k2prodapp/Identity/STS/Forms/Error.aspx?error=x"), "REJECTED", "Error.aspx = rejected");
assertEq(classifyRedirect("https://k2prodapp/Identity/STS/Forms/AccessDenied"), "REJECTED", "AccessDenied = rejected");

// Query yang memuat "Error" TIDAK boleh menolak — ini yang melindungi langkah sukses.
assertEq(classifyRedirect("https://x/Identity/sts/Forms/wresult?saml=Error&wctx=x"), "NEUTRAL", "query baring Error tidak menolak");
assertEq(classifyRedirect("https://x/Identity/Forms/Login?ReturnUrl=Error"), "NEUTRAL", "path ta Login, query baring Error = neutral");

// Bedakan sukses vs gagal memakai segment path, bukan prefix prefix di /Identity/
assertEq(classifyRedirect("https://k2prodapp/Identity/sts/Forms/wsfed?wa=wstmtin1.0"), "FEDERATION_STEP", "wsfed path (even broken query) = federation");

// --- deteksi form federasi (HTML nyata disimplificat) ---

// Posisi sukses K2 (action=Runtime/, field wresult 7kb) → form federasi ditemukan
const k2SuccessHtml = `<!doctype html><html><body><h1>Sign in complete</h1>
<form method="post" action="https://k2prodapp/Runtime/">
    <input type="hidden" name="wa" value="wsignin1.0"/><input type="hidden" name="wresult" value="<samltoken:long>"/><input type="hidden" name="wctx" value="rm=1&id=k2passive&ru=_trust%2fspauthorize.aspx"/>
    <noscript><button type="submit">Continue</button></noscript>
</form><script>document.forms[0].submit();</script></html>`;
const f1 = findFederationAutoPost(k2SuccessHtml, "https://k2prodapp/");
assertEq(f1 !== null, true, "K2 success HTML = federation form found");
assertEq(f1?.action, "https://k2prodapp/Runtime/", "form-found action = wreply target");
assertEq(f1?.fields.wa, "wsignin1.0", "wresult form carries wa");
assertEq(("wresult" in (f1?.fields ?? {})), true, "wresult field present");
assertEq(("wctx" in (f1?.fields ?? {})), true, "wctx field present");

// Tanpa form federasi → null
assertEq(findFederationAutoPost(`<form><input name="username"><input name="password"></form>`, "https://x/"), null, "plain login form not federation");
assertEq(findFederationAutoPost("", "https://x/"), null, "empty html not federation");
assertEq(findFederationAutoPost(`<form action="/Runtime/"><input name="wctx"></form>`, "https://x/"), null, "form berisi wctx saja not federation");

// --- stillOnLoginForm ---
assertEq(stillOnLoginForm(`<input type="text" name="UserName"><input type="password" name="Password">`), true, "password input = still login form");
assertEq(stillOnLoginForm(`<input type="text" name="UserName">`), false, "no password input = not login form");

console.log("=== ALL PASS ===");