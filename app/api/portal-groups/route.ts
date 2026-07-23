import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";
import { PortalGroupCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

// GET /api/portal-groups - List portal groups (SuperAdmin only)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip } = validatePagination(pageParam, limitParam);

        const [groups, total] = await Promise.all([
            prisma.portalGroup.findMany({
                orderBy: [{ name: "asc" }],
                skip,
                take: limit,
                include: {
                    _count: {
                        select: { apps: true, members: true },
                    },
                },
            }),
            prisma.portalGroup.count(),
        ]);

        return NextResponse.json({
            data: groups,
            pagination: {
                page: Math.floor(skip / limit) + 1,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching portal groups:", error);
        return NextResponse.json({ error: "Failed to fetch portal groups" }, { status: 500 });
    }
}

// POST /api/portal-groups - Create portal group (SuperAdmin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json();
        const validation = validateInput(PortalGroupCreateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const data = validation.data;

        // Check name uniqueness
        const existing = await prisma.portalGroup.findUnique({ where: { name: data.name } });
        if (existing) {
            return NextResponse.json({ error: "Group name already exists" }, { status: 409 });
        }

        const group = await prisma.portalGroup.create({
            data: {
                name: data.name,
                description: data.description ?? null,
                isActive: data.isActive,
                apps: data.appIds.length > 0
                    ? { create: data.appIds.map((appId) => ({ appId })) }
                    : undefined,
            },
            include: {
                _count: { select: { apps: true, members: true } },
            },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_GROUP_CREATED",
            entityType: "PORTAL_GROUP",
            entityId: group.id,
            changes: { name: group.name, appCount: data.appIds.length },
            request,
        });

        return NextResponse.json(group, { status: 201 });
    } catch (error) {
        console.error("Error creating portal group:", error);
        return NextResponse.json({ error: "Failed to create portal group" }, { status: 500 });
    }
}
