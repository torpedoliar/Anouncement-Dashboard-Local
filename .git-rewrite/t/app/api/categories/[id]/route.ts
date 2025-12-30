import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/categories/[id] - Get single category
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const category = await prisma.category.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { announcements: true }
                }
            }
        });

        if (!category) {
            return NextResponse.json(
                { error: "Category not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(category);
    } catch (error) {
        console.error("Error fetching category:", error);
        return NextResponse.json(
            { error: "Failed to fetch category" },
            { status: 500 }
        );
    }
}

// PUT /api/categories/[id] - Update category
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, color, order } = body;

        const existingCategory = await prisma.category.findUnique({
            where: { id }
        });

        if (!existingCategory) {
            return NextResponse.json(
                { error: "Category not found" },
                { status: 404 }
            );
        }

        // Generate new slug if name changed
        let slug = existingCategory.slug;
        if (name && name !== existingCategory.name) {
            slug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");

            // Check if new slug exists
            const slugExists = await prisma.category.findFirst({
                where: {
                    slug,
                    id: { not: id }
                }
            });

            if (slugExists) {
                return NextResponse.json(
                    { error: "Category with this name already exists" },
                    { status: 400 }
                );
            }
        }

        const category = await prisma.category.update({
            where: { id },
            data: {
                ...(name && { name, slug }),
                ...(color && { color }),
                ...(order !== undefined && { order }),
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "UPDATE",
                entityType: "CATEGORY",
                entityId: id,
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify({ name, color, order }),
            },
        });

        return NextResponse.json(category);
    } catch (error) {
        console.error("Error updating category:", error);
        return NextResponse.json(
            { error: "Failed to update category" },
            { status: 500 }
        );
    }
}

// DELETE /api/categories/[id] - Delete category
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Check if category has announcements
        const category = await prisma.category.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { announcements: true }
                }
            }
        });

        if (!category) {
            return NextResponse.json(
                { error: "Category not found" },
                { status: 404 }
            );
        }

        if (category._count.announcements > 0) {
            return NextResponse.json(
                { error: `Cannot delete category with ${category._count.announcements} announcements. Move or delete announcements first.` },
                { status: 400 }
            );
        }

        await prisma.category.delete({
            where: { id }
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "DELETE",
                entityType: "CATEGORY",
                entityId: id,
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify({ name: category.name }),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting category:", error);
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        );
    }
}
