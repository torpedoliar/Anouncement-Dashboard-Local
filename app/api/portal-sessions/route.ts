import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";
import { logAudit } from "@/lib/audit";

// GET /api/portal-sessions - List portal sessions (SuperAdmin: all, PortalUser: own)
export async function GET(request: NextRequest) {
    try {
        // Try SuperAdmin first, then portal user
        const adminSession = await getServerSession(authOptions);
        const portalSession = await getServerSession(portalAuthOptions);

        const isSuperAdmin = adminSession?.user?.isSuperAdmin;
        const portalUserId = portalSession?.user?.id;

        if (!isSuperAdmin && !portalUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip } = validatePagination(pageParam, limitParam);

        const filterUserId = searchParams.get("portalUserId");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (isSuperAdmin) {
            if (filterUserId) where.portalUserId = filterUserId;
        } else {
            where.portalUserId = portalUserId;
        }

        const [sessions, total] = await Promise.all([
            prisma.portalSession.findMany({
                where,
                orderBy: { lastActiveAt: "desc" },
                skip,
                take: limit,
                include: {
                    portalUser: { select: { id: true, name: true, email: true } },
                },
            }),
            prisma.portalSession.count({ where }),
        ]);

        return NextResponse.json({
            data: sessions,
            pagination: {
                page: Math.floor(skip / limit) + 1,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching portal sessions:", error);
        return NextResponse.json({ error: "Failed to fetch portal sessions" }, { status: 500 });
    }
}

// DELETE /api/portal-sessions?id=[cuid] - Revoke portal session
export async function DELETE(request: NextRequest) {
    try {
        const adminSession = await getServerSession(authOptions);
        const portalSession = await getServerSession(portalAuthOptions);

        const isSuperAdmin = adminSession?.user?.isSuperAdmin;
        const currentPortalUserId = portalSession?.user?.id;

        if (!isSuperAdmin && !currentPortalUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get("id");

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        const targetSession = await prisma.portalSession.findUnique({ where: { id: sessionId } });
        if (!targetSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Ownership check: portal users can only revoke their own sessions
        if (!isSuperAdmin && targetSession.portalUserId !== currentPortalUserId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.portalSession.update({
            where: { id: sessionId },
            data: { isRevoked: true },
        });

        await logAudit({
            actorType: isSuperAdmin ? "ADMIN_USER" : "PORTAL_USER",
            actorId: isSuperAdmin ? adminSession?.user?.id : currentPortalUserId,
            category: "AUTH",
            action: "PORTAL_SESSION_REVOKED",
            entityType: "PORTAL_SESSION",
            entityId: sessionId,
            changes: { revokedUserId: targetSession.portalUserId },
            request,
        });

        return NextResponse.json({ message: "Session revoked" });
    } catch (error) {
        console.error("Error revoking portal session:", error);
        return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
    }
}
