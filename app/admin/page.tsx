import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowRight, PencilSimple, PlusCircle, PushPin } from "@/components/ui/client-icons";
import Badge from "@/components/ui/Badge";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { runScheduler } from "@/lib/scheduler";
import { resolveAdminSiteId } from "@/lib/site-context";
import { deriveAnnouncementStatus } from "@/lib/announcement-status";
import StatusPill from "@/components/ui/StatusPill";
import Sparkline from "@/components/admin/Sparkline";
import { startOfDay, subDays, format, eachDayOfInterval } from "date-fns";

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

/**
 * Tren views 14 hari (tabel Analytics per-site) untuk sparkline status strip.
 * Delta = total 7 hari terakhir vs 7 hari sebelumnya, dalam persen.
 */
async function getViewsTrend(siteId: string | null) {
    if (!siteId) return { points: [] as number[], delta: null as number | null };

    const since = startOfDay(subDays(new Date(), 13));
    const rows = await prisma.analytics.groupBy({
        by: ["date"],
        where: { siteId, date: { gte: since } },
        _sum: { pageViews: true },
        orderBy: { date: "asc" },
    });

    const byDay = new Map(rows.map((r) => [format(r.date, "yyyy-MM-dd"), r._sum.pageViews ?? 0]));
    const points = eachDayOfInterval({ start: since, end: new Date() }).map(
        (d) => byDay.get(format(d, "yyyy-MM-dd")) ?? 0
    );

    const prev = points.slice(0, 7).reduce((a, b) => a + b, 0);
    const curr = points.slice(7).reduce((a, b) => a + b, 0);
    const delta = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

    return { points, delta };
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
    { label: "Total artikel", key: "total" as const },
    { label: "Terbit", key: "published" as const },
    { label: "Draf", key: "drafts" as const },
    { label: "Total views", key: "totalViews" as const },
];

export default async function AdminDashboard() {
    // Run auto-scheduler check
    await runScheduler();

    const siteId = await resolveAdminSiteId();
    const [stats, recentAnnouncements, viewsTrend] = await Promise.all([
        getStats(siteId),
        getRecentAnnouncements(siteId),
        getViewsTrend(siteId),
    ]);

    return (
        <div className="p-8">
            {/* Header — judul besar + aksi kontekstual, tanpa eyebrow. */}
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="font-display text-title font-bold text-text-1">Dashboard</h1>
                    <p className="mt-1 text-small text-text-2">
                        Ringkasan konten dan aktivitas terbaru.
                    </p>
                </div>
                <Link
                    href="/admin/announcements/new"
                    className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-small font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                >
                    <PlusCircle weight="bold" size={16} />
                    Buat Pengumuman
                </Link>
            </div>

            {/* Status strip — satu baris padat menggantikan empat kartu identik.
                Angka mono besar, label kecil di bawah, dipisah divide. */}
            <section
                aria-label="Statistik konten"
                className="mb-8 grid grid-cols-2 divide-border overflow-hidden rounded-card border border-border bg-surface-1 sm:grid-cols-4 sm:divide-x"
                style={{ animation: "cine-rise var(--motion-slow) var(--motion-ease) both" }}
            >
                {statConfig.map(({ label, key }) => (
                    <div key={label} className="px-6 py-5">
                        <p className="font-mono text-2xl font-bold tabular-nums leading-none text-text-1">
                            {formatNumber(stats[key])}
                        </p>
                        <p className="mt-2 text-caption text-text-3">
                            {label}
                            {/* Delta 7-hari hanya di segmen views, di samping label. */}
                            {key === "totalViews" && viewsTrend.delta !== null && (
                                <span
                                    className={`ml-1.5 font-mono tabular-nums ${
                                        viewsTrend.delta >= 0 ? "text-success" : "text-danger"
                                    }`}
                                >
                                    {viewsTrend.delta >= 0 ? "+" : ""}
                                    {viewsTrend.delta}%
                                </span>
                            )}
                        </p>
                        {key === "totalViews" && viewsTrend.points.length > 1 && (
                            <Sparkline points={viewsTrend.points} className="mt-3 h-7 w-full" />
                        )}
                    </div>
                ))}
            </section>

            {/* Recent Announcements Ledger */}
            <div className="bg-surface-1 border border-border rounded-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <h2 className="font-display text-heading font-semibold text-text-1">Pengumuman Terbaru</h2>
                    <Link
                        href="/admin/announcements"
                        className="inline-flex items-center gap-1.5 text-small font-semibold text-accent transition-opacity duration-150 hover:opacity-80"
                    >
                        Lihat semua
                        <ArrowRight weight="bold" size={14} />
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
                                                <Badge tone="danger">
                                                    <PushPin size={12} />
                                                    Pinned
                                                </Badge>
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
