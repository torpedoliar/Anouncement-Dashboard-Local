import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canEditOnSite } from "@/lib/site-access";
import { CategoryCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";

// GET /api/categories - Get categories (filtered by site)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const siteId = searchParams.get("siteId");
        const siteSlug = searchParams.get("siteSlug");

        // Resolve siteId from slug if provided
        let resolvedSiteId = siteId;
        if (!resolvedSiteId && siteSlug) {
            const site = await prisma.site.findUnique({
                where: { slug: siteSlug },
                select: { id: true },
            });
            resolvedSiteId = site?.id || null;
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (resolvedSiteId) {
            where.siteId = resolvedSiteId;
        }

        const categories = await prisma.category.findMany({
            where,
            orderBy: { order: "asc" },
            include: {
                _count: {
                    select: { announcements: true }
                },
                site: {
                    select: { id: true, name: true, slug: true }
                }
            }
        });

        return NextResponse.json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
            { status: 500 }
        );
    }
}

// POST /api/categories - Create new category (site-specific)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, color, siteId } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        // Auto-assign default site if not provided (backward compatibility)
        let resolvedSiteId = siteId;
        if (!resolvedSiteId) {
            const defaultSite = await prisma.site.findFirst({
                where: { isDefault: true },
                select: { id: true },
            });
            if (defaultSite) {
                resolvedSiteId = defaultSite.id;
            } else {
                const firstSite = await prisma.site.findFirst({
                    where: { isActive: true },
                    select: { id: true },
                });
                if (firstSite) {
                    resolvedSiteId = firstSite.id;
                } else {
                    return NextResponse.json(
                        { error: "No sites available. Please create a site first." },
                        { status: 400 }
                    );
                }
            }
        }

        // Check user has permission to edit on this site
        const canEdit = await canEditOnSite(session.user.id, resolvedSiteId);
        if (!canEdit) {
            return NextResponse.json(
                { error: "No permission to create category on this site" },
                { status: 403 }
            );
        }

        // Generate slug from name
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

        // Check if slug exists for this site
        const existingCategory = await prisma.category.findFirst({
            where: { slug, siteId }
        });

        if (existingCategory) {
            return NextResponse.json(
                { error: "Category with this name already exists for this site" },
                { status: 400 }
            );
        }

        // Get max order for this site
        const maxOrder = await prisma.category.aggregate({
            where: { siteId },
            _max: { order: true }
        });

        const category = await prisma.category.create({
            data: {
                name,
                slug,
                color: color || "#dc2626",
                order: (maxOrder._max.order || 0) + 1,
                siteId: resolvedSiteId,
            },
            include: {
                site: { select: { id: true, name: true, slug: true } }
            }
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "CREATE",
                entityType: "CATEGORY",
                entityId: category.id,
                userId: session.user.id,
                siteId: resolvedSiteId,
                changes: JSON.stringify({ name, color, siteId }),
            },
        });

        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        console.error("Error creating category:", error);
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        );
    }
}
