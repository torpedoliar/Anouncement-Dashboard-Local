//
// Revisions API - GET list, POST restore
// Path: /api/announcements/[id]/revisions
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAccessibleSites } from "@/lib/site-access";
import { getRevisionHistory, restoreRevision } from "@/lib/revision";
import { validatePagination } from "@/lib/pagination-utils";

/**
 * Site gate — same check as sibling /api/announcements/[id]/route.ts:
 * the user must have access to at least one of the announcement's sites
 * before reading its revision snapshots or restoring them.
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

// GET /api/announcements/[id]/revisions - Get revision history
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
        const url = new URL(request.url);

        // Per-site gate before exposing revision snapshots
        const sessionUserId = (session.user as { id: string }).id;
        const { announcement, hasAccess } = await findAccessibleAnnouncement(id, sessionUserId);
        if (!announcement) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (!hasAccess) {
            return NextResponse.json(
                { error: "No access to this announcement" },
                { status: 403 }
            );
        }

        // Apply pagination limits
        const pageParam = url.searchParams.get("page");
        const limitParam = url.searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);

        if (paginationError) {
            return NextResponse.json({ error: paginationError }, { status: 400 });
        }

        const { revisions, total } = await getRevisionHistory(id, limit, skip);

        return NextResponse.json({
            data: revisions,
            pagination: {
                limit,
                offset: skip,
                total,
                hasMore: skip + revisions.length < total,
            },
        });
    } catch (error) {
        console.error("Error fetching revisions:", error);
        return NextResponse.json(
            { error: "Failed to fetch revisions" },
            { status: 500 }
        );
    }
}

// POST /api/announcements/[id]/revisions - Restore to revision
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
        const body = await request.json();
        const { revisionId } = body;

        if (!revisionId) {
            return NextResponse.json(
                { error: "revisionId is required" },
                { status: 400 }
            );
        }

        const userId = (session.user as { id: string }).id;

        // The revision must belong to THIS announcement...
        const revision = await prisma.announcementRevision.findUnique({
            where: { id: revisionId },
            select: { announcementId: true },
        });
        if (!revision || revision.announcementId !== id) {
            return NextResponse.json({ error: "Revision not found" }, { status: 404 });
        }

        // ...and the user must have access to the announcement before restoring
        const { announcement, hasAccess } = await findAccessibleAnnouncement(revision.announcementId, userId);
        if (!announcement) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
        }
        if (!hasAccess) {
            return NextResponse.json(
                { error: "No access to this announcement" },
                { status: 403 }
            );
        }

        const restored = await restoreRevision(revisionId, userId);

        return NextResponse.json({
            message: "Announcement restored successfully",
            announcement: restored,
        });
    } catch (error) {
        console.error("Error restoring revision:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to restore" },
            { status: 500 }
        );
    }
}
