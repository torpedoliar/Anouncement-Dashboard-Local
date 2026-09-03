import { createHash } from "crypto";
import { clientRouteFromUrl, normalizeClientRoute } from "@/lib/portal-client-route";

/**
 * Versi snapshot yang menentukan apakah dua struktur rute login setara.
 * Nilai query, fragment, token, cookie, HTML mentah, dan kredensial sengaja
 * tidak pernah menjadi bagian dari payload.
 */
export const LOGIN_FINGERPRINT_VERSION = "login-route/v2";

export interface LoginFingerprintApiContract {
    method: string;
    path: string;
    params: readonly string[];
}

export interface LoginFingerprintInput {
    /** URL entrypoint lama; dipertahankan agar pemanggil legacy tetap eksplisit. */
    loginUrl?: string | null;
    origin?: string | null;
    entryPath?: string | null;
    clientRoute?: string | null;
    finalPath?: string | null;
    formActionPath?: string | null;
    recommendedMode?: string | null;
    httpMethod?: string | null;
    usernameField?: string | null;
    passwordField?: string | null;
    extraFieldNames?: readonly string[] | null;
    apiContracts?: readonly LoginFingerprintApiContract[] | null;
}

export interface LoginFingerprintSnapshot {
    version: typeof LOGIN_FINGERPRINT_VERSION;
    origin: string;
    entryPath: string;
    clientRoute?: string;
    finalPath: string | null;
    formActionPath: string | null;
    recommendedMode: string | null;
    httpMethod: string | null;
    usernameField: string;
    passwordField: string;
    extraFieldNames: string[];
    apiContracts: Array<{ method: string; path: string; params: string[] }>;
}

function normalizePathname(pathname: string): string {
    const normalized = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
    return normalized || "/";
}

function normalizeOrigin(value: string | null | undefined): string {
    if (!value) return "";
    try {
        const url = new URL(value);
        return url.origin.toLowerCase();
    } catch {
        return value.trim().replace(/\/$/, "").toLowerCase();
    }
}

function pathnameFrom(value: string | null | undefined): string {
    if (!value) return "/";
    try {
        return normalizePathname(new URL(value).pathname);
    } catch {
        const withoutQueryOrFragment = value.split(/[?#]/, 1)[0].trim();
        return normalizePathname(withoutQueryOrFragment.startsWith("/") ? withoutQueryOrFragment : `/${withoutQueryOrFragment}`);
    }
}

/**
 * Route lintas-origin tetap membawa origin-nya sendiri; route same-origin cukup
 * disimpan sebagai pathname karena snapshot telah memiliki origin utama.
 */
function normalizeRoute(value: string | null | undefined, origin: string): string | null {
    if (!value) return null;
    try {
        const url = new URL(value, origin || "http://portal-profile.invalid");
        const path = normalizePathname(url.pathname);
        return url.origin.toLowerCase() === origin ? path : `${url.origin.toLowerCase()}${path}`;
    } catch {
        return pathnameFrom(value);
    }
}

function normalizedStrings(values: readonly string[] | null | undefined): string[] {
    return Array.from(new Set(
        (values ?? [])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean),
    )).sort();
}

function normalizeContracts(
    contracts: readonly LoginFingerprintApiContract[] | null | undefined,
    origin: string,
): Array<{ method: string; path: string; params: string[] }> {
    const normalized = (contracts ?? [])
        .filter((contract) => contract && typeof contract.path === "string" && typeof contract.method === "string")
        .map((contract) => ({
            method: contract.method.toUpperCase(),
            path: normalizeRoute(contract.path, origin) ?? "/",
            params: normalizedStrings(contract.params),
        }));

    const deduplicated = new Map<string, { method: string; path: string; params: string[] }>();
    for (const contract of normalized) {
        deduplicated.set(`${contract.method}\u0000${contract.path}\u0000${contract.params.join("\u0000")}`, contract);
    }

    return Array.from(deduplicated.values()).sort((left, right) => {
        const leftKey = `${left.method}\u0000${left.path}\u0000${left.params.join("\u0000")}`;
        const rightKey = `${right.method}\u0000${right.path}\u0000${right.params.join("\u0000")}`;
        return leftKey.localeCompare(rightKey);
    });
}

/**
 * Bentuk snapshot yang stabil sebelum di-hash. Fungsi ini berguna untuk semua
 * pemanggil agar tidak ada lagi fingerprint parsial dengan aturan berbeda.
 */
export function buildLoginFingerprintSnapshot(input: LoginFingerprintInput): LoginFingerprintSnapshot {
    const urlOrigin = input.loginUrl ? normalizeOrigin(input.loginUrl) : "";
    const origin = normalizeOrigin(input.origin) || urlOrigin;
    const entryPath = pathnameFrom(input.entryPath ?? input.loginUrl);

    const snapshot: LoginFingerprintSnapshot = {
        version: LOGIN_FINGERPRINT_VERSION,
        origin,
        entryPath,
        finalPath: normalizeRoute(input.finalPath, origin),
        formActionPath: normalizeRoute(input.formActionPath, origin),
        recommendedMode: input.recommendedMode?.trim().toUpperCase() || null,
        httpMethod: input.httpMethod?.trim().toUpperCase() || null,
        usernameField: input.usernameField?.trim() ?? "",
        passwordField: input.passwordField?.trim() ?? "",
        extraFieldNames: normalizedStrings(input.extraFieldNames),
        apiContracts: normalizeContracts(input.apiContracts, origin),
    };

    const clientRoute = input.clientRoute
        ? normalizeClientRoute(input.clientRoute)
        : clientRouteFromUrl(input.loginUrl);
    // Preserve the v2 snapshot byte-for-byte for ordinary URLs. Hash routes
    // gain one safe, path-only field so #/signin cannot collide with /.
    if (clientRoute) snapshot.clientRoute = clientRoute;
    return snapshot;
}

/** Hash SHA-256 dari snapshot rute login non-secret yang kanonis. */
export function computeLoginFingerprint(input: LoginFingerprintInput): string {
    const snapshot = buildLoginFingerprintSnapshot(input);
    return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}
/**
 * Compatibility hash for PortalApp.detectedFingerprint values written before
 * login-route/v2. Health checks use it once to avoid falsely flagging existing
 * unbound apps, then migrate a matching legacy value to the canonical snapshot.
 */
export function computeLegacyLoginFingerprint(input: {
    loginUrl: string;
    usernameField: string;
    passwordField: string;
    extraFieldNames: readonly string[];
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