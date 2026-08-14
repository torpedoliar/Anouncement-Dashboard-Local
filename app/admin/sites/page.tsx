"use client";

/**
 * Sites Management Page
 * List all sites with health status and actions
 */

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
    Globe,
    Plus,
    GearSix,
    PencilSimple,
    ArrowSquareOut,
    Users,
    FileText,
    Folder,
    CheckCircle,
    Warning,
    WarningCircle,
} from "@phosphor-icons/react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

/** Kit Button primary visual applied to <Link> — the kit Button renders a <button>, which cannot nest inside an <a>. */
const BUTTON_PRIMARY =
    "inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ACTION_LINK =
    "inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 text-[13px] font-medium transition-colors duration-150";
const ACTION_LINK_SECONDARY = `${ACTION_LINK} border border-border bg-surface-1 text-text-1 hover:bg-surface-2`;
const ACTION_LINK_ACCENT = `${ACTION_LINK} border border-accent-subtle bg-accent-subtle text-accent hover:opacity-90`;

interface Site {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    primaryColor: string;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
    _count: {
        announcementSites: number;
        categories: number;
        userAccess: number;
        liveCount: number;
        scheduledCount: number;
    };
}

type HealthStatusKey = "good" | "warning" | "critical";

interface HealthStatus {
    status: HealthStatusKey;
    metrics: {
        viewsLast7d: number;
        draftCount: number;
        pendingComments: number;
        scheduledPosts: number;
    };
}

const HEALTH_META: Record<HealthStatusKey, { tone: "success" | "warning" | "danger"; label: string; icon: ReactNode }> = {
    good: { tone: "success", label: "Sehat", icon: <CheckCircle size={14} weight="fill" /> },
    warning: { tone: "warning", label: "Perhatian", icon: <Warning size={14} weight="fill" /> },
    critical: { tone: "danger", label: "Kritis", icon: <WarningCircle size={14} weight="fill" /> },
};

export default function SitesPage() {
    const [sites, setSites] = useState<Site[]>([]);
    const [healthMap, setHealthMap] = useState<Record<string, HealthStatus>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async () => {
        try {
            const res = await fetch("/api/sites?includeInactive=true");
            if (res.ok) {
                const data = await res.json();
                setSites(data);

                // Fetch health for each site
                for (const site of data) {
                    fetchSiteHealth(site.id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch sites:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSiteHealth = async (siteId: string) => {
        try {
            const res = await fetch(`/api/sites/${siteId}/health`);
            if (res.ok) {
                const health = await res.json();
                setHealthMap(prev => ({ ...prev, [siteId]: health }));
            }
        } catch (error) {
            console.error(`Failed to fetch health for site ${siteId}:`, error);
        }
    };

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-8 h-8 w-64 animate-pulse rounded bg-surface-2" />
                {/* Card grid skeleton */}
                <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr))]">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-56 animate-pulse rounded-card bg-surface-2"
                            aria-hidden="true"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="mb-1 text-xs font-semibold tracking-widest text-accent">
                        Sites
                    </p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">
                        Site Management
                    </h1>
                    <p className="mt-1 text-text-3">
                        Manage all sites in your multi-site network
                    </p>
                </div>
                <Link href="/admin/sites/new" className={BUTTON_PRIMARY}>
                    <Plus size={16} weight="bold" />
                    Create New Site
                </Link>
            </div>

            {/* Sites Grid */}
            <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr))]">
                {sites.map((site) => {
                    const health = healthMap[site.id];
                    const healthMeta = health ? HEALTH_META[health.status] : null;
                    return (
                        <Card key={site.id} className="overflow-hidden">
                            {/* Masthead */}
                            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card"
                                        style={{ backgroundColor: site.primaryColor }}
                                    >
                                        <Globe size={22} weight="fill" className="text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="truncate font-display text-lg font-semibold text-text-1">
                                                {site.name}
                                            </h3>
                                            {site.isDefault && (
                                                <Badge tone="danger">Default</Badge>
                                            )}
                                        </div>
                                        <div className="font-mono text-[13px] text-text-3">
                                            /site/{site.slug}
                                        </div>
                                    </div>
                                </div>
                                {healthMeta ? (
                                    <Badge tone={healthMeta.tone} className="shrink-0">
                                        {healthMeta.icon}
                                        {healthMeta.label}
                                    </Badge>
                                ) : (
                                    <Badge tone="neutral" className="shrink-0">
                                        Memuat...
                                    </Badge>
                                )}
                            </div>

                            {/* Live/scheduled honesty */}
                            <div className="border-b border-border bg-surface-2/50 px-5 py-2.5">
                                <span className="font-mono text-[13px] tabular-nums text-text-2">
                                    {site._count.liveCount}{" "}
                                    <span className="text-text-3">live</span>
                                    <span className="mx-1.5 text-text-3">·</span>
                                    {site._count.scheduledCount}{" "}
                                    <span className="text-text-3">terjadwal</span>
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-4 border-b border-border px-5 py-4">
                                <div className="text-center">
                                    <div className="mb-1 flex items-center justify-center gap-1 text-[11px] text-text-3">
                                        <FileText size={12} />
                                        Articles
                                    </div>
                                    <div className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                        {site._count.announcementSites}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="mb-1 flex items-center justify-center gap-1 text-[11px] text-text-3">
                                        <Folder size={12} />
                                        Categories
                                    </div>
                                    <div className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                        {site._count.categories}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="mb-1 flex items-center justify-center gap-1 text-[11px] text-text-3">
                                        <Users size={12} />
                                        Users
                                    </div>
                                    <div className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                        {site._count.userAccess}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="mb-1 text-[11px] text-text-3">
                                        Views (7d)
                                    </div>
                                    <div className="font-mono text-lg font-semibold tabular-nums text-text-1">
                                        {health?.metrics?.viewsLast7d?.toLocaleString() || "-"}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 p-4 px-5">
                                <Link
                                    href={`/admin/sites/${site.id}`}
                                    className={`${ACTION_LINK_SECONDARY} flex-1`}
                                >
                                    <PencilSimple size={14} weight="bold" />
                                    Edit
                                </Link>
                                <Link
                                    href={`/admin/sites/${site.id}/settings`}
                                    className={`${ACTION_LINK_SECONDARY} flex-1`}
                                >
                                    <GearSix size={14} weight="bold" />
                                    Settings
                                </Link>
                                <Link
                                    href={`/site/${site.slug}`}
                                    target="_blank"
                                    className={`${ACTION_LINK_ACCENT} flex-1`}
                                >
                                    <ArrowSquareOut size={14} weight="bold" />
                                    View
                                </Link>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {sites.length === 0 && (
                <div className="rounded-card border border-border bg-surface-1 p-12 text-center">
                    <Globe size={48} weight="duotone" className="mx-auto mb-4 text-text-3" />
                    <h3 className="mb-2 font-display text-lg font-semibold text-text-1">
                        No Sites Yet
                    </h3>
                    <p className="mb-6 text-text-3">
                        Create your first site to get started with multi-site management.
                    </p>
                    <Link href="/admin/sites/new" className={BUTTON_PRIMARY}>
                        <Plus size={16} weight="bold" />
                        Create First Site
                    </Link>
                </div>
            )}
        </div>
    );
}
