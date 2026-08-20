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
    lastPublishedAt: string | null;
    publishedAnnouncements: number;
    totalViews: number;
    totalUsers: number;
}

interface HealthReason {
    /** Ringkas, tampil di daftar alasan */
    label: string;
    /** Tingkat kontribusi terhadap status akhir */
    level: 'warning' | 'critical';
    /** Angka pendukung supaya admin tahu dasar penilaiannya */
    detail: string;
    /** Saran tindakan konkret */
    action: string;
}

interface HealthResponse {
    status: 'good' | 'warning' | 'critical';
    /** Alasan kenapa status seperti itu — kosong berarti sehat */
    reasons: HealthReason[];
    /** Ringkasan satu kalimat untuk ditampilkan langsung */
    summary: string;
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

        // Published announcements
        const publishedAnnouncements = await prisma.announcementSite.count({
            where: {
                siteId: id,
                announcement: { isPublished: true },
            },
        });

        // Total views
        const totalViewsResult = await prisma.analytics.aggregate({
            where: { siteId: id },
            _sum: { pageViews: true },
        });
        const totalViews = totalViewsResult._sum.pageViews || 0;

        // Total categories
        const totalCategories = await prisma.category.count({
            where: { siteId: id },
        });

        // Total subscribers
        const totalSubscribers = await prisma.newsletterSubscriber.count({
            where: { siteId: id, isActive: true },
        });

        // Total users (users who have access to this site)
        const totalUsers = await prisma.userSiteAccess.count({
            where: { siteId: id },
        });

        // Last activity
        const lastActivity = await prisma.activityLog.findFirst({
            where: { siteId: id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        // Tanggal terbit artikel terakhir — sinyal basi konten yang reliabel.
        // ActivityLog tidak dipakai untuk ini karena mayoritas penulisannya tidak mengisi siteId.
        const lastPublished = await prisma.announcementSite.findFirst({
            where: {
                siteId: id,
                announcement: { isPublished: true },
            },
            orderBy: { announcement: { createdAt: 'desc' } },
            select: { announcement: { select: { createdAt: true } } },
        });
        const lastPublishedAt = lastPublished?.announcement.createdAt ?? null;

        const metrics: HealthMetrics = {
            viewsLast7d,
            draftCount,
            pendingComments,
            scheduledPosts,
            totalAnnouncements,
            publishedAnnouncements,
            totalViews,
            totalCategories,
            totalSubscribers,
            totalUsers,
            lastActivityAt: lastActivity?.createdAt.toISOString() || null,
            lastPublishedAt: lastPublishedAt?.toISOString() || null,
        };

        // Tentukan status kesehatan + alasannya.
        //
        // Aturan lama menandai site "kritis" hanya karena ActivityLog terakhir >14 hari.
        // Itu menyesatkan: dari 20 penulisan ActivityLog di repo ini hanya 2 yang mengisi
        // siteId, jadi ketiadaan log TIDAK berarti site menganggur — sinyalnya memang tidak
        // terekam. Site tanpa log sama sekali (mis. baru dibuat) juga ikut jadi "kritis"
        // padahal tidak ada yang salah. Sekarang basi-nya konten hanya berstatus 'warning',
        // dan hanya dihitung bila site memang punya konten terbit.
        const reasons: HealthReason[] = [];

        if (draftCount > 10) {
            reasons.push({
                label: 'Draf menumpuk',
                level: 'critical',
                detail: `${draftCount} artikel masih berstatus draf (batas wajar 10).`,
                action: 'Tinjau dan terbitkan atau hapus draf yang sudah tidak relevan.',
            });
        } else if (draftCount > 5) {
            reasons.push({
                label: 'Draf mulai menumpuk',
                level: 'warning',
                detail: `${draftCount} artikel masih berstatus draf (batas wajar 5).`,
                action: 'Selesaikan draf yang tertunda agar tidak menumpuk.',
            });
        }

        if (pendingComments > 20) {
            reasons.push({
                label: 'Komentar menunggu moderasi',
                level: 'critical',
                detail: `${pendingComments} komentar belum dimoderasi (batas wajar 20).`,
                action: 'Buka halaman moderasi komentar dan proses antrean.',
            });
        } else if (pendingComments > 10) {
            reasons.push({
                label: 'Antrean moderasi bertambah',
                level: 'warning',
                detail: `${pendingComments} komentar belum dimoderasi (batas wajar 10).`,
                action: 'Moderasi komentar yang tertunda.',
            });
        }

        // Basi konten: pakai tanggal terbit artikel, bukan ActivityLog yang tidak reliabel.
        // Hanya relevan untuk site yang memang sudah pernah menerbitkan konten.
        if (publishedAnnouncements > 0 && lastPublishedAt) {
            const daysSincePublish = Math.floor(
                (Date.now() - lastPublishedAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSincePublish > 30) {
                reasons.push({
                    label: 'Belum ada konten baru',
                    level: 'warning',
                    detail: `Artikel terbit terakhir ${daysSincePublish} hari lalu.`,
                    action: 'Terbitkan konten baru bila site ini masih aktif digunakan.',
                });
            }
        }

        const hasCritical = reasons.some((r) => r.level === 'critical');
        const status: 'good' | 'warning' | 'critical' = hasCritical
            ? 'critical'
            : reasons.length > 0
              ? 'warning'
              : 'good';

        const summary =
            status === 'good'
                ? 'Tidak ada masalah terdeteksi.'
                : reasons.map((r) => r.label).join(' · ');

        const response: HealthResponse = { status, reasons, summary, metrics };
        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching site health:', error);
        return NextResponse.json({ error: 'Failed to fetch site health' }, { status: 500 });
    }
}
