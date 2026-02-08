import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { validatePagination } from '@/lib/pagination-utils';
import { AnnouncementCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { slugify, generateExcerpt } from "@/lib/utils";
import { canEditOnSite } from "@/lib/site-access";

// GET /api/announcements - List announcements
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");
        const search = searchParams.get("q");
        const siteId = searchParams.get("siteId");
        const siteSlug = searchParams.get("siteSlug");
        // Validated by validatePagination
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);
        if (paginationError) { console.warn(`Pagination warning: ${paginationError}`); }
        // skip calculated by validatePagination
        const includeAll = searchParams.get("includeAll") === "true"; // For admin view

        // Resolve siteId from slug if provided
        let resolvedSiteId = siteId;
        if (!resolvedSiteId && siteSlug) {
            const site = await prisma.site.findUnique({
                where: { slug: siteSlug },
                select: { id: true },
            });
            resolvedSiteId = site?.id || null;
        }

        // Build where clause for announcements
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (!includeAll) {
            where.isPublished = true;
        }

        if (category) {
            where.category = { slug: category };
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { content: { contains: search, mode: "insensitive" } },
            ];
        }

        // Filter by site through the junction table
        if (resolvedSiteId) {
            where.sites = {
                some: { siteId: resolvedSiteId },
            };
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
                    sites: resolvedSiteId ? {
                        where: { siteId: resolvedSiteId },
                        include: {
                            site: { select: { id: true, name: true, slug: true } },
                        },
                    } : {
                        include: {
                            site: { select: { id: true, name: true, slug: true } },
                        },
                    },
                    author: { select: { id: true, name: true } },
                },
            }),
            prisma.announcement.count({ where }),
        ]);

        // Transform to include site info
        const data = announcements.map((a) => ({
            ...a,
            primarySite: a.sites.find((s) => s.isPrimary)?.site || a.sites[0]?.site || null,
            siteCount: a.sites.length,
        }));

        const response = NextResponse.json({
            data,
            pagination: {
                page: Math.floor(skip / limit) + 1,
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
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            title,
            content,
            categoryId,
            imagePath,
            videoPath,
            videoType,
            youtubeUrl,
            isHero,
            isPinned,
            isPublished,
            scheduledAt,
            takedownAt,
            siteIds,        // Array of site IDs to publish to
            primarySiteId,  // Which site is the primary (for canonical URL)
        } = body;

        if (!title || !content || !categoryId) {
            return NextResponse.json(
                { error: "Title, content, and category are required" },
                { status: 400 }
            );
        }

        // Validate site IDs - auto-assign default site if not provided (backward compatibility)
        let resolvedSiteIds = siteIds;
        if (!resolvedSiteIds || resolvedSiteIds.length === 0) {
            // Find default site for backward compatibility
            const defaultSite = await prisma.site.findFirst({
                where: { isDefault: true },
                select: { id: true },
            });
            if (defaultSite) {
                resolvedSiteIds = [defaultSite.id];
            } else {
                // Get first site if no default
                const firstSite = await prisma.site.findFirst({
                    where: { isActive: true },
                    select: { id: true },
                });
                if (firstSite) {
                    resolvedSiteIds = [firstSite.id];
                } else {
                    return NextResponse.json(
                        { error: "No sites available. Please create a site first." },
                        { status: 400 }
                    );
                }
            }
        }

        // Check user has permission to publish to all specified sites
        const userId = session.user.id;
        for (const sId of resolvedSiteIds) {
            const canEdit = await canEditOnSite(userId, sId);
            if (!canEdit) {
                return NextResponse.json(
                    { error: `No permission to publish to site ${sId}` },
                    { status: 403 }
                );
            }
        }

        // Generate unique slug
        let slug = slugify(title);
        const existingSlug = await prisma.announcement.findUnique({ where: { slug } });
        if (existingSlug) {
            slug = `${slug}-${Date.now()}`;
        }

        // Generate excerpt
        const excerpt = generateExcerpt(content);

        // Create announcement with site associations in a transaction
        const announcement = await prisma.$transaction(async (tx) => {
            const newAnnouncement = await tx.announcement.create({
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
                    authorId: userId,
                },
            });

            // Create site associations (syndication)
            const actualPrimarySiteId = primarySiteId || resolvedSiteIds[0];
            for (const sId of resolvedSiteIds) {
                await tx.announcementSite.create({
                    data: {
                        announcementId: newAnnouncement.id,
                        siteId: sId,
                        isPrimary: sId === actualPrimarySiteId,
                    },
                });
            }

            return newAnnouncement;
        });

        // Fetch full announcement with relations
        const fullAnnouncement = await prisma.announcement.findUnique({
            where: { id: announcement.id },
            include: {
                category: true,
                author: { select: { id: true, name: true, email: true } },
                sites: {
                    include: {
                        site: { select: { id: true, name: true, slug: true } },
                    },
                },
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "CREATE",
                entityType: "ANNOUNCEMENT",
                entityId: announcement.id,
                userId,
                siteId: primarySiteId || resolvedSiteIds[0],
                changes: JSON.stringify({ title, categoryId, siteIds: resolvedSiteIds }),
            },
        });

        return NextResponse.json(fullAnnouncement, { status: 201 });
    } catch (error) {
        console.error("Error creating announcement:", error);
        return NextResponse.json(
            { error: "Failed to create announcement" },
            { status: 500 }
        );
    }
}
