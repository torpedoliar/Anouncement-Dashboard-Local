/**
 * Self-check untuk lib/portal-fingerprint.ts (tanpa DB, tanpa jaringan).
 * Run: npx tsx scripts/test-fingerprint.ts
 */
import { computeLoginFingerprint } from "../lib/portal-fingerprint";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const base = {
    loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login?wct=20260821T100000",
    usernameField: "UserName",
    passwordField: "Password",
    extraFieldNames: ["__RequestVerificationToken", "wa"],
};

const fp = computeLoginFingerprint(base);
assertEq(fp.length, 64, "output SHA-256 hex 64 char");
assertEq(computeLoginFingerprint(base), fp, "deterministik");

// Nilai token & query TIDAK boleh mengubah fingerprint
assertEq(
    computeLoginFingerprint({ ...base, loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login?wct=999999" }),
    fp,
    "query berbeda (wct) → fingerprint sama"
);
assertEq(
    computeLoginFingerprint({ ...base, extraFieldNames: ["wa", "__RequestVerificationToken"] }),
    fp,
    "urutan extraFieldNames tidak penting"
);

// Perubahan struktur HARUS mengubah fingerprint
assertEq(
    computeLoginFingerprint({ ...base, usernameField: "user_id" }) !== fp,
    true,
    "nama username berubah → fingerprint berubah"
);
assertEq(
    computeLoginFingerprint({ ...base, passwordField: "pass" }) !== fp,
    true,
    "nama password berubah → fingerprint berubah"
);
assertEq(
    computeLoginFingerprint({ ...base, extraFieldNames: ["__RequestVerificationToken"] }) !== fp,
    true,
    "token hilang → fingerprint berubah"
);
assertEq(
    computeLoginFingerprint({ ...base, loginUrl: "https://k2prodapp/Other/Login" }) !== fp,
    true,
    "path berubah → fingerprint berubah"
);

console.log("=== ALL PASS ===");
