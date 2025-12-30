import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/categories - Get all categories
export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { order: "asc" },
            include: {
                _count: {
                    select: { announcements: true }
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

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, color } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        // Generate slug from name
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

        // Check if slug exists
        const existingCategory = await prisma.category.findUnique({
            where: { slug }
        });

        if (existingCategory) {
            return NextResponse.json(
                { error: "Category with this name already exists" },
                { status: 400 }
            );
        }

        // Get max order
        const maxOrder = await prisma.category.aggregate({
            _max: { order: true }
        });

        const category = await prisma.category.create({
            data: {
                name,
                slug,
                color: color || "#dc2626",
                order: (maxOrder._max.order || 0) + 1,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "CREATE",
                entityType: "CATEGORY",
                entityId: category.id,
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify({ name, color }),
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
