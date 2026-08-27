import http from "http";
import https from "https";
import { detectLoginFields } from "@/lib/portal-login-detect";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PortalDetect/1.0";
const ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const MAX_BYTES = 512 * 1024;
/**
 * Batas hop redirect manual. Rantai federasi (WS-Federation / SAML) memakai banyak hop:
 * K2 butuh 4 hop hanya untuk sampai ke form login, jadi 8 terlalu ketat.
 */
const MAX_HOPS = 12;
/**
 * Satu URL boleh dikunjungi dua kali. Pola "cookie handshake" ASP.NET
 * (AspxAutoDetectCookieSupport) memang mengembalikan pengguna ke URL yang sama setelah
 * cookie terpasang — kunjungan kedua ini sah, bukan loop.
 */
const MAX_VISITS_PER_URL = 2;

/**
 * Cookie jar sederhana untuk satu rantai request.
 *
 * Tanpa ini, redirect chain aplikasi ASP.NET/federasi tidak pernah selesai: server
 * memasang cookie di hop pertama lalu mengharapkannya kembali di hop berikutnya, dan
 * karena tidak pernah dikirim, ia mengalihkan ulang selamanya. Gejalanya terbaca sebagai
 * "loop redirect" padahal server berperilaku normal.
 */
export class CookieJar {
    private jar = new Map<string, string>();

    absorb(setCookieHeaders: string[]): void {
        for (const raw of setCookieHeaders) {
            const pair = raw.split(";")[0];
            const eq = pair.indexOf("=");
            if (eq <= 0) continue;
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            if (name) this.jar.set(name, value);
        }
    }

    header(): string {
        return Array.from(this.jar.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
    }

    names(): string[] {
        return Array.from(this.jar.keys());
    }

    toObject(): Record<string, string> {
        return Object.fromEntries(this.jar.entries());
    }

    get size(): number {
        return this.jar.size;
    }
}

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
    /** Cookie hidup hasil rantai — dipakai SSO POST agar token antiforgery cocok dengan cookie pasangannya. */
    cookieJar?: CookieJar;
    /** Rantai URL yang dilalui — bukti pola federasi (wsfed/saml/oauth) untuk klasifikasi mode SSO. */
    hopChain?: string[];
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
    // Cookie dari tiap hop dikirim ulang di hop berikutnya — tanpa itu handshake cookie
    // ASP.NET tidak pernah selesai dan rantainya salah terbaca sebagai loop.
    try {
        let current = parsed.href;
        const visits = new Map<string, number>([[current, 1]]);
        const hopChain: string[] = [current];
        const allCookies: string[] = [];
        const jar = new CookieJar();

        for (let hop = 0; hop <= MAX_HOPS; hop++) {
            const cookieHeader = jar.header();
            const res = await fetch(current, {
                redirect: "manual",
                signal: AbortSignal.timeout(10000),
                headers: {
                    "user-agent": UA,
                    accept: ACCEPT,
                    ...(cookieHeader ? { cookie: cookieHeader } : {}),
                },
                cache: "no-store",
            });
            const hopCookies = getSetCookies(res.headers);
            allCookies.push(...hopCookies);
            jar.absorb(hopCookies);

            const isRedirect = res.status >= 300 && res.status < 400;
            const location = res.headers.get("location");
            if (isRedirect && location) {
                const next = new URL(location, current).href;
                const seenCount = visits.get(next) ?? 0;
                if (seenCount >= MAX_VISITS_PER_URL) {
                    return {
                        html: "",
                        finalUrl: current,
                        setCookies: allCookies,
                        statusCode: res.status,
                        redirected: current !== parsed.href,
                        loopDetected: true,
                        cookieJar: jar,
                        hopChain,
                    };
                }
                visits.set(next, seenCount + 1);
                hopChain.push(next);
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
                cookieJar: jar,
                hopChain,
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
            cookieJar: jar,
            hopChain,
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
        const visits = new Map<string, number>([[startUrl, 1]]);
        const hopChain: string[] = [startUrl];
        const allCookies: string[] = [];
        const jar = new CookieJar();
        let hops = 0;
        let current = startUrl;

        const singleHop = (): void => {
            const cookieHeader = jar.header();
            const req = https.get(
                current,
                {
                    rejectUnauthorized: false,
                    timeout: 10000,
                    headers: {
                        "user-agent": UA,
                        accept: ACCEPT,
                        ...(cookieHeader ? { cookie: cookieHeader } : {}),
                    },
                },
                (res) => {
                    if (res.headers["set-cookie"]) {
                        allCookies.push(...res.headers["set-cookie"]);
                        jar.absorb(res.headers["set-cookie"]);
                    }
                    const status = res.statusCode ?? 0;
                    const location = res.headers.location;

                    if (status >= 300 && status < 400 && location) {
                        res.resume(); // buang body redirect agar socket bisa dipakai ulang
                        const next = new URL(location, current).href;
                        const seenCount = visits.get(next) ?? 0;
                        if (seenCount >= MAX_VISITS_PER_URL || ++hops > MAX_HOPS) {
                            return resolve({
                                html: "",
                                finalUrl: current,
                                setCookies: allCookies,
                                statusCode: status,
                                redirected: current !== startUrl,
                                loopDetected: true,
                                cookieJar: jar,
                                hopChain,
                            });
                        }
                        visits.set(next, seenCount + 1);
                        hopChain.push(next);
                        current = next;
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
                            cookieJar: jar,
                            hopChain,
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

export interface RelayResponse {
    status: number;
    /** Header Location bila respons berupa redirect. */
    location: string | null;
    /** URL efektif tempat respons ini diterima. */
    url: string;
    html: string;
    contentType: string;
    /** Set-Cookie mentah dari respons ini. */
    rawSetCookies: string[];
}

/**
 * Satu request (GET/POST) memakai modul http/https langsung.
 *
 * Sengaja TIDAK memakai fetch: sertifikat internal (K2, EBS) sering self-signed, dan
 * satu-satunya cara melonggarkan verifikasi pada fetch global adalah menyetel
 * NODE_TLS_REJECT_UNAUTHORIZED=0 — yang mematikan verifikasi TLS untuk SELURUH proses
 * (termasuk koneksi DB dan SMTP) dan tidak pernah pulih. Di sini kelonggaran itu
 * terbatas pada satu request ke satu host.
 */
export function relayRequest(opts: {
    url: string;
    method: "GET" | "POST";
    cookie?: string;
    body?: string;
    referer?: string;
    /** Header tambahan (mis. X-Service untuk Oracle EBS). */
    headers?: Record<string, string>;
    /** Longgarkan verifikasi TLS — hanya untuk request ini, bukan proses. */
    allowInsecureTLS?: boolean;
    timeoutMs?: number;
}): Promise<RelayResponse> {
    return new Promise<RelayResponse>((resolve, reject) => {
        const u = new URL(opts.url);
        const isHttps = u.protocol === "https:";
        const transport = isHttps ? https : http;

        const headers: Record<string, string> = {
            "user-agent": UA,
            accept: ACCEPT,
        };
        if (opts.cookie) headers.cookie = opts.cookie;
        if (opts.referer) {
            headers.referer = opts.referer;
            headers.origin = new URL(opts.referer).origin;
        }
        if (opts.method === "POST") {
            headers["content-type"] = "application/x-www-form-urlencoded";
            headers["content-length"] = String(Buffer.byteLength(opts.body ?? ""));
        }
        if (opts.headers) Object.assign(headers, opts.headers);

        const req = transport.request(
            {
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: `${u.pathname}${u.search}`,
                method: opts.method,
                headers,
                timeout: opts.timeoutMs ?? 12000,
                ...(isHttps && opts.allowInsecureTLS ? { rejectUnauthorized: false } : {}),
            },
            (res) => {
                let data = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    data += chunk;
                    if (data.length > MAX_BYTES) req.destroy();
                });
                res.on("end", () => {
                    resolve({
                        status: res.statusCode ?? 0,
                        location: res.headers.location ?? null,
                        url: opts.url,
                        html: data.substring(0, MAX_BYTES),
                        contentType: res.headers["content-type"] ?? "",
                        rawSetCookies: res.headers["set-cookie"] ?? [],
                    });
                });
            }
        );
        req.on("error", (e) => reject(new FetchError(`Gagal menghubungi ${u.host} (${e.message})`, 422)));
        req.on("timeout", () => {
            req.destroy();
            reject(new FetchError(`Waktu koneksi ke ${u.host} habis`, 422));
        });
        if (opts.method === "POST") req.write(opts.body ?? "");
        req.end();
    });
}

/** Nama field yang nilainya berubah tiap kali halaman login dibuka. */
export const VOLATILE_RE =
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