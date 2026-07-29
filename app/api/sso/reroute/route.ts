import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential, encrypt } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

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

        let finalCookiePairs: string[] = setCookiePairs(postRes);
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
        
        const allTargetCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

        // Encrypt target cookies to store in user's browser securely
        const encryptedCookies = encrypt(allTargetCookies);
        
        // We use the Next.js cookies API to set it
        const cookieStore = await cookies();
        cookieStore.set(`portal_proxy_${appSlug}`, encryptedCookies, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === "production", 
            path: `/portal/proxy/${appSlug}`, // Only send to proxy route
            maxAge: 60 * 60 * 8 // 8 hours
        });

        // Audit log
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

        // Destination: Oracle's success response carries the absolute landing url (OANEWHOMEPAGE).
        const resolvedUrl = new URL(authUrl, loginUrl);
        const destinationPath = `${resolvedUrl.pathname}${resolvedUrl.search}`;

        const proxyPath = `/portal/proxy/${appSlug}${destinationPath}`;
        return NextResponse.redirect(new URL(proxyPath, baseUrl), 302);
    } catch (err) {
        console.error("REROUTE SSO Error:", err);
        return NextResponse.json({ error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
