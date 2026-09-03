const MAX_CLIENT_ROUTE_LENGTH = 160;

// Fragment query values can carry OAuth/SAML codes or tokens. The detector may
// recognize the route, but it must never persist those values in a profile.
const SENSITIVE_FRAGMENT_PARAMETER_RE = /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|samlresponse|samlrequest|wresult|jwt|password|passwd|secret|token|code|state)\s*=/i;
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f]/;

/** Normalize a route path after the hash has already been removed. */
export function normalizeClientRoute(rawRoute: string | null | undefined): string | null {
    if (!rawRoute) return null;
    const route = rawRoute.trim();
    if (!route || route.length > MAX_CLIENT_ROUTE_LENGTH || CONTROL_CHARACTER_RE.test(route)) return null;
    if (SENSITIVE_FRAGMENT_PARAMETER_RE.test(route)) return null;

    const routePart = route.split(/[?#]/, 1)[0].trim().replace(/^!+/, "");
    if (!routePart || routePart.startsWith("//") || /[<>"'\s]/.test(routePart)) return null;

    const normalized = routePart.startsWith("/") ? routePart : `/${routePart}`;
    const collapsed = normalized.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return collapsed.length <= MAX_CLIENT_ROUTE_LENGTH ? collapsed : null;
}

/**
 * Return only the path-like part of a client-side hash route.
 *
 * Examples:
 *   #/signin             -> /signin
 *   #!/auth/login        -> /auth/login
 *   #signin              -> /signin
 *   #/signin?next=/home  -> /signin
 *
 * Query/fragment values are intentionally discarded. Sensitive callback
 * fragments are rejected rather than partially normalized.
 */
export function clientRouteFromUrl(rawUrl: string | null | undefined): string | null {
    if (!rawUrl) return null;

    try {
        return normalizeClientRoute(new URL(rawUrl).hash.slice(1));
    } catch {
        return null;
    }
}

export function hasClientRoute(rawUrl: string | null | undefined): boolean {
    if (!rawUrl) return false;
    try {
        return Boolean(new URL(rawUrl).hash.slice(1).trim());
    } catch {
        return false;
    }
}

export function hasUnsafeClientRoute(rawUrl: string | null | undefined): boolean {
    return hasClientRoute(rawUrl) && clientRouteFromUrl(rawUrl) === null;
}
