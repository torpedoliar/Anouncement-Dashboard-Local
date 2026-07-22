import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { portalGroupSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/portal-groups/[id] - Get single portal group (SuperAdmin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const group = await prisma.portalGroup.findUnique({
            where: { id },
            include: {
                apps: {
                    include: {
                        app: { select: { id: true, name: true, slug: true, isActive: true } },
                    },
                },
                members: {
                    include: {
                        portalUser: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });

        if (!group) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 });
        }

        return NextResponse.json(group);
    } catch (error) {
        console.error("Error fetching portal group:", error);
        return NextResponse.json({ error: "Failed to fetch portal group" }, { status: 500 });
    }
}

// PUT /api/portal-groups/[id] - Update portal group (SuperAdmin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const validation = validateInput(portalGroupSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const existing = await prisma.portalGroup.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 });
        }

        // Check name uniqueness if changed
        if (validation.data.name && validation.data.name !== existing.name) {
            const nameExists = await prisma.portalGroup.findUnique({ where: { name: validation.data.name } });
            if (nameExists) {
                return NextResponse.json({ error: "Group name already exists" }, { status: 409 });
            }
        }

        const data = validation.data;

        // Atomic: update group + replace apps
        const group = await prisma.$transaction(async (tx) => {
            // Replace app assignments
            await tx.portalGroupApp.deleteMany({ where: { groupId: id } });
            if (data.appIds.length > 0) {
                await tx.portalGroupApp.createMany({
                    data: data.appIds.map((appId) => ({ groupId: id, appId })),
                });
            }

            return tx.portalGroup.update({
                where: { id },
                data: {
                    name: data.name,
                    description: data.description ?? null,
                    isActive: data.isActive,
                },
                include: {
                    _count: { select: { apps: true, members: true } },
                },
            });
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_GROUP_UPDATED",
            entityType: "PORTAL_GROUP",
            entityId: id,
            changes: { name: data.name, appCount: data.appIds.length },
            request,
        });

        return NextResponse.json(group);
    } catch (error) {
        console.error("Error updating portal group:", error);
        return NextResponse.json({ error: "Failed to update portal group" }, { status: 500 });
    }
}

// DELETE /api/portal-groups/[id] - Delete portal group (SuperAdmin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const existing = await prisma.portalGroup.findUnique({
            where: { id },
            include: { _count: { select: { members: true, apps: true } } },
        });
        if (!existing) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 });
        }

        await prisma.portalGroup.delete({ where: { id } });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_GROUP_DELETED",
            entityType: "PORTAL_GROUP",
            entityId: id,
            changes: { name: existing.name, memberCount: existing._count.members },
            request,
        });

        return NextResponse.json({ message: "Group deleted" });
    } catch (error) {
        console.error("Error deleting portal group:", error);
        return NextResponse.json({ error: "Failed to delete portal group" }, { status: 500 });
    }
}
