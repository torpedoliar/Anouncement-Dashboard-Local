import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type BulkAction = "delete" | "publish" | "unpublish";

// POST /api/announcements/bulk - Bulk operations
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { ids, action } = await request.json() as { ids: string[]; action: BulkAction };

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "IDs array is required" }, { status: 400 });
        }

        if (!action || !["delete", "publish", "unpublish"].includes(action)) {
            return NextResponse.json({ error: "Valid action is required (delete, publish, unpublish)" }, { status: 400 });
        }

        let result;

        switch (action) {
            case "delete":
                result = await prisma.announcement.deleteMany({
                    where: { id: { in: ids } },
                });

                // Log activity
                await prisma.activityLog.create({
                    data: {
                        action: "BULK_DELETE",
                        entityType: "ANNOUNCEMENT",
                        entityId: ids.join(","),
                        userId: (session.user as { id: string }).id,
                        changes: JSON.stringify({ count: result.count }),
                    },
                });
                break;

            case "publish":
                result = await prisma.announcement.updateMany({
                    where: { id: { in: ids } },
                    data: { isPublished: true },
                });

                await prisma.activityLog.create({
                    data: {
                        action: "BULK_PUBLISH",
                        entityType: "ANNOUNCEMENT",
                        entityId: ids.join(","),
                        userId: (session.user as { id: string }).id,
                        changes: JSON.stringify({ count: result.count }),
                    },
                });
                break;

            case "unpublish":
                result = await prisma.announcement.updateMany({
                    where: { id: { in: ids } },
                    data: { isPublished: false },
                });

                await prisma.activityLog.create({
                    data: {
                        action: "BULK_UNPUBLISH",
                        entityType: "ANNOUNCEMENT",
                        entityId: ids.join(","),
                        userId: (session.user as { id: string }).id,
                        changes: JSON.stringify({ count: result.count }),
                    },
                });
                break;
        }

        return NextResponse.json({
            success: true,
            action,
            affected: result?.count || 0,
        });
    } catch (error) {
        console.error("Error in bulk operation:", error);
        return NextResponse.json({ error: "Failed to perform bulk operation" }, { status: 500 });
    }
}
