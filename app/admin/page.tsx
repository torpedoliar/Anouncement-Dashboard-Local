import prisma from "@/lib/prisma";
import Link from "next/link";
import {
    FiFileText,
    FiEye,
    FiEdit,
    FiTrendingUp,
    FiPlusCircle,
    FiArrowRight
} from "react-icons/fi";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { runScheduler } from "@/lib/scheduler";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentSiteId } from "@/lib/site-context";
import { getDefaultSite } from "@/lib/site-access";

export const dynamic = "force-dynamic";

// Resolve the admin's active site: cookie first, else the user's default site.
// Never returns the "all sites" state, so dashboard stats stay scoped to one site.
async function resolveSiteId(): Promise<string | null> {
    const cookieId = await getCurrentSiteId();
    if (cookieId) return cookieId;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    const fallback = await getDefaultSite(session.user.id);
    return fallback?.id ?? null;
}

async function getStats(siteId: string | null) {
    if (!siteId) {
        return { total: 0, published: 0, drafts: 0, totalViews: 0 };
    }

    const siteFilter = { sites: { some: { siteId } } };
    const [total, published, drafts, totalViews] = await Promise.all([
        prisma.announcement.count({ where: siteFilter }),
        prisma.announcement.count({ where: { ...siteFilter, isPublished: true } }),
        prisma.announcement.count({ where: { ...siteFilter, isPublished: false } }),
        prisma.announcement.aggregate({ _sum: { viewCount: true }, where: siteFilter }),
    ]);

    return {
        total,
        published,
        drafts,
        totalViews: totalViews._sum.viewCount || 0,
    };
}

async function getRecentAnnouncements(siteId: string | null) {
    if (!siteId) return [];
    return prisma.announcement.findMany({
        where: { sites: { some: { siteId } } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
            category: { select: { name: true, color: true } },
        },
    });
}

export default async function AdminDashboard() {
    // Run auto-scheduler check
    await runScheduler();

    const siteId = await resolveSiteId();
    const [stats, recentAnnouncements] = await Promise.all([
        getStats(siteId),
        getRecentAnnouncements(siteId),
    ]);

    const statCards = [
        { icon: FiFileText, label: "TOTAL", value: stats.total, color: "#dc2626" },
        { icon: FiEye, label: "PUBLISHED", value: stats.published, color: "#22c55e" },
        { icon: FiEdit, label: "DRAFT", value: stats.drafts, color: "#eab308" },
        { icon: FiTrendingUp, label: "VIEWS", value: stats.totalViews, color: "#3b82f6" },
    ];

    return (
        <div style={{ padding: '32px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginBottom: '32px',
            }}>
                <div>
                    <p style={{
                        color: '#dc2626',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        marginBottom: '4px',
                    }}>
                        OVERVIEW
                    </p>
                    <h1 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#fff',
                    }}>
                        Dashboard
                    </h1>
                </div>
                <Link
                    href="/admin/announcements/new"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                    }}
                >
                    <FiPlusCircle size={14} />
                    BUAT PENGUMUMAN
                </Link>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '24px',
                marginBottom: '32px',
            }}>
                {statCards.map((stat, index) => (
                    <div
                        key={index}
                        style={{
                            backgroundColor: '#0a0a0a',
                            border: '1px solid #262626',
                            borderLeft: `4px solid ${stat.color}`,
                            borderRadius: '8px',
                            padding: '28px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Gradient background */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '50%',
                            height: '100%',
                            background: `linear-gradient(135deg, transparent 0%, ${stat.color}08 100%)`,
                            pointerEvents: 'none',
                        }} />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '20px',
                                    backgroundColor: `${stat.color}20`,
                                    borderRadius: '12px',
                                    border: `1px solid ${stat.color}40`,
                                    color: stat.color,
                                }}
                            >
                                <stat.icon size={22} />
                            </div>
                            <p style={{
                                color: '#a1a1aa',
                                fontSize: '12px',
                                fontWeight: 700,
                                letterSpacing: '0.15em',
                                marginBottom: '8px',
                            }}>
                                {stat.label}
                            </p>
                            <p style={{
                                fontFamily: 'Montserrat, sans-serif',
                                fontSize: '36px',
                                fontWeight: 800,
                                color: '#fff',
                                lineHeight: 1,
                            }}>
                                {formatNumber(stat.value)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Announcements */}
            <div style={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #1a1a1a',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px',
                    borderBottom: '1px solid #1a1a1a',
                }}>
                    <div>
                        <p style={{
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.2em',
                            marginBottom: '4px',
                        }}>
                            AKTIVITAS
                        </p>
                        <h2 style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 700,
                            color: '#fff',
                        }}>
                            Pengumuman Terbaru
                        </h2>
                    </div>
                    <Link
                        href="/admin/announcements"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                        }}
                    >
                        LIHAT SEMUA
                        <FiArrowRight size={14} />
                    </Link>
                </div>

                {recentAnnouncements.length > 0 ? (
                    <div>
                        {recentAnnouncements.map((announcement) => (
                            <div
                                key={announcement.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #1a1a1a',
                                }}
                            >
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            backgroundColor: `${announcement.category.color}20`,
                                            color: announcement.category.color,
                                            fontSize: '10px',
                                            fontWeight: 600,
                                        }}>
                                            {announcement.category.name.toUpperCase()}
                                        </span>
                                        {announcement.isPinned && (
                                            <span style={{
                                                padding: '4px 8px',
                                                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                                                color: '#dc2626',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                            }}>
                                                PINNED
                                            </span>
                                        )}
                                        {!announcement.isPublished && (
                                            <span style={{
                                                padding: '4px 8px',
                                                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                                                color: '#eab308',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                            }}>
                                                DRAFT
                                            </span>
                                        )}
                                    </div>
                                    <h3 style={{
                                        color: '#fff',
                                        fontWeight: 500,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {announcement.title}
                                    </h3>
                                    <p style={{ color: '#525252', fontSize: '13px' }}>
                                        {formatDateShort(announcement.createdAt)} • {formatNumber(announcement.viewCount)} views
                                    </p>
                                </div>
                                <Link
                                    href={`/admin/announcements/${announcement.id}/edit`}
                                    style={{
                                        padding: '8px',
                                        color: '#737373',
                                    }}
                                >
                                    <FiEdit size={18} />
                                </Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '48px' }}>
                        <p style={{ color: '#525252', marginBottom: '16px' }}>Belum ada pengumuman.</p>
                        <Link
                            href="/admin/announcements/new"
                            style={{ color: '#dc2626', fontWeight: 700 }}
                        >
                            Buat pengumuman pertama &gt;&gt;
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
