"use client";

import { useState, useEffect } from "react";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { TrendUp, Eye, FileText, Warning } from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { getChartTheme } from "@/lib/chart-theme";
import Select from "@/components/ui/Select";
import StatTile from "./StatTile";
import ChartTooltip from "./ChartTooltip";

interface DailyView {
    date: string;
    pageViews: number;
    uniqueVisitors: number;
}

interface TopArticle {
    id: string;
    title: string;
    views: number;
    category?: { name: string; color: string };
}

interface CategoryDistribution {
    name: string;
    color: string;
    views: number;
    [key: string]: string | number;
}

interface AnalyticsSummary {
    totalViews: number;
    publishedArticles: number;
    avgViewsPerArticle: number;
}

interface AnalyticsData {
    dailyViews: DailyView[];
    topArticles: TopArticle[];
    categoryDistribution: CategoryDistribution[];
    summary: AnalyticsSummary;
    hasAnalyticsData?: boolean;
}

const DAY_RANGE_OPTIONS = [
    { value: "7", label: "7 hari terakhir" },
    { value: "30", label: "30 hari terakhir" },
    { value: "90", label: "90 hari terakhir" },
];

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [days, setDays] = useState(30);
    const { showToast } = useToast();
    const { theme } = useSiteTheme();
    const chartTheme = getChartTheme(theme.primaryColor);

    useEffect(() => {
        fetchAnalytics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/analytics?days=${days}`);
            if (response.ok) {
                const result = await response.json();
                setData(result);
            } else {
                showToast("Gagal memuat analytics", "error");
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
            showToast("Gagal memuat analytics", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <Header days={days} onDaysChange={setDays} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-sheet bg-surface-2" aria-hidden="true" />
                    ))}
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-80 animate-pulse rounded-sheet bg-surface-2" aria-hidden="true" />
                    ))}
                </div>
            </div>
        );
    }

    if (!data) return null;

    const categoryData = data.categoryDistribution.filter((c) => c.views > 0);

    return (
        <div className="p-6">
            <Header days={days} onDaysChange={setDays} />

            {/* Notice when no detailed analytics */}
            {!data.hasAnalyticsData && (
                <div className="mb-6 flex items-start gap-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3">
                    <Warning size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                    <p className="text-sm text-warning">Data menggunakan estimasi dari total views.</p>
                </div>
            )}

            {/* Summary tiles */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile icon={Eye} label="Total Views" value={data.summary.totalViews} />
                <StatTile icon={FileText} label="Artikel Published" value={data.summary.publishedArticles} />
                <StatTile icon={TrendUp} label="Rata-rata Views" value={data.summary.avgViewsPerArticle} />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Line Chart - Daily Views */}
                <section className="rounded-card border border-border bg-surface-1 p-5">
                    <h3 className="mb-4 font-display text-sm font-semibold text-text-1">Views Harian</h3>
                    {data.dailyViews.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={data.dailyViews}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                                <XAxis
                                    dataKey="date"
                                    stroke={chartTheme.tick}
                                    fontSize={11}
                                    tickFormatter={(value) => value.slice(5)}
                                />
                                <YAxis stroke={chartTheme.tick} fontSize={11} />
                                <Tooltip content={<ChartTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="pageViews"
                                    stroke={chartTheme.primary}
                                    strokeWidth={2}
                                    dot={{ fill: chartTheme.primary, strokeWidth: 0, r: 3 }}
                                    name="Views"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartMessage message="Belum ada data views harian" />
                    )}
                </section>

                {/* Bar Chart - Top Articles */}
                <section className="rounded-card border border-border bg-surface-1 p-5">
                    <h3 className="mb-4 font-display text-sm font-semibold text-text-1">Top 10 Artikel</h3>
                    {data.topArticles.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={data.topArticles.slice(0, 10)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                                <XAxis type="number" stroke={chartTheme.tick} fontSize={11} />
                                <YAxis
                                    type="category"
                                    dataKey="title"
                                    stroke={chartTheme.tick}
                                    fontSize={10}
                                    width={120}
                                    tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + "..." : value}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="views" fill={chartTheme.primary} radius={[0, 4, 4, 0]} name="Views" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartMessage message="Belum ada artikel" />
                    )}
                </section>

                {/* Pie Chart - Category Distribution */}
                <section className="rounded-card border border-border bg-surface-1 p-5">
                    <h3 className="mb-4 font-display text-sm font-semibold text-text-1">Distribusi Kategori</h3>
                    {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    dataKey="views"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                    labelLine={false}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartMessage message="Belum ada data kategori" />
                    )}
                </section>

                {/* Top Articles List */}
                <section className="rounded-card border border-border bg-surface-1 p-5">
                    <h3 className="mb-4 font-display text-sm font-semibold text-text-1">Artikel Terpopuler</h3>
                    {data.topArticles.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {data.topArticles.slice(0, 5).map((article, index) => (
                                <div
                                    key={article.id}
                                    className="flex items-center gap-3 rounded-card border border-border bg-surface-1 p-3"
                                >
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control font-mono text-xs font-semibold ${index === 0 ? "bg-accent text-[var(--site-text-on-primary)]" : "bg-surface-2 text-text-2"}`}>
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-text-1">
                                            {article.title}
                                        </p>
                                        {article.category && (
                                            <span className="text-xs" style={{ color: article.category.color }}>
                                                {article.category.name}
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-mono text-sm font-semibold tabular-nums text-text-2">
                                        {article.views.toLocaleString("id-ID")} views
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyChartMessage message="Belum ada artikel" />
                    )}
                </section>
            </div>
        </div>
    );
}

function Header({ days, onDaysChange }: {
    days: number;
    onDaysChange: (days: number) => void;
}) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="mb-0.5 text-xs font-semibold tracking-wider text-accent">ANALYTICS</p>
                <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-text-1">
                    <TrendUp size={24} aria-hidden="true" /> Statistik
                </h1>
            </div>
            <Select
                value={String(days)}
                onChange={(e) => onDaysChange(Number(e.target.value))}
                aria-label="Rentang hari"
                className="sm:w-48"
                options={DAY_RANGE_OPTIONS}
            />
        </div>
    );
}

function EmptyChartMessage({ message }: { message: string }) {
    return (
        <div className="flex h-[250px] items-center justify-center rounded-card border border-border bg-surface-1 text-sm text-text-3">
            {message}
        </div>
    );
}