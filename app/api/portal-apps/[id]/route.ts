import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PortalAppUpdateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/portal-apps/[id] - Get single portal app (SuperAdmin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const app = await prisma.portalApp.findUnique({ where: { id } });
        if (!app) {
            return NextResponse.json({ error: "App not found" }, { status: 404 });
        }

        return NextResponse.json(app);
    } catch (error) {
        console.error("Error fetching portal app:", error);
        return NextResponse.json({ error: "Failed to fetch portal app" }, { status: 500 });
    }
}

// PUT /api/portal-apps/[id] - Update portal app (SuperAdmin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const validation = validateInput(PortalAppUpdateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const existing = await prisma.portalApp.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "App not found" }, { status: 404 });
        }

        // Check slug uniqueness if changed
        if (validation.data.slug && validation.data.slug !== existing.slug) {
            const slugExists = await prisma.portalApp.findUnique({ where: { slug: validation.data.slug } });
            if (slugExists) {
                return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
            }
        }

        const app = await prisma.portalApp.update({ where: { id }, data: validation.data });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_APP_UPDATED",
            entityType: "PORTAL_APP",
            entityId: id,
            changes: validation.data,
            request,
        });

        return NextResponse.json(app);
    } catch (error) {
        console.error("Error updating portal app:", error);
        return NextResponse.json({ error: "Failed to update portal app" }, { status: 500 });
    }
}

// DELETE /api/portal-apps/[id] - Delete portal app (SuperAdmin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const existing = await prisma.portalApp.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "App not found" }, { status: 404 });
        }

        await prisma.portalApp.delete({ where: { id } });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_APP_DELETED",
            entityType: "PORTAL_APP",
            entityId: id,
            changes: { name: existing.name, slug: existing.slug },
            request,
        });

        return NextResponse.json({ message: "App deleted" });
    } catch (error) {
        console.error("Error deleting portal app:", error);
        return NextResponse.json({ error: "Failed to delete portal app" }, { status: 500 });
    }
}
