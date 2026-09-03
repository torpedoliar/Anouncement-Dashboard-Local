/**
 * Self-check untuk lib/portal-fingerprint.ts (tanpa DB, tanpa jaringan).
 * Run: npx tsx scripts/test-fingerprint.ts
 */
import { buildLoginFingerprintSnapshot, computeLoginFingerprint } from "../lib/portal-fingerprint";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const base = {
    loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login?wct=20260821T100000",
    finalPath: "/Identity/STS/Forms/Account/Login",
    formActionPath: "/Identity/STS/Forms/Account/Login",
    recommendedMode: "POST",
    httpMethod: "POST",
    usernameField: "UserName",
    passwordField: "Password",
    extraFieldNames: ["__RequestVerificationToken", "wa"],
    apiContracts: [
        { method: "POST", path: "/api/auth/login", params: ["username", "password"] },
        { method: "POST", path: "/api/token", params: ["client_id", "username", "password"] },
    ],
};

const fp = computeLoginFingerprint(base);
assertEq(fp.length, 64, "output SHA-256 hex 64 char");
assertEq(computeLoginFingerprint(base), fp, "deterministik");

// Query dan nilai token TIDAK boleh mengubah fingerprint; route hash yang aman
// justru harus membedakan halaman login SPA yang berbeda.
assertEq(
    computeLoginFingerprint({ ...base, loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login?wct=999999" }),
    fp,
    "query berbeda → fingerprint sama",
);
const signinFingerprint = computeLoginFingerprint({
    ...base,
    loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login?wct=999999#/signin",
});
assertEq(signinFingerprint !== fp, true, "client route /signin → fingerprint berbeda dari route server");
assertEq(
    computeLoginFingerprint({ ...base, clientRoute: "/signin" }),
    signinFingerprint,
    "clientRoute eksplisit setara dengan hash route",
);
assertEq(
    computeLoginFingerprint({
        ...base,
        loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login#/dashboard",
    }) !== signinFingerprint,
    true,
    "#/signin dan #/dashboard → fingerprint berbeda",
);
const hashQuerySnapshot = buildLoginFingerprintSnapshot({
    ...base,
    loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login#/signin?next=/home",
});
assertEq(hashQuerySnapshot.clientRoute, "/signin", "query hash dibuang dari clientRoute");
const sensitiveHashInput = {
    ...base,
    loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login#access_token=secret",
};
assertEq(buildLoginFingerprintSnapshot(sensitiveHashInput).clientRoute, undefined, "fragment token tidak dipersistenkan");
assertEq(computeLoginFingerprint(sensitiveHashInput), fp, "fragment token tidak mengubah fingerprint");
assertEq(
    computeLoginFingerprint({ ...base, extraFieldNames: ["wa", "__RequestVerificationToken"] }),
    fp,
    "urutan extraFieldNames tidak penting",
);
assertEq(
    computeLoginFingerprint({
        ...base,
        apiContracts: [...base.apiContracts].reverse().map((contract) => ({ ...contract, params: [...contract.params].reverse() })),
    }),
    fp,
    "urutan kontrak dan parameter API tidak penting",
);

const snapshot = buildLoginFingerprintSnapshot(base);
assertEq(snapshot.version, "login-route/v2", "snapshot memakai versi kanonis v2");
assertEq(snapshot.finalPath, "/Identity/STS/Forms/Account/Login", "final path disimpan dalam snapshot");

// Perubahan struktur HARUS mengubah fingerprint
for (const [label, changed] of [
    ["nama username berubah", { usernameField: "user_id" }],
    ["nama password berubah", { passwordField: "pass" }],
    ["token hilang", { extraFieldNames: ["__RequestVerificationToken"] }],
    ["entry path berubah", { loginUrl: "https://k2prodapp/Other/Login" }],
    ["final path berubah", { finalPath: "/Identity/STS/Forms/Changed" }],
    ["form action berubah", { formActionPath: "/Identity/STS/Forms/Submit" }],
    ["mode rekomendasi berubah", { recommendedMode: "FORM" }],
    ["HTTP method berubah", { httpMethod: "GET" }],
    ["method kontrak API berubah", { apiContracts: [{ method: "GET", path: "/api/auth/login", params: ["username", "password"] }] }],
    ["path kontrak API berubah", { apiContracts: [{ method: "POST", path: "/api/auth/session", params: ["username", "password"] }] }],
    ["parameter kontrak API berubah", { apiContracts: [{ method: "POST", path: "/api/auth/login", params: ["email", "password"] }] }],
] as const) {
    assertEq(computeLoginFingerprint({ ...base, ...changed }) !== fp, true, `${label} → fingerprint berubah`);
}

console.log("=== ALL PASS ===");
