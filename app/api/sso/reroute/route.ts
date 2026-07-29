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

        // Step 1: GET to get initial session cookies
        const getRes = await fetch(loginUrl, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0" },
            redirect: "manual"
        });
        
        let cookiePairs: string[] = [];
        if (typeof getRes.headers.getSetCookie === 'function') {
            cookiePairs = getRes.headers.getSetCookie().map(c => c.split(';')[0]);
        } else {
            const raw = getRes.headers.get('set-cookie');
            if (raw) {
                cookiePairs = raw.split(',').map(c => c.split(';')[0]);
            }
        }
        const cookieHeader = cookiePairs.join("; ");

        // Prepare POST body
        const formBody = new URLSearchParams();
        formBody.append(app.usernameField || "username", cred.username);
        formBody.append(app.passwordField || "password", cred.password);
        
        const extraFields: Record<string, string> = {};
        if (cred.extra) Object.assign(extraFields, cred.extra);
        if (app.extraFields && typeof app.extraFields === "object") {
            Object.assign(extraFields, app.extraFields);
        }
        for (const [k, v] of Object.entries(extraFields)) {
            formBody.append(k, v as string);
        }

        // Step 2: POST to login with spoofed Origin/Referer
        const postRes = await fetch(loginUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": origin,
                "Referer": loginUrl,
                "Cookie": cookieHeader,
                "User-Agent": "Mozilla/5.0"
            },
            body: formBody.toString(),
            redirect: "manual"
        });

        const locationHeader = postRes.headers.get("location");

        // Check if login failed (Oracle returns 200 OK with login form again when creds fail)
        if (postRes.status === 200 && !locationHeader) {
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: portalUserId,
                category: "SECURITY",
                action: "SSO_LAUNCH",
                entityType: "PORTAL_APP",
                entityId: app.id,
                outcome: "FAILURE",
                errorMessage: "Oracle login rejected credentials",
                metadata: { appSlug: app.slug, appName: app.name, ssoMode: "REROUTE" }
            }).catch(() => {});

            return NextResponse.redirect(new URL(`/portal?error=sso_failed&app=${appSlug}`, request.url), 302);
        }

        let finalCookiePairs: string[] = [];
        if (typeof postRes.headers.getSetCookie === 'function') {
            finalCookiePairs = postRes.headers.getSetCookie().map(c => c.split(';')[0]);
        } else {
            const raw = postRes.headers.get('set-cookie');
            if (raw) {
                finalCookiePairs = raw.split(',').map(c => c.split(';')[0]);
            }
        }
        
        // Combine initial and final cookies (final overwrites initial if duplicate)
        const cookieMap = new Map<string, string>();
        for (const pair of [...cookiePairs, ...finalCookiePairs]) {
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

        // Determine destination URL path from Oracle's Location header or fallback to app.url
        let destinationPath = "";
        if (locationHeader) {
            const resolvedUrl = new URL(locationHeader, loginUrl);
            destinationPath = `${resolvedUrl.pathname}${resolvedUrl.search}`;
        } else {
            const fallbackUrl = new URL(app.url);
            destinationPath = `${fallbackUrl.pathname}${fallbackUrl.search}`;
        }

        const proxyPath = `/portal/proxy/${appSlug}${destinationPath}`;
        return NextResponse.redirect(new URL(proxyPath, request.url), 302);
    } catch (err) {
        console.error("REROUTE SSO Error:", err);
        return NextResponse.json({ error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
