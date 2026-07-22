import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";
import { PortalAppCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

// GET /api/portal-apps - List portal apps (SuperAdmin only)
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

        const category = searchParams.get("category");
        const isActive = searchParams.get("isActive");
        const search = searchParams.get("search");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (category) where.category = category;
        if (isActive !== null && isActive !== undefined && isActive !== "") where.isActive = isActive === "true";
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const [apps, total] = await Promise.all([
            prisma.portalApp.findMany({
                where,
                orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
                skip,
                take: limit,
            }),
            prisma.portalApp.count({ where }),
        ]);

        return NextResponse.json({
            data: apps,
            pagination: {
                page: Math.floor(skip / limit) + 1,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching portal apps:", error);
        return NextResponse.json({ error: "Failed to fetch portal apps" }, { status: 500 });
    }
}

// POST /api/portal-apps - Create portal app (SuperAdmin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json();
        const validation = validateInput(PortalAppCreateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const data = validation.data;

        // Check slug uniqueness
        const existing = await prisma.portalApp.findUnique({ where: { slug: data.slug } });
        if (existing) {
            return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
        }

        const app = await prisma.portalApp.create({ data });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_APP_CREATED",
            entityType: "PORTAL_APP",
            entityId: app.id,
            changes: { name: app.name, slug: app.slug },
            request,
        });

        return NextResponse.json(app, { status: 201 });
    } catch (error) {
        console.error("Error creating portal app:", error);
        return NextResponse.json({ error: "Failed to create portal app" }, { status: 500 });
    }
}
