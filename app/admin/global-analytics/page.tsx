"use client";

/**
 * Global Analytics Page
 * Cross-site analytics dashboard for SuperAdmin
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    FiArrowLeft, FiGlobe, FiFileText, FiUsers, FiEye, FiTrendingUp,
    FiBarChart2, FiRefreshCw, FiPieChart
} from "react-icons/fi";

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
                        return {
                            ...site,
                            stats: {
                                totalAnnouncements: health.totalAnnouncements || 0,
                                publishedAnnouncements: health.publishedAnnouncements || 0,
                                totalViews: health.totalViews || 0,
                                totalCategories: health.totalCategories || 0,
                                totalUsers: health.totalUsers || 0,
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

    const cardStyle = {
        backgroundColor: "#1a1a1a",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        padding: "24px",
    };

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#fff" }}>
            {/* Header */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "24px 32px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <button
                        onClick={() => router.back()}
                        style={{
                            padding: "8px",
                            backgroundColor: "transparent",
                            border: "none",
                            color: "#888",
                            cursor: "pointer",
                        }}
                    >
                        <FiArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
                            <FiPieChart /> Global Analytics
                        </h1>
                        <p style={{ color: "#666", fontSize: "13px" }}>Cross-site performance overview</p>
                    </div>
                </div>
                <button
                    onClick={fetchStats}
                    disabled={isLoading}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 20px",
                        backgroundColor: "#262626",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.6 : 1,
                    }}
                >
                    <FiRefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            <div style={{ padding: "32px", maxWidth: "1400px", margin: "0 auto" }}>
                {error && (
                    <div style={{
                        padding: "16px",
                        backgroundColor: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: "8px",
                        color: "#ef4444",
                        marginBottom: "24px",
                    }}>
                        {error}
                    </div>
                )}

                {isLoading && !stats ? (
                    <div style={{ textAlign: "center", padding: "60px", color: "#666" }}>
                        Loading analytics...
                    </div>
                ) : stats && (
                    <>
                        {/* Global Stats Grid */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(5, 1fr)",
                            gap: "20px",
                            marginBottom: "40px",
                        }}>
                            <div style={cardStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <FiGlobe size={20} color="#3b82f6" />
                                    <span style={{ color: "#888", fontSize: "13px" }}>Sites</span>
                                </div>
                                <div style={{ fontSize: "36px", fontWeight: 700 }}>{stats.totalSites}</div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <FiFileText size={20} color="#22c55e" />
                                    <span style={{ color: "#888", fontSize: "13px" }}>Articles</span>
                                </div>
                                <div style={{ fontSize: "36px", fontWeight: 700 }}>{stats.totalAnnouncements}</div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <FiEye size={20} color="#a855f7" />
                                    <span style={{ color: "#888", fontSize: "13px" }}>Total Views</span>
                                </div>
                                <div style={{ fontSize: "36px", fontWeight: 700 }}>{stats.totalViews.toLocaleString()}</div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <FiBarChart2 size={20} color="#f59e0b" />
                                    <span style={{ color: "#888", fontSize: "13px" }}>Categories</span>
                                </div>
                                <div style={{ fontSize: "36px", fontWeight: 700 }}>{stats.totalCategories}</div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <FiUsers size={20} color="#ec4899" />
                                    <span style={{ color: "#888", fontSize: "13px" }}>Users</span>
                                </div>
                                <div style={{ fontSize: "36px", fontWeight: 700 }}>{stats.totalUsers}</div>
                            </div>
                        </div>

                        {/* Per-Site Breakdown */}
                        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FiTrendingUp /> Per-Site Performance
                        </h2>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                            gap: "20px",
                        }}>
                            {stats.siteStats.map((site) => (
                                <Link
                                    key={site.id}
                                    href={`/admin/sites/${site.id}`}
                                    style={{
                                        ...cardStyle,
                                        textDecoration: "none",
                                        display: "block",
                                        transition: "border-color 0.2s",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                        <div style={{
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "10px",
                                            backgroundColor: site.primaryColor,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}>
                                            <FiGlobe color="#fff" size={20} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff" }}>{site.name}</h3>
                                            <span style={{ fontSize: "12px", color: "#666" }}>/site/{site.slug}</span>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(4, 1fr)",
                                        gap: "12px",
                                        padding: "16px 0",
                                        borderTop: "1px solid rgba(255,255,255,0.1)",
                                    }}>
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>
                                                {site.stats.publishedAnnouncements}
                                            </div>
                                            <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Articles</div>
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>
                                                {site.stats.totalViews.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Views</div>
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>
                                                {site.stats.totalCategories}
                                            </div>
                                            <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Categories</div>
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>
                                                {site.stats.totalUsers}
                                            </div>
                                            <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Users</div>
                                        </div>
                                    </div>

                                    {/* Visual bar */}
                                    <div style={{
                                        height: "4px",
                                        backgroundColor: "rgba(255,255,255,0.05)",
                                        borderRadius: "2px",
                                        overflow: "hidden",
                                        marginTop: "8px",
                                    }}>
                                        <div style={{
                                            height: "100%",
                                            width: `${Math.min((site.stats.totalViews / (stats.totalViews || 1)) * 100, 100)}%`,
                                            backgroundColor: site.primaryColor,
                                            borderRadius: "2px",
                                        }} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
