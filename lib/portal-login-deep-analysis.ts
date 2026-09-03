import { fetchLoginPage, type FetchedPage } from "@/lib/portal-fetch-html";
import { detectLoginFields, type DetectedFields } from "@/lib/portal-login-detect";
import { classifySsoMode, type ModeEvidence, type ModeVerdict, type SsoMode } from "@/lib/portal-sso-mode";
import { renderLoginPage, type RenderResult } from "@/lib/portal-browser-render";
import { probeApiLayer, type ApiContract, type ApiProbe } from "@/lib/portal-api-probe";
import { clientRouteFromUrl } from "@/lib/portal-client-route";
import { looksLikeClientRenderedApp, looksLikeOracleEbs } from "@/lib/portal-sso-relay";
import type { LadderDeps, LadderResult } from "@/lib/portal-detect-ladder";

export const DEEP_LOGIN_ANALYSIS_VERSION = "login-analysis/v1";

export type DeepLoginMethod = "FORM" | "POST" | "JSON" | "REROUTE" | "VAULT";
export type DeepCandidateStatus = "SUPPORTED" | "POSSIBLE" | "BLOCKED";
export type DeepAnalysisStatus = "READY" | "AMBIGUOUS" | "NEEDS_MANUAL" | "NO_LOGIN_SIGNAL";

export interface DeepLoginObservation {
    source: "HTTP" | "BROWSER";
    available: boolean;
    passwordDetected: boolean;
    usernameField: string | null;
    passwordField: string | null;
    formActionPath: string | null;
    httpMethod: string | null;
    confidence: number;
    finalPath: string | null;
    clientRoute: string | null;
    notes: string[];
}

export interface DeepApiObservation {
    layer: ApiProbe["layer"];
    specPath: string | null;
    contracts: Array<{ method: "POST" | "GET"; path: string; params: string[] }>;
    note: string;
}

export interface DeepLoginCandidate {
    method: DeepLoginMethod;
    /** Current executable SSO mode. JSON intentionally maps to VAULT until a JSON runtime mode exists. */
    ssoMode: SsoMode;
    status: DeepCandidateStatus;
    score: number;
    confidence: number;
    reasons: string[];
    evidence: string[];
    blockers: string[];
}

export interface DeepLoginAnalysis {
    version: typeof DEEP_LOGIN_ANALYSIS_VERSION;
    depth: "DEEP";
    status: DeepAnalysisStatus;
    finalPath: string | null;
    clientRoute: string | null;
    selectedSource: "HTTP" | "BROWSER" | "NONE";
    observations: {
        http: DeepLoginObservation;
        browser: DeepLoginObservation;
    };
    api: DeepApiObservation;
    candidates: DeepLoginCandidate[];
    recommendation: {
        method: DeepLoginMethod;
        ssoMode: SsoMode;
        confidence: number;
        rationale: string;
        requiresExplicitVerification: true;
    };
    nextSteps: string[];
    safety: string[];
}

export interface DeepLoginAnalysisResult {
    result: LadderResult;
    analysis: DeepLoginAnalysis;
}

interface InternalObservation extends DeepLoginObservation {
    html: string;
    finalUrl: string;
    detected: DetectedFields;
    verdict: ModeVerdict;
}

const VOLATILE_FIELD_RE = /^(?:__VIEWSTATE|__EVENTVALIDATION|__RequestVerificationToken|_csrf|csrf[-_]?token|_token|authenticity_token|csrfmiddlewaretoken)/i;
const FEDERATION_SIGNAL_RE = /federasi|ws[- ]?federation|saml|oidc|oauth/i;
const PAIRED_COOKIE_SIGNAL_RE = /terikat cookie|pasangan cookie/i;

function normalizePathname(pathname: string): string {
    const normalized = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
    return normalized || "/";
}

/** Return a path-only route and discard query/fragment values from the report. */
function safeRoute(value: string | null | undefined, baseUrl: string, sameOriginOnly = false): string | null {
    if (!value?.trim()) return null;
    try {
        const base = new URL(baseUrl);
        const parsed = new URL(value, base);
        if (parsed.search || parsed.hash) return null;
        if (sameOriginOnly && parsed.origin !== base.origin) return null;
        const path = normalizePathname(parsed.pathname);
        return parsed.origin === base.origin ? path : `${parsed.origin}${path}`;
    } catch {
        const path = value.split(/[?#]/, 1)[0].trim();
        if (!path || !path.startsWith("/")) return null;
        return normalizePathname(path);
    }
}

function safeContract(contract: ApiContract, baseUrl: string): { method: "POST" | "GET"; path: string; params: string[] } | null {
    const path = safeRoute(contract.path, baseUrl, true);
    if (!path) return null;
    const params = Array.from(new Set(
        contract.params
            .filter((param): param is string => typeof param === "string")
            .map((param) => param.trim())
            .filter((param) => param.length > 0 && param.length <= 100),
    )).sort();
    return { method: contract.method, path, params };
}

function safeApiObservation(apiProbe: ApiProbe, baseUrl: string): DeepApiObservation {
    const specPath = apiProbe.specUrl ? safeRoute(apiProbe.specUrl, baseUrl, true) : null;
    const contracts = apiProbe.contracts
        .map((contract) => safeContract(contract, baseUrl))
        .filter((contract): contract is { method: "POST" | "GET"; path: string; params: string[] } => Boolean(contract))
        .slice(0, 8);

    return {
        layer: apiProbe.layer,
        specPath,
        contracts,
        note: apiProbe.layer === "OPENAPI"
            ? `Kontrak API credentialless terdeteksi (${contracts.length} kandidat). Verifikasi JSON tetap harus dijalankan eksplisit.`
            : apiProbe.specUrl
              ? "Spesifikasi API ditemukan, tetapi belum ada kontrak login yang cukup kuat."
              : "Tidak ada kontrak API login yang dapat dibuktikan secara credentialless.",
    };
}

function emptyObservation(source: "HTTP" | "BROWSER", note: string): DeepLoginObservation {
    return {
        source,
        available: false,
        passwordDetected: false,
        usernameField: null,
        passwordField: null,
        formActionPath: null,
        httpMethod: null,
        confidence: 0,
        finalPath: null,
        clientRoute: null,
        notes: [note],
    };
}

function buildObservation(
    source: "HTTP" | "BROWSER",
    html: string,
    finalUrl: string,
    requestedUrl: string,
    detected: DetectedFields,
    verdict: ModeVerdict,
): InternalObservation {
    const formActionPath = safeRoute(detected.formAction, finalUrl);
    return {
        source,
        available: true,
        passwordDetected: Boolean(detected.passwordField),
        usernameField: detected.usernameField,
        passwordField: detected.passwordField,
        formActionPath,
        httpMethod: detected.httpMethod ?? "POST",
        confidence: detected.confidence ?? 0,
        finalPath: safeRoute(finalUrl, finalUrl),
        clientRoute: clientRouteFromUrl(finalUrl) ?? clientRouteFromUrl(requestedUrl),
        notes: [],
        html,
        finalUrl,
        detected,
        verdict,
    };
}

function publicObservation(observation: InternalObservation | DeepLoginObservation): DeepLoginObservation {
    return {
        source: observation.source,
        available: observation.available,
        passwordDetected: observation.passwordDetected,
        usernameField: observation.usernameField,
        passwordField: observation.passwordField,
        formActionPath: observation.formActionPath,
        httpMethod: observation.httpMethod,
        confidence: observation.confidence,
        finalPath: observation.finalPath,
        clientRoute: observation.clientRoute,
        notes: observation.notes,
    };
}

function observationScore(observation: InternalObservation): number {
    if (!observation.passwordDetected) return 0;
    return observation.confidence +
        (observation.formActionPath ? 250 : 0) +
        (observation.source === "HTTP" ? 30 : 0) +
        (observation.clientRoute ? 20 : 0);
}

function hasVolatileFields(observation: InternalObservation): boolean {
    return Object.keys(observation.detected.extraFields).some((name) => VOLATILE_FIELD_RE.test(name));
}

function hasFederationEvidence(observation: InternalObservation): boolean {
    return observation.verdict.signals.some((signal) => FEDERATION_SIGNAL_RE.test(signal));
}

function hasPairedCookieEvidence(observation: InternalObservation): boolean {
    return observation.verdict.signals.some((signal) => PAIRED_COOKIE_SIGNAL_RE.test(signal));
}

function candidate(
    method: DeepLoginMethod,
    ssoMode: SsoMode,
    status: DeepCandidateStatus,
    score: number,
    reasons: string[],
    evidence: string[],
    blockers: string[] = [],
): DeepLoginCandidate {
    return {
        method,
        ssoMode,
        status,
        score,
        confidence: Math.max(0, Math.min(100, Math.round(score))),
        reasons,
        evidence,
        blockers,
    };
}

function buildCandidates(input: {
    selected: InternalObservation;
    httpHtml: string;
    browserHtml: string | null;
    api: DeepApiObservation;
}): DeepLoginCandidate[] {
    const { selected, httpHtml, browserHtml, api } = input;
    const hasForm = selected.passwordDetected;
    const hasApi = api.contracts.length > 0;
    const browserOnly = selected.source === "BROWSER" && Boolean(selected.clientRoute) && !selected.formActionPath;
    const clientRendered = looksLikeClientRenderedApp(httpHtml) || Boolean(browserHtml && looksLikeClientRenderedApp(browserHtml));
    const oracle = looksLikeOracleEbs(selected.html, selected.finalUrl) || looksLikeOracleEbs(httpHtml, selected.finalUrl);
    const federated = hasFederationEvidence(selected);
    const pairedCookie = hasPairedCookieEvidence(selected);
    const volatile = hasVolatileFields(selected);
    const postEvidence = federated || pairedCookie || selected.verdict.mode === "POST";

    const reroute = candidate(
        "REROUTE",
        "REROUTE",
        oracle ? "SUPPORTED" : "BLOCKED",
        oracle ? 98 : 0,
        oracle
            ? ["Marker Oracle EBS dan endpoint AuthenticateUser cocok dengan transport REROUTE."]
            : ["Tidak ada bukti khusus Oracle EBS/AuthenticateUser."],
        oracle ? ["ORACLE_EBS"] : [],
        oracle ? [] : ["Butuh marker Oracle EBS yang konsisten sebelum REROUTE dipakai."],
    );

    const json = candidate(
        "JSON",
        "VAULT",
        hasApi ? "SUPPORTED" : clientRendered ? "POSSIBLE" : "BLOCKED",
        hasApi ? (browserOnly || clientRendered ? 95 : 82) : clientRendered ? 35 : 0,
        hasApi
            ? ["OpenAPI/Swagger same-origin mendeskripsikan POST dengan pasangan identity dan password.", "Metode teknis JSON ditemukan, tetapi runtime SSO JSON belum diaktifkan otomatis."]
            : ["Belum ada kontrak API JSON yang cukup kuat."],
        hasApi ? ["OPENAPI_CONTRACT"] : clientRendered ? ["SPA_SHELL"] : [],
        hasApi ? [] : ["Jalankan verifikasi hanya setelah kontrak API login dapat dibuktikan."],
    );

    const post = candidate(
        "POST",
        "POST",
        postEvidence && hasForm ? "SUPPORTED" : postEvidence ? "POSSIBLE" : "BLOCKED",
        postEvidence && hasForm ? 92 : postEvidence ? 48 : 0,
        postEvidence
            ? [federated ? "Rantai federasi terdeteksi; POST server-side dapat membawa cookie dan langkah redirect." : "Token antiforgery/cookie atau sinyal relay POST terdeteksi."]
            : ["Tidak ada bukti kuat bahwa relay POST diperlukan."],
        postEvidence ? [federated ? "FEDERATION" : pairedCookie ? "PAIRED_ANTIFORGERY_COOKIE" : "POST_SIGNAL"] : [],
        postEvidence && hasForm ? [] : ["Field login dan/atau endpoint relay belum cukup untuk POST."],
    );

    const form = candidate(
        "FORM",
        "FORM",
        hasForm && selected.formActionPath && !browserOnly ? "SUPPORTED" : hasForm && !browserOnly ? "POSSIBLE" : "BLOCKED",
        hasForm && selected.formActionPath && !browserOnly ? 88 : hasForm && !browserOnly ? 56 : 0,
        hasForm
            ? selected.formActionPath
                ? ["Pasangan username/password dan action form server eksplisit ditemukan."]
                : ["Pasangan field ditemukan, tetapi action form tidak eksplisit; perlu verifikasi sebelum native submit."]
            : ["Tidak ada password field yang dapat dipasangkan."],
        hasForm ? [selected.formActionPath ? "EXPLICIT_FORM_ACTION" : "FORM_FIELDS"] : [],
        browserOnly
            ? ["Form client-side tanpa action server tidak boleh dipaksa menjadi FORM/POST native."]
            : hasForm && selected.formActionPath
              ? []
              : ["Uji Login diperlukan untuk membuktikan action default dan respons aplikasi."],
    );

    const vault = candidate(
        "VAULT",
        "VAULT",
        !hasForm || browserOnly ? "SUPPORTED" : "POSSIBLE",
        browserOnly ? 90 : !hasForm && !hasApi ? 86 : !hasForm ? 64 : 32,
        browserOnly
            ? ["Login hanya muncul pada route client-side tanpa action server eksplisit."]
            : !hasForm
              ? ["Tidak ada field password yang dapat dikirim secara aman; VAULT adalah fallback jujur."]
              : ["VAULT tetap tersedia sebagai fallback manual bila verifikasi transport gagal."],
        browserOnly ? ["CLIENT_ROUTE", "BROWSER_FORM_WITHOUT_ACTION"] : !hasForm ? ["NO_PASSWORD_FIELD"] : [],
        [],
    );

    return [reroute, json, post, form, vault].sort((left, right) => right.score - left.score);
}

function buildNextSteps(recommendation: DeepLoginCandidate, analysis: { hasApi: boolean; hasForm: boolean }): string[] {
    switch (recommendation.method) {
        case "JSON":
            return [
                "Tinjau kontrak API yang ditemukan dan pilih endpoint yang benar.",
                "Jalankan Uji JSON dengan kredensial uji yang memang diotorisasi; hasilnya tidak menyimpan nilai kredensial.",
                "Jangan mengubah mode aplikasi menjadi JSON otomatis; runtime saat ini memakai VAULT sampai verifikasi eksplisit berhasil.",
            ];
        case "REROUTE":
            return ["Tinjau marker Oracle EBS dan field yang terdeteksi.", "Jalankan Uji Login sebelum menyimpan atau menyetujui profile."];
        case "POST":
            return ["Pastikan pasangan cookie/token antiforgery tetap tersedia saat relay.", "Jalankan Uji Login untuk memvalidasi seluruh rantai redirect."];
        case "FORM":
            return ["Tinjau action dan nama field yang ditemukan.", "Jalankan Uji Login sebelum menyetujui profile."];
        default:
            return analysis.hasApi
                ? ["Kontrak API ditemukan sebagai alternatif; gunakan Uji JSON jika admin mengotorisasi pengujian.", "Jika tidak, buka aplikasi target melalui VAULT dan login manual."]
                : analysis.hasForm
                  ? ["Native submit belum cukup terbukti; gunakan Uji Login atau VAULT."]
                  : ["Buka aplikasi target melalui VAULT dan login manual; discovery tidak mengirim kredensial."];
    }
}

function buildAnalysis(input: {
    requestedUrl: string;
    selected: InternalObservation | null;
    http: InternalObservation;
    browser: InternalObservation | DeepLoginObservation;
    api: DeepApiObservation;
    httpHtml: string;
    browserHtml: string | null;
}): DeepLoginAnalysis {
    const { requestedUrl, selected, http, browser, api, httpHtml, browserHtml } = input;
    const hasForm = Boolean(selected?.passwordDetected);
    const hasApi = api.contracts.length > 0;
    const candidates = selected
        ? buildCandidates({ selected, httpHtml, browserHtml, api })
        : [candidate("VAULT", "VAULT", "SUPPORTED", 86, ["Tidak ada observasi login yang cukup untuk metode otomatis."], ["NO_LOGIN_SIGNAL"] )];
    const recommendation = candidates.find((item) => item.status !== "BLOCKED") ?? candidates[candidates.length - 1];
    const second = candidates.find((item) => item !== recommendation && item.status !== "BLOCKED");
    const ambiguous = Boolean(second && recommendation.score - second.score <= 8 && recommendation.status === "SUPPORTED");
    const status: DeepAnalysisStatus = !selected || (!hasForm && !hasApi)
        ? "NO_LOGIN_SIGNAL"
        : ambiguous
          ? "AMBIGUOUS"
          : recommendation.method === "VAULT" && !hasApi
            ? "NEEDS_MANUAL"
            : "READY";

    const finalPath = selected?.finalPath ?? (browser.finalPath ?? http.finalPath);
    const clientRoute = selected?.clientRoute ?? browser.clientRoute ?? http.clientRoute;

    return {
        version: DEEP_LOGIN_ANALYSIS_VERSION,
        depth: "DEEP",
        status,
        finalPath,
        clientRoute,
        selectedSource: selected?.source ?? "NONE",
        observations: {
            http: publicObservation(http),
            browser: publicObservation(browser),
        },
        api,
        candidates,
        recommendation: {
            method: recommendation.method,
            ssoMode: recommendation.ssoMode,
            confidence: recommendation.confidence,
            rationale: ambiguous
                ? "Lebih dari satu metode memiliki bukti yang berdekatan; verifikasi eksplisit diperlukan sebelum memilih."
                : recommendation.reasons[0] ?? "Metode dipilih dari bukti yang tersedia.",
            requiresExplicitVerification: true,
        },
        nextSteps: buildNextSteps(recommendation, { hasApi, hasForm }),
        safety: [
            "Analisis ini hanya membaca HTML, DOM hasil browser, route, dan spesifikasi API; tidak mengirim username/password.",
            "Query/fragment token, cookie value, HTML mentah, dan kredensial tidak masuk ke report.",
            "Profile tetap memerlukan tinjauan/persetujuan admin; hasil analisis tidak mengganti konfigurasi secara diam-diam.",
        ],
    };
}

function classifyObservation(input: {
    html: string;
    finalUrl: string;
    requestedUrl: string;
    source: "HTTP" | "BROWSER";
    detected: DetectedFields;
    page: FetchedPage;
}): InternalObservation {
    const clientRoute = clientRouteFromUrl(input.finalUrl) ?? clientRouteFromUrl(input.requestedUrl);
    const evidence: ModeEvidence = {
        html: input.html,
        finalUrl: input.finalUrl,
        hopChain: input.page.hopChain,
        cookieNames: input.page.setCookies.map((cookie) => cookie.split("=")[0].trim()).filter(Boolean),
        detected: input.detected,
        redirected: input.page.redirected,
        loopDetected: input.page.loopDetected ?? false,
        clientRoute,
        layer: input.source,
    };
    return buildObservation(
        input.source,
        input.html,
        input.finalUrl,
        input.requestedUrl,
        input.detected,
        classifySsoMode(evidence),
    );
}

/**
 * Run a credentialless, evidence-based analysis across all available discovery
 * layers. This is intentionally separate from verify-login: finding a likely
 * transport is not proof that credentials are accepted.
 */
export async function analyzeLoginDeeply(url: string, deps: LadderDeps = {}): Promise<DeepLoginAnalysisResult> {
    const fetchPage = deps.fetchPage ?? fetchLoginPage;
    const render = deps.render ?? renderLoginPage;
    const probe = deps.probe ?? probeApiLayer;

    const page = await fetchPage(url);
    const httpDetected = detectLoginFields(page.html, { pageUrl: page.finalUrl || url, layer: "HTTP" });
    const httpFinalUrl = page.finalUrl || url;
    const httpObservation = classifyObservation({
        html: page.html,
        finalUrl: httpFinalUrl,
        requestedUrl: url,
        source: "HTTP",
        detected: httpDetected,
        page,
    });

    let rendered: RenderResult | null = null;
    try {
        rendered = await render(url, 12_000);
    } catch {
        rendered = null;
    }

    const browserFinalUrl = rendered?.finalUrl ?? (url.includes("#") ? url : httpFinalUrl);
    const browserDetected = rendered
        ? detectLoginFields(rendered.html, { pageUrl: browserFinalUrl, layer: "BROWSER" })
        : null;
    const browserObservation = rendered && browserDetected
        ? classifyObservation({
            html: rendered.html,
            finalUrl: browserFinalUrl,
            requestedUrl: url,
            source: "BROWSER",
            detected: browserDetected,
            page,
        })
        : emptyObservation("BROWSER", "Browser render tidak tersedia atau tidak menghasilkan DOM yang dapat dianalisis.");

    let apiProbe: ApiProbe;
    try {
        apiProbe = await probe(browserFinalUrl);
    } catch {
        apiProbe = { layer: "NONE", contracts: [], specUrl: null, note: "Probe API gagal secara aman; tidak ada kontrak yang diasumsikan." };
    }
    const api = safeApiObservation(apiProbe, browserFinalUrl);

    const availableObservations: InternalObservation[] = [
        httpObservation,
        // Di cabang ini browserObservation pasti hasil classifyObservation
        // (InternalObservation), bukan emptyObservation.
        ...(rendered && browserDetected ? [browserObservation as InternalObservation] : []),
    ].filter((observation) => observation.passwordDetected);
    const selected = availableObservations.length > 0
        ? availableObservations.sort((left, right) => observationScore(right) - observationScore(left))[0]
        : rendered && browserDetected
          ? browserObservation as InternalObservation
          : httpObservation;

    const analysis = buildAnalysis({
        requestedUrl: url,
        selected: selected.passwordDetected ? selected : null,
        http: httpObservation,
        browser: browserObservation,
        api,
        httpHtml: page.html,
        browserHtml: rendered?.html ?? null,
    });

    const notes = [
        "Deep analysis menjalankan HTML statis, browser render, dan probe OpenAPI secara credentialless.",
        rendered ? "DOM browser berhasil diamati." : "DOM browser tidak tersedia; kesimpulan browser bersifat terbatas.",
        api.layer === "OPENAPI" ? "Kontrak API login ditemukan dan ditambahkan sebagai kandidat terpisah." : "Tidak ada kontrak API login kuat yang ditemukan.",
    ];
    if (selected.source === "BROWSER" && selected.passwordDetected && !selected.formActionPath) {
        notes.push("Bukti terkuat berasal dari browser dan tidak memiliki action server eksplisit; native FORM/POST diblokir sampai endpoint dikonfirmasi.");
    }

    const result: LadderResult = {
        html: selected.html,
        finalUrl: selected.finalUrl,
        clientRoute: selected.clientRoute,
        setCookies: page.setCookies,
        cookieJar: page.cookieJar,
        cookieNames: page.setCookies.map((cookie) => cookie.split("=")[0].trim()).filter(Boolean),
        hopChain: page.hopChain,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
        detected: selected.detected,
        verdict: selected.verdict,
        layer: selected.source,
        layerNotes: notes,
        apiProbe,
    };

    return { result, analysis };
}
