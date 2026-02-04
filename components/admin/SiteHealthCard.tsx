"use client";

/**
 * Site Health Card Component
 * Displays health metrics for a site
 */

import { useState, useEffect } from 'react';
import { FiActivity, FiFileText, FiUsers, FiTag, FiImage, FiRefreshCw } from 'react-icons/fi';

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
    primaryColor = '#ED1C24',
    compact = false,
}: SiteHealthCardProps) {
    const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHealth = async () => {
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
    };

    useEffect(() => {
        fetchHealth();
    }, [siteId]);

    if (isLoading) {
        return (
            <div style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: compact ? '16px' : '24px',
            }}>
                <div style={{ color: '#666', fontSize: '13px', textAlign: 'center' }}>
                    Loading health metrics...
                </div>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div style={{
                backgroundColor: 'rgba(239,68,68,0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(239,68,68,0.2)',
                padding: compact ? '16px' : '24px',
            }}>
                <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>
                    {error || 'Failed to load metrics'}
                </div>
                <button
                    onClick={fetchHealth}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        margin: '12px auto 0',
                        padding: '8px 16px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#888',
                        fontSize: '12px',
                        cursor: 'pointer',
                    }}
                >
                    <FiRefreshCw size={12} />
                    Retry
                </button>
            </div>
        );
    }

    const statItems = [
        {
            icon: FiFileText,
            label: 'Articles',
            value: metrics.totalAnnouncements,
            subValue: `${metrics.publishedAnnouncements} published`,
            color: '#22c55e',
        },
        {
            icon: FiTag,
            label: 'Categories',
            value: metrics.totalCategories,
            color: '#f59e0b',
        },
        {
            icon: FiUsers,
            label: 'Users',
            value: metrics.totalUsers,
            color: '#3b82f6',
        },
        {
            icon: FiImage,
            label: 'Media',
            value: metrics.totalMediaFiles,
            color: '#a855f7',
        },
    ];

    if (compact) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
            }}>
                {statItems.map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <item.icon size={14} color={item.color} />
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                            {item.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: `${primaryColor}10`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FiActivity size={18} color={primaryColor} />
                    <span style={{ fontWeight: 600, color: '#fff' }}>{siteName} Health</span>
                </div>
                <button
                    onClick={fetchHealth}
                    style={{
                        padding: '6px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#888',
                    }}
                    title="Refresh"
                >
                    <FiRefreshCw size={14} />
                </button>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1px',
                backgroundColor: 'rgba(255,255,255,0.05)',
            }}>
                {statItems.map((item) => (
                    <div
                        key={item.label}
                        style={{
                            padding: '20px',
                            backgroundColor: '#1a1a1a',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <item.icon size={16} color={item.color} />
                            <span style={{ color: '#666', fontSize: '12px', textTransform: 'uppercase' }}>
                                {item.label}
                            </span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>
                            {item.value}
                        </div>
                        {item.subValue && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                {item.subValue}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            {metrics.recentActivity?.length > 0 && (
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                }}>
                    <h4 style={{ fontSize: '12px', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>
                        Recent Activity
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {metrics.recentActivity.slice(0, 3).map((activity, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                }}
                            >
                                <span style={{
                                    padding: '2px 6px',
                                    backgroundColor: activity.action === 'CREATE' ? 'rgba(34,197,94,0.1)' :
                                        activity.action === 'UPDATE' ? 'rgba(59,130,246,0.1)' :
                                            'rgba(239,68,68,0.1)',
                                    color: activity.action === 'CREATE' ? '#22c55e' :
                                        activity.action === 'UPDATE' ? '#3b82f6' :
                                            '#ef4444',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                }}>
                                    {activity.action}
                                </span>
                                <span style={{ color: '#888' }}>{activity.entityType}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
