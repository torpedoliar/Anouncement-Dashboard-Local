import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/portal-users/[id]/access - Assign app access (SuperAdmin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id: portalUserId } = await params;
        const { appId, role } = await request.json();

        if (!appId) {
            return NextResponse.json({ error: "appId is required" }, { status: 400 });
        }

        // Verify user exists
        const user = await prisma.portalUser.findUnique({ where: { id: portalUserId } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Verify app exists and is active
        const app = await prisma.portalApp.findUnique({ where: { id: appId } });
        if (!app) {
            return NextResponse.json({ error: "App not found" }, { status: 404 });
        }

        const access = await prisma.portalUserAppAccess.upsert({
            where: { portalUserId_appId: { portalUserId, appId } },
            update: { role: role || "USER" },
            create: { portalUserId, appId, role: role || "USER" },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: "ACCESS_GRANTED",
            entityType: "PORTAL_USER_APP_ACCESS",
            entityId: access.id,
            changes: { portalUserId, appId, role: role || "USER" },
            request,
        });

        return NextResponse.json({ message: "Access granted" }, { status: 201 });
    } catch (error) {
        console.error("Error granting access:", error);
        return NextResponse.json({ error: "Failed to grant access" }, { status: 500 });
    }
}

// DELETE /api/portal-users/[id]/access?appId=[cuid] - Revoke app access (SuperAdmin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id: portalUserId } = await params;
        const { searchParams } = new URL(request.url);
        const appId = searchParams.get("appId");

        if (!appId) {
            return NextResponse.json({ error: "appId query param is required" }, { status: 400 });
        }

        const existing = await prisma.portalUserAppAccess.findUnique({
            where: { portalUserId_appId: { portalUserId, appId } },
        });
        if (!existing) {
            return NextResponse.json({ error: "Access not found" }, { status: 404 });
        }

        await prisma.portalUserAppAccess.delete({
            where: { portalUserId_appId: { portalUserId, appId } },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: "ACCESS_REVOKED",
            entityType: "PORTAL_USER_APP_ACCESS",
            entityId: `${portalUserId}:${appId}`,
            changes: { portalUserId, appId },
            request,
        });

        return NextResponse.json({ message: "Access revoked" });
    } catch (error) {
        console.error("Error revoking access:", error);
        return NextResponse.json({ error: "Failed to revoke access" }, { status: 500 });
    }
}
