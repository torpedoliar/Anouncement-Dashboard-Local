"use client";

/**
 * Global Analytics Page
 * Cross-site analytics dashboard for SuperAdmin.
 *
 * NOTE: This page is SuperAdmin/cross-site, so --site-primary (the active
 * masthead accent) is NOT the singular accent here — each site's own
 * `primaryColor` is used per-card/per-bar via DB-driven inline styles.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ArrowClockwise,
    Globe,
    FileText,
    Users,
    Eye,
    TrendUp,
    ChartBar,
} from "@phosphor-icons/react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { getChartTheme } from "@/lib/chart-theme";
import StatTile from "@/components/admin/StatTile";
import ChartTooltip from "@/components/admin/ChartTooltip";
import Button from "@/components/ui/Button";

interface SiteStats {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
    stats: {
        totalAnnouncements: number;
        publishedAnnouncements: number;
        totalViews: number;
        totalCategories: number;
        totalUsers: number;
    };
}

interface GlobalStats {
    totalSites: number;
    totalAnnouncements: number;
    totalViews: number;
    totalCategories: number;
    totalUsers: number;
    siteStats: SiteStats[];
}

const CHART_METRICS = [
    { key: "Articles", label: "Artikel" },
    { key: "Views", label: "Views" },
    { key: "Categories", label: "Kategori" },
    { key: "Users", label: "Users" },
] as const;

type ChartMetricKey = (typeof CHART_METRICS)[number]["key"];

export default function GlobalAnalyticsPage() {
    const router = useRouter();
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch all sites with their health metrics
            const sitesRes = await fetch("/api/sites");
            if (!sitesRes.ok) throw new Error("Failed to fetch sites");
            const sites = await sitesRes.json();

            // Fetch health for each site
            const siteStatsPromises = sites.map(async (site: { id: string; name: string; slug: string; primaryColor: string }) => {
                try {
                    const healthRes = await fetch(`/api/sites/${site.id}/health`);
                    if (healthRes.ok) {
                        const health = await healthRes.json();
                        const metrics = health.metrics || {};
                        return {
                            ...site,
                            stats: {
                                totalAnnouncements: metrics.totalAnnouncements || 0,
                                publishedAnnouncements: metrics.publishedAnnouncements || 0,
                                totalViews: metrics.totalViews || 0,
                                totalCategories: metrics.totalCategories || 0,
                                totalUsers: metrics.totalUsers || 0,
                            },
                        };
                    }
                } catch {
                    // Ignore individual site errors
                }
                return {
                    ...site,
                    stats: { totalAnnouncements: 0, publishedAnnouncements: 0, totalViews: 0, totalCategories: 0, totalUsers: 0 },
                };
            });

            const siteStats: SiteStats[] = await Promise.all(siteStatsPromises);

            // Calculate totals
            const globalStats: GlobalStats = {
                totalSites: sites.length,
                totalAnnouncements: siteStats.reduce((sum, s) => sum + s.stats.totalAnnouncements, 0),
                totalViews: siteStats.reduce((sum, s) => sum + s.stats.totalViews, 0),
                totalCategories: siteStats.reduce((sum, s) => sum + s.stats.totalCategories, 0),
                totalUsers: siteStats.reduce((sum, s) => sum + s.stats.totalUsers, 0),
                siteStats,
            };

            setStats(globalStats);
        } catch (err) {
            console.error("Failed to fetch global stats:", err);
            setError("Failed to load analytics");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Chart chrome resolved from the first site's accent (fallback otherwise).
    const ct = getChartTheme(stats?.siteStats?.[0]?.primaryColor);

    const chartData: (Record<ChartMetricKey, number> & { name: string; primaryColor: string })[] =
        stats?.siteStats.map((site) => ({
            name: site.name,
            primaryColor: site.primaryColor,
            Articles: site.stats.publishedAnnouncements,
            Views: site.stats.totalViews,
            Categories: site.stats.totalCategories,
            Users: site.stats.totalUsers,
        })) || [];

    return (
        <div className="min-h-screen bg-surface-1 text-text-1">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-8 py-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.back()}
                        aria-label="Kembali"
                    >
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-text-1">
                            <ChartBar size={24} aria-hidden="true" />
                            Global Analytics
                        </h1>
                        <p className="text-[13px] text-text-3">Cross-site performance overview</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchStats}
                    disabled={isLoading}
                    aria-label="Muat ulang data"
                >
                    <ArrowClockwise size={16} className={isLoading ? "animate-spin" : ""} />
                    Refresh
                </Button>
            </div>

            <div className="mx-auto max-w-[1400px] p-8">
                {error && (
                    <div className="mb-8 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                        {error}
                    </div>
                )}

                {isLoading && !stats ? (
                    <div className="space-y-8">
                        {/* Stat tiles skeleton */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-24 animate-pulse rounded-card bg-surface-2" aria-hidden="true" />
                            ))}
                        </div>
                        {/* Site cards skeleton */}
                        <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-40 animate-pulse rounded-card border border-border bg-surface-1" aria-hidden="true" />
                            ))}
                        </div>
                    </div>
                ) : !stats || stats.siteStats.length === 0 ? (
                    <div className="rounded-card border border-border bg-surface-1 p-12 text-center">
                        <Globe size={48} weight="duotone" className="mx-auto mb-4 text-text-3" aria-hidden="true" />
                        <h3 className="mb-2 font-display text-lg font-semibold text-text-1">
                            Tidak Ada Situs
                        </h3>
                        <p className="text-text-3">Belum ada situs untuk ditampilkan.</p>
                    </div>
                ) : (
                    <>
                        {/* Global Stat Tiles */}
                        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            <StatTile icon={Globe} label="Sites" value={stats.totalSites} />
                            <StatTile icon={FileText} label="Articles" value={stats.totalAnnouncements} />
                            <StatTile icon={Eye} label="Total Views" value={stats.totalViews} />
                            <StatTile icon={ChartBar} label="Categories" value={stats.totalCategories} />
                            <StatTile icon={Users} label="Users" value={stats.totalUsers} />
                        </div>

                        {/* Masthead comparison strip */}
                        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-text-1">
                            <TrendUp size={20} aria-hidden="true" />
                            Per-Site Performance
                        </h2>
                        <div className="mb-8 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
                            {stats.siteStats.map((site) => (
                                <Link
                                    key={site.id}
                                    href={`/admin/sites/${site.id}`}
                                    className="block rounded-card border border-border bg-surface-1 p-5 transition-shadow duration-150 hover:shadow-lvl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                >
                                    <div className="mb-4 flex items-center gap-3">
                                        <span
                                            className="h-3.5 w-3.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: site.primaryColor }}
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0">
                                            <h3 className="truncate font-display text-base font-semibold text-text-1">
                                                {site.name}
                                            </h3>
                                            <p className="font-mono text-[12px] text-text-3">
                                                /site/{site.slug}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-3 border-t border-border pt-4">
                                        <div className="text-center">
                                            <p className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                                {site.stats.publishedAnnouncements.toLocaleString("id-ID")}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-wider text-text-3">
                                                Articles
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                                {site.stats.totalViews.toLocaleString("id-ID")}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-wider text-text-3">
                                                Views
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                                {site.stats.totalCategories.toLocaleString("id-ID")}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-wider text-text-3">
                                                Categories
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                                {site.stats.totalUsers.toLocaleString("id-ID")}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-wider text-text-3">
                                                Users
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {/* Grouped bar chart — site-accent per bar */}
                        <section className="rounded-card border border-border bg-surface-1 p-5">
                            <h3 className="mb-2 font-display text-sm font-semibold text-text-1">
                                Perbandingan Metrik per Situs
                            </h3>
                            {/* Site → color legend: each bar fill follows that site's primaryColor */}
                            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-3">
                                {stats.siteStats.map((site) => (
                                    <span key={site.id} className="flex items-center gap-1.5">
                                        <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: site.primaryColor }}
                                            aria-hidden="true"
                                        />
                                        {site.name}
                                    </span>
                                ))}
                            </div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                                    <XAxis dataKey="name" stroke={ct.tick} fontSize={11} interval={0} tickFormatter={(v) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)} />
                                    <YAxis stroke={ct.tick} fontSize={11} />
                                    <Tooltip content={<ChartTooltip />} />
                                    {CHART_METRICS.map(({ key }) => (
                                        <Bar key={key} dataKey={key} radius={[3, 3, 0, 0]}>
                                            {chartData.map((entry, idx) => (
                                                <Cell key={`${key}-${idx}`} fill={entry.primaryColor} />
                                            ))}
                                        </Bar>
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                            {/* Legend (recharts <Legend> can't capture per-<Cell> colors) */}
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-text-3">
                                {CHART_METRICS.map(({ key, label }) => (
                                    <span key={key} className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-text-3" aria-hidden="true" />
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
