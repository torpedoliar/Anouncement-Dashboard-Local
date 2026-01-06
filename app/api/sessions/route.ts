//
// Sessions API - GET list, DELETE revoke
// Path: /api/sessions
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/sessions - List all user sessions (admin: all, user: own)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");

        const currentUser = session.user as { id: string; role: string };
        const isAdmin = currentUser.role === "ADMIN";

        // Build where clause
        const where = isAdmin && userId
            ? { userId }
            : isAdmin
                ? {}
                : { userId: currentUser.id };

        const [sessions, total] = await Promise.all([
            prisma.userSession.findMany({
                where,
                orderBy: { lastActiveAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
            prisma.userSession.count({ where }),
        ]);

        return NextResponse.json({
            data: sessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching sessions:", error);
        return NextResponse.json(
            { error: "Failed to fetch sessions" },
            { status: 500 }
        );
    }
}

// DELETE /api/sessions - Revoke a session
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const sessionId = url.searchParams.get("id");

        if (!sessionId) {
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        const currentUser = session.user as { id: string; role: string };
        const isAdmin = currentUser.role === "ADMIN";

        // Get the session to revoke
        const targetSession = await prisma.userSession.findUnique({
            where: { id: sessionId },
        });

        if (!targetSession) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        // Only admins can revoke other users' sessions
        if (!isAdmin && targetSession.userId !== currentUser.id) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        // Revoke the session
        await prisma.userSession.update({
            where: { id: sessionId },
            data: { isRevoked: true },
        });

        // Log the action
        await prisma.activityLog.create({
            data: {
                action: "REVOKE_SESSION",
                entityType: "USER_SESSION",
                entityId: sessionId,
                userId: currentUser.id,
                changes: JSON.stringify({ revokedUserId: targetSession.userId }),
            },
        });

        return NextResponse.json({
            message: "Session revoked successfully",
        });
    } catch (error) {
        console.error("Error revoking session:", error);
        return NextResponse.json(
            { error: "Failed to revoke session" },
            { status: 500 }
        );
    }
}
