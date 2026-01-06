//
// Comments Moderation API - Admin only
// Path: /api/comments
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/comments - List all comments (admin)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const status = url.searchParams.get("status");
        const announcementId = url.searchParams.get("announcementId");

        // Build where clause
        const where: Record<string, unknown> = {};
        if (status) where.status = status;
        if (announcementId) where.announcementId = announcementId;

        const [comments, total] = await Promise.all([
            prisma.comment.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    announcement: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                        },
                    },
                    moderator: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma.comment.count({ where }),
        ]);

        return NextResponse.json({
            data: comments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching comments:", error);
        return NextResponse.json(
            { error: "Failed to fetch comments" },
            { status: 500 }
        );
    }
}
