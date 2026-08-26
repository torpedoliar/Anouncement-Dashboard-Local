/**
 * Validator URL pusat untuk semua target SSO (threat model sso-modes-threat-model.md §1b.1).
 *
 * `z.string().url()` menerima skema apa pun yang lolos `new URL()` — termasuk
 * `javascript:` dan `data:` — serta trik parsing seperti userinfo
 * `https://app.santos.co.id@evil.com`. Semua URL tujuan SSO (config admin maupun
 * jalur launch) wajib melewati guard ini sebelum dipakai.
 *
 * ponytail: murni stdlib (URL global), tanpa dependency.
 */

export interface SafeUrlResult {
    ok: true;
    /** Hostname ASCII lowercase (IDN dinormalisasi oleh URL parser bila ICU tersedia). */
    host: string;
    /** hostname + port non-default (URL.host) — dasar perbandingan exact-match/pin port. */
    authority: string;
    origin: string;
    href: string;
}

export type SafeUrlError =
    | "invalid_url" // tidak bisa di-parse, mengandung backslash, atau hostname non-ASCII (runtime tanpa ICU — gagal tertutup)
    | "scheme_not_allowed" // selain http/https (incl. javascript:, data:)
    | "userinfo_forbidden" // user@host — host asli bisa disembunyikan di belakang @
    | "blocked_host" // host metadata/non-routable yang sama dengan blocklist portal-fetch-html
    | "empty_host";

// Selaras isBlockedHost() lib/portal-fetch-html.ts — host yang tak pernah sah jadi
// tujuan SSO meski skemanya http. Host privat LAN (192.168.x dsb.) TETAP diizinkan:
// lingkungan intranet memang menargetkan host privat (threat model §5 residual).
const BLOCKED_HOSTS = new Set(["0.0.0.0", "169.254.169.254", "metadata.google.internal"]);

function safeNewUrl(raw: string): URL | null {
    try {
        return new URL(raw);
    } catch {
        return null;
    }
}

/**
 * Validasi satu URL sebagai target SSO http(s) yang layak dipercaya portal.
 * Mengembalikan host+origin ternormalisasi, atau alasan penolakan yang stabil
 * (aman ditulis ke audit/error tanpa membocorkan isi URL).
 */
export function assertSafeHttpUrl(raw: string): SafeUrlResult | { ok: false; error: SafeUrlError } {
    const url = safeNewUrl(raw.trim());
    if (!url) return { ok: false, error: "invalid_url" };

    // Backslash (`https://evil.com\@santos.co.id`) — WHATWG parser memperlakukannya
    // sebagai path-separator, browser lama/perpustakaan longgar sebagai bagian authority;
    // bentuk ambigu ini tidak boleh jadi target (QA AC-2).
    if (raw.includes("\\")) return { ok: false, error: "invalid_url" };

    // Skema: hanya http(s). Menutup javascript:/data:/file: yang lolos z.string().url().
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, error: "scheme_not_allowed" };
    }

    // Userinfo (`https://user:pass@host`) — bentuk klasik menyembunyikan host asli.
    if (url.username !== "" || url.password !== "") {
        return { ok: false, error: "userinfo_forbidden" };
    }

    if (!url.hostname) return { ok: false, error: "empty_host" };

    // URL parser menormalkan hostname ke ASCII-lowercase (punycode utk IDN) saat ICU
    // tersedia. Hostname masih memuat non-ASCII berarti runtime tak menormalisasi —
    // tolak daripada membandingkan mentah terhadap allowlist.
    if (/[^\x20-\x7E]/.test(url.hostname)) {
        return { ok: false, error: "invalid_url" };
    }

    if (BLOCKED_HOSTS.has(url.hostname)) {
        return { ok: false, error: "blocked_host" };
    }

    return {
        ok: true,
        host: url.hostname,
        authority: url.host,
        origin: `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`,
        href: url.href,
    };
}
