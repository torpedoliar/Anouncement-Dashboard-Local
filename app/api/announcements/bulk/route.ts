import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentSiteId } from "@/lib/site-context";
import { canAccessSite } from "@/lib/site-access";
import { Prisma } from "@prisma/client";

type BulkAction = "delete" | "publish" | "unpublish";

// POST /api/announcements/bulk - Bulk operations (scoped to the current site)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { ids, action } = await request.json() as { ids: string[]; action: BulkAction };

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "IDs array is required" }, { status: 400 });
        }

        if (!action || !["delete", "publish", "unpublish"].includes(action)) {
            return NextResponse.json({ error: "Valid action is required (delete, publish, unpublish)" }, { status: 400 });
        }

        // Scope the operation to the current admin site so bulk actions never
        // touch articles that belong to other sites.
        const siteId = await getCurrentSiteId();
        if (siteId) {
            const allowed = await canAccessSite(session.user.id, siteId);
            if (!allowed) {
                return NextResponse.json({ error: "No access to the current site" }, { status: 403 });
            }
        }
        const where: Prisma.AnnouncementWhereInput = siteId
            ? { id: { in: ids }, sites: { some: { siteId } } }
            : { id: { in: ids } };

        let result;

        switch (action) {
            case "delete":
                result = await prisma.announcement.deleteMany({ where });

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
                    where,
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
                    where,
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
