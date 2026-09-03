/**
 * Registry produk login — DATA, bukan classifier.
 *
 * Tambah produk baru = tambah satu entri di PRODUCT_REGISTRY. Dilarang
 * menambah cabang `if` produk di classifier (heuristik/mode/probe).
 * "generic" bukan produk registry — ia lahir dari auto-register fingerprint
 * untuk aplikasi tak dikenal yang lolos Uji Login.
 */
export interface ProductFingerprint {
    product: string;
    version: string | null;
    markers: string[];
}

interface ProductEntry {
    product: string;
    /** Semua marker dalam satu grup harus cocok; antar grup cukup satu grup. */
    titleRe?: RegExp;
    generatorRe?: RegExp; // meta generator, mis. aplikasi internal
    htmlRe?: RegExp[];
    urlRe?: RegExp;
    versionRe?: RegExp;
}

const PRODUCT_REGISTRY: ProductEntry[] = [
    {
        product: "unifi-os",
        titleRe: /<title[^>]*>\s*UniFi OS\s*<\/title>/i,
        htmlRe: [/<(ng-view|ui-view)[\s/>]/i, /\/angular\//i],
        versionRe: /UniFi OS\s+([\d.]+)/i,
    },
    {
        product: "mantisbt",
        htmlRe: [/login_password_page\.php/i, /name=["']username["']/i],
    },
    {
        product: "oracle-ebs",
        htmlRe: [/AppsLocalLogin/i, /AuthenticateUser/i],
        urlRe: /OA_HTML|AppsLocalLogin/i,
    },
    {
        product: "hris-internal",
        generatorRe: /<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*HRIS[^"']*["']/i,
        urlRe: /hris|nikhris/i,
    },
];

export function fingerprintLoginProduct(html: string, pageUrl: string): ProductFingerprint | null {
    for (const entry of PRODUCT_REGISTRY) {
        if (entry.titleRe && !entry.titleRe.test(html)) continue;
        if (entry.generatorRe && !entry.generatorRe.test(html)) continue;
        if (entry.urlRe && !entry.urlRe.test(pageUrl)) continue;
        if (entry.htmlRe && !entry.htmlRe.some((re) => re.test(html))) continue;
        const markers = [
            entry.titleRe?.source,
            entry.generatorRe?.source,
            ...(entry.htmlRe ?? []).map((re) => re.source),
            entry.urlRe?.source,
        ].filter((m): m is string => Boolean(m));
        const version = entry.versionRe ? (html.match(entry.versionRe)?.[1] ?? null) : null;
        return { product: entry.product, version, markers };
    }
    return null;
}
