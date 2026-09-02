import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { refreshVolatileFields } from "@/lib/portal-fetch-html";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import {
    assertPortalAppProfileLaunchEligible,
    revalidateBoundProfileBeforeCredentialRelease,
    withAuthorizedPortalAppCredentialRelease,
    LoginProfileLaunchBlockedError,
    PortalAppCredentialReleaseDeniedError,
    type ProfileBoundPortalApp,
} from "@/lib/portal-login-profile";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldWarning, Wrench } from "@phosphor-icons/react/dist/ssr";
import AccessDenied from "@/components/portal/AccessDenied";
import NoCredential from "@/components/portal/NoCredential";
import CorruptCredential from "@/components/portal/CorruptCredential";
import SSORedirectHandoff from "@/components/portal/SSORedirectHandoff";
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

function UnsupportedSsoMode({ appName, mode }: { appName: string; mode: "PROXY" | "TOKEN" }) {
    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-0 px-4 py-10 sm:px-5">
            <div className="max-w-[400px] text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet border border-border bg-surface-2">
                    <Wrench size={24} className="text-text-2" aria-hidden="true" />
                </div>
                <h1 className="mt-5 font-display text-xl font-semibold text-text-1">
                    SSO Mode {mode} Belum Aktif
                </h1>
                <p className="mt-3 text-sm text-text-2">
                    Mode SSO <strong className="font-semibold text-text-1">{mode}</strong> untuk{" "}
                    <strong className="font-semibold text-text-1">{appName}</strong> belum didukung portal.
                    {mode === "PROXY"
                        ? " Gunakan mode alternatif (REROUTE/POST/VAULT) untuk aplikasi ini."
                        : " Hubungi admin untuk mengubah mode aplikasi ini."}
                </p>
                <Link
                    href="/portal"
                    className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface-1 px-4 text-sm font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Kembali ke Portal
                </Link>
            </div>
        </div>
    );
}

class CredentialDecryptionError extends Error {}

function ProfileReviewRequired({ appName }: { appName: string }) {
    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-0 px-4 py-10 sm:px-5">
            <div className="max-w-[440px] text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet border border-warning/40 bg-warning-subtle text-warning">
                    <ShieldWarning size={24} aria-hidden="true" />
                </div>
                <h1 className="mt-5 font-display text-xl font-semibold text-text-1">
                    Login Aplikasi Perlu Ditinjau
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-text-2">
                    Pengiriman kredensial ke <strong className="font-semibold text-text-1">{appName}</strong> ditunda karena
                    struktur login aplikasi perlu ditinjau ulang oleh admin.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-3">
                    Tidak ada username atau password yang dikirimkan ke aplikasi tujuan.
                </p>
                <Link
                    href="/portal"
                    className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface-1 px-4 text-sm font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Kembali ke Portal
                </Link>
            </div>
        </div>
    );
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
            isPublic: true,
            ssoMode: true,
            logoPath: true,
            loginProfileId: true,
            loginProfileFingerprint: true,
            loginProfile: true,
            updatedAt: true,
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

    // 3b. Kelas credential-less: REDIRECT tidak memakai kredensial dan tidak
    // memerlukan profile gate. Route redirect tetap memiliki guard target sendiri.
    if (app.ssoMode === "REDIRECT") {
        return <SSORedirectHandoff
            app={{
                name: app.name,
                logoPath: app.logoPath,
                slug: app.slug,
            }}
        />;
    }

    // Mode belum aktif tidak boleh menyentuh credential sama sekali.
    if (app.ssoMode === "PROXY" || app.ssoMode === "TOKEN") {
        return <UnsupportedSsoMode appName={app.name} mode={app.ssoMode} />;
    }

    // 3c. Fail closed: profile yang sudah dibind wajib tetap approved, fresh,
    // dan cocok dengan konfigurasi tepat sebelum app mengakses credential record.
    const initialReleaseApp: ProfileBoundPortalApp = {
        ...app,
        loginUrl: app.loginUrl || app.url,
    };
    let releaseApp = initialReleaseApp;
    let liveProfileExtraFields: Record<string, string> = {};

    try {
        assertPortalAppProfileLaunchEligible(initialReleaseApp);
    } catch (error) {
        if (!(error instanceof LoginProfileLaunchBlockedError)) throw error;
        await logAudit({
            actorType: "PORTAL_USER",
            actorId: portalUserId,
            category: "SECURITY",
            action: "SSO_LAUNCH_BLOCKED_PROFILE",
            entityType: "PORTAL_APP",
            entityId: app.id,
            appId: app.id,
            outcome: "FAILURE",
            severity: "WARNING",
            metadata: { appSlug: app.slug, appName: app.name, ssoMode: app.ssoMode },
        }).catch(() => {});
        return <ProfileReviewRequired appName={app.name} />;
    }

    // Conditional authorization reads the current app + profile immediately
    // before credential access. The returned snapshot is the one used below.
    try {
        const preparation = await revalidateBoundProfileBeforeCredentialRelease(initialReleaseApp);
        if (preparation) {
            releaseApp = preparation.app;
            liveProfileExtraFields = preparation.liveExtraFields;
        }
    } catch (error) {
        if (!(error instanceof LoginProfileLaunchBlockedError)) throw error;
        await logAudit({
            actorType: "PORTAL_USER",
            actorId: portalUserId,
            category: "SECURITY",
            action: "SSO_LAUNCH_BLOCKED_PROFILE",
            entityType: "PORTAL_APP",
            entityId: app.id,
            appId: app.id,
            outcome: "FAILURE",
            severity: "WARNING",
            metadata: { appSlug: app.slug, appName: app.name, ssoMode: app.ssoMode, reason: "PROFILE_RELEASE_CAS_FAILED" },
        }).catch(() => {});
        return <ProfileReviewRequired appName={app.name} />;
    }

    // 4. Find credentials — list (multi-akun). Use the snapshot returned by the
    // conditional profile authorization for every release-sensitive setting.
    const credentials = await prisma.portalUserAppCredential.findMany({
        where: { portalUserId, appId: releaseApp.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, label: true },
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
                accounts={credentials.map((credential) => ({ id: credential.id, label: credential.label }))}
            />
        );
    }

    // Pilih akun: eksplisit via credentialId (validasi milik user) atau satu-satunya
    const credential =
        credentials.length === 1
            ? credentials[0]
            : credentials.find((item) => item.id === credentialId);

    if (!credential) {
        return <NoCredential appName={app.name} appSlug={app.slug} />;
    }

    // The shared release boundary is authoritative for both bound and legacy
    // unbound apps: it rechecks active user/app state and current access before
    // selecting or decrypting the credential.
    let cred: { username: string; password: string; extra?: Record<string, string> };
    try {
        const released = await withAuthorizedPortalAppCredentialRelease(
            { app: releaseApp, portalUserId, credentialId: credential.id },
            (credentialBlob, authorizedApp) => {
                try {
                    return { app: authorizedApp, credential: decryptCredential(credentialBlob) };
                } catch {
                    throw new CredentialDecryptionError();
                }
            },
        );
        if (!released) return <NoCredential appName={app.name} appSlug={app.slug} />;
        releaseApp = released.app;
        cred = released.credential;
    } catch (error) {
        if (error instanceof CredentialDecryptionError) {
            return <CorruptCredential appName={app.name} appSlug={app.slug} />;
        }
        if (error instanceof PortalAppCredentialReleaseDeniedError) {
            return <AccessDenied appName={app.name} />;
        }
        if (!(error instanceof LoginProfileLaunchBlockedError)) throw error;
        await logAudit({
            actorType: "PORTAL_USER",
            actorId: portalUserId,
            category: "SECURITY",
            action: "SSO_LAUNCH_BLOCKED_PROFILE",
            entityType: "PORTAL_APP",
            entityId: app.id,
            appId: app.id,
            outcome: "FAILURE",
            severity: "WARNING",
            metadata: { appSlug: app.slug, appName: app.name, ssoMode: app.ssoMode, reason: "PROFILE_RELEASE_LOCK_FAILED" },
        }).catch(() => {});
        return <ProfileReviewRequired appName={app.name} />;
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
        entityId: releaseApp.id,
        // Wajib: KPI & tren di /admin/portal-audit memfilter appId, bukan entityId.
        appId: releaseApp.id,
        outcome: "SUCCESS",
        metadata: { appSlug: app.slug, appName: app.name, targetUsername: cred.username },
    }).catch(() => {});

    // 8. Parse extra fields. The live profile snapshot is request-local and
    // contains newly observed hidden/static fields; never persist its values.
    const extraFieldMap: Record<string, string> = {};
    if (releaseApp.extraFields && typeof releaseApp.extraFields === "object") {
        Object.assign(extraFieldMap, releaseApp.extraFields as Record<string, string>);
    }
    if (cred.extra) Object.assign(extraFieldMap, cred.extra);
    // Live profile values must win for discovered hidden/static fields. They are
    // request-local and are never written back to app, credential, or evidence.
    if (releaseApp.ssoMode === "FORM") {
        Object.assign(extraFieldMap, liveProfileExtraFields);
    }

    // Token dinamis (__VIEWSTATE, CSRF) kedaluwarsa segera setelah disimpan —
    // ambil ulang dari halaman login tepat sebelum submit.
    const freshFields =
        releaseApp.ssoMode === "FORM"
            ? await refreshVolatileFields(releaseApp.loginUrl, extraFieldMap)
            : extraFieldMap;

    const extraFields: Array<{ name: string; value: string }> = Object.entries(freshFields).map(
        ([name, value]) => ({ name, value }),
    );

    // 9. Render SSO method per snapshot releaseApp.ssoMode
    if (releaseApp.ssoMode === "REROUTE") {
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

    if (releaseApp.ssoMode === "POST") {
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

    if (releaseApp.ssoMode === "VAULT") {
        return <SSOCredentialVault
            app={{
                name: app.name,
                url: releaseApp.url,
                logoPath: app.logoPath,
            }}
            cred={cred}
        />;
    }

    return <SSOAutoSubmit
        app={{
            name: app.name,
            loginUrl: releaseApp.loginUrl,
            httpMethod: releaseApp.httpMethod,
            usernameField: releaseApp.usernameField,
            passwordField: releaseApp.passwordField,
            logoPath: app.logoPath,
        }}
        cred={cred}
        extraFields={extraFields}
    />;
}
