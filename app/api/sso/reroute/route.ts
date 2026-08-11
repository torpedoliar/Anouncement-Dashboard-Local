import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
    // Ignore self-signed certs for internal Oracle EBS
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    try {
        const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const reqProto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
        const baseUrl = reqHost ? `${reqProto}://${reqHost}` : new URL(request.url).origin;

        const formData = await request.formData();
        const appSlug = formData.get("appSlug") as string;

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

        const credential = await prisma.portalUserAppCredential.findUnique({
            where: { portalUserId_appId: { portalUserId, appId: app.id } },
        });

        if (!credential) {
            return NextResponse.json({ error: "No credential" }, { status: 400 });
        }

        const cred = decryptCredential(credential.credentialBlob);
        const loginUrl = app.loginUrl || app.url;
        const origin = new URL(loginUrl).origin;

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

        // POST AuthenticateUser (server-to-server; Origin/Referer spoofed to target domain)
        const postRes = await fetch(loginUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Service": "AuthenticateUser",
                "Origin": origin,
                "Referer": loginUrl,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            body: formBody.toString(),
            redirect: "manual"
        });

        const setCookiePairs = (res: Response): string[] => {
            if (typeof res.headers.getSetCookie === "function") {
                return res.headers.getSetCookie().map(c => c.split(";")[0]);
            }
            const raw = res.headers.get("set-cookie");
            return raw ? raw.split(",").map((c) => c.split(";")[0]) : [];
        };

        const finalCookiePairs: string[] = setCookiePairs(postRes);
        const postBody = await postRes.text();

        // Parse Oracle's JS-object-literal response (keys unquoted, hex-escaped values).
        // login.js uses eval(); we extract fields with regex to avoid eval.
        const unescapeOracle = (s: string) =>
            s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        const fieldRe = (name: string) => {
            const m = postBody.match(new RegExp(`${name}\\s*:\\s*'(.*?)'`, "m"));
            return m ? unescapeOracle(m[1]) : "";
        };
        const authStatus = fieldRe("status");
        const authUrl = fieldRe("url");

        // Oracle rejects bad creds with {status:'failed', errorCode:'...'} (still 200, small JSON-ish body)
        if (authStatus !== "success" || !authUrl) {
            const errorCode = fieldRe("errorCode") || "unknown";
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: portalUserId,
                category: "SECURITY",
                action: "SSO_LAUNCH",
                entityType: "PORTAL_APP",
                entityId: app.id,
                outcome: "FAILURE",
                errorMessage: `Oracle login rejected credentials (${errorCode})`,
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
        // Re-issue Oracle's session cookies to the browser with Domain=.santos.co.id, then
        // redirect to Oracle's REAL landing URL. No reverse proxy → no 502 (proxy route's
        // OOM crash gone), no OAF MAC breakage (URLs not rewritten).
        // ponytail: cookie domain hardcoded to .santos.co.id; generalize to a PortalApp
        // cookieDomain field if a non-santos app ever needs REROUTE.
        const cookieDomain = ".santos.co.id";
        const isHttps = reqProto === "https";

        // Destination: Oracle's success response carries the absolute landing url (OANEWHOMEPAGE).
        const resolvedUrl = new URL(authUrl, loginUrl);
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
