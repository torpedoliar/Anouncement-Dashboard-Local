import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/portal-crypto";
import type { DetectedFields } from "@/lib/portal-login-detect";
import type { SsoMode } from "@/lib/portal-sso-mode";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

/**
 * Lapis analisis LLM opsional untuk deteksi login.
 *
 * Prinsip:
 * - Opt-in: hanya jalan bila admin mengaktifkan + mengisi baseUrl/model di
 *   Pengaturan AI Portal. Tanpa konfigurasi, fungsi mengembalikan null.
 * - Fail-closed: error/timeout/jawaban tidak valid -> null, heuristik tetap
 *   menjadi sumber keputusan.
 * - Anti-halusinasi: field/action yang disarankan LLM WAJIB ada di DOM nyata
 *   (daftar kandidat dibangun di sisi server). Saran di luar daftar dibuang.
 * - Privasi: DOM dipangkas menjadi struktur form/field saja; nilai input
 *   (termasuk token hidden) TIDAK pernah dikirim ke model.
 */

export interface LlmLoginAnalysis {
    usernameField: string | null;
    passwordField: string | null;
    formAction: string | null;
    httpMethod: "GET" | "POST" | null;
    multiStep: boolean;
    /** Endpoint JSON login bila halaman SPA mengirim kredensial via fetch/XHR. */
    loginApiEndpoint: string | null;
    recommendedMode: SsoMode | null;
    confidence: number;
    rationale: string;
}

interface PrunedDom {
    /** Ringkasan terstruktur untuk prompt. */
    summary: string;
    /** Nama/id field yang benar-benar ada — untuk verifikasi anti-halusinasi. */
    fieldKeys: Set<string>;
    /** Action form yang benar-benar ada. */
    formActions: Set<string>;
}

const MAX_PRUNED_CHARS = 6000;
const LLM_TIMEOUT_MS = 20_000;

function isElement(n: Node): n is Element {
    if (!n) return false;
    if (n.nodeName === "#text" || n.nodeName === "#comment" || n.nodeName === "#documentType") return false;
    return "tagName" in n;
}

function isTextNode(n: Node): boolean {
    return n.nodeName === "#text" && "value" in n;
}

function extractText(node: Node): string {
    if (isTextNode(node)) return (node as { value?: string }).value ?? "";
    if (!isElement(node)) return "";
    let text = "";
    for (const child of node.childNodes || []) {
        text += extractText(child) + " ";
    }
    return text.trim();
}

function attr(el: Element, name: string): string | null {
    return el.attrs.find((a) => a.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

/** Pangkas DOM menjadi ringkasan form/field untuk prompt. Nilai input dibuang. */
function pruneDom(html: string): PrunedDom {
    const doc = parse(html);
    const fieldKeys = new Set<string>();
    const formActions = new Set<string>();
    const lines: string[] = [];

    let formIndex = -1;

    const walk = (node: Node): void => {
        if (!node || lines.join("\n").length > MAX_PRUNED_CHARS) return;
        if (isElement(node)) {
            const tag = node.tagName.toLowerCase();
            if (tag === "title") {
                const t = extractText(node).slice(0, 120);
                if (t) lines.push(`title: ${t}`);
            } else if (tag === "form") {
                formIndex++;
                const action = attr(node, "action") ?? "";
                const method = (attr(node, "method") ?? "post").toUpperCase();
                if (action) formActions.add(action);
                const idClass = [attr(node, "id"), attr(node, "class")].filter(Boolean).join(" ").slice(0, 120);
                lines.push(`form#${formIndex} method=${method} action=${action || "(kosong)"}${idClass ? ` id/class="${idClass}"` : ""}`);
            } else if (tag === "input" || tag === "textarea" || tag === "button") {
                const type = (attr(node, "type") ?? (tag === "button" ? "submit" : "text")).toLowerCase();
                const name = attr(node, "name");
                const id = attr(node, "id");
                if (name) fieldKeys.add(name);
                if (id) fieldKeys.add(id);
                if (tag === "button" || type === "submit") {
                    const label = extractText(node).slice(0, 60);
                    lines.push(`  button type=${type} name=${name ?? "-"}${label ? ` text="${label}"` : ""}`);
                } else if (type !== "hidden") {
                    // Field terlihat: sertakan petunjuk semantik, TANPA value.
                    const hints = [
                        attr(node, "placeholder"),
                        attr(node, "aria-label"),
                        attr(node, "autocomplete"),
                        attr(node, "data-testid") ?? attr(node, "data-test-id") ?? attr(node, "data-test"),
                    ].filter(Boolean).join(" ").slice(0, 160);
                    lines.push(`  input type=${type} name=${name ?? "-"} id=${id ?? "-"}${hints ? ` hints="${hints}"` : ""}`);
                } else if (name) {
                    // Hidden: nama saja (token CSRF dsb.), nilai TIDAK disertakan.
                    lines.push(`  input type=hidden name=${name}`);
                }
            }
        }
        if ("childNodes" in node && Array.isArray(node.childNodes)) {
            for (const child of node.childNodes) walk(child);
        }
    };
    walk(doc);

    return { summary: lines.join("\n").slice(0, MAX_PRUNED_CHARS), fieldKeys, formActions };
}

interface AiConfig {
    baseUrl: string;
    model: string;
    apiKey: string | null;
}

async function loadAiConfig(): Promise<AiConfig | null> {
    const cfg = await prisma.portalAiSettings.findFirst();
    if (!cfg || !cfg.enabled || !cfg.baseUrl || !cfg.model) return null;
    let apiKey: string | null = null;
    if (cfg.apiKeyEncrypted) {
        try {
            apiKey = decrypt(cfg.apiKeyEncrypted);
        } catch {
            apiKey = null;
        }
    }
    return { baseUrl: cfg.baseUrl.replace(/\/+$/, ""), model: cfg.model, apiKey };
}

async function recordUsage(error: string | null): Promise<void> {
    try {
        await prisma.portalAiSettings.updateMany({
            data: { lastUsedAt: new Date(), lastError: error },
        });
    } catch {
        // Pencatatan tidak boleh menggagalkan analisis.
    }
}

/** Buang query/fragment dari URL sebelum masuk prompt LLM. */
function stripUrlSecrets(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.search = "";
        parsed.hash = "";
        return parsed.toString();
    } catch {
        return url.split(/[?#]/, 1)[0];
    }
}

const SYSTEM_PROMPT = [
    "Kamu adalah analis halaman login web. Diberikan ringkasan DOM (daftar form, input, dan tombol) dari sebuah halaman login, tentukan cara login otomatis yang benar.",
    "Jawab HANYA dengan satu objek JSON valid (tanpa markdown, tanpa teks lain) dengan skema:",
    '{"usernameField": string|null, "passwordField": string|null, "formAction": string|null, "httpMethod": "GET"|"POST"|null, "multiStep": boolean, "loginApiEndpoint": string|null, "recommendedMode": "FORM"|"POST"|"REROUTE"|"VAULT"|null, "confidence": 0-100, "rationale": string}',
    "Aturan:",
    "- usernameField/passwordField harus persis nilai atribut name (atau id bila name tidak ada) dari daftar yang diberikan; jangan mengarang nama lain.",
    "- formAction harus salah satu action form yang diberikan, atau null.",
    "- multiStep=true bila halaman hanya meminta identifier (email/username) dulu dan password diminta pada langkah berikutnya.",
    "- loginApiEndpoint hanya bila jelas halaman SPA mengirim kredensial via fetch/XHR JSON; selain itu null.",
    "- recommendedMode: FORM untuk form HTML biasa; POST bila ada token antiforgery terikat cookie/rantai redirect federasi; REROUTE hanya untuk Oracle EBS; VAULT bila tidak ada cara aman mengirim kredensial.",
    "- rationale dalam Bahasa Indonesia, maksimal 2 kalimat.",
].join("\n");

function safeJsonObject(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[0]);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

// Diekspor untuk self-check scripts/test-llm-analyze.ts (tanpa DB/LLM).
export const __llmTestables = { pruneDom, safeJsonObject, stripUrlSecrets };

/**
 * Analisis login via LLM. Mengembalikan null bila LLM nonaktif/gagal/jawabannya
 * tidak lolos verifikasi anti-halusinasi.
 */
export async function analyzeLoginWithLlm(input: {
    url: string;
    html: string;
    layer: "HTTP" | "BROWSER";
    heuristic: DetectedFields;
}): Promise<LlmLoginAnalysis | null> {
    let config: AiConfig | null;
    try {
        config = await loadAiConfig();
    } catch {
        return null;
    }
    if (!config) return null;

    const pruned = pruneDom(input.html);
    if (!pruned.summary.trim()) return null;

    const heuristicNote = input.heuristic.passwordField
        ? `Detektor heuristik menemukan username=${input.heuristic.usernameField ?? "-"}, password=${input.heuristic.passwordField}.`
        : input.heuristic.multiStep
          ? "Detektor heuristik menandai halaman ini login dua langkah (identifier-first)."
          : "Detektor heuristik TIDAK menemukan form login.";

    // URL dipangkas ke origin+path: query WS-Fed/SAML/OIDC dan hash route dapat
    // membawa token yang tidak boleh keluar ke model eksternal.
    const safeUrl = stripUrlSecrets(input.url);

    const userPrompt = [
        `URL halaman: ${safeUrl}`,
        `Lapis deteksi: ${input.layer}`,
        heuristicNote,
        "",
        "Ringkasan DOM:",
        pruned.summary,
    ].join("\n");

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

    let raw: string;
    try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0,
                max_tokens: 400,
            }),
            signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        });
        if (!res.ok) {
            await recordUsage(`LLM HTTP ${res.status}`);
            return null;
        }
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            await recordUsage("LLM: respons tanpa content");
            return null;
        }
        raw = content;
    } catch (error) {
        await recordUsage(`LLM fetch gagal: ${error instanceof Error ? error.message : "unknown"}`.slice(0, 200));
        return null;
    }

    const parsed = safeJsonObject(raw);
    if (!parsed) {
        await recordUsage("LLM: JSON tidak valid");
        return null;
    }

    // ── Verifikasi anti-halusinasi ───────────────────────────────────────────
    // Field/action hanya diterima bila benar-benar ada di DOM yang kita kirim.
    const pickField = (value: unknown): string | null => {
        if (typeof value !== "string" || !value.trim()) return null;
        const candidate = value.trim();
        return pruned.fieldKeys.has(candidate) ? candidate : null;
    };
    const pickAction = (value: unknown): string | null => {
        if (typeof value !== "string" || !value.trim()) return null;
        const candidate = value.trim();
        return pruned.formActions.has(candidate) ? candidate : null;
    };
    const pickEndpoint = (value: unknown): string | null => {
        if (typeof value !== "string" || !value.trim()) return null;
        const candidate = value.trim();
        // Hanya path same-origin; tanpa query/fragment (bisa membawa token).
        if (!candidate.startsWith("/") || candidate.includes("?") || candidate.includes("#")) return null;
        return candidate.length <= 200 ? candidate : null;
    };
    const pickMode = (value: unknown): SsoMode | null =>
        value === "FORM" || value === "POST" || value === "REROUTE" || value === "VAULT" ? value : null;

    const confidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
        : 0;

    await recordUsage(null);
    return {
        usernameField: pickField(parsed.usernameField),
        passwordField: pickField(parsed.passwordField),
        formAction: pickAction(parsed.formAction),
        httpMethod: parsed.httpMethod === "GET" || parsed.httpMethod === "POST" ? parsed.httpMethod : null,
        multiStep: parsed.multiStep === true,
        loginApiEndpoint: pickEndpoint(parsed.loginApiEndpoint),
        recommendedMode: pickMode(parsed.recommendedMode),
        confidence,
        rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 400) : "",
    };
}
