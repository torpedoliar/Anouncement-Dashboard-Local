import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import { CookieJar, relayRequest, type RelayResponse } from "@/lib/portal-fetch-html";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

/**
 * Mesin relay login server-side untuk SSO Mode POST.
 *
 * Perbedaan penting dari implementasi lama: setelah kredensial dikirim, rantai
 * pengalihan DIIKUTI sampai selesai sambil membawa cookie. Berhenti di respons pertama
 * membuat login yang sebenarnya berhasil terbaca sebagai gagal, karena aplikasi
 * berbasis federasi (K2/WS-Federation, ADFS, SAML) baru menerbitkan sesi setelah
 * beberapa langkah.
 */

const MAX_RELAY_HOPS = 12;

function isElement(n: Node): n is Element {
    if (!n) return false;
    return "tagName" in n;
}

function attr(el: Element, name: string): string | null {
    return el.attrs.find((a) => a.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

export interface AutoPostForm {
    action: string;
    fields: Record<string, string>;
}

export interface OracleAuthResult {
    status: string;
    url: string;
    errorCode: string;
}

/**
 * Parse respons autentikasi Oracle EBS AppsLocalLogin.jsp: literal objek JS
 * (key tanpa kutip, nilai hex-escaped) — bukan JSON. login.js aslinya memakai
 * eval(); cukup regex di sini agar eval tidak masuk kode kita.
 */
export function parseOracleAuthResponse(body: string): OracleAuthResult {
    const unescapeHex = (s: string) =>
        s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const field = (name: string) => {
        const m = body.match(new RegExp(`${name}\\s*:\\s*'(.*?)'`, "m"));
        return m ? unescapeHex(m[1]) : "";
    };
    return { status: field("status"), url: field("url"), errorCode: field("errorCode") };
}

/**
 * Cari form auto-POST protokol federasi (WS-Federation `wresult`, SAML `SAMLResponse`).
 *
 * Ini titik serah-terima yang benar ke browser: token federasi memang dirancang untuk
 * dikirim OLEH browser ke aplikasi, sehingga aplikasi memasang cookie sesinya sendiri
 * pada origin-nya sendiri. Portal tidak bisa menitipkan cookie lintas-domain.
 */
export function findFederationAutoPost(html: string, baseUrl: string): AutoPostForm | null {
    if (!html || !/wresult|SAMLResponse|wa=wsignin|SAMLRequest/i.test(html)) return null;

    const doc = parse(html);
    let found: AutoPostForm | null = null;

    const walk = (node: Node, currentForm: AutoPostForm | null): void => {
        let form = currentForm;
        if (isElement(node)) {
            const tag = node.tagName.toLowerCase();
            if (tag === "form") {
                const action = attr(node, "action");
                form = action ? { action: new URL(action, baseUrl).href, fields: {} } : null;
            } else if (tag === "input" && form) {
                const name = attr(node, "name");
                const value = attr(node, "value") ?? "";
                if (name) form.fields[name] = value;
            }
        }
        if ("childNodes" in node && Array.isArray(node.childNodes)) {
            for (const child of node.childNodes) walk(child, form);
        }
        // Form dianggap federasi hanya bila membawa token protokolnya.
        if (isElement(node) && node.tagName.toLowerCase() === "form" && form && !found) {
            const keys = Object.keys(form.fields);
            if (keys.some((k) => /^(?:wresult|SAMLResponse|SAMLRequest|wa)$/i.test(k))) {
                found = form;
            }
        }
    };

    walk(doc, null);
    return found;
}

/** Halaman masih menampilkan form login = kredensial ditolak. */
export function stillOnLoginForm(html: string): boolean {
    return /<input[^>]+type=["']?password["']?/i.test(html);
}

/**
 * Langkah federasi yang sah — rantai HARUS diikuti, bukan dianggap gagal.
 * Terverifikasi pada K2: login sukses mengalihkan ke `/Identity/sts/Forms/wsfed?wa=wsignin1.0...`
 */
const FEDERATION_STEP_RE =
    /(?:wa=wsignin1\.0|[?&/]wsfed\b|\/adfs\/ls|SAMLRequest=|SAMLResponse=|\/connect\/authorize|\/oauth2?\/authorize)/i;

/**
 * Tujuan yang berarti login DITOLAK.
 *
 * Sengaja dicocokkan pada SEGMEN PATH, bukan substring bebas. Pada K2 tujuan sukses
 * (`/Identity/sts/Forms/wsfed`) dan tujuan gagal (`/Identity/STS/Forms/Error`) sama-sama
 * berada di bawah `/Identity/`, jadi pencocokan substring mudah salah menilai. Segmen
 * terakhirlah yang membedakan.
 */
const ERROR_SEGMENT_RE = /^(?:error|errors|accessdenied|denied|forbidden|unauthorized|logout|signout)$/i;

export type RedirectVerdict = "FEDERATION_STEP" | "REJECTED" | "NEUTRAL";

/**
 * Nilai satu tujuan pengalihan pasca-login.
 *
 * Urutan penting: langkah federasi diperiksa LEBIH DULU. URL WS-Federation membawa
 * query panjang (`wreply`, `wctx`) yang bisa saja memuat kata "error" di dalamnya —
 * tanpa urutan ini, langkah sukses bisa salah dibaca sebagai penolakan.
 */
export function classifyRedirect(target: string): RedirectVerdict {
    if (FEDERATION_STEP_RE.test(target)) return "FEDERATION_STEP";

    let pathname: string;
    try {
        pathname = new URL(target).pathname;
    } catch {
        pathname = target.split("?")[0];
    }

    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    // Buang ekstensi (.aspx/.jsp/.php) agar "Error.aspx" tetap terbaca sebagai "error".
    const bare = last.replace(/\.(?:aspx|asp|jsp|php|html?|do|action)$/i, "");

    if (ERROR_SEGMENT_RE.test(bare)) return "REJECTED";
    return "NEUTRAL";
}

export interface RelayOutcome {
    ok: boolean;
    /** Cookie hidup hasil seluruh rantai. */
    jar: CookieJar;
    /** URL terakhir yang dicapai server. */
    finalUrl: string;
    /** Form federasi yang harus diserahkan ke browser untuk menyelesaikan SSO. */
    handoff: AutoPostForm | null;
    statusCode: number;
    /** Alasan kegagalan, siap ditampilkan ke pengguna. */
    failureReason: string | null;
    hops: string[];
}

/**
 * Kirim kredensial lalu ikuti rantai pengalihan sampai berhenti, form federasi ditemukan,
 * atau batas hop tercapai.
 */
export async function relayLogin(opts: {
    actionUrl: string;
    body: string;
    jar: CookieJar;
    referer: string;
    allowInsecureTLS: boolean;
}): Promise<RelayOutcome> {
    const { jar } = opts;
    const hops: string[] = [opts.actionUrl];

    let res: RelayResponse = await relayRequest({
        url: opts.actionUrl,
        method: "POST",
        body: opts.body,
        cookie: jar.header(),
        referer: opts.referer,
        allowInsecureTLS: opts.allowInsecureTLS,
    });
    jar.absorb(res.rawSetCookies);

    // Penilaian kredensial HANYA dari status, tidak dari isi body.
    //
    // Terverifikasi pada K2: login yang BERHASIL menjawab 302 namun body-nya tetap
    // berisi form login lengkap dengan teks "Invalid Credentials" — itu sisa render
    // halaman, bukan penolakan. Menilai dari body membuat login sukses terbaca gagal.
    // Aturannya: 3xx = diterima (ikuti rantainya), 2xx + form login = ditolak.
    const isRedirect = res.status >= 300 && res.status < 400 && !!res.location;

    if (!isRedirect && res.status >= 200 && res.status < 300 && stillOnLoginForm(res.html)) {
        return {
            ok: false,
            jar,
            finalUrl: res.url,
            handoff: null,
            statusCode: res.status,
            failureReason: "Aplikasi menolak kredensial yang tersimpan.",
            hops,
        };
    }

    if (res.status >= 400) {
        return {
            ok: false,
            jar,
            finalUrl: res.url,
            handoff: null,
            statusCode: res.status,
            failureReason: `Aplikasi menolak permintaan login (HTTP ${res.status}).`,
            hops,
        };
    }

    // Ikuti rantai pasca-login. Federasi butuh beberapa langkah sebelum sesi terbit.
    for (let hop = 0; hop < MAX_RELAY_HOPS; hop++) {
        const handoff = findFederationAutoPost(res.html, res.url);
        if (handoff) {
            return {
                ok: true,
                jar,
                finalUrl: res.url,
                handoff,
                statusCode: res.status,
                failureReason: null,
                hops,
            };
        }

        if (res.status >= 300 && res.status < 400 && res.location) {
            const next = new URL(res.location, res.url).href;
            if (classifyRedirect(next) === "REJECTED") {
                return {
                    ok: false,
                    jar,
                    finalUrl: next,
                    handoff: null,
                    statusCode: res.status,
                    failureReason:
                        "Aplikasi mengalihkan ke halaman error setelah login — kredensial ditolak, " +
                        "atau token/cookie tidak diterima.",
                    hops,
                };
            }
            hops.push(next);
            res = await relayRequest({
                url: next,
                method: "GET",
                cookie: jar.header(),
                referer: res.url,
                allowInsecureTLS: opts.allowInsecureTLS,
            });
            jar.absorb(res.rawSetCookies);
            continue;
        }

        break;
    }

    // Rantai selesai tanpa form federasi. Berhasil bila tidak kembali ke form login.
    const backOnLogin = stillOnLoginForm(res.html);
    return {
        ok: !backOnLogin,
        jar,
        finalUrl: res.url,
        handoff: null,
        statusCode: res.status,
        failureReason: backOnLogin ? "Aplikasi menolak kredensial yang tersimpan." : null,
        hops,
    };
}

/** Login Oracle EBS: tombol JS memanggil endpoint XHR dengan header X-Service. */
export function looksLikeOracleEbs(html: string, finalUrl: string): boolean {
    return /AppsLocalLogin\.jsp|AuthenticateUser|OA_HTML/i.test(`${html.slice(0, 20000)} ${finalUrl}`);
}

/** Halaman yang form login-nya dirakit JavaScript — HTML mentah tidak memuat inputnya. */
export function looksLikeClientRenderedApp(html: string): boolean {
    if (!html) return false;
    const hasAppRoot = /<div[^>]+id=["'](?:root|app|__next|ng-app)["']/i.test(html);
    const hasNoForm = !/<form[\s>]/i.test(html);
    const heavyScript = (html.match(/<script[\s>]/gi) ?? []).length >= 3;
    return hasAppRoot && hasNoForm && heavyScript;
}

/**
 * Cookie hanya bisa dipasang portal untuk domain yang dibagi bersama aplikasi.
 * Bila portal dan aplikasi beda domain, browser MEMBUANG cookie tersebut — kasus itu
 * harus ditangani lewat serah-terima federasi, bukan dengan berpura-pura berhasil.
 */
export function sharedCookieDomain(portalHost: string, appHost: string): string | null {
    const explicit = process.env.PORTAL_SSO_COOKIE_DOMAIN?.trim();
    if (explicit) return explicit;

    // Header Host membawa port (compose memetakan 3100→3000), sedangkan URL.hostname
    // tidak. Tanpa dibuang, host yang sama terbaca berbeda dan cookie tidak pernah dipasang.
    const portal = portalHost.toLowerCase().split(":")[0].trim();
    const target = appHost.toLowerCase().split(":")[0].trim();
    if (!portal || !target) return null;

    if (portal === target) return target;

    const p = portal.split(".");
    const a = target.split(".");
    const shared: string[] = [];
    for (let i = 1; i <= Math.min(p.length, a.length); i++) {
        if (p[p.length - i] === a[a.length - i]) shared.unshift(p[p.length - i]);
        else break;
    }
    // Butuh minimal dua label (mis. "santos.co.id" — bukan sekadar "id").
    return shared.length >= 2 ? `.${shared.join(".")}` : null;
}
