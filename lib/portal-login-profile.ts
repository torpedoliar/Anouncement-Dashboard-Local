import {
    Prisma,
    type PortalLoginProfile,
    type PortalLoginProfileApproval,
    type PortalLoginProfileState,
    type PortalSsoMode,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { type ApiContract } from "@/lib/portal-api-probe";
import { type LadderResult, detectWithLadder } from "@/lib/portal-detect-ladder";
import { computeLoginFingerprint } from "@/lib/portal-fingerprint";
import { assertSafeHttpUrl } from "@/lib/portal-url-guard";

/**
 * Profil deteksi adalah metadata struktural, bukan sesi login. Nilai hidden
 * fields, cookie, token, HTML mentah, URL query, dan kredensial tidak pernah
 * disimpan di profile atau riwayat evidence.
 */
export const LOGIN_PROFILE_DETECTOR_VERSION = "adaptive-profile/v2";

export type LoginProfileSource = "DISCOVERY" | "REVALIDATION";
export type LoginProfileValidationOutcome =
    | "TRANSPORT_VALIDATED"
    | "CREDENTIAL_ACCEPTED"
    | "REJECTED";

export const loginProfileSummarySelect = {
    id: true,
    origin: true,
    entryPath: true,
    finalPath: true,
    formActionPath: true,
    httpMethod: true,
    usernameField: true,
    passwordField: true,
    extraFieldNames: true,
    recommendedMode: true,
    detectionLayer: true,
    discoveryConfidence: true,
    discoverySignals: true,
    warnings: true,
    apiContracts: true,
    apiSpecPath: true,
    currentFingerprint: true,
    approvedFingerprint: true,
    approvalStatus: true,
    state: true,
    detectorVersion: true,
    lastDiscoveredAt: true,
    lastCheckedAt: true,
    lastTransportValidatedAt: true,
    lastCredentialAcceptedAt: true,
    staleAt: true,
    lastError: true,
    approvedAt: true,
} satisfies Prisma.PortalLoginProfileSelect;

type LoginProfileSummaryRecord = Prisma.PortalLoginProfileGetPayload<{
    select: typeof loginProfileSummarySelect;
}>;

export interface LoginProfileSummary {
    id: string;
    origin: string;
    entryPath: string;
    finalPath: string | null;
    formActionPath: string | null;
    httpMethod: string | null;
    usernameField: string | null;
    passwordField: string | null;
    extraFieldNames: string[];
    recommendedMode: string | null;
    detectionLayer: string;
    discoveryConfidence: number | null;
    discoverySignals: string[];
    warnings: string[];
    apiContracts: ApiContract[];
    apiSpecPath: string | null;
    currentFingerprint: string;
    approvedFingerprint: string | null;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
    state: "DISCOVERED" | "TRANSPORT_VALIDATED" | "CREDENTIAL_ACCEPTED" | "REJECTED" | "STALE";
    requiresApproval: boolean;
    detectorVersion: string;
    lastDiscoveredAt: Date;
    lastCheckedAt: Date | null;
    lastTransportValidatedAt: Date | null;
    lastCredentialAcceptedAt: Date | null;
    staleAt: Date | null;
    lastError: string | null;
    approvedAt: Date | null;
}

export interface LoginProfileCandidate {
    origin: string;
    entryPath: string;
    finalPath: string | null;
    formActionPath: string | null;
    httpMethod: string | null;
    usernameField: string | null;
    passwordField: string | null;
    extraFieldNames: string[];
    recommendedMode: PortalSsoMode | null;
    detectionLayer: string;
    discoveryConfidence: number | null;
    discoverySignals: string[];
    warnings: string[];
    apiContracts: ApiContract[];
    apiSpecPath: string | null;
    fingerprint: string;
}

export interface LoginProfileMutation {
    profile: LoginProfileSummary;
    created: boolean;
    changed: boolean;
    becameStale: boolean;
}

export interface LoginProfileConfiguration {
    loginUrl: string;
    ssoMode: string;
    httpMethod: string;
    usernameField: string;
    passwordField: string;
}

export interface ProfileBoundPortalApp extends LoginProfileConfiguration {
    id: string;
    url: string;
    extraFields: Prisma.JsonValue | null;
    isActive: boolean;
    isPublic: boolean;
    updatedAt: Date;
    loginProfileId: string | null;
    loginProfileFingerprint: string | null;
    loginProfile: PortalLoginProfile | null;
}

export interface BoundProfileReleasePreparation {
    app: ProfileBoundPortalApp;
    liveExtraFields: Record<string, string>;
}

export class LoginProfileApprovalError extends Error {}
export class LoginProfileBindingError extends Error {}
export class LoginProfileLaunchBlockedError extends Error {}
export class PortalAppCredentialReleaseDeniedError extends Error {}
class VerificationSnapshotConflictError extends Error {}

const SAFE_DISCOVERY_MESSAGES = {
    federated: "Rantai federasi terdeteksi.",
    pairedAntiForgery: "Token antiforgery terikat sesi terdeteksi.",
    volatileFields: "Field token dinamis terdeteksi.",
    redirected: "Pengalihan menuju halaman login terdeteksi.",
    browserRendered: "Halaman login dirender melalui browser.",
    apiContract: "Kontrak API login terdeteksi.",
    redirectLoop: "Loop pengalihan login terdeteksi.",
    antiForgeryWarning: "Token antiforgery terikat sesi memerlukan mode POST.",
    volatileWarning: "Token dinamis akan disegarkan saat peluncuran login.",
    redirectWarning: "Halaman login mengalami pengalihan.",
    renderUnavailable: "Render browser tidak tersedia; hasil memakai HTML statis.",
    genericSignal: "Sinyal deteksi login teramati.",
} as const;

const NO_CANDIDATE_REVALIDATION_ERROR =
    "Revalidasi tidak menemukan struktur login atau kontrak API yang dapat dipastikan.";
const OBSERVATION_FAILED_REVALIDATION_ERROR =
    "Revalidasi profile gagal diamati; akan dicoba kembali pada jadwal berikutnya.";
const PROFILE_WRITE_RETRIES = 3;

function normalizePathname(url: URL): string {
    const pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
    return pathname || "/";
}

function locationFrom(rawUrl: string): { origin: string; path: string } | null {
    const safe = assertSafeHttpUrl(rawUrl);
    if (!safe.ok) return null;

    try {
        const url = new URL(safe.href);
        return { origin: safe.origin, path: normalizePathname(url) };
    } catch {
        return null;
    }
}

function hasQueryOrFragment(rawUrl: string): boolean {
    try {
        const url = new URL(rawUrl);
        return Boolean(url.search || url.hash);
    } catch {
        return true;
    }
}

/** URL untuk UI/audit hanya menyimpan origin + pathname, tanpa query atau fragment. */
export function sanitizeLoginUrlForDisplay(rawUrl: string): string | null {
    const location = locationFrom(rawUrl);
    return location ? `${location.origin}${location.path}` : null;
}

function actionPathFrom(rawAction: string | null | undefined, baseUrl: string, origin: string): string | null {
    if (!rawAction) return null;

    try {
        const action = new URL(rawAction, baseUrl);
        const safe = assertSafeHttpUrl(action.href);
        if (!safe.ok || action.search || action.hash) return null;
        const path = normalizePathname(action);
        return safe.origin === origin ? path : `${safe.origin}${path}`;
    } catch {
        return null;
    }
}

function apiSpecPathFrom(specUrl: string | null): string | null {
    if (!specUrl) return null;
    const location = locationFrom(specUrl);
    return location?.path ?? null;
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

function normalizeApiContractPath(path: string): string {
    try {
        return normalizePathname(new URL(path, "http://portal-profile.invalid"));
    } catch {
        const withoutQueryOrFragment = path.split(/[?#]/, 1)[0].trim();
        return withoutQueryOrFragment.startsWith("/") ? withoutQueryOrFragment || "/" : `/${withoutQueryOrFragment}`;
    }
}

function apiContracts(value: unknown): ApiContract[] {
    if (!Array.isArray(value)) return [];

    const contracts: ApiContract[] = value.flatMap((item): ApiContract[] => {
        if (!item || typeof item !== "object") return [];
        const contract = item as Record<string, unknown>;
        const method = contract.method === "GET" || contract.method === "POST" ? contract.method : null;
        if (!method || typeof contract.path !== "string") return [];
        return [{
            method,
            path: normalizeApiContractPath(contract.path),
            params: Array.from(new Set(stringArray(contract.params)
                .map((name) => name.trim())
                .filter((name) => name.length > 0 && name.length <= 100))).sort(),
        }];
    });

    const unique = new Map<string, ApiContract>();
    for (const contract of contracts) {
        unique.set(`${contract.method}\u0000${contract.path}\u0000${contract.params.join("\u0000")}`, contract);
    }
    return Array.from(unique.values()).sort((left, right) =>
        `${left.method}\u0000${left.path}\u0000${left.params.join("\u0000")}`.localeCompare(
            `${right.method}\u0000${right.path}\u0000${right.params.join("\u0000")}`,
        ),
    );
}

function strongestKnownState(profile: Pick<PortalLoginProfile, "lastCredentialAcceptedAt" | "lastTransportValidatedAt">): PortalLoginProfileState {
    if (profile.lastCredentialAcceptedAt) return "CREDENTIAL_ACCEPTED";
    if (profile.lastTransportValidatedAt) return "TRANSPORT_VALIDATED";
    return "DISCOVERED";
}

function containsAny(value: string, expressions: RegExp[]): boolean {
    return expressions.some((expression) => expression.test(value));
}

/**
 * Hanya kategori evidence stabil yang boleh masuk database. Semua text detector
 * mentah dapat memuat URL redirect ber-query atau metadata cookie dan karenanya
 * sengaja dibuang pada boundary ini.
 */
function safeDiscoveryEvidenceFromResult(result: LadderResult): {
    discoverySignals: string[];
    warnings: string[];
    layerNotes: string[];
} {
    const rawSignals = [...result.verdict.signals, ...result.layerNotes].join(" ").toLowerCase();
    const rawWarnings = [...(result.detected.warnings ?? []), ...result.verdict.warnings].join(" ").toLowerCase();
    const signals = new Set<string>();
    const warnings = new Set<string>();
    const layerNotes = new Set<string>();

    if (containsAny(rawSignals, [/federasi/, /ws-federation/, /saml/, /oidc/, /oauth/])) {
        signals.add(SAFE_DISCOVERY_MESSAGES.federated);
    }
    if (containsAny(rawSignals, [/antiforgery/, /cookie.*token/, /token.*cookie/])) {
        signals.add(SAFE_DISCOVERY_MESSAGES.pairedAntiForgery);
    }
    if (containsAny(rawSignals, [/token dinamis/, /volatile/, /csrf/, /viewstate/, /eventvalidation/])) {
        signals.add(SAFE_DISCOVERY_MESSAGES.volatileFields);
    }
    if (result.redirected || containsAny(rawSignals, [/pengalihan/, /redirect/])) {
        signals.add(SAFE_DISCOVERY_MESSAGES.redirected);
    }
    if (result.layer === "BROWSER" || containsAny(rawSignals, [/javascript/, /dirender/, /browser/])) {
        signals.add(SAFE_DISCOVERY_MESSAGES.browserRendered);
    }
    if (result.apiProbe.contracts.length > 0) {
        signals.add(SAFE_DISCOVERY_MESSAGES.apiContract);
    }
    if (result.loopDetected) {
        signals.add(SAFE_DISCOVERY_MESSAGES.redirectLoop);
    }

    if (containsAny(rawWarnings, [/antiforgery/, /cookie.*token/, /token.*cookie/])) {
        warnings.add(SAFE_DISCOVERY_MESSAGES.antiForgeryWarning);
    }
    if (containsAny(rawWarnings, [/token dinamis/, /volatile/, /csrf/, /viewstate/, /eventvalidation/])) {
        warnings.add(SAFE_DISCOVERY_MESSAGES.volatileWarning);
    }
    if (containsAny(rawWarnings, [/pengalihan/, /redirect/])) {
        warnings.add(SAFE_DISCOVERY_MESSAGES.redirectWarning);
    }
    if (result.layerNotes.some((note) => /render browser tidak tersedia/i.test(note))) {
        layerNotes.add(SAFE_DISCOVERY_MESSAGES.renderUnavailable);
    }
    if (result.layer === "BROWSER") {
        layerNotes.add(SAFE_DISCOVERY_MESSAGES.browserRendered);
    }

    return {
        discoverySignals: Array.from(signals),
        warnings: Array.from(warnings),
        layerNotes: Array.from(layerNotes),
    };
}

/**
 * Menyaring signal yang berasal dari request PortalApp agar admin tidak dapat
 * tanpa sengaja menyimpan URL/cookie detail dari respons detektor lama.
 */
export function sanitizePortalAppDiscoverySignals(value: unknown): string[] {
    const output = new Set<string>();
    for (const rawValue of stringArray(value)) {
        const raw = rawValue.toLowerCase();
        if (containsAny(raw, [/federasi/, /ws-federation/, /saml/, /oidc/, /oauth/])) {
            output.add(SAFE_DISCOVERY_MESSAGES.federated);
        } else if (containsAny(raw, [/antiforgery/, /cookie/, /token.*cookie/, /cookie.*token/])) {
            output.add(SAFE_DISCOVERY_MESSAGES.pairedAntiForgery);
        } else if (containsAny(raw, [/token dinamis/, /volatile/, /csrf/, /viewstate/, /eventvalidation/])) {
            output.add(SAFE_DISCOVERY_MESSAGES.volatileFields);
        } else if (containsAny(raw, [/javascript/, /dirender/, /browser/])) {
            output.add(SAFE_DISCOVERY_MESSAGES.browserRendered);
        } else if (containsAny(raw, [/openapi/, /swagger/, /kontrak api/, /json/])) {
            output.add(SAFE_DISCOVERY_MESSAGES.apiContract);
        } else if (containsAny(raw, [/loop/, /pengalihan/, /redirect/])) {
            output.add(SAFE_DISCOVERY_MESSAGES.redirected);
        } else if (raw.trim()) {
            output.add(SAFE_DISCOVERY_MESSAGES.genericSignal);
        }
    }
    return Array.from(output);
}

/** Data aman untuk respons diagnosis yang juga dapat disimpan kembali oleh editor. */
export function getSafeLoginProfileDiscoveryPresentation(result: LadderResult): {
    finalUrl: string | null;
    discoverySignals: string[];
    warnings: string[];
    layerNotes: string[];
} {
    const evidence = safeDiscoveryEvidenceFromResult(result);
    return {
        finalUrl: sanitizeLoginUrlForDisplay(result.finalUrl),
        discoverySignals: evidence.discoverySignals,
        warnings: evidence.warnings,
        layerNotes: evidence.layerNotes,
    };
}

export function serializeLoginProfile(profile: LoginProfileSummaryRecord | PortalLoginProfile): LoginProfileSummary {
    const requiresApproval =
        profile.detectorVersion !== LOGIN_PROFILE_DETECTOR_VERSION ||
        profile.approvalStatus !== "APPROVED" ||
        profile.approvedFingerprint !== profile.currentFingerprint ||
        profile.state === "STALE";

    return {
        id: profile.id,
        origin: profile.origin,
        entryPath: profile.entryPath,
        finalPath: profile.finalPath,
        formActionPath: profile.formActionPath,
        httpMethod: profile.httpMethod,
        usernameField: profile.usernameField,
        passwordField: profile.passwordField,
        extraFieldNames: stringArray(profile.extraFieldNames),
        recommendedMode: profile.recommendedMode,
        detectionLayer: profile.detectionLayer,
        discoveryConfidence: profile.discoveryConfidence,
        discoverySignals: sanitizePortalAppDiscoverySignals(profile.discoverySignals),
        warnings: sanitizePortalAppDiscoverySignals(profile.warnings),
        apiContracts: apiContracts(profile.apiContracts),
        apiSpecPath: profile.apiSpecPath,
        currentFingerprint: profile.currentFingerprint,
        approvedFingerprint: profile.approvedFingerprint,
        approvalStatus: profile.approvalStatus,
        state: profile.state,
        requiresApproval,
        detectorVersion: profile.detectorVersion,
        lastDiscoveredAt: profile.lastDiscoveredAt,
        lastCheckedAt: profile.lastCheckedAt,
        lastTransportValidatedAt: profile.lastTransportValidatedAt,
        lastCredentialAcceptedAt: profile.lastCredentialAcceptedAt,
        staleAt: profile.staleAt,
        lastError: profile.lastError,
        approvedAt: profile.approvedAt,
    };
}

/**
 * Mengubah hasil ladder menjadi kandidat yang aman dipersistenkan. URL query
 * atau fragment pada entrypoint, target akhir, dan action form ditolak sebelum
 * profile dibuat; nilai tersebut tidak pernah disimpan. Nama cookie, nilai
 * hidden input, cookies, token, HTML, dan kredensial juga tidak pernah ikut
 * profile.
 */
export function buildLoginProfileCandidate(
    result: LadderResult,
    entryUrl: string,
): LoginProfileCandidate | null {
    const entry = locationFrom(entryUrl);
    const final = locationFrom(result.finalUrl);
    if (
        !entry ||
        !final ||
        entry.origin !== final.origin ||
        hasQueryOrFragment(entryUrl) ||
        hasQueryOrFragment(result.finalUrl)
    ) return null;

    const hasForm = Boolean(result.detected.passwordField);
    const contracts = apiContracts(result.apiProbe.contracts);
    const hasApiContract = contracts.length > 0;
    if (!hasForm && !hasApiContract) return null;

    const primaryContract = contracts[0];
    const contractParams = primaryContract?.params ?? [];
    const apiPasswordField = contractParams.find((name) => /password|passwd|pwd|pass|sandi/i.test(name)) ?? null;
    const apiUsernameField = contractParams.find((name) => !/password|passwd|pwd|pass|sandi/i.test(name)) ?? null;

    const usernameField = hasForm ? result.detected.usernameField : apiUsernameField;
    const passwordField = hasForm ? result.detected.passwordField : apiPasswordField;
    const extraFieldNames = hasForm
        ? Object.keys(result.detected.extraFields).map((name) => name.trim()).filter(Boolean).sort()
        : ["@json-api", ...contractParams].sort();
    const formActionPath = hasForm
        ? actionPathFrom(result.detected.formAction, result.finalUrl, entry.origin)
        : null;
    if (hasForm && result.detected.formAction && !formActionPath) return null;
    const httpMethod = hasForm ? (result.detected.httpMethod?.toUpperCase() ?? "POST") : "POST";
    const evidence = safeDiscoveryEvidenceFromResult(result);

    return {
        origin: entry.origin,
        entryPath: entry.path,
        finalPath: final.path,
        formActionPath,
        httpMethod,
        usernameField,
        passwordField,
        extraFieldNames,
        recommendedMode: result.verdict.mode,
        detectionLayer: result.layer,
        discoveryConfidence: result.detected.confidence ?? null,
        discoverySignals: evidence.discoverySignals,
        warnings: evidence.warnings,
        apiContracts: contracts,
        apiSpecPath: apiSpecPathFrom(result.apiProbe.specUrl),
        fingerprint: computeLoginFingerprint({
            origin: entry.origin,
            entryPath: entry.path,
            finalPath: final.path,
            formActionPath,
            httpMethod,
            recommendedMode: result.verdict.mode,
            usernameField,
            passwordField,
            extraFieldNames,
            apiContracts: contracts,
        }),
    };
}

function candidateTransition(existing: PortalLoginProfile | null, candidate: LoginProfileCandidate, now: Date) {
    const changed = !existing || existing.currentFingerprint !== candidate.fingerprint;
    const approvedStillMatches = Boolean(
        existing &&
        existing.detectorVersion === LOGIN_PROFILE_DETECTOR_VERSION &&
        existing.approvalStatus === "APPROVED" &&
        existing.approvedFingerprint === candidate.fingerprint,
    );
    const becameStale = Boolean(
        existing &&
        changed &&
        existing.approvedFingerprint &&
        existing.approvedFingerprint !== candidate.fingerprint,
    );
    const approvalStatus: PortalLoginProfileApproval = !existing
        ? "PENDING"
        : approvedStillMatches
          ? "APPROVED"
          : changed
            ? "PENDING"
            : existing.approvalStatus;
    const state: PortalLoginProfileState = becameStale
        ? "STALE"
        : approvedStillMatches && existing
          ? strongestKnownState(existing)
          : changed
            ? "DISCOVERED"
            : existing?.state ?? "DISCOVERED";

    return {
        changed,
        becameStale,
        approvalStatus,
        state,
        staleAt: becameStale ? now : approvedStillMatches ? null : existing?.staleAt ?? null,
    };
}

function isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Menyimpan snapshot profile terbaru dengan optimistic CAS. Jika dua proses
 * menemukan/menyetujui profile bersamaan, penulis yang kalah membaca ulang dan
 * menghitung transition dari snapshot terbaru, bukan menimpa state lama.
 */
export async function recordLoginProfileCandidate(input: {
    result: LadderResult;
    entryUrl: string;
    source: LoginProfileSource;
}): Promise<LoginProfileMutation | null> {
    const candidate = buildLoginProfileCandidate(input.result, input.entryUrl);
    if (!candidate) return null;

    for (let attempt = 0; attempt < PROFILE_WRITE_RETRIES; attempt++) {
        const existing = await prisma.portalLoginProfile.findUnique({
            where: { origin_entryPath: { origin: candidate.origin, entryPath: candidate.entryPath } },
        });
        const now = new Date();
        const transition = candidateTransition(existing, candidate, now);
        const persistData = {
            finalPath: candidate.finalPath,
            formActionPath: candidate.formActionPath,
            httpMethod: candidate.httpMethod,
            usernameField: candidate.usernameField,
            passwordField: candidate.passwordField,
            extraFieldNames: candidate.extraFieldNames,
            recommendedMode: candidate.recommendedMode,
            detectionLayer: candidate.detectionLayer,
            discoveryConfidence: candidate.discoveryConfidence,
            discoverySignals: candidate.discoverySignals,
            warnings: candidate.warnings,
            apiContracts: toJsonValue(candidate.apiContracts),
            apiSpecPath: candidate.apiSpecPath,
            currentFingerprint: candidate.fingerprint,
            detectorVersion: LOGIN_PROFILE_DETECTOR_VERSION,
            approvalStatus: transition.approvalStatus,
            state: transition.state,
            staleAt: transition.staleAt,
            lastDiscoveredAt: now,
            lastCheckedAt: now,
            lastError: null,
            ...(transition.changed
                ? { lastTransportValidatedAt: null, lastCredentialAcceptedAt: null }
                : {}),
            updatedAt: now,
        };

        try {
            const saved = await prisma.$transaction(async (tx) => {
                let profile: PortalLoginProfile | null = null;
                if (existing) {
                    const write = await tx.portalLoginProfile.updateMany({
                        where: {
                            id: existing.id,
                            currentFingerprint: existing.currentFingerprint,
                            updatedAt: existing.updatedAt,
                        },
                        data: persistData,
                    });
                    if (write.count !== 1) return null;
                    profile = await tx.portalLoginProfile.findUnique({ where: { id: existing.id } });
                } else {
                    profile = await tx.portalLoginProfile.create({
                        data: {
                            origin: candidate.origin,
                            entryPath: candidate.entryPath,
                            ...persistData,
                        },
                    });
                }

                if (!profile) return null;
                if (!existing || transition.changed) {
                    await tx.portalLoginProfileEvidence.create({
                        data: {
                            profileId: profile.id,
                            fingerprint: candidate.fingerprint,
                            source: input.source,
                            finalPath: candidate.finalPath,
                            formActionPath: candidate.formActionPath,
                            httpMethod: candidate.httpMethod,
                            usernameField: candidate.usernameField,
                            passwordField: candidate.passwordField,
                            extraFieldNames: candidate.extraFieldNames,
                            recommendedMode: candidate.recommendedMode,
                            detectionLayer: candidate.detectionLayer,
                            discoveryConfidence: candidate.discoveryConfidence,
                            discoverySignals: candidate.discoverySignals,
                            warnings: candidate.warnings,
                            apiContracts: toJsonValue(candidate.apiContracts),
                            apiSpecPath: candidate.apiSpecPath,
                        },
                    });
                }
                return profile;
            });

            if (saved) {
                return {
                    profile: serializeLoginProfile(saved),
                    created: !existing,
                    changed: transition.changed,
                    becameStale: transition.becameStale,
                };
            }
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }
    }

    throw new Error("Profile login berubah bersamaan; ulangi deteksi.");
}

export async function approveLoginProfile(input: {
    profileId: string;
    fingerprint: string;
    approvedById: string;
}): Promise<LoginProfileSummary> {
    const profile = await prisma.portalLoginProfile.findUnique({ where: { id: input.profileId } });
    if (!profile) throw new LoginProfileApprovalError("Profil deteksi tidak ditemukan.");
    if (profile.state === "STALE" && profile.lastError === NO_CANDIDATE_REVALIDATION_ERROR) {
        throw new LoginProfileApprovalError(
            "Revalidasi tidak menemukan kandidat baru. Jalankan deteksi ulang sebelum menyetujui profile.",
        );
    }
    if (profile.detectorVersion !== LOGIN_PROFILE_DETECTOR_VERSION || profile.currentFingerprint !== input.fingerprint) {
        throw new LoginProfileApprovalError(
            "Kandidat profile sudah berubah. Jalankan deteksi ulang dan tinjau bukti terbaru sebelum menyetujui.",
        );
    }

    const now = new Date();
    const write = await prisma.portalLoginProfile.updateMany({
        where: {
            id: profile.id,
            currentFingerprint: input.fingerprint,
            updatedAt: profile.updatedAt,
        },
        data: {
            approvalStatus: "APPROVED",
            approvedFingerprint: profile.currentFingerprint,
            approvedAt: now,
            approvedById: input.approvedById,
            state: strongestKnownState(profile),
            staleAt: null,
            lastError: null,
            updatedAt: now,
        },
    });
    if (write.count !== 1) {
        throw new LoginProfileApprovalError(
            "Kandidat profile sudah berubah. Jalankan deteksi ulang dan tinjau bukti terbaru sebelum menyetujui.",
        );
    }

    const updated = await prisma.portalLoginProfile.findUnique({ where: { id: profile.id } });
    if (!updated) throw new LoginProfileApprovalError("Profil deteksi tidak ditemukan.");
    return serializeLoginProfile(updated);
}

function profileMatchesConfiguration(profile: PortalLoginProfile, config: LoginProfileConfiguration): boolean {
    const location = locationFrom(config.loginUrl);
    if (!location || location.origin !== profile.origin || hasQueryOrFragment(config.loginUrl)) return false;
    if (location.path !== profile.entryPath) return false;
    if (profile.recommendedMode && config.ssoMode !== profile.recommendedMode) return false;
    if (profile.httpMethod && config.httpMethod.toUpperCase() !== profile.httpMethod.toUpperCase()) return false;
    if (profile.usernameField && config.usernameField !== profile.usernameField) return false;
    if (profile.passwordField && config.passwordField !== profile.passwordField) return false;
    return true;
}

/**
 * Mengikat PortalApp ke profile hanya bila snapshot yang dipilih masih persis
 * kandidat approved saat ini. Ini mencegah form berubah lalu kredensial dikirim
 * memakai endpoint/profile lama tanpa review admin.
 */
export async function resolveApprovedProfileBinding(input: {
    profileId?: string | null;
    fingerprint?: string | null;
} & LoginProfileConfiguration): Promise<{ loginProfileId: string; loginProfileFingerprint: string } | null> {
    if (!input.profileId && !input.fingerprint) return null;
    if (!input.profileId || !input.fingerprint) {
        throw new LoginProfileBindingError("Profile dan fingerprint persetujuan harus dipilih bersamaan.");
    }

    const profile = await prisma.portalLoginProfile.findUnique({ where: { id: input.profileId } });
    if (!profile) throw new LoginProfileBindingError("Profil deteksi yang dipilih tidak ditemukan.");
    if (
        profile.detectorVersion !== LOGIN_PROFILE_DETECTOR_VERSION ||
        profile.approvalStatus !== "APPROVED" ||
        profile.currentFingerprint !== profile.approvedFingerprint ||
        profile.currentFingerprint !== input.fingerprint ||
        profile.state === "STALE"
    ) {
        throw new LoginProfileBindingError(
            "Profil deteksi belum disetujui atau sudah berubah. Tinjau dan setujui kandidat terbaru sebelum menyimpan.",
        );
    }
    if (!profileMatchesConfiguration(profile, input)) {
        throw new LoginProfileBindingError(
            "Konfigurasi form tidak lagi cocok dengan profil yang disetujui. Deteksi ulang atau lepaskan profile sebelum menyimpan manual.",
        );
    }

    return { loginProfileId: profile.id, loginProfileFingerprint: profile.currentFingerprint };
}

function profileIsLaunchEligible(profile: PortalLoginProfile, app: LoginProfileConfiguration & {
    loginProfileFingerprint: string | null;
}): boolean {
    return profile.detectorVersion === LOGIN_PROFILE_DETECTOR_VERSION &&
        profile.approvalStatus === "APPROVED" &&
        profile.state !== "STALE" &&
        profile.currentFingerprint === profile.approvedFingerprint &&
        profile.currentFingerprint === app.loginProfileFingerprint &&
        profileMatchesConfiguration(profile, app);
}

/**
 * Fail-closed hanya berlaku untuk aplikasi yang memiliki binding profile.
 * Aplikasi lama tanpa kedua kolom binding tetap mengikuti perilaku sebelumnya.
 */
export function assertPortalAppProfileLaunchEligible(app: ProfileBoundPortalApp): void {
    const hasAnyBinding = Boolean(app.loginProfileId || app.loginProfileFingerprint);
    if (!hasAnyBinding) return;

    if (!app.loginProfileId || !app.loginProfileFingerprint || !app.loginProfile) {
        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
    }

    if (!profileIsLaunchEligible(app.loginProfile, app)) {
        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
    }
}

/**
 * Converts a PortalApp row into the narrow, current snapshot required by a
 * credential-release decision. The login URL is always the effective target,
 * so callers cannot accidentally authorize a nullable fallback differently.
 */
type PortalAppReleaseRecord = Prisma.PortalAppGetPayload<{ include: { loginProfile: true } }>;

function toProfileBoundPortalApp(app: PortalAppReleaseRecord): ProfileBoundPortalApp {
    return {
        id: app.id,
        url: app.url,
        loginUrl: app.loginUrl || app.url,
        extraFields: app.extraFields,
        isActive: app.isActive,
        isPublic: app.isPublic,
        updatedAt: app.updatedAt,
        ssoMode: app.ssoMode,
        httpMethod: app.httpMethod,
        usernameField: app.usernameField,
        passwordField: app.passwordField,
        loginProfileId: app.loginProfileId,
        loginProfileFingerprint: app.loginProfileFingerprint,
        loginProfile: app.loginProfile,
    };
}

function releaseSnapshotMatches(left: ProfileBoundPortalApp, right: ProfileBoundPortalApp): boolean {
    return left.id === right.id &&
        left.updatedAt.getTime() === right.updatedAt.getTime() &&
        left.url === right.url &&
        left.loginUrl === right.loginUrl &&
        left.ssoMode === right.ssoMode &&
        left.httpMethod === right.httpMethod &&
        left.usernameField === right.usernameField &&
        left.passwordField === right.passwordField &&
        left.isActive === right.isActive &&
        left.isPublic === right.isPublic &&
        left.loginProfileId === right.loginProfileId &&
        left.loginProfileFingerprint === right.loginProfileFingerprint &&
        JSON.stringify(left.extraFields ?? null) === JSON.stringify(right.extraFields ?? null);
}

function runtimeExtraFields(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"),
    );
}

/**
 * Conditional authorization langsung sebelum credential dibuka. Ia membaca
 * ulang PortalApp dan profile dalam satu transaksi, memastikan binding,
 * effective target/config, updatedAt, approval, dan fingerprint masih sama,
 * lalu melakukan CAS pada kedua row. Caller wajib memakai snapshot hasilnya.
 */
export async function authorizePortalAppProfileCredentialRelease(
    app: ProfileBoundPortalApp,
): Promise<ProfileBoundPortalApp> {
    const hasAnyBinding = Boolean(app.loginProfileId || app.loginProfileFingerprint);
    if (!hasAnyBinding) return app;
    if (!app.loginProfileId || !app.loginProfileFingerprint) {
        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        const authorized = await prisma.$transaction(async (tx) => {
            const currentRecord = await tx.portalApp.findUnique({
                where: { id: app.id },
                include: { loginProfile: true },
            });
            if (!currentRecord) return null;

            const current = toProfileBoundPortalApp(currentRecord);
            if (!releaseSnapshotMatches(app, current)) return null;
            if (!current.loginProfileId || !current.loginProfileFingerprint) return null;

            const profile = await tx.portalLoginProfile.findUnique({ where: { id: current.loginProfileId } });
            if (!profile || !profileIsLaunchEligible(profile, current)) return null;

            const now = new Date();
            const profileWrite = await tx.portalLoginProfile.updateMany({
                where: {
                    id: profile.id,
                    detectorVersion: LOGIN_PROFILE_DETECTOR_VERSION,
                    approvalStatus: "APPROVED",
                    state: { not: "STALE" },
                    currentFingerprint: current.loginProfileFingerprint,
                    approvedFingerprint: current.loginProfileFingerprint,
                    updatedAt: profile.updatedAt,
                },
                data: { lastCheckedAt: now, updatedAt: now },
            });
            if (profileWrite.count !== 1) return null;

            const appWrite = await tx.portalApp.updateMany({
                where: {
                    id: currentRecord.id,
                    updatedAt: currentRecord.updatedAt,
                    loginProfileId: currentRecord.loginProfileId,
                    loginProfileFingerprint: currentRecord.loginProfileFingerprint,
                    url: currentRecord.url,
                    loginUrl: currentRecord.loginUrl,
                    ssoMode: currentRecord.ssoMode,
                    httpMethod: currentRecord.httpMethod,
                    usernameField: currentRecord.usernameField,
                    passwordField: currentRecord.passwordField,
                },
                data: { updatedAt: now },
            });
            if (appWrite.count !== 1) return null;

            const updatedRecord = await tx.portalApp.findUnique({
                where: { id: currentRecord.id },
                include: { loginProfile: true },
            });
            return updatedRecord ? toProfileBoundPortalApp(updatedRecord) : null;
        });

        if (authorized) return authorized;
    }

    throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
}


/**
 * Atomically reserve a bound credential release. The app and profile rows are
 * locked before the current snapshot is checked, CASed, and the credential is
 * read/decrypted by the caller's callback. This prevents an admin/profile write
 * from landing between authorization and secret release.
 */
export async function withAuthorizedPortalAppCredentialRelease<T>(input: {
    app: ProfileBoundPortalApp;
    portalUserId: string;
    credentialId?: string | null;
}, release: (credentialBlob: string, app: ProfileBoundPortalApp) => Promise<T> | T): Promise<T | null> {
    const hasBinding = Boolean(input.app.loginProfileId || input.app.loginProfileFingerprint);
    if (hasBinding && (!input.app.loginProfileId || !input.app.loginProfileFingerprint)) {
        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
    }

    // Serializable prevents a concurrent access/group mutation from changing
    // the authorization decision after the user/app rows have been observed.
    // Retry one serialization conflict so a normal concurrent admin update does
    // not surface as a server error to the portal user.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                await tx.$queryRaw<Array<{ id: string }>>`
                    SELECT "id"
                    FROM "portal_users"
                    WHERE "id" = ${input.portalUserId}
                    FOR UPDATE
                `;

                const currentUser = await tx.portalUser.findUnique({
                    where: { id: input.portalUserId },
                    select: { isActive: true, role: true },
                });
                if (!currentUser?.isActive) {
                    throw new PortalAppCredentialReleaseDeniedError("Pengguna tidak aktif atau tidak memiliki akses.");
                }

                const observed = await tx.portalApp.findUnique({
                    where: { id: input.app.id },
                    select: { loginProfileId: true },
                });
                if (!observed) {
                    throw new PortalAppCredentialReleaseDeniedError("Aplikasi tidak tersedia.");
                }

                // Keep the profile → app lock order used by profile writes. The
                // user row is locked first because this transaction owns the
                // final access decision as well as the profile decision.
                if (observed.loginProfileId) {
                    await tx.$queryRaw<Array<{ id: string }>>`
                        SELECT "id"
                        FROM "portal_login_profiles"
                        WHERE "id" = ${observed.loginProfileId}
                        FOR UPDATE
                    `;
                }
                await tx.$queryRaw<Array<{ id: string }>>`
                    SELECT "id"
                    FROM "portal_apps"
                    WHERE "id" = ${input.app.id}
                    FOR UPDATE
                `;

                const currentRecord = await tx.portalApp.findUnique({
                    where: { id: input.app.id },
                    include: { loginProfile: true },
                });
                if (!currentRecord) {
                    throw new PortalAppCredentialReleaseDeniedError("Aplikasi tidak tersedia.");
                }

                const current = toProfileBoundPortalApp(currentRecord);
                if (!releaseSnapshotMatches(input.app, current)) {
                    if (hasBinding) {
                        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
                    }
                    throw new PortalAppCredentialReleaseDeniedError("Konfigurasi aplikasi berubah; silakan ulangi peluncuran.");
                }
                if (!current.isActive) {
                    throw new PortalAppCredentialReleaseDeniedError("Aplikasi sedang tidak aktif.");
                }

                const directAccess = current.isPublic || currentUser.role === "PORTAL_ADMIN"
                    ? null
                    : await tx.portalUserAppAccess.findFirst({
                        where: { portalUserId: input.portalUserId, appId: currentRecord.id },
                        select: { id: true },
                    });
                const groupAccess = current.isPublic || currentUser.role === "PORTAL_ADMIN" || directAccess
                    ? null
                    : await tx.portalUserGroup.findFirst({
                        where: {
                            portalUserId: input.portalUserId,
                            group: {
                                isActive: true,
                                apps: { some: { appId: currentRecord.id } },
                            },
                        },
                        select: { id: true },
                    });
                if (currentUser.role !== "PORTAL_ADMIN" && !current.isPublic && !directAccess && !groupAccess) {
                    throw new PortalAppCredentialReleaseDeniedError("Pengguna tidak memiliki akses ke aplikasi.");
                }

                if (hasBinding) {
                    if (
                        !current.loginProfileId ||
                        !current.loginProfileFingerprint ||
                        current.loginProfileId !== observed.loginProfileId
                    ) {
                        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
                    }

                    const profile = await tx.portalLoginProfile.findUnique({ where: { id: current.loginProfileId } });
                    if (!profile || !profileIsLaunchEligible(profile, current)) {
                        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
                    }

                    const now = new Date();
                    const profileWrite = await tx.portalLoginProfile.updateMany({
                        where: {
                            id: profile.id,
                            detectorVersion: LOGIN_PROFILE_DETECTOR_VERSION,
                            approvalStatus: "APPROVED",
                            state: { not: "STALE" },
                            currentFingerprint: current.loginProfileFingerprint,
                            approvedFingerprint: current.loginProfileFingerprint,
                            updatedAt: profile.updatedAt,
                        },
                        data: { lastCheckedAt: now, updatedAt: now },
                    });
                    if (profileWrite.count !== 1) {
                        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
                    }

                    const appWrite = await tx.portalApp.updateMany({
                        where: {
                            id: currentRecord.id,
                            updatedAt: currentRecord.updatedAt,
                            loginProfileId: currentRecord.loginProfileId,
                            loginProfileFingerprint: currentRecord.loginProfileFingerprint,
                            url: currentRecord.url,
                            loginUrl: currentRecord.loginUrl,
                            ssoMode: currentRecord.ssoMode,
                            httpMethod: currentRecord.httpMethod,
                            usernameField: currentRecord.usernameField,
                            passwordField: currentRecord.passwordField,
                            isActive: currentRecord.isActive,
                            isPublic: currentRecord.isPublic,
                        },
                        data: { updatedAt: now },
                    });
                    if (appWrite.count !== 1) {
                        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
                    }
                }

                const credential = input.credentialId
                    ? await tx.portalUserAppCredential.findFirst({
                        where: { id: input.credentialId, portalUserId: input.portalUserId, appId: currentRecord.id },
                        select: { credentialBlob: true },
                    })
                    : await tx.portalUserAppCredential.findFirst({
                        where: { portalUserId: input.portalUserId, appId: currentRecord.id },
                        orderBy: { createdAt: "asc" },
                        select: { credentialBlob: true },
                    });
                if (!credential) return null;

                const authorizedRecord = hasBinding
                    ? await tx.portalApp.findUnique({ where: { id: currentRecord.id }, include: { loginProfile: true } })
                    : currentRecord;
                if (!authorizedRecord) {
                    throw new PortalAppCredentialReleaseDeniedError("Aplikasi tidak tersedia.");
                }

                return release(credential.credentialBlob, toProfileBoundPortalApp(authorizedRecord));
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (error) {
            if (
                attempt === 0 &&
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2034"
            ) continue;
            throw error;
        }
    }

    throw new PortalAppCredentialReleaseDeniedError("Transaksi akses credential tidak dapat diselesaikan.");
}

export async function revalidateBoundProfileBeforeCredentialRelease(
    app: ProfileBoundPortalApp,
): Promise<BoundProfileReleasePreparation | null> {
    if (!app.loginProfileId && !app.loginProfileFingerprint) return null;

    try {
        assertPortalAppProfileLaunchEligible(app);
        const entryUrl = app.loginUrl;
        const live = await detectWithLadder(entryUrl);
        const candidate = buildLoginProfileCandidate(live, entryUrl);
        if (!candidate) {
            if (app.loginProfileId) await markLoginProfileStaleForNoCandidate(app.loginProfileId);
            throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
        }

        const mutation = await recordLoginProfileCandidate({
            result: live,
            entryUrl,
            source: "REVALIDATION",
        });
        if (
            candidate.fingerprint !== app.loginProfileFingerprint ||
            mutation?.becameStale ||
            mutation?.profile.requiresApproval
        ) {
            throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
        }

        const authorizedApp = await authorizePortalAppProfileCredentialRelease(app);
        return {
            app: authorizedApp,
            // These values remain request-local. They are never persisted as
            // profile evidence, but FORM SSO needs them for the current submit.
            liveExtraFields: runtimeExtraFields(live.detected.extraFields),
        };
    } catch (error) {
        if (error instanceof LoginProfileLaunchBlockedError) throw error;
        // A target yang tidak dapat diamati bukan bukti bahwa route approved masih
        // aman. Caller hanya menerima blocked result; detail dependency tidak keluar.
        throw new LoginProfileLaunchBlockedError("Profile login aplikasi perlu ditinjau admin sebelum kredensial dikirim.");
    }
}

export async function recordLoginProfileVerification(input: {
    profileId: string;
    fingerprint: string;
    outcome: LoginProfileValidationOutcome;
    errorMessage?: string | null;
    config: LoginProfileConfiguration;
    appSnapshot?: {
        id: string;
        updatedAt: Date;
        loginProfileId: string | null;
        loginProfileFingerprint: string | null;
        verificationUpdate: {
            loginVerifiedAt?: Date | null;
            loginVerifyError?: string | null;
        };
    };
}): Promise<LoginProfileSummary | null> {
    try {
        return await prisma.$transaction(async (tx) => {
            if (input.appSnapshot) {
                if (
                    input.appSnapshot.loginProfileId !== input.profileId ||
                    !input.appSnapshot.loginProfileFingerprint
                ) return null;

                // Lock profile → app, matching credential-release transactions.
                await tx.$queryRaw<Array<{ id: string }>>`
                    SELECT "id"
                    FROM "portal_login_profiles"
                    WHERE "id" = ${input.profileId}
                    FOR UPDATE
                `;
                await tx.$queryRaw<Array<{ id: string }>>`
                    SELECT "id"
                    FROM "portal_apps"
                    WHERE "id" = ${input.appSnapshot.id}
                    FOR UPDATE
                `;
                const currentApp = await tx.portalApp.findUnique({ where: { id: input.appSnapshot.id } });
                if (
                    !currentApp ||
                    currentApp.updatedAt.getTime() !== input.appSnapshot.updatedAt.getTime() ||
                    currentApp.loginProfileId !== input.appSnapshot.loginProfileId ||
                    currentApp.loginProfileFingerprint !== input.appSnapshot.loginProfileFingerprint
                ) {
                    throw new VerificationSnapshotConflictError();
                }
            }

            const profile = await tx.portalLoginProfile.findUnique({ where: { id: input.profileId } });
            if (
                !profile ||
                profile.detectorVersion !== LOGIN_PROFILE_DETECTOR_VERSION ||
                profile.approvalStatus !== "APPROVED" ||
                profile.state === "STALE" ||
                profile.currentFingerprint !== profile.approvedFingerprint ||
                profile.currentFingerprint !== input.fingerprint ||
                !profileMatchesConfiguration(profile, input.config)
            ) {
                return null;
            }

            const now = new Date();
            const state: PortalLoginProfileState = input.outcome === "CREDENTIAL_ACCEPTED"
                ? "CREDENTIAL_ACCEPTED"
                : input.outcome === "TRANSPORT_VALIDATED"
                  ? profile.lastCredentialAcceptedAt ? "CREDENTIAL_ACCEPTED" : "TRANSPORT_VALIDATED"
                  : "REJECTED";
            const write = await tx.portalLoginProfile.updateMany({
                where: {
                    id: profile.id,
                    currentFingerprint: input.fingerprint,
                    approvedFingerprint: input.fingerprint,
                    approvalStatus: "APPROVED",
                    state: { not: "STALE" },
                    updatedAt: profile.updatedAt,
                },
                data: {
                    state,
                    lastCheckedAt: now,
                    lastTransportValidatedAt: input.outcome === "REJECTED" ? profile.lastTransportValidatedAt : now,
                    lastCredentialAcceptedAt: input.outcome === "CREDENTIAL_ACCEPTED" ? now : profile.lastCredentialAcceptedAt,
                    // Pesan dispatcher dapat mengandung detail target. Profile hanya
                    // menyimpan status aman yang tidak memuat path, query, atau token.
                    lastError: input.outcome === "REJECTED"
                        ? "Verifikasi login terakhir ditolak."
                        : null,
                    updatedAt: now,
                },
            });
            if (write.count !== 1) return null;

            if (input.appSnapshot) {
                const appWrite = await tx.portalApp.updateMany({
                    where: {
                        id: input.appSnapshot.id,
                        updatedAt: input.appSnapshot.updatedAt,
                        loginProfileId: input.appSnapshot.loginProfileId,
                        loginProfileFingerprint: input.appSnapshot.loginProfileFingerprint,
                    },
                    data: input.appSnapshot.verificationUpdate,
                });
                if (appWrite.count !== 1) throw new VerificationSnapshotConflictError();
            }

            const updated = await tx.portalLoginProfile.findUnique({ where: { id: profile.id } });
            return updated ? serializeLoginProfile(updated) : null;
        });
    } catch (error) {
        if (error instanceof VerificationSnapshotConflictError) return null;
        throw error;
    }
}

export async function markLoginProfileStaleForNoCandidate(profileId: string): Promise<LoginProfileMutation | null> {
    for (let attempt = 0; attempt < PROFILE_WRITE_RETRIES; attempt++) {
        const profile = await prisma.portalLoginProfile.findUnique({ where: { id: profileId } });
        if (!profile) return null;

        const now = new Date();
        const becameStale = profile.state !== "STALE";
        const write = await prisma.portalLoginProfile.updateMany({
            where: {
                id: profile.id,
                currentFingerprint: profile.currentFingerprint,
                updatedAt: profile.updatedAt,
            },
            data: {
                approvalStatus: "PENDING",
                state: "STALE",
                staleAt: profile.staleAt ?? now,
                lastCheckedAt: now,
                lastError: NO_CANDIDATE_REVALIDATION_ERROR,
                updatedAt: now,
            },
        });
        if (write.count !== 1) continue;

        const updated = await prisma.portalLoginProfile.findUnique({ where: { id: profile.id } });
        if (!updated) return null;
        return {
            profile: serializeLoginProfile(updated),
            created: false,
            changed: becameStale,
            becameStale,
        };
    }
    return null;
}

const DEFAULT_REVALIDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const activeRevalidations = new Map<string, Promise<LoginProfileMutation | null>>();

function revalidationIntervalMs(): number {
    const configured = Number(process.env.PORTAL_LOGIN_PROFILE_REVALIDATE_INTERVAL_MS);
    if (!Number.isFinite(configured)) return DEFAULT_REVALIDATE_INTERVAL_MS;
    return Math.min(Math.max(configured, 5 * 60 * 1000), 7 * 24 * 60 * 60 * 1000);
}

export function profileRevalidationDue(profile: Pick<PortalLoginProfile, "lastCheckedAt">, now = Date.now()): boolean {
    return !profile.lastCheckedAt || now - profile.lastCheckedAt.getTime() >= revalidationIntervalMs();
}

/**
 * Revalidasi bersifat no-credential. Ladder yang sama dipakai supaya SPA dan
 * OpenAPI tidak terlihat sebagai drift palsu hanya karena HTML statis kosong.
 */
export async function revalidateLoginProfileIfDue(input: {
    profile: Pick<PortalLoginProfile, "id" | "lastCheckedAt">;
    entryUrl: string;
}): Promise<LoginProfileMutation | null> {
    if (!profileRevalidationDue(input.profile)) return null;

    const active = activeRevalidations.get(input.profile.id);
    if (active) return active;

    const run = (async () => {
        try {
            const result = await detectWithLadder(input.entryUrl);
            const mutation = await recordLoginProfileCandidate({
                result,
                entryUrl: input.entryUrl,
                source: "REVALIDATION",
            });
            if (!mutation) {
                // Ladder selesai normal tetapi target yang reachable tidak lagi
                // memberi struktur yang dapat dipercaya: approval lama tidak boleh
                // tetap aktif.
                return markLoginProfileStaleForNoCandidate(input.profile.id);
            }
            return mutation;
        } catch {
            // Error jaringan/render tidak membuktikan struktur berubah. Catat
            // alasan generik, tetapi jangan menimpa alasan STALE akibat no-candidate;
            // snapshot lama itu tetap wajib menunggu kandidat baru sebelum approval.
            const current = await prisma.portalLoginProfile.findUnique({
                where: { id: input.profile.id },
                select: { state: true, lastError: true, updatedAt: true },
            });
            if (current) {
                const preserveNoCandidateStale =
                    current.state === "STALE" && current.lastError === NO_CANDIDATE_REVALIDATION_ERROR;
                await prisma.portalLoginProfile.updateMany({
                    where: { id: input.profile.id, updatedAt: current.updatedAt },
                    data: {
                        lastCheckedAt: new Date(),
                        lastError: preserveNoCandidateStale
                            ? current.lastError
                            : OBSERVATION_FAILED_REVALIDATION_ERROR,
                        updatedAt: new Date(),
                    },
                }).catch(() => {});
            }
            return null;
        } finally {
            activeRevalidations.delete(input.profile.id);
        }
    })();

    activeRevalidations.set(input.profile.id, run);
    return run;
}
