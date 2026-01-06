//
// Comments API - Public comments on announcements
// Path: /api/announcements/[id]/comments
//

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/announcements/[id]/comments - Get approved comments (public)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");

        // Only show approved comments to public
        const where = {
            announcementId: id,
            status: "APPROVED" as const,
            parentId: null, // Top-level comments only
        };

        const [comments, total] = await Promise.all([
            prisma.comment.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    replies: {
                        where: { status: "APPROVED" },
                        orderBy: { createdAt: "asc" },
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

// POST /api/announcements/[id]/comments - Submit a comment (public)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { authorName, authorEmail, content, parentId } = body;

        // Validation
        if (!authorName || !content) {
            return NextResponse.json(
                { error: "Name and content are required" },
                { status: 400 }
            );
        }

        if (content.length < 2 || content.length > 5000) {
            return NextResponse.json(
                { error: "Content must be between 2 and 5000 characters" },
                { status: 400 }
            );
        }

        // Check if announcement exists and is published
        const announcement = await prisma.announcement.findUnique({
            where: { id },
            select: { id: true, isPublished: true },
        });

        if (!announcement || !announcement.isPublished) {
            return NextResponse.json(
                { error: "Announcement not found" },
                { status: 404 }
            );
        }

        // Check if parent comment exists (for replies)
        if (parentId) {
            const parent = await prisma.comment.findUnique({
                where: { id: parentId },
                select: { id: true, announcementId: true },
            });

            if (!parent || parent.announcementId !== id) {
                return NextResponse.json(
                    { error: "Parent comment not found" },
                    { status: 404 }
                );
            }
        }

        // Get settings for auto-approve
        const settings = await prisma.settings.findFirst();
        const autoApprove = settings?.commentAutoApprove ?? false;
        const requireEmail = settings?.commentRequireEmail ?? false;

        if (requireEmail && !authorEmail) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        // Create comment
        const comment = await prisma.comment.create({
            data: {
                announcementId: id,
                authorName: authorName.trim(),
                authorEmail: authorEmail?.toLowerCase().trim() || null,
                content: content.trim(),
                parentId: parentId || null,
                status: autoApprove ? "APPROVED" : "PENDING",
            },
        });

        return NextResponse.json({
            message: autoApprove
                ? "Comment posted successfully"
                : "Comment submitted for moderation",
            comment: {
                id: comment.id,
                status: comment.status,
            },
        });
    } catch (error) {
        console.error("Error creating comment:", error);
        return NextResponse.json(
            { error: "Failed to submit comment" },
            { status: 500 }
        );
    }
}
