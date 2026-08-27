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
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { verifyLoginSchema } from "@/lib/validation-schemas";
import { checkVerifyLimit, type VerifySlot } from "@/lib/verify-rate-limit";

const VERIFY_MAX = 5;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const verifyAttempts = new Map<string, VerifySlot>();

type SsoMode = "FORM" | "POST" | "REROUTE" | "VAULT" | "REDIRECT" | "PROXY" | "TOKEN";
type DispatchResult =
    | { ok: boolean; message: string; handoff: boolean; verifyMode: SsoMode; apiProbe?: ApiProbe }
    | { status: number; body: Record<string, unknown> };

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
                { status: 429 }
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
                metadata: { url: data.url, ssoMode: requestedMode, handoff: false },
                request,
            }).catch(() => {});
            return NextResponse.json(
                {
                    error: `Mode ${requestedMode} belum aktif di portal — verifikasi tidak dijalankan. Pilih mode lain (FORM/POST/REROUTE/VAULT/REDIRECT).`,
                    verifyMode: requestedMode,
                },
                { status: 422 }
            );
        }

        let result: DispatchResult;
        try {
            result = await dispatch(data);
        } catch (err) {
            console.error("verify-login dispatch error:", err);
            return NextResponse.json({ error: "Gagal menjalankan uji login" }, { status: 422 });
        }

        if ("status" in result) {
            // Jalur gagal-jelas (saat ini hanya tidak dipakai — semua DispatchResult
            // membawa payload 200, tapi biarkan sebagai escape hatch).
            return NextResponse.json(result.body, { status: result.status });
        }

        // Audit metadata.ssoMode = nilai aktual mode yang dipakai eksekusi.
        // Sebelumnya literal "verify" — tidak bisa ditelusuri per-mode.
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: adminId,
            category: "PORTAL",
            action: "SSO_VERIFY_LOGIN",
            entityType: "PORTAL_APP",
            outcome: result.ok ? "SUCCESS" : "FAILURE",
            errorMessage: result.ok ? undefined : result.message,
            metadata: { url: data.url, ssoMode: result.verifyMode, handoff: result.handoff },
            request,
        }).catch(() => {});

        // Persist bukti verifikasi pada aplikasi (khusus alur EDIT). Catatan §9:
        // walau config belum di-Save, loginVerifiedAt tetap di-set — artinya
        // "form ini teruji", bukan "baris DB teruji". UI wajib memberi label
        // "menggunakan konfigurasi belum disimpan".
        if (data.appId) {
            await prisma.portalApp
                .update({
                    where: { id: data.appId },
                    data: result.ok
                        ? { loginVerifiedAt: new Date(), loginVerifyError: null }
                        : { loginVerifyError: result.message },
                })
                .catch(() => {});
        }

        const body: Record<string, unknown> = {
            ok: result.ok,
            handoff: result.handoff,
            message: result.message,
            verifyMode: result.verifyMode,
        };
        if (result.apiProbe) body.apiProbe = result.apiProbe;
        return NextResponse.json(body);
    } catch (err) {
        console.error("verify-login error:", err);
        return NextResponse.json({ error: "Gagal menjalankan uji login" }, { status: 422 });
    }
}

/**
 * Dispatcher per-mode. Dipisah dari route handler agar mudah diuji mandiri
 * dari scripts/ (lihat test-detect-verify-v2.ts).
 */
async function dispatch(data: {
    url: string;
    ssoMode: SsoMode;
    httpMethod: "POST" | "GET";
    usernameField: string;
    passwordField: string;
    extraFields?: Record<string, string> | null;
    testUsername: string;
    testPassword: string;
    jsonApi?: { path: string } | null;
}): Promise<DispatchResult> {
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
        const contract = apiProbe.contracts.find((c) => c.path === jsonApi.path && c.method === "POST");
        if (!contract) {
            return {
                ok: false,
                message: `Kontrak untuk ${jsonApi.path} tidak ditemukan di spec (${apiProbe.note})`,
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
        const res = await relayRequest({
            url: targetUrl,
            method: "POST",
            body: JSON.stringify(bodyObj),
            headers: { "content-type": "application/json" },
            allowInsecureTLS: true,
        });
        const status = res.status;
        const ok = status >= 200 && status < 300;
        const denied = status === 401 || status === 403;
        return {
            ok: ok || denied,
            message: ok
                ? "API menerima format — kredensial valid."
                : denied
                  ? "API hidup, kredensial ditolak (401/403)."
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
        if (page.loopDetected) {
            return {
                ok: false,
                message: `Halaman berputar dalam pengalihan (berakhir di ${page.finalUrl}) — server tampak hidup, tetapi URL tidak mengarah ke formulir.`,
                handoff: false,
                verifyMode: ssoMode,
                apiProbe,
            };
        }
        if (!page.html) {
            return {
                ok: false,
                message: "Halaman kosong / tidak dapat diambil.",
                handoff: false,
                verifyMode: ssoMode,
                apiProbe,
            };
        }
        return {
            ok: true,
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
        const ok = oracle.status === "success" && !!oracle.url;
        const failureReason = ok
            ? null
            : oracle.status === "failed"
              ? `Oracle menolak kredensial uji (${oracle.errorCode || "unknown"}).`
              : "Respons Oracle tidak dikenali — periksa USERNAME FIELD/PASSWORD FIELD pada deteksi.";
        return {
            ok,
            message: ok ? "Login Oracle berhasil (REROUTE)." : (failureReason ?? "Login Oracle gagal."),
            handoff: false,
            verifyMode: "REROUTE",
        };
    }

    // SPA tanpa form: kasih tahu admin, jangan kirim kredensial.
    if (!fresh.passwordField && looksLikeClientRenderedApp(page.html)) {
        const apiProbe = await probeApiLayer(page.finalUrl);
        return {
            ok: false,
            message:
                "Halaman ini dirakit JavaScript (SPA), jadi kredensial tidak dapat diuji dari portal. " +
                (apiProbe.layer === "OPENAPI"
                    ? `Kontrak API JSON terdeteksi — gunakan tombol "Uji JSON".`
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
    for (const [k, v] of Object.entries(fresh.extraFields)) {
        // Volatil: SELALU ambil dari halaman runtime (lihat aturan §3).
        if (VOLATILE_RE.test(k)) formExtras[k] = v;
        else if (!(k in formExtras)) formExtras[k] = v;
    }
    const finalExtras = await refreshVolatileFields(actionUrl, formExtras);

    const params = new URLSearchParams();
    params.append(userField, testUsername);
    params.append(passField, testPassword);
    for (const [k, v] of Object.entries(finalExtras)) params.append(k, v);

    // ponytail: relayLogin saat ini hanya jalur POST. httpMethod dipayload untuk
    // dipenuhi schema dan siap dipakai engine GET di iterasi berikut. Saat
    // httpMethod=GET kami tolak eksplisit agar admin tahu engine belum ada,
    // bukan diam-diam mengirim POST.
    if (httpMethod === "GET") {
        return {
            ok: false,
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

    return {
        ok: outcome.ok,
        message: outcome.ok
            ? outcome.handoff
                ? "Login berhasil — konfigurasi terbukti (mode POST/federasi)."
                : "Login berhasil. Bila aplikasi berbeda domain dari portal, pastikan PORTAL_SSO_COOKIE_DOMAIN sesuai atau aplikasi memakai federasi."
            : (outcome.failureReason ?? "Login ditolak aplikasi."),
        handoff: !!outcome.handoff,
        verifyMode: ssoMode,
    };
}
