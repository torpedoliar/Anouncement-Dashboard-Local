import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import AccessDenied from "@/components/portal/AccessDenied";
import NoCredential from "@/components/portal/NoCredential";
import CorruptCredential from "@/components/portal/CorruptCredential";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ appSlug: string }>;
}

export default async function SsoLaunchPage({ params }: PageProps) {
    const { appSlug } = await params;

    // 1. Check login
    const session = await getServerSession(portalAuthOptions);
    if (!session?.user?.id) {
        return notFound();
    }

    const portalUserId = (session.user as { id: string }).id;

    // 2. Find app by slug
    const app = await prisma.portalApp.findUnique({
        where: { slug: appSlug },
        select: {
            id: true,
            name: true,
            slug: true,
            loginUrl: true,
            httpMethod: true,
            usernameField: true,
            passwordField: true,
            extraFields: true,
            isActive: true,
        },
    });

    if (!app || !app.isActive) {
        return notFound();
    }

    // 3. Check access
    const hasAccess = await canAccessPortalAppBySlug(portalUserId, appSlug);
    if (!hasAccess) {
        return <AccessDenied appName={app.name} />;
    }

    // 4. Find credential
    const credential = await prisma.portalUserAppCredential.findUnique({
        where: {
            portalUserId_appId: { portalUserId, appId: app.id },
        },
        select: { id: true, credentialBlob: true },
    });

    if (!credential) {
        return <NoCredential appName={app.name} appSlug={app.slug} />;
    }

    // 5. Decrypt credential
    let cred: { username: string; password: string; extra?: Record<string, string> };
    try {
        cred = decryptCredential(credential.credentialBlob);
    } catch {
        return <CorruptCredential appName={app.name} appSlug={app.slug} />;
    }

    // 6. Update lastUsedAt
    await prisma.portalUserAppCredential.update({
        where: { id: credential.id },
        data: { lastUsedAt: new Date() },
    }).catch(() => {});

    // 7. Audit log
    await logAudit({
        actorType: "PORTAL_USER",
        actorId: portalUserId,
        category: "SECURITY",
        action: "SSO_LAUNCH",
        entityType: "PORTAL_APP",
        entityId: app.id,
        outcome: "SUCCESS",
        metadata: { appSlug: app.slug, appName: app.name },
    }).catch(() => {});

    // 8. Parse extra fields
    const extraFields: Array<{ name: string; value: string }> = [];
    if (cred.extra) {
        for (const [name, value] of Object.entries(cred.extra)) {
            extraFields.push({ name, value });
        }
    }
    // Also parse app-level extraFields (JSON from DB)
    if (app.extraFields && typeof app.extraFields === "object") {
        const fields = app.extraFields as Record<string, string>;
        for (const [name, value] of Object.entries(fields)) {
            // Don't duplicate if already in cred.extra
            if (!cred.extra || !(name in cred.extra)) {
                extraFields.push({ name, value });
            }
        }
    }

    // 9. Render auto-submit form
    return (
        <html>
            <body
                style={{
                    backgroundColor: "#0a0a0a",
                    color: "#a1a1aa",
                    fontFamily: "system-ui, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    margin: 0,
                }}
            >
                <p>Mengalihkan ke {app.name}...</p>
                <form
                    method={app.httpMethod.toLowerCase() as "post" | "get"}
                    action={app.loginUrl}
                    target="_blank"
                >
                    <input type="hidden" name={app.usernameField} value={cred.username} />
                    <input type="hidden" name={app.passwordField} value={cred.password} />
                    {extraFields.map((f, i) => (
                        <input key={i} type="hidden" name={f.name} value={f.value} />
                    ))}
                </form>
                {/* eslint-disable-next-line @next/next/no-sync-scripts */}
                <script dangerouslySetInnerHTML={{ __html: "document.forms[0].submit();" }} />
            </body>
        </html>
    );
}
