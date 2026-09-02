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
import { detectWithLadder } from "@/lib/portal-detect-ladder";
import { assertSafeHttpUrl } from "@/lib/portal-url-guard";
import {
    assertPortalAppProfileLaunchEligible,
    buildLoginProfileCandidate,
    LoginProfileLaunchBlockedError,
    markLoginProfileStaleForNoCandidate,
    recordLoginProfileCandidate,
    type ProfileBoundPortalApp,
    withAuthorizedPortalAppCredentialRelease,
    PortalAppCredentialReleaseDeniedError,
} from "@/lib/portal-login-profile";

/**
 * SSO Mode POST — relay kredensial server-to-server.
 *
 * Untuk app yang telah terikat profile, halaman login diobservasi ulang tanpa
 * kredensial terlebih dahulu. Snapshot live harus identik dengan fingerprint
 * approved; baru setelah itu credential dibaca dan relay dijalankan.
 */

/** HTML minimal yang menyerahkan token federasi ke browser untuk dikirim sendiri. */
function autoPostHandoffPage(form: AutoPostForm, appName: string): string {
    const esc = (value: string) =>
        value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const inputs = Object.entries(form.fields)
        .map(([key, value]) => `<input type="hidden" name="${esc(key)}" value="${esc(value)}" />`)
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

function profileBlockedResponse(baseUrl: string, appSlug: string) {
    return NextResponse.redirect(new URL(`/portal?error=sso_profile_review&app=${appSlug}`, baseUrl), 302);
}

function resolveBoundPostActionUrl(rawAction: string | null | undefined, baseUrl: string): string | null {
    try {
        const action = new URL(rawAction || baseUrl, baseUrl);
        const safe = assertSafeHttpUrl(action.href);
        if (!safe.ok || action.search || action.hash) return null;
        return safe.href;
    } catch {
        return null;
    }
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

        const app = await prisma.portalApp.findUnique({
            where: { slug: appSlug },
            include: { loginProfile: true },
        });
        if (!app || !app.isActive || app.ssoMode !== "POST") {
            return NextResponse.json({ error: "App not found or not POST mode" }, { status: 404 });
        }

        const hasAccess = await canAccessPortalAppBySlug(portalUserId, appSlug);
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const auditBase = {
            actorType: "PORTAL_USER" as const,
            actorId: portalUserId,
            category: "SECURITY" as const,
            action: "SSO_LAUNCH",
            entityType: "PORTAL_APP" as const,
            entityId: app.id,
            appId: app.id,
        };
        const failRedirect = () =>
            NextResponse.redirect(new URL(`/portal?error=sso_failed&app=${appSlug}`, baseUrl), 302);
        const bound = Boolean(app.loginProfileId || app.loginProfileFingerprint);

        // Initial relation check gives a fast credentialless response for stale or
        // incomplete bindings. The conditional authorization below is the final
        // database check immediately before the credential query/decryption.
        try {
            assertPortalAppProfileLaunchEligible({
                ...app,
                loginUrl: app.loginUrl || app.url,
            });
        } catch (error) {
            if (!(error instanceof LoginProfileLaunchBlockedError)) throw error;
            await logAudit({
                ...auditBase,
                action: "SSO_LAUNCH_BLOCKED_PROFILE",
                outcome: "FAILURE",
                severity: "WARNING",
                metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST" },
            }).catch(() => {});
            return profileBlockedResponse(baseUrl, appSlug);
        }

        const loginUrl = (app.loginUrl || app.url).trim();
        let releaseApp: ProfileBoundPortalApp = { ...app, loginUrl };
        let prefetched: {
            html: string;
            finalUrl: string;
            cookieJar?: CookieJar;
        };

        if (bound) {
            // Live route verification is deliberately before credential lookup.
            // Reuse the same no-credential fetch jar so an antiforgery token and
            // its paired cookie remain from one observation.
            try {
                const live = await detectWithLadder(loginUrl);
                const liveCandidate = buildLoginProfileCandidate(live, loginUrl);
                if (!liveCandidate) {
                    await markLoginProfileStaleForNoCandidate(app.loginProfileId!);
                    await logAudit({
                        ...auditBase,
                        action: "SSO_LAUNCH_BLOCKED_PROFILE",
                        outcome: "FAILURE",
                        severity: "WARNING",
                        metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST", reason: "NO_LIVE_CANDIDATE" },
                    }).catch(() => {});
                    return profileBlockedResponse(baseUrl, appSlug);
                }

                const mutation = await recordLoginProfileCandidate({
                    result: live,
                    entryUrl: loginUrl,
                    source: "REVALIDATION",
                });
                if (
                    liveCandidate.fingerprint !== app.loginProfileFingerprint ||
                    mutation?.becameStale ||
                    mutation?.profile.requiresApproval
                ) {
                    await logAudit({
                        ...auditBase,
                        action: "SSO_LAUNCH_BLOCKED_PROFILE",
                        outcome: "FAILURE",
                        severity: "WARNING",
                        metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST", reason: "LIVE_PROFILE_MISMATCH" },
                    }).catch(() => {});
                    return profileBlockedResponse(baseUrl, appSlug);
                }

                prefetched = {
                    html: live.html,
                    finalUrl: live.finalUrl,
                    cookieJar: live.cookieJar,
                };
            } catch (error) {
                if (error instanceof LoginProfileLaunchBlockedError) {
                    await logAudit({
                        ...auditBase,
                        action: "SSO_LAUNCH_BLOCKED_PROFILE",
                        outcome: "FAILURE",
                        severity: "WARNING",
                        metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST", reason: "PROFILE_RECHECK_FAILED" },
                    }).catch(() => {});
                    return profileBlockedResponse(baseUrl, appSlug);
                }
                // A live target that cannot be observed is not evidence that the
                // approved route remains safe. Fail closed without storing raw error text.
                await logAudit({
                    ...auditBase,
                    action: "SSO_LAUNCH_BLOCKED_PROFILE",
                    outcome: "FAILURE",
                    severity: "WARNING",
                    metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST", reason: "LIVE_OBSERVATION_FAILED" },
                }).catch(() => {});
                return profileBlockedResponse(baseUrl, appSlug);
            }
        } else {
            // Legacy unbound apps retain the prior behavior.
            try {
                const page = await fetchLoginPage(loginUrl);
                prefetched = {
                    html: page.html,
                    finalUrl: page.finalUrl,
                    cookieJar: page.cookieJar,
                };
            } catch {
                await logAudit({
                    ...auditBase,
                    outcome: "FAILURE",
                    errorMessage: "POST relay: gagal memuat halaman login",
                    metadata: { appSlug: app.slug, ssoMode: "POST" },
                }).catch(() => {});
                return failRedirect();
            }
        }

        const parsedUrl = new URL(releaseApp.loginUrl);
        const jar = prefetched.cookieJar ?? new CookieJar();
        const fresh = detectLoginFields(prefetched.html);

        if (!fresh.passwordField) {
            await logAudit({
                ...auditBase,
                outcome: "FAILURE",
                errorMessage: "POST relay: form login tidak ditemukan pada halaman target",
                metadata: { appSlug: app.slug, ssoMode: "POST" },
            }).catch(() => {});
            return failRedirect();
        }

        const usernameField = fresh.usernameField ?? releaseApp.usernameField ?? "username";
        const passwordField = fresh.passwordField ?? releaseApp.passwordField ?? "password";
        // Form action relatif diselesaikan terhadap URL AKHIR prefetch, bukan URL awal —
        // rantai federasi berakhir di host/path yang berbeda dari yang dikonfigurasi.
        const legacyActionUrl = fresh.formAction
            ? new URL(fresh.formAction, prefetched.finalUrl).href
            : prefetched.finalUrl;
        const actionUrl = bound ? resolveBoundPostActionUrl(fresh.formAction, prefetched.finalUrl) : legacyActionUrl;
        if (bound && !actionUrl) {
            await markLoginProfileStaleForNoCandidate(app.loginProfileId!);
            await logAudit({
                ...auditBase,
                action: "SSO_LAUNCH_BLOCKED_PROFILE",
                outcome: "FAILURE",
                severity: "WARNING",
                metadata: {
                    appSlug: app.slug,
                    appName: app.name,
                    ssoMode: "POST",
                    reason: "LIVE_ACTION_QUERY_OR_FRAGMENT",
                },
            }).catch(() => {});
            return profileBlockedResponse(baseUrl, appSlug);
        }
        const resolvedActionUrl = actionUrl ?? legacyActionUrl;
        let cred: { username: string; password: string; extra?: Record<string, string> };
        try {
            const released = await withAuthorizedPortalAppCredentialRelease(
                { app: releaseApp, portalUserId, credentialId },
                (credentialBlob, authorizedApp) => ({
                    app: authorizedApp,
                    credential: decryptCredential(credentialBlob),
                }),
            );
            if (!released) {
                return NextResponse.json({ error: "No credential" }, { status: 400 });
            }
            releaseApp = released.app;
            cred = released.credential;
        } catch (error) {
            if (error instanceof PortalAppCredentialReleaseDeniedError) {
                await logAudit({
                    ...auditBase,
                    action: "SSO_LAUNCH_ACCESS_DENIED",
                    outcome: "FAILURE",
                    severity: "WARNING",
                    metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST" },
                }).catch(() => {});
                return NextResponse.json({ error: "Access denied" }, { status: 403 });
            }
            if (!(error instanceof LoginProfileLaunchBlockedError)) throw error;
            await logAudit({
                ...auditBase,
                action: "SSO_LAUNCH_BLOCKED_PROFILE",
                outcome: "FAILURE",
                severity: "WARNING",
                metadata: { appSlug: app.slug, appName: app.name, ssoMode: "POST", reason: "PROFILE_RELEASE_LOCK_FAILED" },
            }).catch(() => {});
            return profileBlockedResponse(baseUrl, appSlug);
        }

        const body = new URLSearchParams();
        body.append(usernameField, cred.username);
        body.append(passwordField, cred.password);
        for (const [key, value] of Object.entries(fresh.extraFields)) body.append(key, value);
        if (releaseApp.extraFields && typeof releaseApp.extraFields === "object") {
            for (const [key, value] of Object.entries(releaseApp.extraFields as Record<string, string>)) {
                if (!body.has(key)) body.append(key, value);
            }
        }

        const outcome = await relayLogin({
            actionUrl: resolvedActionUrl,
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

        if (outcome.handoff) {
            return new NextResponse(autoPostHandoffPage(outcome.handoff, app.name), {
                status: 200,
                headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
            });
        }

        const cookieDomain = sharedCookieDomain(reqHost ?? "", parsedUrl.hostname);
        const destination = outcome.finalUrl || (releaseApp.url?.trim() ? releaseApp.url.trim() : parsedUrl.origin);

        if (!cookieDomain) {
            await logAudit({
                ...auditBase,
                outcome: "FAILURE",
                errorMessage:
                    "POST relay: sesi tidak dapat dipindahkan ke browser karena portal dan aplikasi berbeda domain " +
                    "(aplikasi tidak memakai serah-terima federasi). Setel PORTAL_SSO_COOKIE_DOMAIN bila keduanya " +
                    "berbagi domain induk, atau gunakan SSO Mode VAULT.",
                metadata: { appSlug: app.slug, ssoMode: "POST", portalHost: reqHost, appHost: parsedUrl.hostname },
            }).catch(() => {});
            return NextResponse.redirect(new URL(`/portal?error=sso_cross_domain&app=${appSlug}`, baseUrl), 302);
        }

        const isHttps = reqProto === "https";
        const response = NextResponse.redirect(destination, 302);
        for (const [key, value] of Object.entries(jar.toObject())) {
            const parts = [`${key}=${value}`, "Path=/", `Domain=${cookieDomain}`, "HttpOnly", "SameSite=Lax"];
            if (isHttps) parts.push("Secure");
            parts.push("Max-Age=28800");
            response.headers.append("Set-Cookie", parts.join("; "));
        }
        return response;
    } catch (error) {
        console.error("POST relay SSO Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
