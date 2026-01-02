import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
                draftContent: true,
                draftUpdatedAt: true,
                content: true,
                updatedAt: true,
            },
        });

        if (!announcement) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
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
