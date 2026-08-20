import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { refreshVolatileFields } from "@/lib/portal-fetch-html";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import AccessDenied from "@/components/portal/AccessDenied";
import NoCredential from "@/components/portal/NoCredential";
import CorruptCredential from "@/components/portal/CorruptCredential";
import SSOAutoSubmit from "@/components/portal/SSOAutoSubmit";
import SSORerouteSubmit from "@/components/portal/SSORerouteSubmit";
import SSOPostSubmit from "@/components/portal/SSOPostSubmit";
import SSOCredentialVault from "@/components/portal/SSOCredentialVault";
import AccountSelector from "@/components/portal/AccountSelector";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ appSlug: string }>;
    searchParams: Promise<{ credentialId?: string }>;
}

export default async function SsoLaunchPage({ params, searchParams }: PageProps) {
    const { appSlug } = await params;
    const { credentialId } = await searchParams;

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
            url: true,
            loginUrl: true,
            httpMethod: true,
            usernameField: true,
            passwordField: true,
            extraFields: true,
            isActive: true,
            ssoMode: true,
            logoPath: true,
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

    // 4. Find credentials — list (multi-akun)
    const credentials = await prisma.portalUserAppCredential.findMany({
        where: { portalUserId, appId: app.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, label: true, credentialBlob: true },
    });

    if (credentials.length === 0) {
        return <NoCredential appName={app.name} appSlug={app.slug} />;
    }

    // >1 akun & user belum memilih → tampilkan pemilih akun
    if (credentials.length > 1 && !credentialId) {
        return (
            <AccountSelector
                appName={app.name}
                baseHref={`/portal/app/${app.slug}`}
                accounts={credentials.map((c) => ({ id: c.id, label: c.label }))}
            />
        );
    }

    // Pilih akun: eksplisit via credentialId (validasi milik user) atau satu-satunya
    const credential =
        credentials.length === 1
            ? credentials[0]
            : credentials.find((c) => c.id === credentialId);

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
        // Wajib: KPI & tren di /admin/portal-audit memfilter appId, bukan entityId.
        appId: app.id,
        outcome: "SUCCESS",
        metadata: { appSlug: app.slug, appName: app.name, targetUsername: cred.username },
    }).catch(() => {});

    // 8. Parse extra fields
    const extraFieldMap: Record<string, string> = {};
    // App-level dulu (token/hidden field), lalu cred.extra menimpa bila bentrok.
    if (app.extraFields && typeof app.extraFields === "object") {
        Object.assign(extraFieldMap, app.extraFields as Record<string, string>);
    }
    if (cred.extra) Object.assign(extraFieldMap, cred.extra);

    // Token dinamis (__VIEWSTATE, CSRF) kedaluwarsa segera setelah disimpan —
    // ambil ulang dari halaman login tepat sebelum submit.
    const freshFields =
        app.ssoMode === "FORM"
            ? await refreshVolatileFields(app.loginUrl || app.url, extraFieldMap)
            : extraFieldMap;

    const extraFields: Array<{ name: string; value: string }> = Object.entries(freshFields).map(
        ([name, value]) => ({ name, value })
    );

    // 9. Render SSO method per app.ssoMode
    if (app.ssoMode === "REROUTE") {
        return <SSORerouteSubmit
            app={{
                name: app.name,
                logoPath: app.logoPath,
                slug: app.slug,
            }}
            cred={{ username: cred.username }}
            credentialId={credential.id}
        />;
    }

    if (app.ssoMode === "POST") {
        return <SSOPostSubmit
            app={{
                name: app.name,
                logoPath: app.logoPath,
                slug: app.slug,
            }}
            cred={{ username: cred.username }}
            credentialId={credential.id}
        />;
    }

    if (app.ssoMode === "VAULT") {
        return <SSOCredentialVault
            app={{
                name: app.name,
                url: app.url,
                logoPath: app.logoPath,
            }}
            cred={cred}
        />;
    }

    return <SSOAutoSubmit
        app={{
            name: app.name,
            loginUrl: app.loginUrl || app.url,
            httpMethod: app.httpMethod,
            usernameField: app.usernameField,
            passwordField: app.passwordField,
            logoPath: app.logoPath,
        }}
        cred={cred}
        extraFields={extraFields}
    />;
}
