import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import {
    LoginProfileLaunchBlockedError,
    revalidateBoundProfileBeforeCredentialRelease,
    type ProfileBoundPortalApp,
    withAuthorizedPortalAppCredentialRelease,
    PortalAppCredentialReleaseDeniedError,
} from "@/lib/portal-login-profile";

// POST /api/portal/credentials/reveal - Decrypt and reveal password after re-authenticating with portal password
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json().catch(() => null);
        const { credentialId, portalPassword } = body || {};

        if (!credentialId || typeof credentialId !== "string") {
            return NextResponse.json({ error: "credentialId diperlukan" }, { status: 400 });
        }

        if (!portalPassword || typeof portalPassword !== "string") {
            return NextResponse.json({ error: "Password login portal diperlukan untuk verifikasi" }, { status: 400 });
        }

        // 1. Fetch user to verify their portal password
        const user = await prisma.portalUser.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true, isActive: true },
        });

        if (!user || !user.isActive) {
            return NextResponse.json({ error: "Pengguna tidak valid atau tidak aktif" }, { status: 401 });
        }

        if (!user.passwordHash) {
            // Akun JIT tanpa password tidak bisa re-auth untuk reveal.
            return NextResponse.json({ error: "Akun belum memiliki kata sandi — atur kata sandi dahulu" }, { status: 403 });
        }

        const isPasswordValid = await compare(portalPassword, user.passwordHash);
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Password login portal tidak sesuai" }, { status: 403 });
        }

        // 2. Fetch the target credential belonging to this user
        const credential = await prisma.portalUserAppCredential.findFirst({
            where: { id: credentialId, portalUserId: userId },
            select: {
                id: true,
                label: true,
                app: {
                    select: {
                        id: true,
                        name: true,
                        url: true,
                        loginUrl: true,
                        ssoMode: true,
                        httpMethod: true,
                        usernameField: true,
                        passwordField: true,
                        extraFields: true,
                        updatedAt: true,
                        isActive: true,
                        isPublic: true,
                        loginProfileId: true,
                        loginProfileFingerprint: true,
                        loginProfile: true,
                    },
                },
            },
        });

        if (!credential) {
            return NextResponse.json({ error: "Kredensial tidak ditemukan" }, { status: 404 });
        }

        let releaseApp: ProfileBoundPortalApp = {
            ...credential.app,
            loginUrl: credential.app.loginUrl || credential.app.url,
        };
        try {
            const preparation = await revalidateBoundProfileBeforeCredentialRelease(releaseApp);
            if (preparation) releaseApp = preparation.app;
        } catch (error) {
            if (!(error instanceof LoginProfileLaunchBlockedError)) throw error;
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: userId,
                category: "SECURITY",
                action: "CREDENTIAL_REVEAL_BLOCKED_PROFILE",
                entityType: "PORTAL_CREDENTIAL",
                entityId: credential.id,
                outcome: "FAILURE",
                severity: "WARNING",
                changes: { appId: releaseApp.id, appName: credential.app.name },
                request,
            }).catch((err) => console.error("Audit log error:", err));
            return NextResponse.json(
                { error: "Profile login aplikasi perlu ditinjau admin sebelum kredensial dibuka" },
                { status: 409 },
            );
        }

        // The shared release boundary is authoritative for bound and unbound
        // apps, including active-user/app and current portal access checks.
        let decrypted: { username: string; password: string; extra?: Record<string, string> };
        try {
            const released = await withAuthorizedPortalAppCredentialRelease(
                { app: releaseApp, portalUserId: userId, credentialId },
                (credentialBlob, authorizedApp) => ({
                    app: authorizedApp,
                    credential: decryptCredential(credentialBlob),
                }),
            );
            if (!released) {
                return NextResponse.json({ error: "Kredensial tidak ditemukan" }, { status: 404 });
            }
            releaseApp = released.app;
            decrypted = released.credential;
        } catch (error) {
            if (error instanceof PortalAppCredentialReleaseDeniedError) {
                await logAudit({
                    actorType: "PORTAL_USER",
                    actorId: userId,
                    category: "SECURITY",
                    action: "CREDENTIAL_REVEAL_ACCESS_DENIED",
                    entityType: "PORTAL_CREDENTIAL",
                    entityId: credential.id,
                    outcome: "FAILURE",
                    severity: "WARNING",
                    changes: { appId: releaseApp.id, appName: credential.app.name },
                    request,
                }).catch((err) => console.error("Audit log error:", err));
                return NextResponse.json({ error: "Akses ke aplikasi tidak tersedia" }, { status: 403 });
            }
            if (!(error instanceof LoginProfileLaunchBlockedError)) throw error;
            await logAudit({
                actorType: "PORTAL_USER",
                actorId: userId,
                category: "SECURITY",
                action: "CREDENTIAL_REVEAL_BLOCKED_PROFILE",
                entityType: "PORTAL_CREDENTIAL",
                entityId: credential.id,
                outcome: "FAILURE",
                severity: "WARNING",
                changes: { appId: releaseApp.id, appName: credential.app.name },
                request,
            }).catch((err) => console.error("Audit log error:", err));
            return NextResponse.json(
                { error: "Profile login aplikasi perlu ditinjau admin sebelum kredensial dibuka" },
                { status: 409 },
            );
        }

        // 4. Log security audit event
        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "SECURITY",
            action: "CREDENTIAL_REVEALED",
            entityType: "PORTAL_CREDENTIAL",
            entityId: credential.id,
            changes: { appId: releaseApp.id, label: credential.label, appName: credential.app.name },
            request,
        }).catch((err) => console.error("Audit log error:", err));

        return NextResponse.json({
            success: true,
            username: decrypted.username,
            password: decrypted.password,
            label: credential.label,
        });
    } catch (error) {
        console.error("Error revealing credential:", error);
        return NextResponse.json({ error: "Gagal mendekripsi kredensial" }, { status: 500 });
    }
}
