"use client";

/**
 * Site Syndication Picker Component
 * Allows selecting multiple sites to publish content to
 */

import { useState, useEffect } from 'react';
import { FiGlobe, FiCheck, FiStar } from 'react-icons/fi';

interface Site {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
}

interface SiteSyndicationPickerProps {
    selectedSiteIds: string[];
    primarySiteId: string | null;
    onChange: (siteIds: string[], primarySiteId: string | null) => void;
    disabled?: boolean;
}

export default function SiteSyndicationPicker({
    selectedSiteIds,
    primarySiteId,
    onChange,
    disabled = false,
}: SiteSyndicationPickerProps) {
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async () => {
        try {
            const res = await fetch('/api/sites');
            if (res.ok) {
                const data = await res.json();
                setSites(data);

                // Auto-select default site if nothing selected
                if (selectedSiteIds.length === 0 && data.length > 0) {
                    const defaultSite = data.find((s: Site & { isDefault?: boolean }) => s.isDefault) || data[0];
                    onChange([defaultSite.id], defaultSite.id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch sites:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSite = (siteId: string) => {
        if (disabled) return;

        let newSelected: string[];
        let newPrimary = primarySiteId;

        if (selectedSiteIds.includes(siteId)) {
            // Removing site
            newSelected = selectedSiteIds.filter((id) => id !== siteId);

            // If removing primary, set first remaining as primary
            if (primarySiteId === siteId) {
                newPrimary = newSelected[0] || null;
            }
        } else {
            // Adding site
            newSelected = [...selectedSiteIds, siteId];

            // If first site, make it primary
            if (!primarySiteId) {
                newPrimary = siteId;
            }
        }

        onChange(newSelected, newPrimary);
    };

    const setPrimary = (siteId: string) => {
        if (disabled) return;
        if (!selectedSiteIds.includes(siteId)) return;
        onChange(selectedSiteIds, siteId);
    };

    if (isLoading) {
        return (
            <div style={{
                padding: '16px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
            }}>
                <div style={{ color: '#666', fontSize: '13px' }}>Loading sites...</div>
            </div>
        );
    }

    if (sites.length === 0) {
        return (
            <div style={{
                padding: '16px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
            }}>
                <div style={{ color: '#888', fontSize: '13px' }}>
                    No sites available. Please create a site first.
                </div>
            </div>
        );
    }

    return (
        <div>
            <label style={{
                display: 'block',
                fontSize: '13px',
                color: '#888',
                marginBottom: '8px',
            }}>
                Publish to Sites
            </label>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
            }}>
                {sites.map((site) => {
                    const isSelected = selectedSiteIds.includes(site.id);
                    const isPrimary = primarySiteId === site.id;

                    return (
                        <div
                            key={site.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: isSelected ? 'rgba(237,28,36,0.1)' : 'rgba(255,255,255,0.03)',
                                border: `2px solid ${isSelected ? site.primaryColor : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '10px',
                                overflow: 'hidden',
                                opacity: disabled ? 0.6 : 1,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {/* Site Header */}
                            <button
                                type="button"
                                onClick={() => toggleSite(site.id)}
                                disabled={disabled}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    backgroundColor: site.primaryColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    {isSelected ? (
                                        <FiCheck color="#fff" size={16} />
                                    ) : (
                                        <FiGlobe color="#fff" size={16} />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: '#fff',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {site.name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>
                                        /site/{site.slug}
                                    </div>
                                </div>
                            </button>

                            {/* Primary Button */}
                            {isSelected && selectedSiteIds.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setPrimary(site.id)}
                                    disabled={disabled}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '8px',
                                        backgroundColor: isPrimary ? site.primaryColor : 'rgba(255,255,255,0.05)',
                                        border: 'none',
                                        borderTop: '1px solid rgba(255,255,255,0.1)',
                                        color: isPrimary ? '#fff' : '#888',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <FiStar size={12} fill={isPrimary ? '#fff' : 'none'} />
                                    {isPrimary ? 'Primary Site' : 'Set as Primary'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Help Text */}
            {selectedSiteIds.length > 1 && (
                <div style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    color: '#666',
                }}>
                    <FiStar size={10} style={{ marginRight: '6px' }} />
                    Primary site digunakan untuk canonical URL (SEO)
                </div>
            )}

            {/* Required validation */}
            {selectedSiteIds.length === 0 && (
                <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#ef4444',
                }}>
                    Pilih minimal satu site
                </div>
            )}
        </div>
    );
}
