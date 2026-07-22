import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/portal-users/[id]/reset-password - Admin reset password (SuperAdmin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const { password } = await request.json();

        if (!password || password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
        }

        const user = await prisma.portalUser.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await prisma.portalUser.update({
            where: { id },
            data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "AUTH",
            action: "ADMIN_RESET_PORTAL_PASSWORD",
            entityType: "PORTAL_USER",
            entityId: id,
            changes: { targetEmail: user.email },
            request,
        });

        return NextResponse.json({ message: "Password reset" });
    } catch (error) {
        console.error("Error resetting password:", error);
        return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
    }
}
