import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentSiteId } from "@/lib/site-context";
import { canAccessSite } from "@/lib/site-access";
import { Prisma } from "@prisma/client";
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from "date-fns";

// GET /api/analytics - Get analytics data (scoped to the current site)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get("days") || "30");

        const startDate = startOfDay(subDays(new Date(), days));
        const endDate = endOfDay(new Date());

        // Resolve site scope from the admin cookie. When set, every query below is
        // restricted to that site so analytics never mix data across sites.
        const siteId = await getCurrentSiteId();
        if (siteId && !(await canAccessSite(session.user.id, siteId))) {
            return NextResponse.json({ error: "No access to this site" }, { status: 403 });
        }
        // Reusable filters
        const analyticsSiteWhere: Prisma.AnalyticsWhereInput = siteId ? { siteId } : {};
        const announcementSiteWhere: Prisma.AnnouncementWhereInput = siteId
            ? { sites: { some: { siteId } } }
            : {};

        // Check if Analytics table has data (for this site)
        const analyticsCount = await prisma.analytics.count({ where: analyticsSiteWhere });
        const hasAnalyticsData = analyticsCount > 0;

        let dailyViews: { date: string; pageViews: number; uniqueVisitors: number }[] = [];
        let topArticlesData: { id: string; title: string; views: number; category?: { name: string; color: string } }[] = [];

        if (hasAnalyticsData) {
            // Get daily views from Analytics table
            const rawDailyViews = await prisma.analytics.groupBy({
                by: ["date"],
                where: {
                    date: { gte: startDate, lte: endDate },
                    ...analyticsSiteWhere,
                },
                _sum: {
                    pageViews: true,
                    uniqueVisitors: true,
                },
                orderBy: { date: "asc" },
            });

            dailyViews = rawDailyViews.map((d) => ({
                date: format(d.date, "yyyy-MM-dd"),
                pageViews: d._sum.pageViews || 0,
                uniqueVisitors: d._sum.uniqueVisitors || 0,
            }));

            // Get top articles from Analytics
            const topFromAnalytics = await prisma.analytics.groupBy({
                by: ["announcementId"],
                where: {
                    announcementId: { not: null },
                    date: { gte: startDate, lte: endDate },
                    ...analyticsSiteWhere,
                },
                _sum: { pageViews: true },
                orderBy: { _sum: { pageViews: "desc" } },
                take: 10,
            });

            const topArticleIds = topFromAnalytics
                .map((a) => a.announcementId)
                .filter((id): id is string => id !== null);

            const announcements = await prisma.announcement.findMany({
                where: { id: { in: topArticleIds } },
                select: {
                    id: true,
                    title: true,
                    category: { select: { name: true, color: true } },
                },
            });

            const announcementMap = new Map(announcements.map((a) => [a.id, a]));

            topArticlesData = topFromAnalytics.map((a) => ({
                id: a.announcementId!,
                views: a._sum.pageViews || 0,
                title: announcementMap.get(a.announcementId!)?.title || "Unknown",
                category: announcementMap.get(a.announcementId!)?.category,
            }));
        } else {
            // Fallback: Generate sample daily views from existing viewCount data
            const interval = eachDayOfInterval({ start: startDate, end: endDate });
            const totalViews = await prisma.announcement.aggregate({
                _sum: { viewCount: true },
                where: announcementSiteWhere,
            });
            const avgDailyViews = Math.round((totalViews._sum.viewCount || 0) / days);

            dailyViews = interval.slice(-Math.min(days, 30)).map((date, index) => ({
                date: format(date, "yyyy-MM-dd"),
                pageViews: Math.max(0, avgDailyViews + Math.floor(Math.random() * 5) - 2), // slight variation
                uniqueVisitors: Math.max(0, Math.floor(avgDailyViews * 0.7)),
            }));

            // Fallback: Get top articles from viewCount field
            const topByViewCount = await prisma.announcement.findMany({
                where: { isPublished: true, ...announcementSiteWhere },
                orderBy: { viewCount: "desc" },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    viewCount: true,
                    category: { select: { name: true, color: true } },
                },
            });

            topArticlesData = topByViewCount.map((a) => ({
                id: a.id,
                title: a.title,
                views: a.viewCount,
                category: a.category,
            }));
        }

        // Get category distribution from viewCount, scoped to the site when set.
        // Categories belong to one site; announcements link to sites via the junction.
        const categoryViews = (siteId
            ? await prisma.$queryRaw`
                SELECT c.name, c.color, COALESCE(SUM(a."viewCount"), 0) as views
                FROM categories c
                LEFT JOIN announcements a
                    ON a."categoryId" = c.id AND a."isPublished" = true
                    AND EXISTS (
                        SELECT 1 FROM announcement_sites s
                        WHERE s."announcementId" = a.id AND s."siteId" = ${siteId}
                    )
                WHERE c."siteId" = ${siteId}
                GROUP BY c.id, c.name, c.color
                ORDER BY views DESC`
            : await prisma.$queryRaw`
                SELECT c.name, c.color, COALESCE(SUM(a."viewCount"), 0) as views
                FROM categories c
                LEFT JOIN announcements a ON a."categoryId" = c.id AND a."isPublished" = true
                GROUP BY c.id, c.name, c.color
                ORDER BY views DESC`
        ) as { name: string; color: string; views: bigint }[];

        // Get totals (scoped)
        const totalViews = await prisma.announcement.aggregate({
            _sum: { viewCount: true },
            where: announcementSiteWhere,
        });

        const publishedCount = await prisma.announcement.count({
            where: { isPublished: true, ...announcementSiteWhere },
        });

        return NextResponse.json({
            dailyViews,
            topArticles: topArticlesData,
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
            hasAnalyticsData,
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

        // Attribute the view to the article's primary site so analytics is scoped.
        const primary = await prisma.announcementSite.findFirst({
            where: { announcementId },
            orderBy: { isPrimary: "desc" },
            select: { siteId: true },
        });

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
                siteId: primary?.siteId ?? null,
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
