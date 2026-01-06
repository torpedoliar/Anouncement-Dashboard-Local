import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/audit-logs - List activity logs with pagination and filters
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const entityType = searchParams.get("entityType");
        const action = searchParams.get("action");
        const userId = searchParams.get("userId");
        const severity = searchParams.get("severity");
        const skip = (page - 1) * limit;

        // Build where clause
        type WhereClause = {
            entityType?: string;
            action?: string;
            userId?: string;
            severity?: "INFO" | "WARNING" | "ERROR";
        };

        const where: WhereClause = {};

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
                page,
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

