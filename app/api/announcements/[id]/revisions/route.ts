//
// Revisions API - GET list, POST restore
// Path: /api/announcements/[id]/revisions
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRevisionHistory, restoreRevision } from "@/lib/revision";

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
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const { revisions, total } = await getRevisionHistory(id, limit, offset);

        return NextResponse.json({
            data: revisions,
            pagination: {
                limit,
                offset,
                total,
                hasMore: offset + revisions.length < total,
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
