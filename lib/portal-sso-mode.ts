import type { DetectedFields } from "@/lib/portal-login-detect";
import { looksLikeClientRenderedApp, looksLikeOracleEbs } from "@/lib/portal-sso-relay";

/**
 * Klasifikasi mode SSO berdasarkan BUKTI dari halaman login, bukan tebakan.
 *
 * Sebelumnya semua kegagalan deteksi jatuh ke VAULT, sehingga aplikasi yang sebenarnya
 * bisa di-SSO otomatis (K2, ASP.NET MVC, WebForms) ikut disuruh copy-paste manual.
 * Di sini tiap mode punya syarat yang jelas dan alasan yang bisa dibaca admin.
 */

export type SsoMode = "FORM" | "POST" | "REROUTE" | "VAULT";

export interface ModeEvidence {
    /** HTML halaman final (kosong bila rantai tidak pernah sampai ke halaman). */
    html: string;
    finalUrl: string;
    /** Rantai URL yang dilalui — dipakai mengenali federasi WS-Fed / SAML / OIDC. */
    hopChain?: string[];
    /** Nama cookie yang dipasang server selama rantai. */
    cookieNames: string[];
    detected: DetectedFields;
    redirected: boolean;
    loopDetected: boolean;
}

export interface ModeVerdict {
    mode: SsoMode;
    reason: string;
    /** Sinyal mentah — ditampilkan ke admin agar keputusan bisa diaudit, bukan kotak hitam. */
    signals: string[];
    warnings: string[];
}

/** Field token yang nilainya berubah tiap halaman dibuka. */
const VOLATILE_FIELD_RE =
    /^(?:__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION|__RequestVerificationToken|_csrf|csrf[-_]?token|_token|authenticity_token|csrfmiddlewaretoken)/i;

/** Jejak URL protokol federasi. Login-nya bukan form biasa, tapi rantai token antar-server. */
const FEDERATION_URL_RE =
    /(?:wa=wsignin1\.0|\/wsfed|\/adfs\/ls|SAMLRequest=|\/saml2?\/|\/connect\/authorize|\/oauth2?\/authorize|response_type=)/i;

/**
 * Cookie dianggap "pasangan" token bila namanya diawali nama field token.
 * Contoh K2: field `__RequestVerificationToken`, cookie
 * `__RequestVerificationToken_L0lkZW50aXR5L1NUUy9Gb3Jtcw2`. Pencocokan prefix ini
 * generik — tidak perlu daftar nama cookie per-produk.
 */
function findPairedCookies(cookieNames: string[], extraFields: Record<string, string>): string[] {
    const tokenFields = Object.keys(extraFields).filter((k) => VOLATILE_FIELD_RE.test(k));
    const paired = new Set<string>();

    for (const cookie of cookieNames) {
        const c = cookie.toLowerCase();
        for (const field of tokenFields) {
            const f = field.toLowerCase();
            if (c === f || c.startsWith(`${f}_`) || c.startsWith(`${f}-`)) {
                paired.add(cookie);
            }
        }
        // Nama cookie antiforgery kanonik yang berdiri sendiri (Django/Rails/Laravel/Angular)
        // tetap dihitung meski tidak ada field hidden dengan nama sama.
        if (/^(?:csrftoken|_csrf|xsrf-token|csrf-token|xsrf_token)$/i.test(cookie)) {
            paired.add(cookie);
        }
    }
    return Array.from(paired);
}

// looksLikeClientRenderedApp & looksLikeOracleEbs kini di lib/portal-sso-relay
// agar dipakai bersama verify-login (satu definisi, dua pemanggil).

export function classifySsoMode(ev: ModeEvidence): ModeVerdict {
    const signals: string[] = [];
    const warnings: string[] = [];
    const { detected, html, finalUrl, cookieNames, loopDetected, redirected } = ev;

    const chain = ev.hopChain ?? [];
    const isFederated = chain.some((u) => FEDERATION_URL_RE.test(u)) || FEDERATION_URL_RE.test(finalUrl);
    const pairedCookies = findPairedCookies(cookieNames, detected.extraFields);
    const volatileFields = Object.keys(detected.extraFields).filter((k) => VOLATILE_FIELD_RE.test(k));

    if (isFederated) signals.push("Rantai login memakai protokol federasi (WS-Federation/SAML/OIDC).");
    if (pairedCookies.length) signals.push(`Token antiforgery terikat cookie: ${pairedCookies.join(", ")}.`);
    else if (volatileFields.length) signals.push(`Token dinamis tanpa cookie pasangan: ${volatileFields.join(", ")}.`);
    if (chain.length > 1) signals.push(`${chain.length - 1} pengalihan sebelum sampai ke halaman login.`);

    // ── Tidak ada form login yang bisa dikirim ────────────────────────────────
    if (!detected.passwordField) {
        if (looksLikeClientRenderedApp(html)) {
            signals.push("Halaman dirakit JavaScript; form login tidak ada di HTML mentah.");
            return {
                mode: "VAULT",
                reason:
                    "Form login dibuat oleh JavaScript di browser, jadi tidak ada field yang bisa dikirim dari server. " +
                    "SSO Mode VAULT: portal menyimpan kredensial, pengguna login di halaman aslinya.",
                signals,
                warnings,
            };
        }
        if (isFederated) {
            return {
                mode: "VAULT",
                reason:
                    "Alamat ini masuk ke alur federasi (WS-Federation/SAML/OIDC) tetapi tidak pernah menampilkan form login. " +
                    "Isi LOGIN URL dengan halaman form yang sebenarnya (salin URL lengkap dari address bar setelah halaman login muncul), " +
                    "lalu deteksi ulang. Sementara itu gunakan SSO Mode VAULT.",
                signals,
                warnings,
            };
        }
        if (loopDetected) {
            return {
                mode: "VAULT",
                reason:
                    "Halaman berputar dalam pengalihan dan tidak pernah menyajikan form login. " +
                    "Periksa apakah LOGIN URL sudah lengkap; bila memang begitu perilakunya, gunakan SSO Mode VAULT.",
                signals,
                warnings,
            };
        }
        return {
            mode: "VAULT",
            reason:
                "Tidak ditemukan input password di halaman ini, jadi tidak ada yang bisa dikirim otomatis. " +
                "Gunakan SSO Mode VAULT agar portal menyimpan kredensial dan pengguna login sendiri.",
            signals,
            warnings,
        };
    }

    // ── Form login ditemukan ──────────────────────────────────────────────────
    if (looksLikeOracleEbs(html, finalUrl)) {
        signals.push("Pola Oracle E-Business Suite (AppsLocalLogin / AuthenticateUser).");
        return {
            mode: "REROUTE",
            reason:
                "Aplikasi ini memakai login XHR Oracle EBS (header X-Service: AuthenticateUser), bukan pengiriman form biasa. " +
                "SSO Mode REROUTE sudah menangani pola tersebut.",
            signals,
            warnings,
        };
    }

    if (pairedCookies.length > 0) {
        warnings.push(
            "Token antiforgery aplikasi ini terikat cookie sesi. SSO Mode FORM akan selalu ditolak " +
                "karena browser pengguna tidak memiliki cookie pasangannya."
        );
        return {
            mode: "POST",
            reason:
                "Halaman menerbitkan token antiforgery yang dipasangkan dengan cookie sesi " +
                `(${pairedCookies.join(", ")}). Portal harus mengambil token dan cookie itu bersamaan di sisi server, ` +
                "jadi SSO Mode POST yang sesuai.",
            signals,
            warnings,
        };
    }

    if (isFederated) {
        return {
            mode: "POST",
            reason:
                "Login berjalan melalui rantai federasi (WS-Federation/SAML/OIDC) yang harus diikuti berurutan " +
                "beserta cookie tiap langkahnya. SSO Mode POST menjalankan rantai itu di server lalu menyerahkan " +
                "hasilnya ke browser.",
            signals,
            warnings,
        };
    }

    if (volatileFields.length > 0) {
        warnings.push(
            `Token dinamis (${volatileFields.join(", ")}) akan diambil ulang setiap peluncuran SSO. ` +
                "Bila aplikasi tetap menolak, ganti ke SSO Mode POST."
        );
        return {
            mode: "FORM",
            reason:
                "Form login biasa dengan token dinamis yang tidak terikat cookie. SSO Mode FORM cukup, " +
                "karena portal menyegarkan token tepat sebelum pengiriman.",
            signals,
            warnings,
        };
    }

    if (redirected) {
        warnings.push(`Halaman dialihkan ke ${finalUrl}. Simpan URL akhir ini sebagai LOGIN URL.`);
    }

    return {
        mode: "FORM",
        reason:
            "Halaman menyajikan form login biasa tanpa token terikat cookie, jadi kredensial bisa dikirim " +
            "langsung dari browser. SSO Mode FORM sesuai.",
        signals,
        warnings,
    };
}
