import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { slugify, generateExcerpt } from "@/lib/utils";

// GET /api/announcements - List announcements
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");
        const search = searchParams.get("q");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "12");
        const skip = (page - 1) * limit;

        // Build where clause - PostgreSQL compatible
        type WhereClause = {
            isPublished: boolean;
            category?: { slug: string };
            OR?: Array<{ title: { contains: string; mode: "insensitive" } } | { content: { contains: string; mode: "insensitive" } }>;
        };

        const where: WhereClause = {
            isPublished: true,
        };

        if (category) {
            where.category = { slug: category };
        }

        if (search) {
            // PostgreSQL supports case-insensitive search
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { content: { contains: search, mode: "insensitive" } },
            ];
        }

        const [announcements, total] = await Promise.all([
            prisma.announcement.findMany({
                where,
                orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
                skip,
                take: limit,
                include: {
                    category: {
                        select: { name: true, color: true, slug: true },
                    },
                },
            }),
            prisma.announcement.count({ where }),
        ]);

        const response = NextResponse.json({
            data: announcements,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
        response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        return response;
    } catch (error) {
        console.error("Error fetching announcements:", error);
        return NextResponse.json(
            { error: "Failed to fetch announcements" },
            { status: 500 }
        );
    }
}

// POST /api/announcements - Create announcement (protected)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { title, content, categoryId, imagePath, videoPath, videoType, youtubeUrl, isHero, isPinned, isPublished, scheduledAt, takedownAt } = body;

        if (!title || !content || !categoryId) {
            return NextResponse.json(
                { error: "Title, content, and category are required" },
                { status: 400 }
            );
        }

        // Generate unique slug
        let slug = slugify(title);
        const existingSlug = await prisma.announcement.findUnique({ where: { slug } });
        if (existingSlug) {
            slug = `${slug}-${Date.now()}`;
        }

        // Generate excerpt
        const excerpt = generateExcerpt(content);

        const announcement = await prisma.announcement.create({
            data: {
                title,
                slug,
                content,
                excerpt,
                categoryId,
                imagePath,
                videoPath,
                videoType,
                youtubeUrl,
                isHero: isHero || false,
                isPinned: isPinned || false,
                isPublished: isPublished || false,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                takedownAt: takedownAt ? new Date(takedownAt) : null,
                authorId: (session.user as { id: string }).id,
            },
            include: {
                category: true,
                author: { select: { id: true, name: true, email: true } },
            },
        });

        // Log activity - stringify JSON for SQLite
        await prisma.activityLog.create({
            data: {
                action: "CREATE",
                entityType: "ANNOUNCEMENT",
                entityId: announcement.id,
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify({ title, categoryId }),
            },
        });

        return NextResponse.json(announcement, { status: 201 });
    } catch (error) {
        console.error("Error creating announcement:", error);
        return NextResponse.json(
            { error: "Failed to create announcement" },
            { status: 500 }
        );
    }
}
