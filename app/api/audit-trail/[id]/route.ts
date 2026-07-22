import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/audit-trail/[id] - Get single audit log detail (SuperAdmin only)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;

        const log = await prisma.auditLog.findUnique({
            where: { id },
        });

        if (!log) {
            return NextResponse.json({ error: "Audit log not found" }, { status: 404 });
        }

        return NextResponse.json(log);
    } catch (error) {
        console.error("Error fetching audit log detail:", error);
        return NextResponse.json(
            { error: "Failed to fetch audit log" },
            { status: 500 }
        );
    }
}
