/**
 * Probe OpenAPI / Swagger untuk halaman SPA yang tidak menampilkan form login.
 *
 * Tujuan: kasus seperti http://192.168.2.3:8443 (FastAPI + React). Halaman
 * mentah berisi <div id="root"> saja, form login tidak pernah tampak. Tapi
 * server di belakang layar mengekspos /openapi.json, dan salah satu operasinya
 * adalah POST {username,password} — itulah yang sebenarnya diuji saat login.
 *
 * ATURAN KERAS (lihat detect-verify-v2 §4.2):
 * 1. Probe SELALU same-origin. Origin diturunkan dari URL halaman yang
 *    sedang diproses, BUKAN dari input admin. Tidak ada host lain disentuh.
 * 2. Hanya GET. Tidak pernah POST. JSON probe yang mengirim kredensial
 *    adalah tombol terpisah di UI dan ditangani oleh dispatcher, bukan sini.
 * 3. Cap body 512k. Cap the complete probe budget at 8 seconds. Common spec paths
 *    are tried sequentially with the remaining budget; no target POST is sent.
 * 4. TLS self-signed: pakai https.request per-hop dengan rejectUnauthorized:false,
 *    bukan NODE_TLS_REJECT_UNAUTHORIZED=0 (yang mematikan verifikasi untuk
 *    SELURUH proses termasuk DB dan SMTP).
 * 5. Output apiLayer = "OPENAPI" bila minimal satu kandidat ditemukan,
 *    "NONE" bila tidak. Mode SSO TIDAK berubah — tetap VAULT (aturan §4.3).
 */
import http from "http";
import https from "https";
import { URL } from "url";

export type ApiLayer = "OPENAPI" | "KNOWN_ENDPOINT" | "NONE";

export interface ApiContract {
    method: "POST" | "GET";
    path: string;
    params: string[];
}

export interface ApiProbe {
    layer: ApiLayer;
    contracts: ApiContract[];
    /** URL spec yang berhasil diambil (openapi.json atau swagger.json). */
    specUrl: string | null;
    /** Catatan proses — mis. "tidak ditemukan", "diabaikan: POST tanpa username". */
    note: string;
}

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;
/** Common spec locations used by FastAPI, ASP.NET, Nest, and reverse-proxied SPAs. */
const SPEC_PATHS = [
    "/openapi.json",
    "/swagger.json",
    "/api/openapi.json",
    "/api/swagger.json",
    "/v1/openapi.json",
    "/api/v1/openapi.json",
    "/swagger/v1/swagger.json",
];

/**
 * Endpoint login JSON yang lokasinya sudah dikenal dari produk nyata dan tidak
 * diekspos lewat OpenAPI. GET saja (aturan keras §2): 405 Method Not Allowed
 * dengan Allow: POST, atau 4xx yang menyebut username/password, adalah bukti
 * endpoint ada — tanpa mengirim apa pun.
 */
const KNOWN_LOGIN_ENDPOINTS = [
    { path: "/api/auth/login", params: ["username", "password"], product: "UniFi OS" },
];

/**
 * Interpretasi bukti GET pada endpoint dikenal. Murni agar bisa diuji.
 * 405 + Allow POST = endpoint ada tapi hanya menerima POST.
 * 400/401/415/422 dengan body menyebut username/password = endpoint auth hidup.
 */
export function knownEndpointEvidence(status: number, allowHeader: string | null, body: string): boolean {
    if (status === 405) {
        return /POST/i.test(allowHeader ?? "");
    }
    if (status === 400 || status === 401 || status === 415 || status === 422) {
        return /(?:username|password|user[_-]?name|credential)/i.test(body.slice(0, 2000));
    }
    return false;
}

function fetchSpec(specUrl: URL, timeoutMs = TIMEOUT_MS): Promise<{ status: number; body: string; allow: string | null } | null> {
    return new Promise((resolve) => {
        const transport = specUrl.protocol === "https:" ? https : http;
        const req = transport.request(
            {
                hostname: specUrl.hostname,
                port: specUrl.port || (specUrl.protocol === "https:" ? 443 : 80),
                path: `${specUrl.pathname}${specUrl.search}`,
                method: "GET",
                timeout: timeoutMs,
                ...(specUrl.protocol === "https:" ? { rejectUnauthorized: false } : {}),
                headers: {
                    accept: "application/json, */*;q=0.5",
                    "user-agent": "PortalApiProbe/1.0",
                },
            },
            (res) => {
                const allow = typeof res.headers.allow === "string" ? res.headers.allow : null;
                let data = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    data += chunk;
                    if (data.length > MAX_BYTES) req.destroy();
                });
                res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data.slice(0, MAX_BYTES), allow }));
                res.on("error", () => resolve(null));
            }
        );
        req.on("error", () => resolve(null));
        req.on("timeout", () => {
            req.destroy();
            resolve(null);
        });
        req.end();
    });
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeJsonPointerSegment(segment: string): string {
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Resolve only local OpenAPI references; external refs are intentionally ignored. */
function resolveLocalRef(root: JsonObject, ref: string, seen = new Set<string>()): unknown {
    if (!ref.startsWith("#/") || seen.has(ref)) return undefined;
    seen.add(ref);

    let current: unknown = root;
    for (const segment of ref.slice(2).split("/").map(decodeJsonPointerSegment)) {
        if (!isObject(current) || !(segment in current)) return undefined;
        current = current[segment];
    }

    if (isObject(current) && typeof current.$ref === "string") {
        return resolveLocalRef(root, current.$ref, seen);
    }
    return current;
}

function resolveRefObject(root: JsonObject, value: unknown): JsonObject | null {
    if (!isObject(value)) return null;
    if (typeof value.$ref === "string") {
        const resolved = resolveLocalRef(root, value.$ref);
        return isObject(resolved) ? resolved : null;
    }
    return value;
}

function isJsonMediaType(mediaType: string): boolean {
    const normalized = mediaType.toLowerCase().split(";")[0].trim();
    return normalized === "application/json" || normalized === "*/*" || normalized.endsWith("+json");
}

/** Collect property names through `$ref`, allOf/oneOf/anyOf, and required fields. */
function collectSchemaProperties(root: JsonObject, schema: unknown, out: Set<string>, seenRefs = new Set<string>()): void {
    if (!isObject(schema)) return;

    if (typeof schema.$ref === "string") {
        if (seenRefs.has(schema.$ref)) return;
        seenRefs.add(schema.$ref);
        collectSchemaProperties(root, resolveLocalRef(root, schema.$ref), out, seenRefs);
    }

    const properties = schema.properties;
    if (isObject(properties)) {
        for (const name of Object.keys(properties)) out.add(name);
    }
    if (Array.isArray(schema.required)) {
        for (const name of schema.required) {
            if (typeof name === "string") out.add(name);
        }
    }

    for (const composition of ["allOf", "oneOf", "anyOf"]) {
        const members = schema[composition];
        if (Array.isArray(members)) {
            for (const member of members) collectSchemaProperties(root, member, out, seenRefs);
        }
    }
}

function collectRequestBodyProperties(root: JsonObject, requestBody: unknown, out: Set<string>): void {
    const body = resolveRefObject(root, requestBody);
    if (!body) return;

    const content = body.content;
    if (isObject(content)) {
        for (const [mediaType, mediaValue] of Object.entries(content)) {
            if (!isJsonMediaType(mediaType)) continue;
            const media = resolveRefObject(root, mediaValue);
            collectSchemaProperties(root, media?.schema, out);
        }
    }

    // Swagger 2.0 body parameters can expose the schema directly.
    collectSchemaProperties(root, body.schema, out);
}

/** Cari operasi POST yang menerima kredensial username/password, termasuk schema `$ref`. */
export function extractContracts(spec: unknown): ApiContract[] {
    if (!isObject(spec) || !isObject(spec.paths)) return [];
    const root = spec;
    const paths = spec.paths;
    const likelyAuthContracts: ApiContract[] = [];
    const genericCredentialContracts: ApiContract[] = [];

    // Field names from real APIs vary widely. Boundaries include `_` and `-` so
    // user_id, user-id, username, and userId (lowercased) are all handled.
    const tokenRe = (alts: string[]): RegExp =>
        new RegExp(`(?:^|[_-])(?:${alts.join("|")})(?=[_-]|$)`, "i");
    const userRe = tokenRe([
        "username",
        "user_name",
        "userid",
        "user_id",
        "user",
        "user_code",
        "username_code",
        "email",
        "email_address",
        "emailaddress",
        "account",
        "account_id",
        "account_name",
        "employee_id",
        "staff_id",
        "member_id",
        "identifier",
        "nik",
        "nip",
        "nrp",
        "login",
        "login_id",
        "loginid",
        "login_name",
        "loginname",
    ]);
    const passRe = tokenRe([
        "password",
        "passwd",
        "pass_word",
        "pwd",
        "passcode",
        "passphrase",
        "sandi",
        "secret",
        "credential",
        "pin",
        "pin_code",
    ]);

    for (const [path, methodsRaw] of Object.entries(paths)) {
        if (!path.startsWith("/") || !isObject(methodsRaw)) continue;
        const post = resolveRefObject(root, methodsRaw.post);
        if (!post) continue;

        const params = new Set<string>();
        collectRequestBodyProperties(root, post.requestBody, params);

        if (Array.isArray(post.parameters)) {
            for (const rawParameter of post.parameters) {
                const parameter = resolveRefObject(root, rawParameter);
                if (!parameter) continue;

                // OpenAPI 2 body parameter: inspect its schema instead of adding
                // the generic parameter name "body".
                if (parameter.in === "body") {
                    collectSchemaProperties(root, parameter.schema, params);
                } else if (typeof parameter.name === "string" && parameter.name.trim()) {
                    params.add(parameter.name);
                }
            }
        }

        const names = Array.from(params);
        const hasUser = names.some((name) => userRe.test(name.toLowerCase()));
        const hasPass = names.some((name) => passRe.test(name.toLowerCase()));
        if (hasUser && hasPass) {
            const contract = { method: "POST" as const, path, params: names };
            const operationHint = [
                path,
                typeof post.summary === "string" ? post.summary : "",
                typeof post.operationId === "string" ? post.operationId : "",
                Array.isArray(post.tags) ? post.tags.join(" ") : "",
            ].join(" ");
            // Prefer actual authentication operations. User creation, password
            // rotation, and credential-management endpoints often also contain
            // username/password but must never become the first "Uji JSON" target.
            if (/(?:login|log[-_ ]?in|signin|sign[-_ ]?in|authenticate|authentication|oauth|token|session|sso)/i.test(operationHint)) {
                likelyAuthContracts.push(contract);
            } else {
                genericCredentialContracts.push(contract);
            }
        }
    }

    return likelyAuthContracts.length > 0 ? likelyAuthContracts : genericCredentialContracts;
}

/**
 * Probe API spec same-origin. pages: halaman hasil ladder (untuk derive origin).
 * Aman dipanggil berulang; tidak pernah melempar — degradasi ke {layer:"NONE"}.
 */
export async function probeApiLayer(pageUrl: string): Promise<ApiProbe> {
    let origin: URL;
    try {
        origin = new URL(pageUrl);
    } catch {
        return { layer: "NONE", contracts: [], specUrl: null, note: "URL halaman tidak valid" };
    }

    const deadline = Date.now() + TIMEOUT_MS;
    for (const specPath of SPEC_PATHS) {
        const remainingMs = deadline - Date.now();
        if (remainingMs < 250) break;
        const specUrl = new URL(specPath, origin);
        // SSRF guard: origin halaman sudah difilter fetch layer; di sini kita TIDAK
        // menerima input admin, hanya origin yang sama. Tetap guard agar konsisten.
        if (specUrl.host !== origin.host || specUrl.protocol !== origin.protocol) {
            return { layer: "NONE", contracts: [], specUrl: null, note: "Asal probe tidak cocok (same-origin gagal)" };
        }
        const res = await fetchSpec(specUrl, Math.min(TIMEOUT_MS, remainingMs));
        if (!res) continue;
        if (res.status < 200 || res.status >= 300) continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(res.body);
        } catch {
            continue;
        }
        const contracts = extractContracts(parsed);
        if (contracts.length === 0) {
            return {
                layer: "NONE",
                contracts: [],
                specUrl: specUrl.href,
                note: `Spesifikasi ${specPath} dimuat tetapi tidak memuat POST dengan {username,password}`,
            };
        }
        return {
            layer: "OPENAPI",
            contracts,
            specUrl: specUrl.href,
            note: `Kontrak API JSON terdeteksi: ${contracts
                .slice(0, 3)
                .map((c) => `${c.method} ${c.path}`)
                .join(", ")} — tombol Uji JSON tersedia`,
        };
    }

    // OpenAPI tidak ada — coba endpoint login JSON yang lokasinya dikenal.
    const known = await probeKnownLoginEndpoints(origin, deadline);
    if (known) return known;

    return { layer: "NONE", contracts: [], specUrl: null, note: "Tidak ada /openapi.json atau /swagger.json same-origin" };
}

/**
 * Probe endpoint login JSON yang lokasinya dikenal (UniFi OS dsb.) — GET saja,
 * bukti keberadaan dari status 405/4xx. Dipanggil setelah probe OpenAPI gagal.
 */
async function probeKnownLoginEndpoints(origin: URL, deadline: number): Promise<ApiProbe | null> {
    for (const known of KNOWN_LOGIN_ENDPOINTS) {
        const remainingMs = deadline - Date.now();
        if (remainingMs < 250) break;
        const endpointUrl = new URL(known.path, origin);
        if (endpointUrl.host !== origin.host || endpointUrl.protocol !== origin.protocol) continue;
        const res = await fetchSpec(endpointUrl, Math.min(TIMEOUT_MS, remainingMs));
        if (!res) continue;
        if (!knownEndpointEvidence(res.status, res.allow, res.body)) continue;
        return {
            layer: "KNOWN_ENDPOINT",
            contracts: [{ method: "POST", path: known.path, params: known.params }],
            specUrl: null,
            note:
                `Endpoint login ${known.product} dikenali (${known.path}, bukti GET ${res.status}). ` +
                "Parameter {username,password} sesuai konvensi produk — jalankan Uji JSON untuk memastikan.",
        };
    }
    return null;
}
