/**
 * Site Health API Route
 * GET - Get site health metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessSite } from '@/lib/site-access';

interface RouteParams {
    params: Promise<{ id: string }>;
}

interface HealthMetrics {
    viewsLast7d: number;
    draftCount: number;
    pendingComments: number;
    scheduledPosts: number;
    totalAnnouncements: number;
    totalCategories: number;
    totalSubscribers: number;
    lastActivityAt: string | null;
}

interface HealthResponse {
    status: 'good' | 'warning' | 'critical';
    metrics: HealthMetrics;
}

// GET /api/sites/[id]/health
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user can access this site
        const canAccess = await canAccessSite(session.user.id, id);
        if (!canAccess) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        // Get site to verify it exists
        const site = await prisma.site.findUnique({
            where: { id },
        });

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        // Calculate health metrics
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Views last 7 days
        const viewsResult = await prisma.analytics.aggregate({
            where: {
                siteId: id,
                date: { gte: sevenDaysAgo },
            },
            _sum: { pageViews: true },
        });
        const viewsLast7d = viewsResult._sum.pageViews || 0;

        // Draft count (announcements not published, linked to this site)
        const draftCount = await prisma.announcementSite.count({
            where: {
                siteId: id,
                announcement: { isPublished: false },
            },
        });

        // Pending comments
        const pendingComments = await prisma.comment.count({
            where: {
                status: 'PENDING',
                announcement: {
                    sites: { some: { siteId: id } },
                },
            },
        });

        // Scheduled posts
        const scheduledPosts = await prisma.announcementSite.count({
            where: {
                siteId: id,
                announcement: {
                    scheduledAt: { gt: new Date() },
                    isPublished: false,
                },
            },
        });

        // Total announcements
        const totalAnnouncements = await prisma.announcementSite.count({
            where: { siteId: id },
        });

        // Total categories
        const totalCategories = await prisma.category.count({
            where: { siteId: id },
        });

        // Total subscribers
        const totalSubscribers = await prisma.newsletterSubscriber.count({
            where: { siteId: id, isActive: true },
        });

        // Last activity
        const lastActivity = await prisma.activityLog.findFirst({
            where: { siteId: id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        const metrics: HealthMetrics = {
            viewsLast7d,
            draftCount,
            pendingComments,
            scheduledPosts,
            totalAnnouncements,
            totalCategories,
            totalSubscribers,
            lastActivityAt: lastActivity?.createdAt.toISOString() || null,
        };

        // Determine health status
        let status: 'good' | 'warning' | 'critical' = 'good';

        if (draftCount > 10 || pendingComments > 20) {
            status = 'critical';
        } else if (draftCount > 5 || pendingComments > 10) {
            status = 'warning';
        }

        // Check last activity
        if (lastActivity) {
            const daysSinceActivity = Math.floor(
                (Date.now() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceActivity > 14) {
                status = 'critical';
            } else if (daysSinceActivity > 7 && status === 'good') {
                status = 'warning';
            }
        }

        const response: HealthResponse = { status, metrics };
        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching site health:', error);
        return NextResponse.json({ error: 'Failed to fetch site health' }, { status: 500 });
    }
}
