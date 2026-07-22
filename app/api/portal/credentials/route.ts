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

        // Get credential status
        const credentials = await prisma.portalUserAppCredential.findMany({
            where: { portalUserId: userId },
            select: { appId: true, lastUsedAt: true },
        });
        const credMap = new Map(credentials.map((c) => [c.appId, c.lastUsedAt]));

        const apps = accessibleApps;

        const result = apps.map((app) => ({
            appId: app.id,
            appName: app.name,
            appSlug: app.slug,
            hasCredential: credMap.has(app.id),
            lastUsedAt: credMap.get(app.id) || null,
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching credentials:", error);
        return NextResponse.json({ error: "Failed to fetch credentials" }, { status: 500 });
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

        const { appId, username, password, extra } = validation.data;

        // Verify access
        const hasAccess = await canAccessPortalApp(userId, appId);
        if (!hasAccess) {
            return NextResponse.json({ error: "No access to this app" }, { status: 403 });
        }

        const credentialBlob = encryptCredential({ username, password, extra });

        await prisma.portalUserAppCredential.upsert({
            where: { portalUserId_appId: { portalUserId: userId, appId } },
            update: { credentialBlob },
            create: { portalUserId: userId, appId, credentialBlob },
        });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "SECURITY",
            action: "CREDENTIAL_SAVED",
            entityType: "PORTAL_CREDENTIAL",
            entityId: `${userId}:${appId}`,
            changes: { appId },
            request,
        });

        return NextResponse.json({ message: "Credential saved" }, { status: 201 });
    } catch (error) {
        console.error("Error saving credential:", error);
        return NextResponse.json({ error: "Failed to save credential" }, { status: 500 });
    }
}

// DELETE /api/portal/credentials?appId=[cuid] - Delete credential
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const appId = searchParams.get("appId");

        if (!appId) {
            return NextResponse.json({ error: "appId is required" }, { status: 400 });
        }

        const existing = await prisma.portalUserAppCredential.findUnique({
            where: { portalUserId_appId: { portalUserId: userId, appId } },
        });
        if (!existing) {
            return NextResponse.json({ error: "Credential not found" }, { status: 404 });
        }

        await prisma.portalUserAppCredential.delete({
            where: { portalUserId_appId: { portalUserId: userId, appId } },
        });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "SECURITY",
            action: "CREDENTIAL_DELETED",
            entityType: "PORTAL_CREDENTIAL",
            entityId: `${userId}:${appId}`,
            changes: { appId },
            request,
        });

        return NextResponse.json({ message: "Credential deleted" });
    } catch (error) {
        console.error("Error deleting credential:", error);
        return NextResponse.json({ error: "Failed to delete credential" }, { status: 500 });
    }
}
