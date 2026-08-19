"use client";

/**
 * Site Health Card Component
 * Displays health metrics for a site
 */

import { useState, useEffect, useCallback } from 'react';
import { Heartbeat, FileText, Users, Tag, Image, ArrowsClockwise } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface HealthMetrics {
    totalAnnouncements: number;
    publishedAnnouncements: number;
    draftAnnouncements: number;
    totalCategories: number;
    totalMediaFiles: number;
    totalUsers: number;
    recentActivity: {
        action: string;
        entityType: string;
        createdAt: string;
    }[];
}

interface SiteHealthCardProps {
    siteId: string;
    siteName: string;
    primaryColor?: string;
    compact?: boolean;
}

export default function SiteHealthCard({
    siteId,
    siteName,
    compact = false,
}: SiteHealthCardProps) {
    const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHealth = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/sites/${siteId}/health`);
            if (res.ok) {
                const data = await res.json();
                setMetrics(data);
            } else {
                setError('Failed to load health metrics');
            }
        } catch (err) {
            console.error('Health check failed:', err);
            setError('Failed to load health metrics');
        } finally {
            setIsLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    if (isLoading) {
        return (
            <div className="bg-surface-1 border border-border rounded-card p-6">
                <div className="text-text-3 text-sm text-center">
                    Loading health metrics...
                </div>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div className="bg-danger-subtle border border-danger rounded-card p-6">
                <div className="text-danger text-sm text-center">
                    {error || 'Failed to load metrics'}
                </div>
                <Button
                    onClick={fetchHealth}
                    variant="secondary"
                    size="sm"
                    iconLeft={<ArrowsClockwise size={12} />}
                >
                    Retry
                </Button>
            </div>
        );
    }

    const statItems = [
        {
            icon: FileText,
            label: 'Articles',
            value: metrics.totalAnnouncements,
            subValue: `${metrics.publishedAnnouncements} published`,
        },
        {
            icon: Tag,
            label: 'Categories',
            value: metrics.totalCategories,
        },
        {
            icon: Users,
            label: 'Users',
            value: metrics.totalUsers,
        },
        {
            icon: Image,
            label: 'Media',
            value: metrics.totalMediaFiles,
        },
    ];

    if (compact) {
        return (
            <div className="flex items-center gap-4 px-4 py-3 bg-surface-1 border border-border rounded-control">
                {statItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <item.icon weight="fill" size={14} className="text-text-2" />
                        <span className="text-text-1 text-sm font-semibold font-mono tabular-nums">
                            {item.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <Card>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <Heartbeat size={18} weight="fill" className="text-accent" />
                    <span className="font-semibold text-text-1">{siteName} Health</span>
                </div>
                <button
                    onClick={fetchHealth}
                    className="p-1.5 text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-control transition-colors duration-150"
                    title="Refresh"
                    aria-label="Refresh health metrics"
                >
                    <ArrowsClockwise size={14} />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-px bg-border">
                {statItems.map((item) => (
                    <div
                        key={item.label}
                        className="bg-surface-1 px-5 py-5"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <item.icon weight="fill" size={16} className="text-text-3" />
                            <span className="text-text-3 text-xs font-semibold uppercase">
                                {item.label}
                            </span>
                        </div>
                        <div className="text-3xl font-bold text-text-1 font-mono tabular-nums">
                            {item.value}
                        </div>
                        {item.subValue && (
                            <div className="text-text-3 text-xs mt-1">
                                {item.subValue}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            {metrics.recentActivity?.length > 0 && (
                <div className="px-5 py-4 border-t border-border">
                    <h4 className="text-text-3 text-xs font-semibold uppercase mb-3">
                        Recent Activity
                    </h4>
                    <div className="flex flex-col gap-2">
                        {metrics.recentActivity.slice(0, 3).map((activity, idx) => {
                            const tone = activity.action === 'CREATE'
                                ? 'success' as const
                                : activity.action === 'UPDATE'
                                ? 'info' as const
                                : 'danger' as const;
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <Badge tone={tone}>{activity.action}</Badge>
                                    <span className="text-text-2">{activity.entityType}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Card>
    );
}
