import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    fetchLoginPage,
    CookieJar,
    relayRequest,
    refreshVolatileFields,
    VOLATILE_RE,
} from "@/lib/portal-fetch-html";
import { detectLoginFields } from "@/lib/portal-login-detect";
import {
    looksLikeClientRenderedApp,
    looksLikeOracleEbs,
    parseOracleAuthResponse,
    relayLogin,
} from "@/lib/portal-sso-relay";
import { probeApiLayer, type ApiProbe } from "@/lib/portal-api-probe";
import { fingerprintLoginProduct } from "@/lib/portal-product-registry";
import { formSignatureHash } from "@/lib/portal-memory-recall";
import { captureLoginRequest } from "@/lib/portal-browser-capture";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { verifyLoginSchema } from "@/lib/validation-schemas";
import { checkVerifyLimit, type VerifySlot } from "@/lib/verify-rate-limit";
import {
    recordLoginProfileVerification,
    sanitizeLoginUrlForDisplay,
    type LoginProfileValidationOutcome,
} from "@/lib/portal-login-profile";

const VERIFY_MAX = 5;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const verifyAttempts = new Map<string, VerifySlot>();

type SsoMode = "FORM" | "POST" | "REROUTE" | "VAULT" | "REDIRECT" | "PROXY" | "TOKEN";
type DispatchResult =
    | {
        ok: boolean;
        outcome: LoginProfileValidationOutcome;
        message: string;
        handoff: boolean;
        verifyMode: SsoMode;
        apiProbe?: ApiProbe;
    }
    | { status: number; body: Record<string, unknown> };

type VerifyConfig = {
    appId?: string | null;
    url: string;
    ssoMode: SsoMode;
    httpMethod: "POST" | "GET";
    usernameField: string;
    passwordField: string;
    extraFields?: Record<string, string> | null;
    testUsername: string;
    testPassword: string;
    jsonApi?: { path: string } | null;
};

function sortedNames(value: unknown): string[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return Object.keys(value as Record<string, unknown>).sort();
}

function normalizedContractPath(value: string): string {
    try {
        return new URL(value, "http://portal-profile.invalid").pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    } catch {
        return value.split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    }
}

function sameStringArray(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function matchesSavedAppConfiguration(app: {
    url: string;
    loginUrl: string | null;
    ssoMode: string;
    httpMethod: string;
    usernameField: string;
    passwordField: string;
    extraFields: unknown;
    loginProfile?: { apiContracts: unknown } | null;
}, data: VerifyConfig, result: Exclude<DispatchResult, { status: number }>): boolean {
    const savedTarget = sanitizeLoginUrlForDisplay(app.loginUrl || app.url);
    const testedTarget = sanitizeLoginUrlForDisplay(data.url);
    const sameBasicConfig = Boolean(savedTarget) &&
        savedTarget === testedTarget &&
        app.ssoMode === data.ssoMode &&
        app.httpMethod.toUpperCase() === data.httpMethod.toUpperCase() &&
        app.usernameField === data.usernameField &&
        app.passwordField === data.passwordField &&
        sameStringArray(sortedNames(app.extraFields), Object.keys(data.extraFields ?? {}).sort());
    if (!sameBasicConfig) return false;

    // JSON verification is authoritative only when the exact selected contract
    // (method, path, and parameter shape) is part of the approved profile.
    if (data.jsonApi) {
        const liveContract = result.apiProbe?.contracts.find((contract) =>
            contract.method === "POST" && normalizedContractPath(contract.path) === normalizedContractPath(data.jsonApi!.path),
        );
        const savedContracts = Array.isArray(app.loginProfile?.apiContracts) ? app.loginProfile.apiContracts : [];
        const savedContract = savedContracts.find((raw) => {
            if (!raw || typeof raw !== "object") return false;
            const contract = raw as { method?: unknown; path?: unknown; params?: unknown };
            return contract.method === "POST" &&
                typeof contract.path === "string" &&
                normalizedContractPath(contract.path) === normalizedContractPath(data.jsonApi!.path);
        }) as { method: string; path: string; params?: unknown } | undefined;
        return Boolean(
            liveContract &&
            savedContract &&
            sameStringArray(
                [...(liveContract.params ?? [])].sort(),
                Array.isArray(savedContract.params) ? savedContract.params.filter((item): item is string => typeof item === "string").sort() : [],
            ),
        );
    }

    return true;
}

async function persistVerificationResult(data: VerifyConfig, result: Exclude<DispatchResult, { status: number }>, createdBy?: string | null) {
    if (!data.appId) return;

    // Auto-register: Uji Login SUKSES pada produk tak dikenal mendaftarkan
    // fingerprint generik (satu GET pasif tambahan). Non-fatal.
    if (result.outcome === "CREDENTIAL_ACCEPTED") {
        try {
            const page = await fetchLoginPage(data.url);
            const finalUrl = page.finalUrl || data.url;
            if (!fingerprintLoginProduct(page.html, finalUrl)) {
                const origin = new URL(finalUrl).origin.toLowerCase();
                const existing = await prisma.portalProductFingerprint.findFirst({ where: { origin }, select: { id: true } });
                if (!existing) {
                    await prisma.portalProductFingerprint.create({
                        data: {
                            origin,
                            product: "generic",
                            formHash: formSignatureHash([data.usernameField, data.passwordField], data.httpMethod),
                            config: {
                                usernameField: data.usernameField,
                                passwordField: data.passwordField,
                                httpMethod: data.httpMethod,
                                ssoMode: data.ssoMode,
                            },
                            createdBy: createdBy ?? null,
                        },
                    });
                }
            }
        } catch {
            // Gagal fetch/DB tidak boleh menggagalkan hasil verifikasi.
        }
    }

    const app = await prisma.portalApp.findUnique({
        where: { id: data.appId },
        select: {
            id: true,
            url: true,
            loginUrl: true,
            ssoMode: true,
            httpMethod: true,
            usernameField: true,
            passwordField: true,
            extraFields: true,
            updatedAt: true,
            loginProfileId: true,
            loginProfileFingerprint: true,
            loginProfile: { select: { apiContracts: true } },
        },
    });
    if (!app) return;

    // Unsaved or exploratory verification remains visible in the response/audit,
    // but cannot mutate trusted app/profile verification state.
    const matchesSavedConfig = matchesSavedAppConfiguration(app, data, result);
    if (!matchesSavedConfig) return;

    const verificationUpdate = result.outcome === "CREDENTIAL_ACCEPTED"
        ? { loginVerifiedAt: new Date(), loginVerifyError: null }
        : result.outcome === "REJECTED"
          ? { loginVerifyError: "Verifikasi login terakhir ditolak." }
          : { loginVerifyError: null };

    const hasProfileBinding = Boolean(app.loginProfileId || app.loginProfileFingerprint);
    if (hasProfileBinding) {
        if (!app.loginProfileId || !app.loginProfileFingerprint) return;
        const verifiedProfile = await recordLoginProfileVerification({
            profileId: app.loginProfileId,
            fingerprint: app.loginProfileFingerprint,
            outcome: result.outcome,
            errorMessage: result.outcome === "REJECTED" ? "Verifikasi login terakhir ditolak." : null,
            config: {
                loginUrl: app.loginUrl || app.url,
                ssoMode: app.ssoMode,
                httpMethod: app.httpMethod,
                usernameField: app.usernameField,
                passwordField: app.passwordField,
            },
            appSnapshot: {
                id: app.id,
                updatedAt: app.updatedAt,
                loginProfileId: app.loginProfileId,
                loginProfileFingerprint: app.loginProfileFingerprint,
                verificationUpdate,
            },
        }).catch(() => null);
        // The profile state and app verification status are committed together;
        // a conflict leaves both unchanged.
        if (!verifiedProfile) return;
        return;
    }

    // Legacy unbound apps keep their existing verification telemetry, but the
    // write still uses the original row version to reject stale admin requests.
    await prisma.portalApp.updateMany({
        where: { id: app.id, updatedAt: app.updatedAt },
        data: verificationUpdate,
    }).catch(() => {});
}

// POST /api/portal-apps/verify-login — SuperAdmin & ADMIN. Memakai konfigurasi
// FORM saat ini (bukan DB), sehingga admin bisa menguji sebelum Save.
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user?.id || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const adminId = user.id;

        const limit = checkVerifyLimit(verifyAttempts, adminId, VERIFY_MAX, VERIFY_WINDOW_MS);
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Terlalu banyak percobaan uji login. Coba lagi beberapa menit." },
                { status: 429 },
            );
        }

        const reqBody = await request.json().catch(() => null);
        const validation = verifyLoginSchema.safeParse(reqBody);
        if (!validation.success) {
            return NextResponse.json({ error: "Validasi gagal" }, { status: 400 });
        }
        const data = validation.data;
        const requestedMode: SsoMode = data.ssoMode;

        // PROXY/TOKEN = mode belum aktif (lihat SSO_MODE_HINT UI). Jangan kirim
        // kredensial, jangan render apa-apa; jawab 422 informatif.
        if (requestedMode === "PROXY" || requestedMode === "TOKEN") {
            await logAudit({
                actorType: "ADMIN_USER",
                actorId: adminId,
                category: "PORTAL",
                action: "SSO_VERIFY_LOGIN",
                entityType: "PORTAL_APP",
                outcome: "FAILURE",
                errorMessage: "Mode belum aktif",
                metadata: {
                    target: sanitizeLoginUrlForDisplay(data.url),
                    ssoMode: requestedMode,
                    handoff: false,
                },
                request,
            }).catch(() => {});
            return NextResponse.json(
                {
                    error: `Mode ${requestedMode} belum aktif di portal — verifikasi tidak dijalankan. Pilih mode lain (FORM/POST/REROUTE/VAULT/REDIRECT).`,
                    verifyMode: requestedMode,
                },
                { status: 422 },
            );
        }

        if (data.ladder && !data.jsonApi) {
            let ladder: LadderOutcome;
            try {
                // Slot pertama sudah dipakai di atas; tiap kiriman kredensial
                // berikutnya menghabiskan slot rate limit yang sama.
                ladder = await runTestLadder(data, () =>
                    checkVerifyLimit(verifyAttempts, adminId, VERIFY_MAX, VERIFY_WINDOW_MS).allowed,
                );
            } catch (error) {
                console.error("verify-login ladder error:", error);
                return NextResponse.json({ error: "Gagal menjalankan tangga uji" }, { status: 422 });
            }
            for (const attempt of ladder.attempts) {
                await logAudit({
                    actorType: "ADMIN_USER",
                    actorId: adminId,
                    category: "PORTAL",
                    action: "SSO_VERIFY_LOGIN",
                    entityType: "PORTAL_APP",
                    entityId: data.appId ?? undefined,
                    outcome: attempt.ok ? "SUCCESS" : "FAILURE",
                    errorMessage: attempt.ok ? undefined : attempt.message,
                    metadata: {
                        target: sanitizeLoginUrlForDisplay(data.url),
                        ssoMode: attempt.mode,
                        ladderStep: attempt.step,
                        validationOutcome: attempt.outcome,
                    },
                    request,
                }).catch(() => {});
            }
            // Hasil tangga hanya mengisi form editor; status verifikasi app tidak
            // diubah sampai admin menyimpan dan menguji konfigurasi itu sendiri.
            const win = ladder.attempts.find((attempt) => attempt.ok);
            return NextResponse.json({
                ok: Boolean(ladder.suggestion),
                handoff: false,
                message: ladder.message,
                verifyMode: ladder.suggestion?.ssoMode ?? "VAULT",
                validationOutcome: win?.outcome ?? "REJECTED",
                ladder,
            });
        }

        let result: DispatchResult;
        try {
            result = await dispatch(data);
        } catch (error) {
            console.error("verify-login dispatch error:", error);
            return NextResponse.json({ error: "Gagal menjalankan uji login" }, { status: 422 });
        }

        if ("status" in result) {
            return NextResponse.json(result.body, { status: result.status });
        }

        // Audit memakai outcome eksplisit: transport yang sehat bukan klaim bahwa
        // kredensial diterima, tetapi tetap bukti sukses bahwa target dapat diuji.
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: adminId,
            category: "PORTAL",
            action: "SSO_VERIFY_LOGIN",
            entityType: "PORTAL_APP",
            outcome: result.outcome === "REJECTED" ? "FAILURE" : "SUCCESS",
            errorMessage: result.outcome === "REJECTED" ? result.message : undefined,
            metadata: {
                target: sanitizeLoginUrlForDisplay(data.url),
                ssoMode: result.verifyMode,
                handoff: result.handoff,
                validationOutcome: result.outcome,
            },
            request,
        }).catch(() => {});

        await persistVerificationResult(data, result, adminId);

        const body: Record<string, unknown> = {
            ok: result.ok,
            handoff: result.handoff,
            message: result.message,
            verifyMode: result.verifyMode,
            validationOutcome: result.outcome,
        };
        if (result.apiProbe) body.apiProbe = result.apiProbe;
        return NextResponse.json(body);
    } catch (error) {
        console.error("verify-login error:", error);
        return NextResponse.json({ error: "Gagal menjalankan uji login" }, { status: 422 });
    }
}

type LadderAttempt = {
    step: number;
    mode: "FORM" | "POST" | "REROUTE" | "CAPTURE";
    ok: boolean;
    outcome: LoginProfileValidationOutcome;
    message: string;
};
type LadderOutcome = {
    attempts: LadderAttempt[];
    message: string;
    /** Konfigurasi yang terbukti — hanya untuk mengisi form editor. */
    suggestion: {
        ssoMode: "FORM" | "POST" | "REROUTE";
        usernameField: string;
        passwordField: string;
        httpMethod: "POST";
        loginUrl?: string;
    } | null;
    /** Endpoint JSON yang terekam dari browser (mode tetap VAULT). Nama kunci saja. */
    jsonEndpoint: { url: string; bodyKeys: string[]; status: number | null } | null;
};

const LADDER_MAX_ATTEMPTS = 3;

/**
 * Tangga uji: buktikan mode dengan kredensial uji, bukan menebak dari HTML.
 *  - Oracle EBS → hanya REROUTE (engine XHR khusus).
 *  - Form di HTML statis → FORM (POST tanpa cookie ke LOGIN URL, persis seperti
 *    SSOAutoSubmit dari browser pengguna), lalu POST (relay server dengan cookie
 *    dan action form). POST ditolak dengan form login kembali = password/field
 *    salah → berhenti, tidak ada gunanya mencoba lagi.
 *  - Tanpa form statis (SPA) → Browserless mengisi & submit, rekam request-nya.
 *    Form-encoded → diverifikasi ulang sebagai FORM ke endpoint terekam.
 *    JSON → dilaporkan apa adanya; mode tetap VAULT (belum ada engine JSON).
 * Maksimal 3 kiriman kredensial; tiap kiriman setelah yang pertama memakai slot
 * rate limit verify-login.
 */
async function runTestLadder(data: VerifyConfig, consumeSlot: () => boolean): Promise<LadderOutcome> {
    const attempts: LadderAttempt[] = [];
    const done = (message: string, suggestion: LadderOutcome["suggestion"] = null, jsonEndpoint: LadderOutcome["jsonEndpoint"] = null): LadderOutcome =>
        ({ attempts, message, suggestion, jsonEndpoint });
    const canSend = () => attempts.length < LADDER_MAX_ATTEMPTS && (attempts.length === 0 || consumeSlot());

    const page = await fetchLoginPage(data.url);
    const fresh = detectLoginFields(page.html, { pageUrl: page.finalUrl });
    const userField = fresh.usernameField ?? data.usernameField;
    const passField = fresh.passwordField ?? data.passwordField;

    if (looksLikeOracleEbs(page.html, page.finalUrl)) {
        const result = await dispatch({ ...data, ssoMode: "REROUTE", jsonApi: null });
        if ("status" in result) return done("Uji REROUTE tidak dapat dijalankan.");
        attempts.push({ step: 1, mode: "REROUTE", ok: result.ok, outcome: result.outcome, message: result.message });
        return result.ok
            ? done("Terbukti: SSO Mode REROUTE (Oracle EBS).", { ssoMode: "REROUTE", usernameField: userField, passwordField: passField, httpMethod: "POST" })
            : done(result.message);
    }

    if (fresh.passwordField) {
        // FORM: browser pengguna mengirim langsung ke LOGIN URL tanpa cookie target.
        const formExtras = await refreshVolatileFields(page.finalUrl, { ...fresh.extraFields, ...(data.extraFields ?? {}) });
        const formBody = new URLSearchParams({ ...formExtras, [userField]: data.testUsername, [passField]: data.testPassword });
        const formTry = await relayLogin({
            actionUrl: data.url,
            body: formBody.toString(),
            jar: new CookieJar(),
            referer: page.finalUrl,
            allowInsecureTLS: true,
        });
        attempts.push({
            step: 1,
            mode: "FORM",
            ok: formTry.ok,
            outcome: !formTry.ok ? "REJECTED" : formTry.handoff ? "CREDENTIAL_ACCEPTED" : "TRANSPORT_VALIDATED",
            message: formTry.ok ? "Login diterima tanpa relay server." : (formTry.failureReason ?? "Ditolak."),
        });
        if (formTry.ok) {
            return done("Terbukti: SSO Mode FORM.", { ssoMode: "FORM", usernameField: userField, passwordField: passField, httpMethod: "POST" });
        }

        if (!canSend()) return done("Batas percobaan uji login tercapai sebelum POST dicoba.");
        const postTry = await dispatch({ ...data, ssoMode: "POST", httpMethod: "POST", usernameField: userField, passwordField: passField, jsonApi: null });
        if ("status" in postTry) return done("Uji POST tidak dapat dijalankan.");
        attempts.push({ step: 2, mode: "POST", ok: postTry.ok, outcome: postTry.outcome, message: postTry.message });
        return postTry.ok
            ? done("Terbukti: SSO Mode POST (token terikat cookie, perlu relay server).", { ssoMode: "POST", usernameField: userField, passwordField: passField, httpMethod: "POST" })
            : done(`FORM dan POST sama-sama ditolak — periksa username/password uji. ${postTry.message}`);
    }

    // Tidak ada form di HTML statis: rekam apa yang dikirim halaman saat submit.
    const capture = await captureLoginRequest(data.url, data.testUsername, data.testPassword);
    if (!capture) return done("Layanan browser tidak tersedia — submit SPA tidak dapat direkam. Mode tetap VAULT.");
    attempts.push({
        step: 1,
        mode: "CAPTURE",
        ok: Boolean(capture.login && !capture.stillOnLogin),
        outcome: capture.login && !capture.stillOnLogin ? "TRANSPORT_VALIDATED" : "REJECTED",
        message: capture.login
            ? `${capture.login.method} ${sanitizeLoginUrlForDisplay(capture.login.url) ?? "endpoint"} (${capture.login.encoding}) → HTTP ${capture.login.status ?? "?"}`
            : capture.note,
    });
    const login = capture.login;
    if (!login) return done(`${capture.note} Mode tetap VAULT.`);
    if (capture.stillOnLogin) {
        return done("Halaman tetap menampilkan form login setelah submit — kredensial uji kemungkinan salah. Mode tetap VAULT.");
    }
    if (login.encoding === "json" || !login.usernameKey || !login.passwordKey) {
        return done(
            "Login aplikasi memakai API JSON. Portal belum punya engine SSO JSON, jadi mode tetap VAULT; endpoint dicatat untuk referensi.",
            null,
            { url: sanitizeLoginUrlForDisplay(login.url) ?? login.url, bodyKeys: login.bodyKeys, status: login.status },
        );
    }

    // Form-encoded: buktikan ulang dari server, persis seperti SSOAutoSubmit
    // (POST tanpa cookie ke endpoint terekam).
    if (!canSend()) return done("Batas percobaan uji login tercapai sebelum verifikasi ulang.");
    const replayBody = new URLSearchParams({ [login.usernameKey]: data.testUsername, [login.passwordKey]: data.testPassword });
    const replay = await relayLogin({ actionUrl: login.url, body: replayBody.toString(), jar: new CookieJar(), referer: page.finalUrl, allowInsecureTLS: true });
    attempts.push({
        step: 2,
        mode: "FORM",
        ok: replay.ok,
        outcome: !replay.ok ? "REJECTED" : replay.handoff ? "CREDENTIAL_ACCEPTED" : "TRANSPORT_VALIDATED",
        message: replay.ok ? "Endpoint terekam menerima kiriman form langsung." : (replay.failureReason ?? "Ditolak."),
    });
    return replay.ok
        ? done("Terbukti: SSO Mode FORM ke endpoint yang direkam browser. LOGIN URL ikut diganti ke endpoint itu.", {
              ssoMode: "FORM",
              usernameField: login.usernameKey,
              passwordField: login.passwordKey,
              httpMethod: "POST",
              loginUrl: login.url,
          })
        : done(`Endpoint terekam menolak kiriman langsung dari server. Mode tetap VAULT. ${replay.failureReason ?? ""}`.trim());
}

/**
 * Dispatcher per-mode. Dipisah dari route handler agar mudah diuji mandiri
 * dari scripts/ (lihat test-detect-verify-v2.ts).
 */
async function dispatch(data: VerifyConfig): Promise<DispatchResult> {
    const {
        url,
        ssoMode,
        httpMethod,
        usernameField,
        passwordField,
        extraFields,
        testUsername,
        testPassword,
        jsonApi,
    } = data;

    // ── Opsional: JSON probe (tombol "Uji JSON" di UI) ──────────────────────
    // Hanya boleh dipanggil bila admin mengirim jsonApi secara eksplisit.
    // Mode tidak relevan untuk probe (senantiasa POST JSON ke path spec).
    if (jsonApi) {
        const apiProbe = await probeApiLayer(url);
        const contract = apiProbe.contracts.find((item) => item.path === jsonApi.path && item.method === "POST");
        if (!contract) {
            return {
                ok: false,
                outcome: "REJECTED",
                message: "Kontrak API login yang dipilih tidak ditemukan pada observasi target.",
                handoff: false,
                verifyMode: ssoMode,
                apiProbe,
            };
        }
        // POST JSON {username,password}. Body dibangun dari contract.params
        // sehingga nama field persis sama dengan yang dideklarasikan spec.
        const bodyObj: Record<string, string> = {};
        for (const name of contract.params) {
            if (/password|passwd|pwd|pass|sandi/i.test(name)) bodyObj[name] = testPassword;
            else bodyObj[name] = testUsername;
        }
        const targetUrl = new URL(contract.path, url).href;
        const response = await relayRequest({
            url: targetUrl,
            method: "POST",
            body: JSON.stringify(bodyObj),
            headers: { "content-type": "application/json" },
            allowInsecureTLS: true,
        });
        const status = response.status;
        const acceptedTransport = status >= 200 && status < 300;
        const denied = status === 401 || status === 403;
        return {
            ok: acceptedTransport,
            outcome: acceptedTransport ? "TRANSPORT_VALIDATED" : "REJECTED",
            message: acceptedTransport
                ? "API menerima format permintaan. Penerimaan kredensial belum dapat dibuktikan tanpa marker sukses khusus."
                : denied
                  ? "API hidup, tetapi kredensial ditolak (401/403)."
                  : `Respons tak terduga: HTTP ${status}.`,
            handoff: false,
            verifyMode: ssoMode,
            apiProbe: { ...apiProbe, note: `${apiProbe.note}; uji JSON → HTTP ${status}` },
        };
    }

    // ── VAULT / REDIRECT: reachability only, tanpa kirim kredensial ────────
    if (ssoMode === "VAULT" || ssoMode === "REDIRECT") {
        const page = await fetchLoginPage(url);
        const apiProbe = await probeApiLayer(page.finalUrl);
        const safeFinalUrl = sanitizeLoginUrlForDisplay(page.finalUrl) ?? "target";
        if (page.loopDetected) {
            return {
                ok: false,
                outcome: "REJECTED",
                message: `Halaman berputar dalam pengalihan (berakhir di ${safeFinalUrl}) — server tampak hidup, tetapi URL tidak mengarah ke formulir.`,
                handoff: false,
                verifyMode: ssoMode,
                apiProbe,
            };
        }
        if (!page.html) {
            return {
                ok: false,
                outcome: "REJECTED",
                message: "Halaman kosong / tidak dapat diambil.",
                handoff: false,
                verifyMode: ssoMode,
                apiProbe,
            };
        }
        return {
            ok: true,
            outcome: "TRANSPORT_VALIDATED",
            message: `Halaman reachable; mode ${ssoMode} tidak mengirim kredensial.`,
            handoff: false,
            verifyMode: ssoMode,
            apiProbe,
        };
    }

    // ── FORM / POST / REROUTE: butuh halaman, mungkin kirim kredensial ─────
    const page = await fetchLoginPage(url);
    const jar = page.cookieJar ?? new CookieJar();
    const fresh = detectLoginFields(page.html);

    // REROUTE atau halaman Oracle: pakai engine XHR. Dipicu jika mode=REROUTE
    // ATAU halaman terbukti Oracle (REROUTE adalah default untuk Oracle).
    const isOracleMode = ssoMode === "REROUTE" || looksLikeOracleEbs(page.html, page.finalUrl);
    if (isOracleMode) {
        const formBody = new URLSearchParams();
        formBody.append(usernameField || "username", testUsername);
        formBody.append(passwordField || "password", testPassword);
        const postRes = await relayRequest({
            url: page.finalUrl,
            method: "POST",
            body: formBody.toString(),
            cookie: jar.header(),
            referer: page.finalUrl,
            allowInsecureTLS: true,
            headers: { "X-Service": "AuthenticateUser" },
        });
        jar.absorb(postRes.rawSetCookies);
        const oracle = parseOracleAuthResponse(postRes.html);
        const accepted = oracle.status === "success" && Boolean(oracle.url);
        const failureReason = accepted
            ? null
            : oracle.status === "failed"
              ? `Oracle menolak kredensial uji (${oracle.errorCode || "unknown"}).`
              : "Respons Oracle tidak dikenali — periksa USERNAME FIELD/PASSWORD FIELD pada deteksi.";
        return {
            ok: accepted,
            outcome: accepted ? "CREDENTIAL_ACCEPTED" : "REJECTED",
            message: accepted ? "Login Oracle berhasil (REROUTE)." : (failureReason ?? "Login Oracle gagal."),
            handoff: false,
            verifyMode: "REROUTE",
        };
    }

    // SPA tanpa form: kasih tahu admin, jangan kirim kredensial. Halaman tetap
    // membuktikan target dapat dijangkau, tetapi bukan penerimaan kredensial.
    if (!fresh.passwordField && looksLikeClientRenderedApp(page.html)) {
        const apiProbe = await probeApiLayer(page.finalUrl);
        return {
            ok: false,
            outcome: "TRANSPORT_VALIDATED",
            message:
                "Halaman ini dirakit JavaScript (SPA), jadi kredensial tidak dapat diuji dari portal. " +
                (apiProbe.layer === "OPENAPI" || apiProbe.layer === "KNOWN_ENDPOINT"
                    ? "Kontrak API JSON terdeteksi — gunakan tombol \"Uji JSON\"."
                    : "Uji manual: buka halaman login aplikasi dan login dengan akun tersimpan."),
            handoff: false,
            verifyMode: ssoMode,
            apiProbe,
        };
    }

    // Form login biasa (FORM/POST). Field form di-merge dengan detected —
    // prioritas: nilai form (admin) > auto-detect. Volatil di-refresh.
    const userField = fresh.usernameField ?? usernameField;
    const passField = fresh.passwordField ?? passwordField;
    const actionUrl = fresh.formAction ? new URL(fresh.formAction, page.finalUrl).href : page.finalUrl;

    const formExtras = { ...(extraFields ?? {}) };
    for (const [key, value] of Object.entries(fresh.extraFields)) {
        // Volatil: SELALU ambil dari halaman runtime (lihat aturan §3).
        if (VOLATILE_RE.test(key)) formExtras[key] = value;
        else if (!(key in formExtras)) formExtras[key] = value;
    }
    const finalExtras = await refreshVolatileFields(actionUrl, formExtras);

    const params = new URLSearchParams();
    params.append(userField, testUsername);
    params.append(passField, testPassword);
    for (const [key, value] of Object.entries(finalExtras)) params.append(key, value);

    // ponytail: relayLogin saat ini hanya jalur POST. httpMethod dipayload untuk
    // dipenuhi schema dan siap dipakai engine GET di iterasi berikut. Saat
    // httpMethod=GET kami tolak eksplisit agar admin tahu engine belum ada,
    // bukan diam-diam mengirim POST.
    if (httpMethod === "GET") {
        return {
            ok: false,
            outcome: "TRANSPORT_VALIDATED",
            message:
                "Engine untuk HTTP METHOD GET belum diaktifkan pada dispatcher ini. " +
                "Pilih POST, atau hubungi tim bila aplikasi Anda memang hanya menerima GET.",
            handoff: false,
            verifyMode: ssoMode,
        };
    }

    const outcome = await relayLogin({
        actionUrl,
        body: params.toString(),
        jar,
        referer: page.finalUrl,
        allowInsecureTLS: true,
    });
    const validationOutcome: LoginProfileValidationOutcome = !outcome.ok
        ? "REJECTED"
        : outcome.handoff
          ? "CREDENTIAL_ACCEPTED"
          : "TRANSPORT_VALIDATED";

    return {
        ok: outcome.ok,
        outcome: validationOutcome,
        message: outcome.ok
            ? outcome.handoff
                ? "Login berhasil — konfigurasi terbukti (mode POST/federasi)."
                : "Transport login berhasil. Penerimaan kredensial belum dapat dibuktikan tanpa marker sukses khusus."
            : (outcome.failureReason ?? "Login ditolak aplikasi."),
        handoff: Boolean(outcome.handoff),
        verifyMode: ssoMode,
    };
}
