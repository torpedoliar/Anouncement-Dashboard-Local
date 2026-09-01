/**
 * Self-check deteksi v2 + dispatcher verify-login.
 *
 * Run: npx tsx scripts/test-detect-verify-v2.ts
 * Tanpa jaringan, tanpa DB.
 *
 * Mencakup 8 AC dari .planning/phases/detect-verify-v2.md §7 sejauh yang bisa
 * diuji tanpa target hidup. Pemeriksaan 100% cocok bila semua assertion PASS.
 */
import { extractContracts } from "../lib/portal-api-probe";
import { VOLATILE_RE } from "../lib/portal-fetch-html";
import { verifyLoginSchema } from "../lib/validation-schemas";

let failed = 0;
function expect(label: string, cond: boolean, detail?: unknown) {
    const tag = cond ? "PASS" : "FAIL";
    if (!cond) failed++;
    console.log(`${tag} | ${label}${cond ? "" : ` | ${JSON.stringify(detail)}`}`);
}

// ─── AC #4 — OpenAPI extraction (probe menemukan POST {username,password}) ──
const goodSpec = {
    openapi: "3.0.0",
    paths: {
        "/api/v1/auth/login": {
            post: {
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: { username: { type: "string" }, password: { type: "string" } },
                            },
                        },
                    },
                },
            },
        },
        "/api/v1/users": {
            post: {
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } },
                },
            },
        },
    },
};
const goodContracts = extractContracts(goodSpec);
expect(
    "AC#4: OpenAPI probe mengekstrak POST dengan {username,password}",
    goodContracts.length === 1 && goodContracts[0].path === "/api/v1/auth/login" && goodContracts[0].params.includes("username") && goodContracts[0].params.includes("password"),
    goodContracts
);

// AC #4 negatif: spec tanpa {username,password}
const badSpec = {
    openapi: "3.0.0",
    paths: { "/api/v1/orders": { post: { requestBody: { content: { "application/json": { schema: { type: "object", properties: { sku: {}, qty: {} } } } } } } } },
};
expect("AC#4: spec tanpa {username,password} → contracts kosong", extractContracts(badSpec).length === 0);

// AC #4 Swagger 2.0 fallback — gunakan nama field realistis (whole-token).
const swaggerSpec = {
    swagger: "2.0",
    paths: { "/auth/token": { post: { parameters: [{ name: "username", in: "formData" }, { name: "password", in: "formData" }] } } },
};
const swaggerContracts = extractContracts(swaggerSpec);
expect(
    "AC#4: Swagger 2.0 parameters diekstrak (username + password)",
    swaggerContracts.length === 1 && swaggerContracts[0].path === "/auth/token",
    swaggerContracts
);

// AC #4 negative: field yang bukan kredensial tidak boleh false-positive
const trickySpec = {
    openapi: "3.0.0",
    paths: {
        "/login": {
            post: {
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { confirmation_code: { type: "string" } } } } },
                },
            },
        },
    },
};
expect("AC#4: field confirmation_code saja TIDAK dianggap password", extractContracts(trickySpec).length === 0);

// Target 192.168.2.3/NCM: FastAPI menaruh LoginRequest di components dan operasi
// hanya menyimpan `$ref`. Probe harus mengikuti referensi lokal ini.
const referencedSpec = {
    openapi: "3.1.0",
    paths: {
        "/api/v1/auth/login": {
            post: {
                requestBody: {
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/LoginRequest" },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            LoginRequest: {
                type: "object",
                properties: { username: { type: "string" }, password: { type: "string" } },
                required: ["username", "password"],
            },
        },
    },
};
const referencedContracts = extractContracts(referencedSpec);
expect(
    "AC#4: OpenAPI 3.1 `$ref` LoginRequest ter-resolve",
    referencedContracts.length === 1 &&
        referencedContracts[0].path === "/api/v1/auth/login" &&
        JSON.stringify(referencedContracts[0].params) === JSON.stringify(["username", "password"]),
    referencedContracts
);

// Composition refs yang umum pada schema enterprise.
const composedSpec = {
    openapi: "3.0.0",
    paths: {
        "/auth": {
            post: {
                requestBody: {
                    content: {
                        "application/problem+json": {
                            schema: { allOf: [{ $ref: "#/components/schemas/UserPart" }, { $ref: "#/components/schemas/PasswordPart" }] },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            UserPart: { properties: { user_id: { type: "string" } } },
            PasswordPart: { properties: { passcode: { type: "string" } } },
        },
    },
};
expect("AC#4: allOf + application/*+json ter-resolve", extractContracts(composedSpec).length === 1);

// AC #4 input rusak
expect("AC#4: spec null → []", extractContracts(null).length === 0);
expect("AC#4: spec bukan object → []", extractContracts("string").length === 0);

// ─── AC #5 — JSON path harus absolut di origin ──────────────────────────────
const validSchema = verifyLoginSchema.safeParse({
    url: "https://app.example.com/login",
    ssoMode: "VAULT",
    httpMethod: "POST",
    usernameField: "username",
    passwordField: "password",
    testUsername: "u",
    testPassword: "p",
    jsonApi: { path: "/api/v1/auth/login" },
});
expect("schema: jsonApi absolut (awalan /) diterima", validSchema.success);

const invalidSchema = verifyLoginSchema.safeParse({
    url: "https://app.example.com/login",
    ssoMode: "VAULT",
    usernameField: "username",
    passwordField: "password",
    testUsername: "u",
    testPassword: "p",
    jsonApi: { path: "https://evil.com/api" },
});
expect("schema: jsonApi cross-origin ditolak", !invalidSchema.success);

// ─── AC #1 — payload form lengkap (ssoMode/httpMethod/extraFields) ─────────
const fullPayload = verifyLoginSchema.safeParse({
    url: "https://app.example.com/login",
    ssoMode: "REROUTE",
    httpMethod: "POST",
    usernameField: "txtUser",
    passwordField: "txtPassword",
    extraFields: { login: "submit" },
    testUsername: "u",
    testPassword: "p",
});
expect("AC#1: payload form lengkap (ssoMode=REROUTE + httpMethod + extraFields) diterima", fullPayload.success);

// extraFields tidak boleh menyisipkan token volatil — ini tanggung jawab runtime
// (refreshVolatileFields), tapi schema tidak menolak karena itu dilakukan server.
const withVolatile = verifyLoginSchema.safeParse({
    url: "https://app.example.com",
    usernameField: "u",
    passwordField: "p",
    testUsername: "u",
    testPassword: "p",
    extraFields: { __RequestVerificationToken: "xxx" },
});
expect("AC#4-rule: extraFields boleh memuat token volatil (diabaikan saat runtime)", withVolatile.success);

// ─── Volatile regex — name-nama yang harus di-refresh saat runtime ──────────
for (const k of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "__RequestVerificationToken", "_csrf", "csrf_token", "csrfmiddlewaretoken", "authenticity_token"]) {
    expect(`VOLATILE_RE: ${k} terdeteksi`, VOLATILE_RE.test(k));
}
for (const k of ["login", "submit", "txtUser", "remember_me"]) {
    expect(`VOLATILE_RE: ${k} TIDAK dianggap volatil`, !VOLATILE_RE.test(k));
}

// ─── AC #3 — default httpMethod POST + default ssoMode FORM ────────────────
const minimalPayload = verifyLoginSchema.safeParse({
    url: "https://app.example.com/login",
    testUsername: "u",
    testPassword: "p",
});
expect("AC#3: ssoMode default FORM, httpMethod default POST", minimalPayload.success && minimalPayload.data?.ssoMode === "FORM" && minimalPayload.data?.httpMethod === "POST");

if (failed > 0) {
    console.log(`=== ${failed} FAILED ===`);
    process.exitCode = 1;
} else {
    console.log("=== ALL PASS ===");
}
