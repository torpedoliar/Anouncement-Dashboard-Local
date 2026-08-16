import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleSites } from "@/lib/site-access";

/**
 * Site gate for draft handlers — same check as sibling
 * /api/announcements/[id]/route.ts (GET/DELETE): the user must have
 * access to at least one of the announcement's sites.
 */
async function findAccessibleAnnouncement(id: string, userId: string) {
    const announcement = await prisma.announcement.findUnique({
        where: { id },
        include: { sites: { select: { siteId: true } } },
    });
    if (!announcement) {
        return { announcement: null, hasAccess: false };
    }
    const accessibleIds = (await getAccessibleSites(userId)).map((s) => s.id);
    return {
        announcement,
        hasAccess: announcement.sites.some((s) => accessibleIds.includes(s.siteId)),
    };
}

// POST /api/announcements/[id]/draft - Save draft
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const sessionUserId = (session.user as { id: string }).id;
        const gate = await findAccessibleAnnouncement(id, sessionUserId);
        if (!gate.announcement) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (!gate.hasAccess) {
            return NextResponse.json(
                { error: "No access to this announcement" },
                { status: 403 }
            );
        }

        const { draftContent } = await request.json();

        if (!draftContent) {
            return NextResponse.json({ error: "Draft content is required" }, { status: 400 });
        }

        const announcement = await prisma.announcement.update({
            where: { id },
            data: {
                draftContent,
                draftUpdatedAt: new Date(),
            },
            select: {
                id: true,
                draftUpdatedAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            draftUpdatedAt: announcement.draftUpdatedAt,
        });
    } catch (error) {
        console.error("Error saving draft:", error);
        return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
    }
}

// GET /api/announcements/[id]/draft - Get draft
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

        const announcement = await prisma.announcement.findUnique({
            where: { id },
            select: {
                id: true,
                draftContent: true,
                draftUpdatedAt: true,
                content: true,
                updatedAt: true,
                sites: { select: { siteId: true } },
            },
        });

        if (!announcement) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
        }

        const sessionUserId = (session.user as { id: string }).id;
        const accessibleIds = (await getAccessibleSites(sessionUserId)).map((s) => s.id);
        const hasAccess = announcement.sites.some((s) => accessibleIds.includes(s.siteId));
        if (!hasAccess) {
            return NextResponse.json(
                { error: "No access to this announcement" },
                { status: 403 }
            );
        }

        return NextResponse.json({
            draftContent: announcement.draftContent,
            draftUpdatedAt: announcement.draftUpdatedAt,
            content: announcement.content,
            contentUpdatedAt: announcement.updatedAt,
            hasDraft: !!announcement.draftContent,
        });
    } catch (error) {
        console.error("Error fetching draft:", error);
        return NextResponse.json({ error: "Failed to fetch draft" }, { status: 500 });
    }
}

// DELETE /api/announcements/[id]/draft - Discard draft
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

        const sessionUserId = (session.user as { id: string }).id;
        const { announcement, hasAccess } = await findAccessibleAnnouncement(id, sessionUserId);
        if (!announcement) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
        }
        if (!hasAccess) {
            return NextResponse.json(
                { error: "No access to this announcement" },
                { status: 403 }
            );
        }

        await prisma.announcement.update({
            where: { id },
            data: {
                draftContent: null,
                draftUpdatedAt: null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error discarding draft:", error);
        return NextResponse.json({ error: "Failed to discard draft" }, { status: 500 });
    }
}
