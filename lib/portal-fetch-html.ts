import https from "https";
import { detectLoginFields } from "@/lib/portal-login-detect";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PortalDetect/1.0";
const ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const MAX_BYTES = 512 * 1024;
/** Batas hop redirect manual — di atas ini dianggap loop dan fetch tidak boleh menggantung. */
const MAX_HOPS = 8;

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
    /** Set-Cookie terkumpul di seluruh hop (relevan untuk SSO POST: token antiforgery terikat cookie). */
    setCookies: string[];
    /** Status HTTP dari respons final (null bila tak dapat ditentukan). */
    statusCode: number | null;
    redirected: boolean;
    /** Rantai redirect berulang tanpa pernah sampai ke halaman mana pun — server hidup tapi URL tidak valid. */
    loopDetected?: boolean;
}

function getSetCookies(headers: Headers): string[] {
    return typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
}

/**
 * Ambil halaman login dengan mengikuti redirect SECARA MANUAL (fetch native dengan
 * redirect:"manual"). Ini pola untuk situs yang "selalu membuka cache/token baru tiap
 * akses" dan rentan loop redirect (mis. K2 yang dibuka tanpa query WS-Federation):
 * fetch maupun curl dengan redirect:"follow" akan menghabiskan batas redirect lalu
 * melempar "fetch failed" — padahal server-nya hidup dan me-respons. Di sini loop
 * dibatasi hop, dideteksi, dan dikembalikan sebagai `loopDetected`, bukan exception.
 */
export async function fetchLoginPage(url: string): Promise<FetchedPage> {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new FetchError("URL harus menggunakan http:// atau https://", 400);
    }
    if (isBlockedHost(parsed.hostname)) {
        throw new FetchError("Host tidak diizinkan", 400);
    }

    // Rantai manual: tidak mengikuti redirect otomatis, memeriksa Location sendiri.
    try {
        let current = parsed.href;
        const seen = new Set<string>([current]);
        const allCookies: string[] = [];
        let response: Response | null = null;

        for (let hop = 0; hop <= MAX_HOPS; hop++) {
            const res = await fetch(current, {
                redirect: "manual",
                signal: AbortSignal.timeout(10000),
                headers: { "user-agent": UA, accept: ACCEPT },
                cache: "no-store",
            });
            allCookies.push(...getSetCookies(res.headers));
            response = res;

            const isRedirect = res.status >= 300 && res.status < 400;
            const location = res.headers.get("location");
            if (isRedirect && location) {
                const next = new URL(location, current).href;
                if (seen.has(next)) {
                    return {
                        html: "",
                        finalUrl: current,
                        setCookies: allCookies,
                        statusCode: res.status,
                        redirected: current !== parsed.href,
                        loopDetected: true,
                    };
                }
                seen.add(next);
                current = next;
                continue;
            }

            if (!res.ok) {
                throw new FetchError(`Halaman login mengembalikan HTTP ${res.status} (${res.statusText})`, res.status);
            }
            const ct = res.headers.get("content-type") ?? "";
            if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml") && !ct.includes("text/plain")) {
                throw new FetchError("Respons bukan halaman web / HTML", 422);
            }
            const text = await res.text();
            return {
                html: text.substring(0, MAX_BYTES),
                finalUrl: current,
                setCookies: allCookies,
                statusCode: res.status,
                redirected: current !== parsed.href,
            };
        }

        // Hop habis tanpa halaman yang valid — pola loop/gila-hops.
        return {
            html: "",
            finalUrl: current,
            setCookies: allCookies,
            statusCode: null,
            redirected: current !== parsed.href,
            loopDetected: true,
        };
    } catch (err: unknown) {
        if (err instanceof FetchError) throw err;

        // Fallback untuk HTTPS internal dengan sertifikat self-signed / private CA.
        // Mengulang rantai hop yang sama memakai https.get (bukan fetch) agar
        // rejectUnauthorized:false ikut berlaku di setiap hop.
        if (parsed.protocol === "https:") {
            try {
                return await httpsGetFollowHops(parsed.href);
            } catch (fallbackErr: unknown) {
                if (fallbackErr instanceof FetchError) throw fallbackErr;
            }
        }

        const timedOut = err instanceof Error && err.name === "TimeoutError";
        const msg = err instanceof Error ? err.message : "Gagal mengakses halaman login";
        throw new FetchError(
            timedOut ? "Waktu pengambilan halaman habis (timeout)" : `Gagal mengakses target URL (${msg})`,
            422
        );
    }
}

/** Rantai hop manual memakai https.get untuk sertifikat internal yang tidak dipercaya. */
function httpsGetFollowHops(startUrl: string): Promise<FetchedPage> {
    return new Promise<FetchedPage>((resolve, reject) => {
        const seen = new Set<string>([startUrl]);
        const allCookies: string[] = [];
        let current = startUrl;

        const singleHop = (): void => {
            const req = https.get(
                current,
                {
                    rejectUnauthorized: false,
                    timeout: 10000,
                    headers: { "user-agent": UA, accept: ACCEPT },
                },
                (res) => {
                    if (res.headers["set-cookie"]) allCookies.push(...res.headers["set-cookie"]);
                    const status = res.statusCode ?? 0;
                    const location = res.headers.location;

                    if (status >= 300 && status < 400 && location) {
                        const next = new URL(location, current).href;
                        if (seen.has(next)) {
                            return resolve({
                                html: "",
                                finalUrl: current,
                                setCookies: allCookies,
                                statusCode: status,
                                redirected: current !== startUrl,
                                loopDetected: true,
                            });
                        }
                        seen.add(next);
                        current = next;
                        if (seen.size > MAX_HOPS + 1) {
                            return resolve({
                                html: "",
                                finalUrl: current,
                                setCookies: allCookies,
                                statusCode: status,
                                redirected: true,
                                loopDetected: true,
                            });
                        }
                        return singleHop();
                    }

                    if (status >= 400) {
                        return reject(new FetchError(`Halaman login mengembalikan HTTP ${status}`, status));
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
                            finalUrl: current,
                            setCookies: allCookies,
                            statusCode: status,
                            redirected: current !== startUrl,
                        })
                    );
                }
            );
            req.on("error", (e) => reject(new FetchError(`Gagal mengakses target URL (${e.message})`, 422)));
            req.on("timeout", () => {
                req.destroy();
                reject(new FetchError("Waktu pengambilan halaman habis (timeout)", 422));
            });
        };

        singleHop();
    });
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