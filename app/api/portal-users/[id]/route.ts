import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PortalUserUpdateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/portal-users/[id] - Get single portal user (SuperAdmin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const user = await prisma.portalUser.findUnique({
            where: { id },
            select: {
                id: true, email: true, name: true, avatar: true,
                role: true, isActive: true, failedLoginCount: true, lockedUntil: true,
                createdAt: true, updatedAt: true,
                appAccess: {
                    include: { app: { select: { id: true, name: true, slug: true } } },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error fetching portal user:", error);
        return NextResponse.json({ error: "Failed to fetch portal user" }, { status: 500 });
    }
}

// PUT /api/portal-users/[id] - Update portal user (SuperAdmin only, no password)
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const validation = validateInput(PortalUserUpdateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const existing = await prisma.portalUser.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Check email uniqueness if changed
        if (validation.data.email && validation.data.email !== existing.email) {
            const emailExists = await prisma.portalUser.findUnique({ where: { email: validation.data.email } });
            if (emailExists) {
                return NextResponse.json({ error: "Email already registered" }, { status: 409 });
            }
        }

        const user = await prisma.portalUser.update({ where: { id }, data: validation.data });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: "PORTAL_USER_UPDATED",
            entityType: "PORTAL_USER",
            entityId: id,
            changes: validation.data,
            request,
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error updating portal user:", error);
        return NextResponse.json({ error: "Failed to update portal user" }, { status: 500 });
    }
}

// DELETE /api/portal-users/[id] - Delete portal user (SuperAdmin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const existing = await prisma.portalUser.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        await prisma.portalUser.delete({ where: { id } });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: "PORTAL_USER_DELETED",
            entityType: "PORTAL_USER",
            entityId: id,
            changes: { email: existing.email, name: existing.name },
            request,
        });

        return NextResponse.json({ message: "User deleted" });
    } catch (error) {
        console.error("Error deleting portal user:", error);
        return NextResponse.json({ error: "Failed to delete portal user" }, { status: 500 });
    }
}
