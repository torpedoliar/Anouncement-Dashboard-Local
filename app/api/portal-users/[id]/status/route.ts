import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PATCH /api/portal-users/[id]/status - Activate/deactivate (SuperAdmin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const { isActive } = await request.json();

        if (typeof isActive !== "boolean") {
            return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
        }

        const user = await prisma.portalUser.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        await prisma.portalUser.update({ where: { id }, data: { isActive } });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: isActive ? "PORTAL_USER_ACTIVATED" : "PORTAL_USER_DEACTIVATED",
            entityType: "PORTAL_USER",
            entityId: id,
            changes: { email: user.email, isActive },
            request,
        });

        return NextResponse.json({ message: isActive ? "User activated" : "User deactivated" });
    } catch (error) {
        console.error("Error updating user status:", error);
        return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
    }
}
