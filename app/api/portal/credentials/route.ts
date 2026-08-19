import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import prisma from "@/lib/prisma";
import { canAccessPortalApp, getAccessiblePortalApps } from "@/lib/portal-access";
import { encryptCredential } from "@/lib/portal-crypto";
import { PortalCredentialSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

// GET /api/portal/credentials - List app credential status (no plaintext)
export async function GET() {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        // Get accessible apps via group + direct access resolution
        const accessibleApps = await getAccessiblePortalApps(userId);

        // Get credential status (jumlah akun + daftar akun + last used per app)
        const creds = await prisma.portalUserAppCredential.findMany({
            where: { portalUserId: userId },
            select: { id: true, appId: true, label: true, appUsername: true, lastUsedAt: true },
            orderBy: { createdAt: "asc" },
        });
        const credByApp = new Map<string, Array<{ id: string; label: string; username: string; lastUsedAt: Date | null }>>();
        for (const c of creds) {
            const arr = credByApp.get(c.appId) ?? [];
            arr.push({ id: c.id, label: c.label, username: c.appUsername || "-", lastUsedAt: c.lastUsedAt });
            credByApp.set(c.appId, arr);
        }

        const apps = accessibleApps;

        const result = apps.map((app) => {
            const accounts = credByApp.get(app.id) ?? [];
            return {
                appId: app.id,
                appName: app.name,
                appSlug: app.slug,
                credentialCount: accounts.length,
                lastUsedAt: accounts.reduce((acc, a) => (a.lastUsedAt && (!acc || a.lastUsedAt > acc) ? a.lastUsedAt : acc), null as Date | null),
                accounts: accounts.map((a) => ({
                    id: a.id,
                    label: a.label,
                    username: a.username,
                    lastUsedAt: a.lastUsedAt,
                })),
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching credentials:", error);
        return NextResponse.json({ error: "Failed to fetch credentials" }, { status: 500 });
    }
}

// PUT /api/portal/credentials - Update existing credential
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json().catch(() => null);
        const { credentialId, label, username, password, extra } = body || {};

        if (!credentialId || typeof credentialId !== "string") {
            return NextResponse.json({ error: "credentialId diperlukan" }, { status: 400 });
        }

        if (!label || !username) {
            return NextResponse.json({ error: "Label dan username harus diisi" }, { status: 400 });
        }

        const existing = await prisma.portalUserAppCredential.findFirst({
            where: { id: credentialId, portalUserId: userId },
            include: { app: { select: { name: true } } },
        });

        if (!existing) {
            return NextResponse.json({ error: "Kredensial tidak ditemukan" }, { status: 404 });
        }

        // Check if label conflicts with another account on same app
        if (label !== existing.label) {
            const labelConflict = await prisma.portalUserAppCredential.findFirst({
                where: {
                    portalUserId: userId,
                    appId: existing.appId,
                    label,
                    id: { not: credentialId },
                },
            });
            if (labelConflict) {
                return NextResponse.json({ error: "Label akun sudah dipakai untuk aplikasi ini" }, { status: 409 });
            }
        }

        let newBlob = existing.credentialBlob;
        if (password && password.trim()) {
            newBlob = encryptCredential({ username, password, extra });
        }

        const updated = await prisma.portalUserAppCredential.update({
            where: { id: credentialId },
            data: {
                label,
                appUsername: username,
                credentialBlob: newBlob,
            },
        });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "SECURITY",
            action: "CREDENTIAL_UPDATED",
            entityType: "PORTAL_CREDENTIAL",
            entityId: updated.id,
            changes: { appId: existing.appId, label, passwordChanged: !!(password && password.trim()) },
            request,
        }).catch((err) => console.error("Audit log error:", err));

        return NextResponse.json({ message: "Kredensial berhasil diperbarui", data: { id: updated.id, label: updated.label, username: updated.appUsername } });
    } catch (error) {
        console.error("Error updating credential:", error);
        return NextResponse.json({ error: "Gagal memperbarui kredensial" }, { status: 500 });
    }
}

// POST /api/portal/credentials - Save/update credential
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json();
        const validation = validateInput(PortalCredentialSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const { appId, label, username, password, extra } = validation.data;

        // Verify access
        const hasAccess = await canAccessPortalApp(userId, appId);
        if (!hasAccess) {
            return NextResponse.json({ error: "No access to this app" }, { status: 403 });
        }

        // Duplikat label per (user, app) → 409 (unique constraint juga menolak, tapi dengan pesan jelas)
        const existing = await prisma.portalUserAppCredential.findFirst({
            where: { portalUserId: userId, appId, label },
            select: { id: true },
        });
        if (existing) {
            return NextResponse.json({ error: "Label akun sudah dipakai untuk aplikasi ini" }, { status: 409 });
        }

        const credentialBlob = encryptCredential({ username, password, extra });

        const created = await prisma.portalUserAppCredential.create({
            data: { portalUserId: userId, appId, label, credentialBlob, appUsername: username },
        });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "SECURITY",
            action: "CREDENTIAL_SAVED",
            entityType: "PORTAL_CREDENTIAL",
            entityId: created.id,
            changes: { appId, label },
            request,
        });

        return NextResponse.json({ message: "Credential saved" }, { status: 201 });
    } catch (error) {
        console.error("Error saving credential:", error);
        return NextResponse.json({ error: "Failed to save credential" }, { status: 500 });
    }
}

// DELETE /api/portal/credentials?credentialId=[cuid] - Delete specific account
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const credentialId = searchParams.get("credentialId");

        if (!credentialId) {
            return NextResponse.json({ error: "credentialId is required" }, { status: 400 });
        }

        const existing = await prisma.portalUserAppCredential.findFirst({
            where: { id: credentialId, portalUserId: userId },
        });
        if (!existing) {
            return NextResponse.json({ error: "Credential not found" }, { status: 404 });
        }

        await prisma.portalUserAppCredential.delete({ where: { id: existing.id } });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "SECURITY",
            action: "CREDENTIAL_DELETED",
            entityType: "PORTAL_CREDENTIAL",
            entityId: existing.id,
            changes: { appId: existing.appId, label: existing.label },
            request,
        });

        return NextResponse.json({ message: "Credential deleted" });
    } catch (error) {
        console.error("Error deleting credential:", error);
        return NextResponse.json({ error: "Failed to delete credential" }, { status: 500 });
    }
}
