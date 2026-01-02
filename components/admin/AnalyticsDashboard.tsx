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
import { FiTrendingUp, FiEye, FiFileText, FiLoader, FiAlertCircle } from "react-icons/fi";
import { useToast } from "@/contexts/ToastContext";

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

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [days, setDays] = useState(30);
    const { showToast } = useToast();

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
            <div style={{
                padding: "32px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "400px",
            }}>
                <FiLoader size={32} style={{ color: "#dc2626", animation: "spin 1s linear infinite" }} />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "32px",
                flexWrap: "wrap",
                gap: "16px",
            }}>
                <div>
                    <p style={{
                        color: "#dc2626",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.2em",
                        marginBottom: "4px",
                    }}>
                        ANALYTICS
                    </p>
                    <h1 style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontSize: "24px",
                        fontWeight: 700,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}>
                        <FiTrendingUp /> Statistik
                    </h1>
                </div>
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    style={{
                        padding: "10px 16px",
                        backgroundColor: "#0a0a0a",
                        border: "1px solid #262626",
                        color: "#fff",
                        fontSize: "13px",
                        cursor: "pointer",
                    }}
                >
                    <option value={7}>7 hari terakhir</option>
                    <option value={30}>30 hari terakhir</option>
                    <option value={90}>90 hari terakhir</option>
                </select>
            </div>

            {/* Notice when no detailed analytics */}
            {!data.hasAnalyticsData && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px 20px",
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    marginBottom: "24px",
                }}>
                    <FiAlertCircle size={20} color="#737373" />
                    <p style={{ color: "#a3a3a3", fontSize: "12px" }}>
                        Data menggunakan estimasi dari total views.
                    </p>
                </div>
            )}

            {/* Summary Cards */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "24px",
                marginBottom: "32px",
            }}>
                <SummaryCard
                    icon={FiEye}
                    label="TOTAL VIEWS"
                    value={data.summary.totalViews}
                    color="#3b82f6"
                />
                <SummaryCard
                    icon={FiFileText}
                    label="ARTIKEL PUBLISHED"
                    value={data.summary.publishedArticles}
                    color="#22c55e"
                />
                <SummaryCard
                    icon={FiTrendingUp}
                    label="RATA-RATA VIEWS"
                    value={data.summary.avgViewsPerArticle}
                    color="#f59e0b"
                />
            </div>

            {/* Charts Grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
                gap: "24px",
            }}>
                {/* Line Chart - Daily Views */}
                <div style={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #262626",
                    padding: "24px",
                }}>
                    <h3 style={{
                        color: "#fff",
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "24px",
                    }}>
                        Views Harian
                    </h3>
                    {data.dailyViews.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={data.dailyViews}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#525252"
                                    fontSize={11}
                                    tickFormatter={(value) => value.slice(5)}
                                />
                                <YAxis stroke="#525252" fontSize={11} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#171717",
                                        border: "1px solid #262626",
                                        borderRadius: "8px",
                                    }}
                                    labelStyle={{ color: "#fff" }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="pageViews"
                                    stroke="#dc2626"
                                    strokeWidth={2}
                                    dot={{ fill: "#dc2626", strokeWidth: 0, r: 3 }}
                                    name="Views"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartMessage message="Belum ada data views harian" />
                    )}
                </div>

                {/* Bar Chart - Top Articles */}
                <div style={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #262626",
                    padding: "24px",
                }}>
                    <h3 style={{
                        color: "#fff",
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "24px",
                    }}>
                        Top 10 Artikel
                    </h3>
                    {data.topArticles.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={data.topArticles.slice(0, 10)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                                <XAxis type="number" stroke="#525252" fontSize={11} />
                                <YAxis
                                    type="category"
                                    dataKey="title"
                                    stroke="#525252"
                                    fontSize={10}
                                    width={120}
                                    tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + "..." : value}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#171717",
                                        border: "1px solid #262626",
                                        borderRadius: "8px",
                                    }}
                                />
                                <Bar dataKey="views" fill="#dc2626" radius={[0, 4, 4, 0]} name="Views" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartMessage message="Belum ada artikel" />
                    )}
                </div>

                {/* Pie Chart - Category Distribution */}
                <div style={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #262626",
                    padding: "24px",
                }}>
                    <h3 style={{
                        color: "#fff",
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "24px",
                    }}>
                        Distribusi Kategori
                    </h3>
                    {data.categoryDistribution.filter(c => c.views > 0).length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={data.categoryDistribution.filter(c => c.views > 0)}
                                    dataKey="views"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                    labelLine={false}
                                >
                                    {data.categoryDistribution.filter(c => c.views > 0).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#171717",
                                        border: "1px solid #262626",
                                        borderRadius: "8px",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartMessage message="Belum ada data kategori" />
                    )}
                </div>

                {/* Top Articles List */}
                <div style={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #262626",
                    padding: "24px",
                }}>
                    <h3 style={{
                        color: "#fff",
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "24px",
                    }}>
                        Artikel Terpopuler
                    </h3>
                    {data.topArticles.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {data.topArticles.slice(0, 5).map((article, index) => (
                                <div
                                    key={article.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        padding: "12px",
                                        backgroundColor: "#111",
                                        borderRadius: "8px",
                                    }}
                                >
                                    <span style={{
                                        width: "28px",
                                        height: "28px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: index === 0 ? "#dc2626" : "#262626",
                                        color: "#fff",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        borderRadius: "6px",
                                    }}>
                                        {index + 1}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            color: "#fff",
                                            fontSize: "13px",
                                            fontWeight: 500,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {article.title}
                                        </p>
                                        {article.category && (
                                            <span style={{ color: article.category.color, fontSize: "11px" }}>
                                                {article.category.name}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ color: "#737373", fontSize: "13px", fontWeight: 600 }}>
                                        {article.views} views
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyChartMessage message="Belum ada artikel" />
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, color }: {
    icon: typeof FiEye;
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div style={{
            backgroundColor: "#0a0a0a",
            border: "1px solid #262626",
            borderLeft: `4px solid ${color}`,
            borderRadius: "8px",
            padding: "20px",
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "12px",
            }}>
                <div style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor: `${color}20`,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color,
                }}>
                    <Icon size={20} />
                </div>
            </div>
            <p style={{ color: "#737373", fontSize: "11px", letterSpacing: "0.1em", marginBottom: "4px" }}>
                {label}
            </p>
            <p style={{ color: "#fff", fontSize: "28px", fontWeight: 700 }}>
                {value.toLocaleString()}
            </p>
        </div>
    );
}

function EmptyChartMessage({ message }: { message: string }) {
    return (
        <div style={{
            height: "250px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#525252",
            fontSize: "14px",
            backgroundColor: "#111",
            borderRadius: "8px",
        }}>
            {message}
        </div>
    );
}
