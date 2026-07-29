/**
 * Diagnostic v2: replay Oracle EBS login sesuai login.js submitCredentials() + call().
 * Oracle login = XHR POST ke /OA_HTML/AppsLocalLogin.jsp dengan header X-Service: AuthenticateUser,
 * response JSON (bukan form POST, bukan redirect).
 *
 * Usage (PowerShell):
 *   $env:DR_LOGIN_URL="https://appsprod.santos.co.id:4443/OA_HTML/AppsLocalLogin.jsp"
 *   $env:DR_USERNAME="..."; $env:DR_PASSWORD="..."
 *   npx tsx scripts/diag-reroute.ts xhr
 */
import "dotenv/config";

const LOGIN_URL = process.env.DR_LOGIN_URL!;
const USERNAME = process.env.DR_USERNAME!;
const PASSWORD = process.env.DR_PASSWORD!;
let EXTRA: Record<string, string> = {};
try { if (process.env.DR_EXTRA) EXTRA = JSON.parse(process.env.DR_EXTRA); } catch {}

if (!LOGIN_URL || !USERNAME || !PASSWORD) {
    console.error("Set DR_LOGIN_URL, DR_USERNAME, DR_PASSWORD (optional DR_EXTRA)");
    process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const mode = process.argv[2] || "xhr";
const ORIGIN = new URL(LOGIN_URL).origin;

async function main() {
    console.log("=== MODE:", mode, "===");

    // Build params EXACTLY like submitCredentials():
    //   username=...&password=...&_lAccessibility=...&displayLangCode=...
    const params = new URLSearchParams();
    params.append("username", USERNAME);
    params.append("password", PASSWORD);
    const defaults: Record<string, string> = { _lAccessibility: "N", displayLangCode: "US", ...EXTRA };
    for (const [k, v] of Object.entries(defaults)) params.append(k, v);

    const body = params.toString();
    console.log("POST URL:", LOGIN_URL);
    console.log("X-Service:", "AuthenticateUser");
    console.log("body:", body.replace(/password=[^&]*/, "password=***"));

    const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Service": "AuthenticateUser",
            Origin: ORIGIN,
            Referer: LOGIN_URL,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        body,
        redirect: "manual",
    });

    console.log("\n=== RESPONSE ===");
    console.log("status:", res.status);
    console.log("content-type:", res.headers.get("content-type"));
    let sc: string[] = [];
    if (typeof res.headers.getSetCookie === "function") sc = res.headers.getSetCookie().map((c: string) => c.split(";")[0]);
    console.log("set-cookie:", sc);
    const text = await res.text();
    console.log("body (first 2000):", text.slice(0, 2000));
    console.log("body length:", text.length);

    // Parse JSON like login.js does
    let parsed: any = null;
    try {
        const cleaned = text.replace(/[\n\r\t\s]/g, "").replace(/,}/g, "}");
        parsed = JSON.parse(cleaned);
    } catch (e) {
        console.log("\nJSON parse failed:", (e as Error).message);
    }

    console.log("\n=== VERDICT ===");
    if (parsed) {
        console.log("parsed:", JSON.stringify(parsed, null, 2));
        if (parsed.status === "failed") {
            console.log("FAIL: Oracle rejected creds. errorCode:", parsed.errorCode, "popup:", parsed.popup);
        } else {
            console.log("SUCCESS: authenticated. redirect url:", parsed.url);
        }
    } else {
        console.log("No JSON => not AuthenticateUser response. Check headers/endpoint.");
    }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
