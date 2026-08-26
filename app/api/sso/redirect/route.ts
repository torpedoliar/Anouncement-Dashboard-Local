import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { assertSafeHttpUrl } from "@/lib/portal-url-guard";

/**
 * SSO Mode REDIRECT — hand-off langsung tanpa kredensial (desain sso-modes-design.md §2).
 *
 * Portal memverifikasi sesi + hak akses, menulis audit, lalu 302 browser ke
 * app.loginUrl || app.url. Target diautentikasi oleh mekanismenya sendiri
 * (Windows Integrated Auth / whitelist IP / SSO di belakang IdP korporat).
 *
 * Keamanan (threat model §1b + addendum F-1):
 * - Tujuan HANYA dari konfigurasi DB — tidak ada parameter URL tujuan dari user (R-1, AC-4).
 * - Target divalidasi validator pusat sebelum redirect (R-2), lalu di-pin exact-match
 *   ke host(app.url): config lama/salah ketik tidak bisa membuka redirect ke host lain.
 * - Tidak ada fetch server-side → tidak ada permukaan SSRF (AC-3 struktural).
 */
export async function POST(request: NextRequest) {
    try {
        const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const reqProto =
            request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
        const baseUrl = reqHost ? `${reqProto}://${reqHost}` : new URL(request.url).origin;

        const formData = await request.formData();
        // AC-4: satu-satunya input user — slug penunjuk config; field lain diabaikan total.
        const appSlug = formData.get("appSlug") as string;
        if (!appSlug) {
            return NextResponse.json({ error: "App slug required" }, { status: 400 });
        }

        // Guard berlapis — pola identik reroute/post.
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const portalUserId = (session.user as { id: string }).id;

        const app = await prisma.portalApp.findUnique({ where: { slug: appSlug } });
        if (!app || !app.isActive || app.ssoMode !== "REDIRECT") {
            return NextResponse.json({ error: "App not found or not REDIRECT mode" }, { status: 404 });
        }

        const hasAccess = await canAccessPortalAppBySlug(portalUserId, appSlug);
        if (!hasAccess) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // F-1 allowlist derivasi: tujuan harus http(s) aman DAN exact-match authority
        // host(app.url) — port non-default ikut dipin (URL parser menormalkan port
        // default 80/443 ke kosong, jadi bentuk eksplisit & implisit tetap cocok).
        // Tanpa kolom baru; app dengan loginUrl beda-host memang harus dirapikan adminnya.
        const targetRaw = (app.loginUrl || app.url).trim();
        const guard = assertSafeHttpUrl(targetRaw);
        const pinnedTarget = assertSafeHttpUrl(app.url);
        const targetMismatch =
            !guard.ok || !pinnedTarget.ok || guard.authority !== pinnedTarget.authority;

        if (targetMismatch) {
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: portalUserId,
                category: "SECURITY",
                action: "SSO_LAUNCH",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id, // KPI /admin/portal-audit memfilter appId
                outcome: "FAILURE",
                // Alasan generik tanpa URL internal penuh (QA AC-1) — kode guard stabil.
                errorMessage: guard.ok
                    ? "REDIRECT: authority target berbeda dari host utama aplikasi"
                    : `REDIRECT: target aplikasi tidak valid (${guard.error})`,
                metadata: { appSlug: app.slug, appName: app.name, ssoMode: "REDIRECT" },
            }).catch(() => {});

            return NextResponse.redirect(
                new URL(`/portal?error=sso_invalid_target&app=${appSlug}`, baseUrl),
                302
            );
        }

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: portalUserId,
            category: "SECURITY",
            action: "SSO_LAUNCH",
            entityType: "PORTAL_APP",
            entityId: app.id,
            appId: app.id,
            outcome: "SUCCESS",
            metadata: { appSlug: app.slug, appName: app.name, ssoMode: "REDIRECT" },
        }).catch(() => {});

        // 302 langsung ke target hasil validasi. Error 500 generik (pola post/route.ts).
        return NextResponse.redirect(guard.href, 302);
    } catch (err) {
        console.error("REDIRECT SSO Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
