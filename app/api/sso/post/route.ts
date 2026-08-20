import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { fetchLoginPage } from "@/lib/portal-fetch-html";
import { detectLoginFields } from "@/lib/portal-login-detect";

/**
 * SSO Mode POST — relay kredensial server-to-server.
 *
 * Untuk situs yang menerbitkan token antiforgery TERIKAT COOKIE sesi (K2, ASP.NET MVC,
 * Django, Rails): browser pengguna tidak akan pernah punya cookie pasangannya, jadi
 * SSO FORM (auto-submit) selalu ditolak server. Di sini portallah yang melakukan:
 *
 *   1. Prefetch halaman login (dengan redirect manual + deteksi loop) → ambil cookie
 *      antiforgery + token dari HTML yang SEGAR tiap akses (pola "cache acak").
 *   2. Kirim kredensial + token dengan header Cookie dari langkah 1.
 *   3. Tangkap cookie sesi hasil login, terbitkan ulang ke browser dengan Path=/
 *      agar request berikutnya ke aplikasi terbawa otomatis.
 *   4. Alihkan browser ke halaman tujuan aplikasi.
 *
 * Batasan (jujur): cookie sesi hanya akan "nempel" di browser bila browser dan
 * aplikasi berbagi host/domain — setel PORTAL_SSO_COOKIE_DOMAIN bila domain aplikasi
 * berbeda dari host login (mis. ".santos.co.id"). Tanpa itu, Set-Cookie lintas-origin
 * akan dibuang browser dan user tetap harus login manual di tab aplikasi.
 */

function parseSetCookies(pairs: string[]): Array<{ name: string; value: string }> {
    const out: Array<{ name: string; value: string }> = [];
    for (const c of pairs) {
        const eq = c.indexOf("=");
        if (eq === -1) continue;
        const name = c.slice(0, eq).trim();
        const value = c.slice(eq + 1).split(";")[0].trim();
        if (name) out.push({ name, value });
    }
    return out;
}

export async function POST(request: NextRequest) {
    // Ignore self-signed certs untuk internal (K2 dll.) — pola sama dengan REROUTE.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    try {
        const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const reqProto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
        const baseUrl = reqHost ? `${reqProto}://${reqHost}` : new URL(request.url).origin;

        const formData = await request.formData();
        const appSlug = formData.get("appSlug") as string;
        const credentialId = formData.get("credentialId") as string | null;
        if (!appSlug) {
            return NextResponse.json({ error: "App slug required" }, { status: 400 });
        }

        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const portalUserId = (session.user as { id: string }).id;

        const app = await prisma.portalApp.findUnique({ where: { slug: appSlug } });
        if (!app || !app.isActive || app.ssoMode !== "POST") {
            return NextResponse.json({ error: "App not found or not POST mode" }, { status: 404 });
        }

        const hasAccess = await canAccessPortalAppBySlug(portalUserId, appSlug);
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const credential = credentialId
            ? await prisma.portalUserAppCredential.findFirst({ where: { id: credentialId, portalUserId } })
            : await prisma.portalUserAppCredential.findFirst({
                  where: { portalUserId, appId: app.id },
                  orderBy: { createdAt: "asc" },
              });
        if (!credential) {
            return NextResponse.json({ error: "No credential" }, { status: 400 });
        }

        const cred = decryptCredential(credential.credentialBlob);
        const loginUrl = (app.loginUrl || app.url).trim();
        const parsedUrl = new URL(loginUrl);

        // 1. Prefetch halaman login → cookie + token segar (pola cache acak tiap akses).
        let prefetched;
        try {
            prefetched = await fetchLoginPage(loginUrl);
        } catch (err) {
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: portalUserId,
                category: "SECURITY",
                action: "SSO_LAUNCH",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id,
                outcome: "FAILURE",
                errorMessage: "POST relay: gagal memuat halaman login",
                metadata: { appSlug: app.slug, ssoMode: "POST" },
            }).catch(() => {});
            return NextResponse.redirect(new URL(`/portal?error=sso_failed&app=${appSlug}`, baseUrl), 302);
        }

        const prefetchCookies = parseSetCookies(prefetched.setCookies);
        const cookieHeader = prefetchCookies.map((c) => `${c.name}=${c.value}`).join("; ");

        // Deteksi field + token dari HTML yang segar; fallback ke konfigurasi app.
        const fresh = detectLoginFields(prefetched.html);
        const usernameField = fresh.usernameField ?? app.usernameField ?? "username";
        const passwordField = fresh.passwordField ?? app.passwordField ?? "password";
        const actionUrl = fresh.formAction ? new URL(fresh.formAction, loginUrl).href : loginUrl;

        // 2. Kirim kredensial + token, dengan cookie hasil prefetch.
        const body = new URLSearchParams();
        body.append(usernameField, cred.username);
        body.append(passwordField, cred.password);
        for (const [k, v] of Object.entries(fresh.extraFields)) {
            body.append(k, v);
        }
        // App-level extra (token statis dari konfigurasi) dilengkapi bila belum ada.
        if (app.extraFields && typeof app.extraFields === "object") {
            const appFields = app.extraFields as Record<string, string>;
            for (const [k, v] of Object.entries(appFields)) {
                if (!body.has(k)) body.append(k, v);
            }
        }

        const postRes = await fetch(actionUrl, {
            method: "POST",
            redirect: "manual",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Cookie: cookieHeader,
                Origin: parsedUrl.origin,
                Referer: loginUrl,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            },
            body: body.toString(),
        });

        const postCookies = parseSetCookies(
            typeof postRes.headers.getSetCookie === "function" ? postRes.headers.getSetCookie() : []
        );
        const location = postRes.headers.get("location");
        const status = postRes.status;
        const isRedirect = status >= 300 && status < 400;

        // Deteksi gagal: 302 ke halaman error/login, atau re-render form login (200).
        const redirectToError = isRedirect && location && /(error|login|signin|Logout)/i.test(location) && !/wa=wsignin1\.0/.test(location);
        let loginFailed = status >= 400;
        if (isRedirect && location && redirectToError) loginFailed = true;
        if (!isRedirect && status < 400) {
            // 2xx yang ternyata mengembalikan form login lagi (validasi gagal).
            const text = await postRes.text().catch(() => "");
            if (text && /<input[^>]*(type=["']?password["']?)/i.test(text)) loginFailed = true;
        }

        if (loginFailed) {
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: portalUserId,
                category: "SECURITY",
                action: "SSO_LAUNCH",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id,
                outcome: "FAILURE",
                errorMessage: `POST relay ditolak (HTTP ${status})`,
                metadata: { appSlug: app.slug, ssoMode: "POST", statusCode: status },
            }).catch(() => {});
            return NextResponse.redirect(new URL(`/portal?error=sso_failed&app=${appSlug}`, baseUrl), 302);
        }

        // 3. Terbitkan ulang semua cookie (prefetch + hasil POST) ke browser.
        const allCookies = [...prefetchCookies, ...postCookies];
        const cookieDomain = process.env.PORTAL_SSO_COOKIE_DOMAIN ?? parsedUrl.hostname;
        const isHttps = reqProto === "https";
        const cookiePairs = new Map(allCookies.map((c) => [c.name, c.value]));

        const setCookieHeaders = Array.from(cookiePairs.entries()).map(([k, v]) => {
            const parts = [`${k}=${v}`, "Path=/", `Domain=${cookieDomain}`, "HttpOnly", "SameSite=Lax"];
            if (isHttps) parts.push("Secure");
            parts.push("Max-Age=28800"); // 8 jam, sejalan dengan masa sesi REROUTE
            return parts.join("; ");
        });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: portalUserId,
            category: "SECURITY",
            action: "SSO_LAUNCH",
            entityType: "PORTAL_APP",
            entityId: app.id,
            appId: app.id,
            outcome: "SUCCESS",
            metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST", statusCode: status },
        }).catch(() => {});

        // 4. Tujuan: Location dari server (bila ada & masuk akal), fallback ke app.url.
        const destination = location
            ? new URL(location, parsedUrl.origin).href
            : app.url && app.url.trim()
              ? app.url.trim()
              : parsedUrl.origin;

        const res = NextResponse.redirect(destination, 302);
        for (const sc of setCookieHeaders) {
            res.headers.append("Set-Cookie", sc);
        }
        return res;
    } catch (err) {
        console.error("POST relay SSO Error:", err);
        return NextResponse.json({ error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}