import { createHash } from "crypto";

/**
 * Fingerprint struktur form login.
 *
 * Nilai token dan query sengaja TIDAK ikut: nilai token berubah tiap akses
 * (K2: __RequestVerificationToken berbeda setiap request), dan query form action
 * K2 memuat timestamp/GUID sesi. Yang ditangkap hanya struktur yang bila berubah
 * akan merusak SSO: nama field, nama token, dan path endpoint login.
 */
export function computeLoginFingerprint(input: {
    loginUrl: string;
    usernameField: string;
    passwordField: string;
    extraFieldNames: string[];
}): string {
    let path: string;
    try {
        path = new URL(input.loginUrl).pathname;
    } catch {
        path = input.loginUrl;
    }
    const payload = [
        path,
        input.usernameField,
        input.passwordField,
        [...input.extraFieldNames].sort().join(","),
    ].join("|");
    return createHash("sha256").update(payload).digest("hex");
}