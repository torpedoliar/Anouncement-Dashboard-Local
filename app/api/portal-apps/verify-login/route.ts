import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchLoginPage, CookieJar, relayRequest } from "@/lib/portal-fetch-html";
import { detectLoginFields } from "@/lib/portal-login-detect";
import {
    looksLikeClientRenderedApp,
    looksLikeOracleEbs,
    parseOracleAuthResponse,
    relayLogin,
} from "@/lib/portal-sso-relay";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { verifyLoginSchema } from "@/lib/validation-schemas";
import { checkVerifyLimit, type VerifySlot } from "@/lib/verify-rate-limit";

const VERIFY_MAX = 5;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const verifyAttempts = new Map<string, VerifySlot>();

// POST /api/portal-apps/verify-login — SuperAdmin & ADMIN (gate sama dengan halaman
// /admin/portal-apps dan route detect-fields; sebelumnya SuperAdmin-only sehingga
// tombol Uji Login yang tampil untuk ADMIN selalu menjawab 403).
// Kredensial uji TIDAK disimpan & TIDAK dicatat; hanya hasilnya yang masuk audit.
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

        const body = await request.json().catch(() => null);
        const validation = verifyLoginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Validasi gagal" }, { status: 400 });
        }
        const { url, appId, usernameField, passwordField, testUsername, testPassword } = validation.data;

        const page = await fetchLoginPage(url);
        const jar = page.cookieJar ?? new CookieJar();
        const fresh = detectLoginFields(page.html);

        // ── Pola Oracle EBS (SSO Mode REROUTE) ────────────────────────────────────
        // Login lewat XHR POST + header X-Service ke URL yang sama; form standar akan
        // selalu dianggap gagal karena Oracle hanya menyajikan ulang halaman login.
        if (looksLikeOracleEbs(page.html, page.finalUrl)) {
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
            // Respons tanpa field status berarti endpoint tidak menjawab protokolnya
            // (mis. konfigurasi field salah) — laporkan apa adanya.
            const ok = oracle.status === "success" && !!oracle.url;
            const failureReason = ok
                ? null
                : oracle.status === "failed"
                  ? `Oracle menolak kredensial uji (${oracle.errorCode || "unknown"}).`
                  : "Respons Oracle tidak dikenali — periksa USERNAME FIELD/PASSWORD FIELD pada deteksi.";

            return respondWithResult({ ok, failureReason, handoff: false }, { url, appId, adminId, request });
        }

        // ── SPA / halaman yang form-nya dirakit JavaScript (SSO Mode VAULT) ───────
        // Tidak ada form yang bisa dikirim server-side; uji hanya memastikan halaman
        // hidup dan bentuknya sesuai dugaan. Kredensial tidak bisa diverifikasi dari sini.
        if (!fresh.passwordField && looksLikeClientRenderedApp(page.html)) {
            return respondWithResult(
                {
                    ok: false,
                    failureReason:
                        "Halaman ini dirakit JavaScript (SPA), jadi kredensial tidak dapat diuji dari portal. " +
                        "Uji manual: buka halaman login aplikasi dan login dengan akun tersimpan.",
                    handoff: false,
                },
                { url, appId, adminId, request }
            );
        }

        // ── Form login biasa (SSO Mode FORM/POST) ─────────────────────────────────
        const userField = fresh.usernameField ?? usernameField;
        const passField = fresh.passwordField ?? passwordField;
        const actionUrl = fresh.formAction ? new URL(fresh.formAction, page.finalUrl).href : page.finalUrl;

        const params = new URLSearchParams();
        params.append(userField, testUsername);
        params.append(passField, testPassword);
        for (const [k, v] of Object.entries(fresh.extraFields)) params.append(k, v);

        const outcome = await relayLogin({
            actionUrl,
            body: params.toString(),
            jar,
            referer: page.finalUrl,
            allowInsecureTLS: true,
        });

        return respondWithResult(
            { ok: outcome.ok, failureReason: outcome.failureReason, handoff: !!outcome.handoff },
            { url, appId, adminId, request }
        );
    } catch (err) {
        console.error("verify-login error:", err);
        return NextResponse.json({ error: "Gagal menjalankan uji login" }, { status: 422 });
    }
}

/**
 * Satu pintu keluar: audit hasil (tanpa nilai kredensial), persist bukti verifikasi
 * alur EDIT, lalu pesan sesuai jalur yang dipakai.
 */
async function respondWithResult(
    result: { ok: boolean; failureReason: string | null; handoff: boolean },
    ctx: { url: string; appId?: string | null; adminId: string; request: NextRequest }
): Promise<NextResponse> {
    // Catat HASIL saja, tanpa nilai kredensial.
    await logAudit({
        actorType: "ADMIN_USER",
        actorId: ctx.adminId,
        category: "PORTAL",
        action: "SSO_VERIFY_LOGIN",
        entityType: "PORTAL_APP",
        outcome: result.ok ? "SUCCESS" : "FAILURE",
        errorMessage: result.failureReason ?? undefined,
        metadata: { url: ctx.url, ssoMode: "verify", handoff: result.handoff },
        request: ctx.request,
    }).catch(() => {});

    // Persist bukti verifikasi pada aplikasi (khusus alur EDIT; saat CREATE app belum ada).
    if (ctx.appId) {
        await prisma.portalApp
            .update({
                where: { id: ctx.appId },
                data: result.ok
                    ? { loginVerifiedAt: new Date(), loginVerifyError: null }
                    : { loginVerifyError: result.failureReason ?? "Login ditolak aplikasi." },
            })
            .catch(() => {});
    }

    // Pesan mengikuti 4 baris tabel Lapis 3 di spec, bukan sekadar sukses/gagal.
    return NextResponse.json({
        ok: result.ok,
        handoff: result.handoff,
        message: result.ok
            ? result.handoff
                ? "Login berhasil — konfigurasi terbukti (mode POST/federasi)."
                : "Login berhasil. Bila aplikasi berbeda domain dari portal, pastikan PORTAL_SSO_COOKIE_DOMAIN sesuai atau aplikasi memakai federasi."
            : (result.failureReason ?? "Login ditolak aplikasi."),
    });
}