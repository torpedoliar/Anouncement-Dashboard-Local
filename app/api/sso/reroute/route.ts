import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { relayRequest } from "@/lib/portal-fetch-html";
import { parseOracleAuthResponse, sharedCookieDomain } from "@/lib/portal-sso-relay";

export async function POST(request: NextRequest) {
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

        const app = await prisma.portalApp.findUnique({
            where: { slug: appSlug },
        });

        if (!app || !app.isActive || app.ssoMode !== "REROUTE") {
            return NextResponse.json({ error: "App not found or not REROUTE mode" }, { status: 404 });
        }

        const hasAccess = await canAccessPortalAppBySlug(portalUserId, appSlug);
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        let credential;
        if (credentialId) {
            credential = await prisma.portalUserAppCredential.findFirst({
                where: { id: credentialId, portalUserId },
            });
        } else {
            // fallback: akun pertama (kompatibilitas pemanggil lama tanpa credentialId)
            credential = await prisma.portalUserAppCredential.findFirst({
                where: { portalUserId, appId: app.id },
                orderBy: { createdAt: "asc" },
            });
        }

        if (!credential) {
            return NextResponse.json({ error: "No credential" }, { status: 400 });
        }

        const cred = decryptCredential(credential.credentialBlob);
        const loginUrl = app.loginUrl || app.url;

        // Oracle EBS AppsLocalLogin.jsp login is an XHR-style POST to the SAME url with
        // a custom header X-Service: AuthenticateUser. Response is a JS object literal (not JSON,
        // not a redirect). Without X-Service, Oracle just re-serves the login HTML page (200, 3496 bytes)
        // and the browser-side submitCredentials() in ?login.js is what actually authenticates.
        // ponytail: X-Service hardcoded to Oracle's AuthenticateUser; generalize to a PortalApp
        // serviceHeader field if a non-Oracle app ever needs REROUTE.

        // Build POST body. Oracle param names are literally "username"/"password" regardless of the
        // DOM input name= attributes; usernameField/passwordField config must be set to those literals.
        const formBody = new URLSearchParams();
        formBody.append(app.usernameField || "username", cred.username);
        formBody.append(app.passwordField || "password", cred.password);

        const extraFields: Record<string, string> = {};
        if (cred.extra) Object.assign(extraFields, cred.extra);
        if (app.extraFields && typeof app.extraFields === "object") {
            Object.assign(extraFields, app.extraFields as Record<string, string>);
        }
        for (const [k, v] of Object.entries(extraFields)) {
            formBody.append(k, v as string);
        }

        // POST AuthenticateUser (server-to-server; Origin/Referer spoofed to target domain).
        // TLS longgar terbatas pada request ini (bukan seluruh proses).
        // ponytail: Oracle login bisa sangat lambat — timeout 120 dtk khusus REROUTE
        // (default relayRequest 12 dtk). Naik per-call, jangan ubah default global.
        const postRes = await relayRequest({
            url: loginUrl,
            method: "POST",
            body: formBody.toString(),
            referer: loginUrl,
            allowInsecureTLS: true,
            timeoutMs: 120000,
            headers: { "X-Service": "AuthenticateUser" },
        });

        const finalCookiePairs: string[] = postRes.rawSetCookies.map((c) => c.split(";")[0]);

        // Parse Oracle's JS-object-literal response (keys unquoted, hex-escaped values).
        // login.js uses eval(); we extract fields with regex to avoid eval.
        const { status: authStatus, url: authUrl, errorCode } = parseOracleAuthResponse(postRes.html);

        // Oracle rejects bad creds with {status:'failed', errorCode:'...'} (still 200, small JSON-ish body)
        if (authStatus !== "success" || !authUrl) {
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: portalUserId,
                category: "SECURITY",
                action: "SSO_LAUNCH",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id, // KPI /admin/portal-audit memfilter appId
                outcome: "FAILURE",
                errorMessage: `Oracle login rejected credentials (${errorCode || "unknown"})`,
                metadata: { appSlug: app.slug, appName: app.name, ssoMode: "REROUTE" }
            }).catch(() => {});

            return NextResponse.redirect(new URL(`/portal?error=sso_failed&app=${appSlug}`, baseUrl), 302);
        }

        const cookieMap = new Map<string, string>();
        for (const pair of finalCookiePairs) {
            if (pair.includes("=")) {
                const [k, ...v] = pair.split("=");
                cookieMap.set(k.trim(), v.join("="));
            }
        }
        
        // Direct-redirect mode (Laporan Investigasi SSO Oracle):
        // Re-issue Oracle's session cookies to the browser scoped to the shared domain,
        // then redirect to Oracle's REAL landing URL. No reverse proxy → no 502 (proxy
        // route's OOM crash gone), no OAF MAC breakage (URLs not rewritten).
        //
        // Domain cookie HARUS dihitung dari host portal yang sebenarnya: cookie
        // Domain=*.santos.co.id dari host IP (mis. 192.168.2.3:3100) dibuang browser
        // diam-diam → redirect mendarat kembali di halaman login Oracle. Pola sama
        // dengan route POST: tanpa shared domain, jangan berpura-pura berhasil.
        const resolvedUrl = new URL(authUrl, loginUrl);
        const cookieDomain = sharedCookieDomain(reqHost ?? "", resolvedUrl.hostname);
        const isHttps = reqProto === "https";

        if (!cookieDomain) {
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: portalUserId,
                category: "SECURITY",
                action: "SSO_LAUNCH",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id,
                outcome: "FAILURE",
                errorMessage:
                    "REROUTE: login Oracle berhasil di server, tetapi sesi tidak dapat dipindahkan ke browser " +
                    "karena portal dan aplikasi tidak berbagi domain induk (cookie lintas-domain dibuang browser). " +
                    "Solusi permanen: akses portal via subdomain .santos.co.id atau setel PORTAL_SSO_COOKIE_DOMAIN; " +
                    "sementara itu gunakan SSO Mode VAULT.",
                metadata: { appSlug: app.slug, appName: app.name, ssoMode: "REROUTE", portalHost: reqHost, appHost: resolvedUrl.hostname },
            }).catch(() => {});

            return NextResponse.redirect(
                new URL(`/portal?error=sso_cross_domain&app=${appSlug}`, baseUrl),
                302
            );
        }

        // Destination: Oracle's success response carries the absolute landing url (OANEWHOMEPAGE).
        const destinationUrl = resolvedUrl.href;

        // Build one Set-Cookie header per Oracle cookie, scoped to the shared TLD so the
        // browser sends them to appsprod.santos.co.id (Oracle) directly.
        const setCookieHeaders = Array.from(cookieMap.entries()).map(([k, v]) => {
            const parts = [
                `${k}=${v}`,
                `Path=/`,
                `Domain=${cookieDomain}`,
                `HttpOnly`,
                `SameSite=Lax`,
            ];
            if (isHttps) parts.push("Secure");
            parts.push("Max-Age=28800"); // 8 hours, matches Oracle session lifetime
            return parts.join("; ");
        });

        // Audit log (non-blocking) before redirect
        await logAudit({
            actorType: "PORTAL_USER",
            actorId: portalUserId,
            category: "SECURITY",
            action: "SSO_LAUNCH",
            entityType: "PORTAL_APP",
            entityId: app.id,
            appId: app.id, // KPI /admin/portal-audit memfilter appId
            outcome: "SUCCESS",
            metadata: { appSlug: app.slug, appName: app.name, ssoMode: "REROUTE" }
        }).catch(() => {});

        const res = NextResponse.redirect(new URL(destinationUrl, baseUrl), 302);
        for (const sc of setCookieHeaders) {
            res.headers.append("Set-Cookie", sc);
        }
        return res;
    } catch (err) {
        console.error("REROUTE SSO Error:", err);
        return NextResponse.json({ error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
