"use client";

/**
 * Site Syndication Picker Component
 * Select multiple sites to publish to, with per-site Primary / Hero / Pin flags.
 */

import { useState, useEffect } from 'react';
import { FiGlobe, FiCheck, FiStar, FiMapPin } from 'react-icons/fi';

interface Site {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
    isDefault?: boolean;
}

export interface SiteAssoc {
    siteId: string;
    isPrimary: boolean;
    isHero: boolean;
    isPinned: boolean;
}

interface SiteSyndicationPickerProps {
    value: SiteAssoc[];
    onChange: (value: SiteAssoc[]) => void;
    /** Site to pre-select for brand-new articles (current admin site context). */
    defaultSiteId?: string | null;
    disabled?: boolean;
}

export default function SiteSyndicationPicker({
    value,
    onChange,
    defaultSiteId,
    disabled = false,
}: SiteSyndicationPickerProps) {
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchSites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchSites = async () => {
        try {
            const res = await fetch('/api/sites');
            if (res.ok) {
                const data: Site[] = await res.json();
                setSites(data);

                // Auto-select a site when nothing is selected yet:
                // prefer the current admin context, then the default site, then the first.
                if (value.length === 0 && data.length > 0) {
                    const preferred =
                        data.find((s) => s.id === defaultSiteId) ||
                        data.find((s) => s.isDefault) ||
                        data[0];
                    onChange([{ siteId: preferred.id, isPrimary: true, isHero: false, isPinned: false }]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch sites:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const isSelected = (siteId: string) => value.some((v) => v.siteId === siteId);

    const toggleSite = (siteId: string) => {
        if (disabled) return;

        if (isSelected(siteId)) {
            let next = value.filter((v) => v.siteId !== siteId);
            // Ensure a primary remains
            if (next.length > 0 && !next.some((v) => v.isPrimary)) {
                next = next.map((v, i) => (i === 0 ? { ...v, isPrimary: true } : v));
            }
            onChange(next);
        } else {
            const makePrimary = value.length === 0;
            onChange([...value, { siteId, isPrimary: makePrimary, isHero: false, isPinned: false }]);
        }
    };

    const setPrimary = (siteId: string) => {
        if (disabled || !isSelected(siteId)) return;
        onChange(value.map((v) => ({ ...v, isPrimary: v.siteId === siteId })));
    };

    const toggleFlag = (siteId: string, flag: 'isHero' | 'isPinned') => {
        if (disabled || !isSelected(siteId)) return;
        onChange(value.map((v) => (v.siteId === siteId ? { ...v, [flag]: !v[flag] } : v)));
    };

    if (isLoading) {
        return (
            <div style={boxStyle}>
                <div style={{ color: '#666', fontSize: '13px' }}>Loading sites...</div>
            </div>
        );
    }

    if (sites.length === 0) {
        return (
            <div style={boxStyle}>
                <div style={{ color: '#888', fontSize: '13px' }}>
                    No sites available. Please create a site first.
                </div>
            </div>
        );
    }

    return (
        <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                Publish to Sites
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {sites.map((site) => {
                    const assoc = value.find((v) => v.siteId === site.id);
                    const selected = !!assoc;

                    return (
                        <div
                            key={site.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: selected ? 'rgba(237,28,36,0.1)' : 'rgba(255,255,255,0.03)',
                                border: `2px solid ${selected ? site.primaryColor : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '10px',
                                overflow: 'hidden',
                                opacity: disabled ? 0.6 : 1,
                            }}
                        >
                            {/* Site header / toggle selection */}
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
                                    width: '32px', height: '32px', borderRadius: '6px',
                                    backgroundColor: site.primaryColor, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    {selected ? <FiCheck color="#fff" size={16} /> : <FiGlobe color="#fff" size={16} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '14px', fontWeight: 600, color: '#fff',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {site.name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>/site/{site.slug}</div>
                                </div>
                            </button>

                            {/* Per-site placement controls */}
                            {selected && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ display: 'flex' }}>
                                        <FlagButton
                                            active={!!assoc?.isHero}
                                            color={site.primaryColor}
                                            disabled={disabled}
                                            onClick={() => toggleFlag(site.id, 'isHero')}
                                            icon={<FiStar size={12} fill={assoc?.isHero ? '#fff' : 'none'} />}
                                            label="Hero"
                                        />
                                        <FlagButton
                                            active={!!assoc?.isPinned}
                                            color={site.primaryColor}
                                            disabled={disabled}
                                            onClick={() => toggleFlag(site.id, 'isPinned')}
                                            icon={<FiMapPin size={12} />}
                                            label="Pin"
                                            borderLeft
                                        />
                                    </div>
                                    {value.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setPrimary(site.id)}
                                            disabled={disabled}
                                            style={{
                                                width: '100%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                padding: '8px',
                                                backgroundColor: assoc?.isPrimary ? site.primaryColor : 'rgba(255,255,255,0.05)',
                                                border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)',
                                                color: assoc?.isPrimary ? '#fff' : '#888',
                                                fontSize: '11px', fontWeight: 600,
                                                cursor: disabled ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            <FiStar size={12} fill={assoc?.isPrimary ? '#fff' : 'none'} />
                                            {assoc?.isPrimary ? 'Primary Site' : 'Set as Primary'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {value.length > 1 && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                    <FiStar size={10} style={{ marginRight: '6px' }} />
                    Primary site digunakan untuk canonical URL (SEO). Hero &amp; Pin diatur terpisah per site.
                </div>
            )}

            {value.length === 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#ef4444' }}>
                    Pilih minimal satu site
                </div>
            )}
        </div>
    );
}

const boxStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
};

function FlagButton({
    active, color, disabled, onClick, icon, label, borderLeft = false,
}: {
    active: boolean; color: string; disabled: boolean; onClick: () => void;
    icon: React.ReactNode; label: string; borderLeft?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '8px',
                backgroundColor: active ? color : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderLeft: borderLeft ? '1px solid rgba(255,255,255,0.1)' : 'none',
                color: active ? '#fff' : '#888',
                fontSize: '11px', fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
        >
            {icon}
            {label}
        </button>
    );
}
