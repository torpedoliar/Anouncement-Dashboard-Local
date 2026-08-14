import prisma from "@/lib/prisma";
import Link from "next/link";
import { Files, Eye, PencilSimple, Broadcast } from "@phosphor-icons/react";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { runScheduler } from "@/lib/scheduler";
import { resolveAdminSiteId } from "@/lib/site-context";
import { deriveAnnouncementStatus } from "@/lib/announcement-status";
import StatusPill from "@/components/ui/StatusPill";

export const dynamic = "force-dynamic";

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

const statConfig = [
    { icon: Files, label: "TOTAL", key: "total" as const },
    { icon: Broadcast, label: "PUBLISHED", key: "published" as const },
    { icon: PencilSimple, label: "DRAFT", key: "drafts" as const },
    { icon: Eye, label: "VIEWS", key: "totalViews" as const },
];

export default async function AdminDashboard() {
    // Run auto-scheduler check
    await runScheduler();

    const siteId = await resolveAdminSiteId();
    const [stats, recentAnnouncements] = await Promise.all([
        getStats(siteId),
        getRecentAnnouncements(siteId),
    ]);

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div>
                    <p className="text-accent text-xs font-semibold tracking-widest mb-1">
                        OVERVIEW
                    </p>
                    <h1 className="text-xl font-bold">Dashboard</h1>
                </div>
                <Link
                    href="/admin/announcements/new"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white text-xs font-semibold tracking-widest rounded-control transition-colors duration-150 hover:opacity-90"
                >
                    <Files weight="fill" size={14} />
                    BUAT PENGUMUMAN
                </Link>
            </div>

            {/* Stat Tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statConfig.map(({ icon: Icon, label, key }) => (
                    <div
                        key={label}
                        className="bg-surface-1 border border-border rounded-card shadow-lvl-1 p-7 relative overflow-hidden transition-opacity duration-150"
                    >
                        <div
                            className="w-12 h-12 flex items-center justify-center mb-5 bg-accent-subtle rounded-control"
                        >
                            <Icon size={22} className="text-accent" weight="duotone" />
                        </div>
                        <p className="text-text-2 text-xs font-semibold tracking-widest mb-2">
                            {label}
                        </p>
                        <p className="font-mono tabular-nums text-3xl font-bold text-text-1 leading-none">
                            {formatNumber(stats[key])}
                        </p>
                    </div>
                ))}
            </div>

            {/* Recent Announcements Ledger */}
            <div className="bg-surface-1 border border-border rounded-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <div>
                        <p className="text-accent text-xs font-semibold tracking-widest mb-1">
                            AKTIVITAS
                        </p>
                        <h2 className="text-base font-bold">Pengumuman Terbaru</h2>
                    </div>
                    <Link
                        href="/admin/announcements"
                        className="inline-flex items-center gap-2 text-accent text-xs font-semibold tracking-widest hover:opacity-80 transition-opacity duration-150"
                    >
                        LIHAT SEMUA
                        <Files weight="bold" size={14} />
                    </Link>
                </div>

                {recentAnnouncements.length > 0 ? (
                    <div>
                        {recentAnnouncements.map((announcement) => {
                            const status = deriveAnnouncementStatus({ isPublished: announcement.isPublished });
                            return (
                                <div
                                    key={announcement.id}
                                    className="flex items-center gap-4 px-6 py-5 border-b border-border last:border-b-0 transition-colors duration-150 hover:bg-surface-2"
                                >
                                    {/* Status + Title */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <StatusPill status={status} />
                                            <span
                                                className="text-[10px] font-semibold"
                                                style={{ color: announcement.category.color }}
                                            >
                                                {announcement.category.name.toUpperCase()}
                                            </span>
                                            {announcement.isPinned && (
                                                <span className="inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-xs font-medium bg-danger text-danger">
                                                    <Files size={10} />
                                                    PINNED
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-text-1 text-sm font-medium truncate">
                                            {announcement.title}
                                        </h3>
                                        <p className="text-text-3 text-sm font-mono tabular-nums">
                                            {formatDateShort(announcement.createdAt)} &middot; {formatNumber(announcement.viewCount)} views
                                        </p>
                                    </div>

                                    {/* Edit link */}
                                    <Link
                                        href={`/admin/announcements/${announcement.id}/edit`}
                                        aria-label="Edit pengumuman"
                                        className="p-2 text-text-3 hover:text-text-1 transition-colors duration-150"
                                    >
                                        <PencilSimple size={18} />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-text-3 mb-4">Belum ada pengumuman.</p>
                        <Link
                            href="/admin/announcements/new"
                            className="text-accent font-bold hover:opacity-80 transition-opacity duration-150"
                        >
                            Buat pengumuman pertama &gt;&gt;
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
