//
// Comments API - Public comments on announcements
// Path: /api/announcements/[id]/comments
//

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";
import { CommentCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";

// GET /api/announcements/[id]/comments - Get approved comments (public)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);

        // Validate pagination with limits
        const pageParam = url.searchParams.get("page");
        const limitParam = url.searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);

        if (paginationError) {
            console.warn(`Pagination warning: ${paginationError}`);
        }

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
                skip,
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
                page: Math.floor(skip / limit) + 1,
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

        // Zod validation with sanitization
        const validation = validateInput(CommentCreateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const { authorName, authorEmail, content, parentId } = validation.data;

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
