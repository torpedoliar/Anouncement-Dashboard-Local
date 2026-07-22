import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";

// GET /api/audit-trail - List audit logs with filters (SuperAdmin only)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);

        // Pagination
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);
        if (paginationError) {
            console.warn(`Pagination warning: ${paginationError}`);
        }

        // Filters
        const actorType = searchParams.get("actorType");
        const category = searchParams.get("category");
        const outcome = searchParams.get("outcome");
        const severity = searchParams.get("severity");
        const entityType = searchParams.get("entityType");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const search = searchParams.get("search");
        const exportFormat = searchParams.get("export");

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (actorType) where.actorType = actorType;
        if (category) where.category = category;
        if (outcome) where.outcome = outcome;
        if (severity) where.severity = severity;
        if (entityType) where.entityType = entityType;

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to);
        }

        if (search) {
            where.OR = [
                { actorEmail: { contains: search, mode: "insensitive" } },
                { actorName: { contains: search, mode: "insensitive" } },
                { action: { contains: search, mode: "insensitive" } },
                { entityType: { contains: search, mode: "insensitive" } },
                { entityId: { contains: search, mode: "insensitive" } },
            ];
        }

        // Export mode: return full data without pagination
        if (exportFormat === "csv" || exportFormat === "json") {
            const allLogs = await prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: 10000, // Safety limit
            });

            if (exportFormat === "csv") {
                const headers = [
                    "timestamp", "actorType", "actorEmail", "actorName",
                    "category", "action", "entityType", "entityId",
                    "outcome", "errorMessage", "ipAddress", "severity", "changes",
                ];
                const csvRows = [headers.join(",")];
                for (const log of allLogs) {
                    csvRows.push([
                        log.createdAt.toISOString(),
                        log.actorType,
                        log.actorEmail ?? "",
                        log.actorName ?? "",
                        log.category,
                        log.action,
                        log.entityType,
                        log.entityId ?? "",
                        log.outcome,
                        log.errorMessage ?? "",
                        log.ipAddress ?? "",
                        log.severity,
                        `"${(log.changes ?? "").replace(/"/g, '""')}"`,
                    ].join(","));
                }
                return new NextResponse(csvRows.join("\n"), {
                    status: 200,
                    headers: {
                        "Content-Type": "text/csv",
                        "Content-Disposition": `attachment; filename="audit_trail_${new Date().toISOString().slice(0, 10)}.csv"`,
                    },
                });
            }

            // JSON export
            return new NextResponse(JSON.stringify(allLogs, null, 2), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="audit_trail_${new Date().toISOString().slice(0, 10)}.json"`,
                },
            });
        }

        // Normal paginated mode
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
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
        console.error("Error fetching audit trail:", error);
        return NextResponse.json(
            { error: "Failed to fetch audit trail" },
            { status: 500 }
        );
    }
}
