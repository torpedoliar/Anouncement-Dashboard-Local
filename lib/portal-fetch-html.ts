import https from "https";
import { detectLoginFields } from "@/lib/portal-login-detect";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PortalDetect/1.0";
const ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const MAX_BYTES = 512 * 1024;

export class FetchError extends Error {
    constructor(
        message: string,
        public status: number
    ) {
        super(message);
    }
}

// SSRF harden: cegah target non-routable / AWS/GCP metadata service
function isBlockedHost(hostname: string): boolean {
    const h = hostname.toLowerCase().trim();
    return h === "0.0.0.0" || h === "169.254.169.254" || h === "metadata.google.internal";
}

export interface FetchedPage {
    html: string;
    /** URL akhir setelah mengikuti redirect. Beda dari URL awal = halaman login bukan yang diminta. */
    finalUrl: string;
    /** Set-Cookie dari halaman login (mis. cookie antiforgery ASP.NET MVC). */
    setCookies: string[];
}

export async function fetchLoginPage(url: string): Promise<FetchedPage> {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new FetchError("URL harus menggunakan http:// atau https://", 400);
    }
    if (isBlockedHost(parsed.hostname)) {
        throw new FetchError("Host tidak diizinkan", 400);
    }

    try {
        const res = await fetch(url, {
            redirect: "follow",
            signal: AbortSignal.timeout(10000),
            headers: { "user-agent": UA, accept: ACCEPT },
            cache: "no-store",
        });

        if (!res.ok) {
            throw new FetchError(`Halaman login mengembalikan HTTP ${res.status} (${res.statusText})`, 422);
        }
        const ct = res.headers.get("content-type") ?? "";
        if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml") && !ct.includes("text/plain")) {
            throw new FetchError("Respons bukan halaman web / HTML", 422);
        }

        const text = await res.text();
        return {
            html: text.substring(0, MAX_BYTES),
            finalUrl: res.url || url,
            setCookies: typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [],
        };
    } catch (err: unknown) {
        if (err instanceof FetchError) throw err;

        // Fallback untuk HTTPS internal dengan sertifikat self-signed / private CA
        if (parsed.protocol === "https:") {
            try {
                return await new Promise<FetchedPage>((resolve, reject) => {
                    const req = https.get(
                        url,
                        {
                            rejectUnauthorized: false,
                            timeout: 10000,
                            headers: { "user-agent": UA, accept: ACCEPT },
                        },
                        (res) => {
                            if (res.statusCode && res.statusCode >= 400) {
                                return reject(new FetchError(`Halaman login mengembalikan HTTP ${res.statusCode}`, 422));
                            }
                            let data = "";
                            res.setEncoding("utf8");
                            res.on("data", (chunk) => {
                                data += chunk;
                                if (data.length > MAX_BYTES) req.destroy();
                            });
                            res.on("end", () =>
                                resolve({
                                    html: data.substring(0, MAX_BYTES),
                                    finalUrl: url,
                                    setCookies: res.headers["set-cookie"] ?? [],
                                })
                            );
                        }
                    );
                    req.on("error", (e) => reject(new FetchError(`Gagal mengakses target URL (${e.message})`, 422)));
                    req.on("timeout", () => {
                        req.destroy();
                        reject(new FetchError("Waktu pengambilan halaman habis (timeout)", 422));
                    });
                });
            } catch (fallbackErr: unknown) {
                if (fallbackErr instanceof FetchError) throw fallbackErr;
            }
        }

        const timedOut = err instanceof Error && err.name === "TimeoutError";
        const msg = err instanceof Error ? err.message : "Gagal mengakses halaman login";

        // Loop redirect: khas endpoint SSO federasi yang dibuka tanpa parameter
        // WS-Federation/SAML (mis. K2 `https://host` polos memantul tanpa henti).
        // Pesan generik "fetch failed" tidak memberi petunjuk apa pun ke admin.
        if (/redirect|too many|ERR_TOO_MANY_REDIRECTS/i.test(msg)) {
            throw new FetchError(
                "Halaman login memantul dalam loop pengalihan tanpa henti. Ini pola khas endpoint SSO federasi " +
                    "(WS-Federation/SAML) yang dibuka tanpa parameter query yang diperlukan. Salin URL login LENGKAP " +
                    "dari address bar browser, atau gunakan SSO Mode VAULT untuk aplikasi ini.",
                422
            );
        }

        throw new FetchError(
            timedOut ? "Waktu pengambilan halaman habis (timeout)" : `Gagal mengakses target URL (${msg})`,
            422
        );
    }
}

/** Nama field yang nilainya berubah tiap kali halaman login dibuka. */
const VOLATILE_RE =
    /^(?:__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION|__RequestVerificationToken|_csrf|csrf[-_]?token|_token|authenticity_token|csrfmiddlewaretoken)/i;

export function hasVolatileFields(extraFields: Record<string, string>): boolean {
    return Object.keys(extraFields).some((k) => VOLATILE_RE.test(k));
}

/**
 * Ambil ulang token dinamis (ViewState, CSRF) dari halaman login tepat sebelum SSO.
 * Token yang disimpan saat konfigurasi sudah kedaluwarsa — ASP.NET WebForms
 * menerbitkan __VIEWSTATE baru setiap request, jadi nilai lama membuat login gagal diam-diam.
 * Nilai statis (mis. nama tombol submit) dipertahankan apa adanya.
 */
export async function refreshVolatileFields(
    loginUrl: string,
    stored: Record<string, string>
): Promise<Record<string, string>> {
    if (!hasVolatileFields(stored)) return stored;

    try {
        const { html } = await fetchLoginPage(loginUrl);
        const fresh = detectLoginFields(html).extraFields;
        const merged = { ...stored };
        for (const [k, v] of Object.entries(fresh)) {
            if (VOLATILE_RE.test(k)) merged[k] = v;
        }
        return merged;
    } catch {
        // ponytail: gagal refresh → pakai nilai tersimpan. Login mungkin ditolak,
        // tapi lebih baik daripada memblokir peluncuran SSO sepenuhnya.
        return stored;
    }
}
