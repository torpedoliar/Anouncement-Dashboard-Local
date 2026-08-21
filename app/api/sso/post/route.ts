import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { fetchLoginPage, CookieJar } from "@/lib/portal-fetch-html";
import { detectLoginFields } from "@/lib/portal-login-detect";
import { relayLogin, sharedCookieDomain, type AutoPostForm } from "@/lib/portal-sso-relay";

/**
 * SSO Mode POST — relay kredensial server-to-server.
 *
 * Alur:
 *   1. Prefetch halaman login mengikuti rantai pengalihan sambil membawa cookie,
 *      sehingga token antiforgery dan cookie pasangannya berasal dari sesi yang SAMA.
 *   2. Kirim kredensial, lalu ikuti rantai pasca-login sampai selesai.
 *   3. Serahkan hasilnya ke browser:
 *      - Aplikasi berbasis federasi (K2/WS-Federation, ADFS, SAML) menghasilkan form
 *        auto-POST berisi token. Form itu diteruskan ke browser pengguna untuk dikirim
 *        sendiri — inilah yang membuat aplikasi memasang cookie sesi pada origin-nya,
 *        satu-satunya cara yang sah untuk lintas domain.
 *      - Aplikasi satu domain dengan portal: cookie sesi diterbitkan ulang langsung.
 */

/** HTML minimal yang menyerahkan token federasi ke browser untuk dikirim sendiri. */
function autoPostHandoffPage(form: AutoPostForm, appName: string): string {
    const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const inputs = Object.entries(form.fields)
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}" />`)
        .join("\n");

    return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>Menghubungkan ke ${esc(appName)}</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;color:#334155">
<form id="sso" method="POST" action="${esc(form.action)}">
${inputs}
<noscript><button type="submit">Lanjutkan ke ${esc(appName)}</button></noscript>
</form>
<p>Menghubungkan ke ${esc(appName)}…</p>
<script>document.getElementById('sso').submit();</script>
</body></html>`;
}

export async function POST(request: NextRequest) {
    try {
        const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const reqProto =
            request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
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

        const auditBase = {
            actorType: "PORTAL_USER" as const,
            actorId: portalUserId,
            category: "SECURITY" as const,
            action: "SSO_LAUNCH",
            entityType: "PORTAL_APP",
            entityId: app.id,
            appId: app.id,
        };
        const failRedirect = () =>
            NextResponse.redirect(new URL(`/portal?error=sso_failed&app=${appSlug}`, baseUrl), 302);

        // 1. Prefetch: token + cookie dari sesi yang sama.
        let prefetched;
        try {
            prefetched = await fetchLoginPage(loginUrl);
        } catch {
            await logAudit({
                ...auditBase,
                outcome: "FAILURE",
                errorMessage: "POST relay: gagal memuat halaman login",
                metadata: { appSlug: app.slug, ssoMode: "POST" },
            }).catch(() => {});
            return failRedirect();
        }

        const jar = prefetched.cookieJar ?? new CookieJar();
        const fresh = detectLoginFields(prefetched.html);

        if (!fresh.passwordField) {
            await logAudit({
                ...auditBase,
                outcome: "FAILURE",
                errorMessage: "POST relay: form login tidak ditemukan pada halaman target",
                metadata: { appSlug: app.slug, ssoMode: "POST", finalUrl: prefetched.finalUrl },
            }).catch(() => {});
            return failRedirect();
        }

        const usernameField = fresh.usernameField ?? app.usernameField ?? "username";
        const passwordField = fresh.passwordField ?? app.passwordField ?? "password";
        // Form action relatif diselesaikan terhadap URL AKHIR prefetch, bukan URL awal —
        // rantai federasi berakhir di host/path yang berbeda dari yang dikonfigurasi.
        const actionUrl = fresh.formAction
            ? new URL(fresh.formAction, prefetched.finalUrl).href
            : prefetched.finalUrl;

        // 2. Susun body: token segar dari halaman menang atas nilai tersimpan.
        const body = new URLSearchParams();
        body.append(usernameField, cred.username);
        body.append(passwordField, cred.password);
        for (const [k, v] of Object.entries(fresh.extraFields)) body.append(k, v);
        if (app.extraFields && typeof app.extraFields === "object") {
            for (const [k, v] of Object.entries(app.extraFields as Record<string, string>)) {
                if (!body.has(k)) body.append(k, v);
            }
        }

        // TLS longgar hanya untuk host internal ini, bukan seluruh proses.
        const outcome = await relayLogin({
            actionUrl,
            body: body.toString(),
            jar,
            referer: prefetched.finalUrl,
            allowInsecureTLS: true,
        });

        if (!outcome.ok) {
            await logAudit({
                ...auditBase,
                outcome: "FAILURE",
                errorMessage: outcome.failureReason ?? `POST relay ditolak (HTTP ${outcome.statusCode})`,
                metadata: { appSlug: app.slug, ssoMode: "POST", statusCode: outcome.statusCode },
            }).catch(() => {});
            return failRedirect();
        }

        await logAudit({
            ...auditBase,
            outcome: "SUCCESS",
            metadata: {
                appSlug: app.slug,
                appName: app.name,
                ssoMode: "POST",
                statusCode: outcome.statusCode,
                handoff: outcome.handoff ? "FEDERATION_AUTOPOST" : "COOKIE_REISSUE",
            },
        }).catch(() => {});

        // 3a. Serah-terima federasi: browser mengirim token sendiri ke aplikasi, sehingga
        //     aplikasi memasang cookie sesi pada origin-nya sendiri. Ini satu-satunya jalur
        //     yang bekerja saat portal dan aplikasi berbeda domain.
        if (outcome.handoff) {
            return new NextResponse(autoPostHandoffPage(outcome.handoff, app.name), {
                status: 200,
                headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
            });
        }

        // 3b. Satu domain dengan portal: terbitkan ulang cookie sesi ke browser.
        const cookieDomain = sharedCookieDomain(reqHost ?? "", parsedUrl.hostname);
        // Tujuan diambil dari URL AKHIR rantai relay — di situlah sesi baru saja terbentuk.
        // `app.url` dipakai sebagai fallback saja; memaksakannya membuang hasil rantai dan
        // bisa melempar pengguna kembali ke titik yang menuntut login ulang.
        const destination = outcome.finalUrl || (app.url?.trim() ? app.url.trim() : parsedUrl.origin);

        if (!cookieDomain) {
            // Jujur: cookie lintas-domain akan dibuang browser. Login server berhasil, tapi
            // sesinya tidak bisa dipindahkan — jangan berpura-pura SSO berhasil.
            await logAudit({
                ...auditBase,
                outcome: "FAILURE",
                errorMessage:
                    "POST relay: sesi tidak dapat dipindahkan ke browser karena portal dan aplikasi berbeda domain " +
                    "(aplikasi tidak memakai serah-terima federasi). Setel PORTAL_SSO_COOKIE_DOMAIN bila keduanya " +
                    "berbagi domain induk, atau gunakan SSO Mode VAULT.",
                metadata: { appSlug: app.slug, ssoMode: "POST", portalHost: reqHost, appHost: parsedUrl.hostname },
            }).catch(() => {});
            return NextResponse.redirect(
                new URL(`/portal?error=sso_cross_domain&app=${appSlug}`, baseUrl),
                302
            );
        }

        const isHttps = reqProto === "https";
        const res = NextResponse.redirect(destination, 302);
        for (const [k, v] of Object.entries(jar.toObject())) {
            const parts = [`${k}=${v}`, "Path=/", `Domain=${cookieDomain}`, "HttpOnly", "SameSite=Lax"];
            if (isHttps) parts.push("Secure");
            parts.push("Max-Age=28800"); // 8 jam, sejalan dengan masa sesi REROUTE
            res.headers.append("Set-Cookie", parts.join("; "));
        }
        return res;
    } catch (err) {
        console.error("POST relay SSO Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
