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
 * 3. Cap body 512k. Cap waktu 8 detik. Cap dua path (openapi, swagger).
 * 4. TLS self-signed: pakai https.request per-hop dengan rejectUnauthorized:false,
 *    bukan NODE_TLS_REJECT_UNAUTHORIZED=0 (yang mematikan verifikasi untuk
 *    SELURUH proses termasuk DB dan SMTP).
 * 5. Output apiLayer = "OPENAPI" bila minimal satu kandidat ditemukan,
 *    "NONE" bila tidak. Mode SSO TIDAK berubah — tetap VAULT (aturan §4.3).
 */
import http from "http";
import https from "https";
import { URL } from "url";

export type ApiLayer = "OPENAPI" | "NONE";

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
/** Path yang dicoba, berurutan. Berhenti di spec pertama yang 2xx + JSON valid. */
const SPEC_PATHS = ["/openapi.json", "/swagger.json"];

function fetchSpec(specUrl: URL): Promise<{ status: number; body: string } | null> {
    return new Promise((resolve) => {
        const transport = specUrl.protocol === "https:" ? https : http;
        const req = transport.request(
            {
                hostname: specUrl.hostname,
                port: specUrl.port || (specUrl.protocol === "https:" ? 443 : 80),
                path: `${specUrl.pathname}${specUrl.search}`,
                method: "GET",
                timeout: TIMEOUT_MS,
                ...(specUrl.protocol === "https:" ? { rejectUnauthorized: false } : {}),
                headers: {
                    accept: "application/json, */*;q=0.5",
                    "user-agent": "PortalApiProbe/1.0",
                },
            },
            (res) => {
                let data = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    data += chunk;
                    if (data.length > MAX_BYTES) req.destroy();
                });
                res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data.slice(0, MAX_BYTES) }));
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

/** Cari operasi POST yang menerima {username,password} (atau "password"|"pwd"). */
export function extractContracts(spec: unknown): ApiContract[] {
    if (!spec || typeof spec !== "object") return [];
    const root = spec as { paths?: Record<string, unknown> };
    if (!root.paths || typeof root.paths !== "object") return [];

    const out: ApiContract[] = [];
    // Pencocokan nama field tolerant underscore. Token diapit (^|_) di kiri
    // dan (_,|$) di kanan — whole-token, bukan prefix. Tanpa ini "pass" akan
    // cocok pada "passcode" / "user" pada "username-id" → kontrak palsu.
    const tokenRe = (alts: string[]): RegExp =>
        new RegExp(`(?:^|_)(?:${alts.join("|")})(?=_|$)`, "i");
    const userRe = tokenRe(["username", "user_name", "user", "email", "nik", "login"]);
    const passRe = tokenRe(["password", "passwd", "pass_word", "pwd", "sandi"]);

    for (const [path, methodsRaw] of Object.entries(root.paths)) {
        if (typeof path !== "string" || !path.startsWith("/")) continue;
        if (!methodsRaw || typeof methodsRaw !== "object") continue;
        const methods = methodsRaw as Record<string, unknown>;
        const post = methods.post;
        if (!post || typeof post !== "object") continue;

        // Ambil nama field dari requestBody.schema.properties (OpenAPI 3) atau
        // parameters[].name (OpenAPI 2 / Swagger).
        const params = new Set<string>();
        const op = post as { requestBody?: { content?: { "application/json"?: { schema?: { properties?: Record<string, unknown> } } } }; parameters?: Array<{ name?: string; in?: string }> };
        const props = op.requestBody?.content?.["application/json"]?.schema?.properties;
        if (props && typeof props === "object") {
            for (const name of Object.keys(props)) params.add(name);
        }
        if (Array.isArray(op.parameters)) {
            for (const p of op.parameters) {
                if (p && typeof p === "object" && typeof p.name === "string") params.add(p.name);
            }
        }
        const names = Array.from(params);
        const hasUser = names.some((n) => userRe.test(n));
        const hasPass = names.some((n) => passRe.test(n));
        if (hasUser && hasPass) {
            out.push({ method: "POST", path, params: names });
        }
    }
    return out;
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

    for (const specPath of SPEC_PATHS) {
        const specUrl = new URL(specPath, origin);
        // SSRF guard: origin halaman sudah difilter fetch layer; di sini kita TIDAK
        // menerima input admin, hanya origin yang sama. Tetap guard agar konsisten.
        if (specUrl.host !== origin.host || specUrl.protocol !== origin.protocol) {
            return { layer: "NONE", contracts: [], specUrl: null, note: "Asal probe tidak cocok (same-origin gagal)" };
        }
        const res = await fetchSpec(specUrl);
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

    return { layer: "NONE", contracts: [], specUrl: null, note: "Tidak ada /openapi.json atau /swagger.json same-origin" };
}
