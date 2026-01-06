//
// Comment Moderation API - Approve/Reject/Delete
// Path: /api/comments/[id]
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/comments/[id] - Get single comment
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const comment = await prisma.comment.findUnique({
            where: { id },
            include: {
                announcement: {
                    select: { id: true, title: true, slug: true },
                },
                replies: true,
                moderator: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!comment) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        return NextResponse.json(comment);
    } catch (error) {
        console.error("Error fetching comment:", error);
        return NextResponse.json(
            { error: "Failed to fetch comment" },
            { status: 500 }
        );
    }
}

// PUT /api/comments/[id] - Moderate comment (approve/reject)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { status, moderatorNote } = body;

        if (!status || !["APPROVED", "REJECTED", "SPAM"].includes(status)) {
            return NextResponse.json(
                { error: "Valid status is required (APPROVED, REJECTED, SPAM)" },
                { status: 400 }
            );
        }

        const userId = (session.user as { id: string }).id;

        const comment = await prisma.comment.update({
            where: { id },
            data: {
                status,
                moderatedAt: new Date(),
                moderatorId: userId,
                ...(moderatorNote !== undefined && { moderatorNote }),
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: `MODERATE_${status}`,
                entityType: "COMMENT",
                entityId: id,
                userId,
                changes: JSON.stringify({ newStatus: status }),
            },
        });

        return NextResponse.json({
            message: `Comment ${status.toLowerCase()}`,
            comment,
        });
    } catch (error) {
        console.error("Error moderating comment:", error);
        return NextResponse.json(
            { error: "Failed to moderate comment" },
            { status: 500 }
        );
    }
}

// DELETE /api/comments/[id] - Delete comment
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const userId = (session.user as { id: string }).id;

        // Get comment before deleting for logging
        const comment = await prisma.comment.findUnique({
            where: { id },
            select: { authorName: true, content: true, announcementId: true },
        });

        if (!comment) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        await prisma.comment.delete({ where: { id } });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "DELETE",
                entityType: "COMMENT",
                entityId: id,
                userId,
                changes: JSON.stringify({
                    authorName: comment.authorName,
                    content: comment.content.substring(0, 100),
                }),
            },
        });

        return NextResponse.json({
            message: "Comment deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting comment:", error);
        return NextResponse.json(
            { error: "Failed to delete comment" },
            { status: 500 }
        );
    }
}
