import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { slugify, generateExcerpt } from "@/lib/utils";
import { createRevision } from "@/lib/revision";

// GET /api/announcements/[id] - Get single announcement
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const announcement = await prisma.announcement.findUnique({
            where: { id },
            include: {
                category: true,
            },
        });

        if (!announcement) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Increment view count
        await prisma.announcement.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });

        return NextResponse.json(announcement);
    } catch (error) {
        console.error("Error fetching announcement:", error);
        return NextResponse.json(
            { error: "Failed to fetch announcement" },
            { status: 500 }
        );
    }
}

// PUT /api/announcements/[id] - Update announcement
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
        const { title, content, categoryId, imagePath, videoPath, videoType, youtubeUrl, isHero, isPinned, isPublished, scheduledAt, takedownAt } = body;

        const existingAnnouncement = await prisma.announcement.findUnique({ where: { id } });
        if (!existingAnnouncement) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Generate new slug if title changed
        let slug = existingAnnouncement.slug;
        if (title && title !== existingAnnouncement.title) {
            slug = slugify(title);
            const existingSlug = await prisma.announcement.findFirst({
                where: { slug, NOT: { id } },
            });
            if (existingSlug) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        // Generate excerpt if content changed
        const excerpt = content ? generateExcerpt(content) : existingAnnouncement.excerpt;

        // Create revision snapshot BEFORE updating (save current state)
        const userId = (session.user as { id: string }).id;
        try {
            await createRevision({
                announcementId: id,
                authorId: userId,
                changeType: "EDIT",
                changeSummary: title !== existingAnnouncement.title ? "Title changed" : undefined,
            });
        } catch (revErr) {
            console.warn("Failed to create revision:", revErr);
            // Continue with update even if revision fails
        }

        const announcement = await prisma.announcement.update({
            where: { id },
            data: {
                title: title || existingAnnouncement.title,
                slug,
                content: content || existingAnnouncement.content,
                excerpt,
                categoryId: categoryId || existingAnnouncement.categoryId,
                imagePath: imagePath !== undefined ? imagePath : existingAnnouncement.imagePath,
                videoPath: videoPath !== undefined ? videoPath : existingAnnouncement.videoPath,
                videoType: videoType !== undefined ? videoType : existingAnnouncement.videoType,
                youtubeUrl: youtubeUrl !== undefined ? youtubeUrl : existingAnnouncement.youtubeUrl,
                isHero: isHero !== undefined ? isHero : existingAnnouncement.isHero,
                isPinned: isPinned !== undefined ? isPinned : existingAnnouncement.isPinned,
                isPublished: isPublished !== undefined ? isPublished : existingAnnouncement.isPublished,
                scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : existingAnnouncement.scheduledAt,
                takedownAt: takedownAt !== undefined ? (takedownAt ? new Date(takedownAt) : null) : existingAnnouncement.takedownAt,
            },
            include: {
                category: true,
            },
        });

        // Log activity - stringify JSON for SQLite compatibility
        await prisma.activityLog.create({
            data: {
                action: "UPDATE",
                entityType: "ANNOUNCEMENT",
                entityId: id,
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify(body),
            },
        });

        return NextResponse.json(announcement);
    } catch (error) {
        console.error("Error updating announcement:", error);
        return NextResponse.json(
            { error: "Failed to update announcement" },
            { status: 500 }
        );
    }
}

// DELETE /api/announcements/[id] - Delete announcement
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

        // Get announcement title before deleting for activity log
        const announcement = await prisma.announcement.findUnique({
            where: { id },
            select: { title: true },
        });

        await prisma.announcement.delete({ where: { id } });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "DELETE",
                entityType: "ANNOUNCEMENT",
                entityId: id,
                userId: (session.user as { id: string }).id,
                changes: announcement ? JSON.stringify({ title: announcement.title }) : null,
            },
        });

        return NextResponse.json({ message: "Deleted successfully" });
    } catch (error) {
        console.error("Error deleting announcement:", error);
        return NextResponse.json(
            { error: "Failed to delete announcement" },
            { status: 500 }
        );
    }
}
