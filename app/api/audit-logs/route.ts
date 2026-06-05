import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validatePagination } from "@/lib/pagination-utils";
import { getCurrentSiteId } from "@/lib/site-context";
import { canAccessSite, getAccessibleSites } from "@/lib/site-access";
import type { Prisma } from "@prisma/client";

// GET /api/audit-logs - List activity logs (scoped to the user's accessible sites)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Validate pagination with limits
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);

        if (paginationError) {
            console.warn(`Pagination warning: ${paginationError}`);
        }

        const entityType = searchParams.get("entityType");
        const action = searchParams.get("action");
        const userId = searchParams.get("userId");
        const severity = searchParams.get("severity");

        const where: Prisma.ActivityLogWhereInput = {};

        if (entityType) {
            where.entityType = entityType;
        }
        if (action) {
            where.action = action;
        }
        if (userId) {
            where.userId = userId;
        }
        if (severity && ["INFO", "WARNING", "ERROR"].includes(severity)) {
            where.severity = severity as "INFO" | "WARNING" | "ERROR";
        }

        // Scope to site: prefer the current admin site cookie, else all accessible sites.
        // SuperAdmin with no site context sees everything. Logs with null siteId
        // (system-level events) are included alongside the current site's logs.
        const isSuperAdmin = !!session.user.isSuperAdmin;
        const currentSiteId = await getCurrentSiteId();
        if (currentSiteId) {
            if (!isSuperAdmin && !(await canAccessSite(session.user.id, currentSiteId))) {
                return NextResponse.json({ error: "No access to this site" }, { status: 403 });
            }
            where.OR = [{ siteId: currentSiteId }, { siteId: null }];
        } else if (!isSuperAdmin) {
            const accessible = await getAccessibleSites(session.user.id);
            where.OR = [{ siteId: { in: accessible.map((s) => s.id) } }, { siteId: null }];
        }

        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
            prisma.activityLog.count({ where }),
        ]);

        return NextResponse.json({
            data: logs,
            pagination: {
                page: Math.floor(skip / limit) + 1,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        return NextResponse.json(
            { error: "Failed to fetch audit logs" },
            { status: 500 }
        );
    }
}

