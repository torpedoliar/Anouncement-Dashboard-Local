"use client";

/**
 * Sites Management Page
 * List all sites with health status and actions
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    FiGlobe,
    FiPlus,
    FiSettings,
    FiEdit2,
    FiExternalLink,
    FiUsers,
    FiFileText,
    FiFolder,
    FiCheckCircle,
    FiAlertCircle,
    FiAlertTriangle
} from "react-icons/fi";

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
    };
}

interface HealthStatus {
    status: 'good' | 'warning' | 'critical';
    metrics: {
        viewsLast7d: number;
        draftCount: number;
        pendingComments: number;
        scheduledPosts: number;
    };
}

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

    const getStatusIcon = (status?: 'good' | 'warning' | 'critical') => {
        switch (status) {
            case 'good':
                return <FiCheckCircle color="#22c55e" size={20} />;
            case 'warning':
                return <FiAlertTriangle color="#f59e0b" size={20} />;
            case 'critical':
                return <FiAlertCircle color="#ef4444" size={20} />;
            default:
                return null;
        }
    };

    const getStatusColor = (status?: 'good' | 'warning' | 'critical') => {
        switch (status) {
            case 'good': return '#22c55e';
            case 'warning': return '#f59e0b';
            case 'critical': return '#ef4444';
            default: return '#666';
        }
    };

    if (isLoading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ color: '#888' }}>Loading sites...</div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px'
            }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                        Site Management
                    </h1>
                    <p style={{ color: '#888', fontSize: '14px' }}>
                        Manage all sites in your multi-site network
                    </p>
                </div>
                <Link
                    href="/admin/sites/new"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: '#ED1C24',
                        color: '#fff',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        transition: 'transform 0.2s',
                    }}
                >
                    <FiPlus size={18} />
                    Create New Site
                </Link>
            </div>

            {/* Sites Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                gap: '24px',
            }}>
                {sites.map((site) => {
                    const health = healthMap[site.id];
                    return (
                        <div
                            key={site.id}
                            style={{
                                backgroundColor: '#1a1a1a',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                padding: '20px',
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                            }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '10px',
                                        backgroundColor: site.primaryColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <FiGlobe color="#fff" size={24} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{site.name}</h3>
                                            {site.isDefault && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '2px 8px',
                                                    backgroundColor: 'rgba(237,28,36,0.2)',
                                                    color: '#ED1C24',
                                                    borderRadius: '4px',
                                                    textTransform: 'uppercase',
                                                    fontWeight: 600,
                                                }}>
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ color: '#888', fontSize: '13px' }}>
                                            /site/{site.slug}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {getStatusIcon(health?.status)}
                                    <span style={{
                                        fontSize: '12px',
                                        color: getStatusColor(health?.status),
                                        textTransform: 'capitalize',
                                    }}>
                                        {health?.status || 'Loading...'}
                                    </span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{
                                padding: '16px 20px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '12px',
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>
                                        <FiFileText size={12} style={{ marginRight: '4px' }} />
                                        Articles
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                        {site._count.announcementSites}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>
                                        <FiFolder size={12} style={{ marginRight: '4px' }} />
                                        Categories
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                        {site._count.categories}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>
                                        <FiUsers size={12} style={{ marginRight: '4px' }} />
                                        Users
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                        {site._count.userAccess}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>
                                        Views (7d)
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                        {health?.metrics?.viewsLast7d?.toLocaleString() || '-'}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                                <Link
                                    href={`/admin/sites/${site.id}`}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '10px',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    <FiEdit2 size={14} />
                                    Edit
                                </Link>
                                <Link
                                    href={`/admin/sites/${site.id}/settings`}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '10px',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    <FiSettings size={14} />
                                    Settings
                                </Link>
                                <Link
                                    href={`/site/${site.slug}`}
                                    target="_blank"
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '10px',
                                        backgroundColor: 'rgba(237,28,36,0.1)',
                                        border: '1px solid rgba(237,28,36,0.2)',
                                        borderRadius: '8px',
                                        color: '#ED1C24',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    <FiExternalLink size={14} />
                                    View
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            {sites.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <FiGlobe size={48} color="#666" style={{ marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>No Sites Yet</h3>
                    <p style={{ color: '#888', marginBottom: '24px' }}>
                        Create your first site to get started with multi-site management.
                    </p>
                    <Link
                        href="/admin/sites/new"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#ED1C24',
                            color: '#fff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: 600,
                        }}
                    >
                        <FiPlus size={18} />
                        Create First Site
                    </Link>
                </div>
            )}
        </div>
    );
}
