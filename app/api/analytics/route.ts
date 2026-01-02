import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

// GET /api/analytics - Get analytics data
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get("days") || "30");

        const startDate = startOfDay(subDays(new Date(), days));
        const endDate = endOfDay(new Date());

        // Get daily views
        const dailyViews = await prisma.analytics.groupBy({
            by: ["date"],
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _sum: {
                pageViews: true,
                uniqueVisitors: true,
            },
            orderBy: {
                date: "asc",
            },
        });

        // Get top articles
        const topArticles = await prisma.analytics.groupBy({
            by: ["announcementId"],
            where: {
                announcementId: { not: null },
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _sum: {
                pageViews: true,
            },
            orderBy: {
                _sum: {
                    pageViews: "desc",
                },
            },
            take: 10,
        });

        // Get announcement details for top articles
        const topArticleIds = topArticles
            .map((a) => a.announcementId)
            .filter((id): id is string => id !== null);

        const announcements = await prisma.announcement.findMany({
            where: { id: { in: topArticleIds } },
            select: {
                id: true,
                title: true,
                slug: true,
                category: { select: { name: true, color: true } },
            },
        });

        const announcementMap = new Map(announcements.map((a) => [a.id, a]));

        // Get category distribution
        const categoryViews = await prisma.$queryRaw`
            SELECT c.name, c.color, SUM(a."viewCount") as views
            FROM announcements a
            JOIN categories c ON a."categoryId" = c.id
            WHERE a."isPublished" = true
            GROUP BY c.id, c.name, c.color
            ORDER BY views DESC
        ` as { name: string; color: string; views: bigint }[];

        // Get totals
        const totalViews = await prisma.announcement.aggregate({
            _sum: { viewCount: true },
        });

        const publishedCount = await prisma.announcement.count({
            where: { isPublished: true },
        });

        return NextResponse.json({
            dailyViews: dailyViews.map((d) => ({
                date: format(d.date, "yyyy-MM-dd"),
                pageViews: d._sum.pageViews || 0,
                uniqueVisitors: d._sum.uniqueVisitors || 0,
            })),
            topArticles: topArticles.map((a) => ({
                id: a.announcementId,
                views: a._sum.pageViews || 0,
                ...announcementMap.get(a.announcementId!),
            })),
            categoryDistribution: categoryViews.map((c) => ({
                name: c.name,
                color: c.color,
                views: Number(c.views),
            })),
            summary: {
                totalViews: totalViews._sum.viewCount || 0,
                publishedArticles: publishedCount,
                avgViewsPerArticle: publishedCount > 0
                    ? Math.round((totalViews._sum.viewCount || 0) / publishedCount)
                    : 0,
            },
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}

// POST /api/analytics - Track page view
export async function POST(request: NextRequest) {
    try {
        const { announcementId } = await request.json();

        if (!announcementId) {
            return NextResponse.json({ error: "Announcement ID is required" }, { status: 400 });
        }

        const today = startOfDay(new Date());

        // Upsert analytics record
        await prisma.analytics.upsert({
            where: {
                announcementId_date: {
                    announcementId,
                    date: today,
                },
            },
            update: {
                pageViews: { increment: 1 },
            },
            create: {
                announcementId,
                pageViews: 1,
                uniqueVisitors: 1,
                date: today,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error tracking view:", error);
        return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
    }
}
