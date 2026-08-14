"use client";

/**
 * Site Syndication Picker Component
 * Select multiple sites to publish to, with per-site Primary / Hero / Pin flags.
 * Token-native restyle: replaces inline styles + react-icons/fi.
 */

import { useState, useEffect } from 'react';
import { GlobeSimple, Check, Star, MapPin } from '@phosphor-icons/react';

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
            <div
                className="rounded-card p-4 text-sm"
                style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                }}
            >
                <span style={{ color: "var(--text-3)" }}>Loading sites...</span>
            </div>
        );
    }

    if (sites.length === 0) {
        return (
            <div
                className="rounded-card p-4 text-sm"
                style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                }}
            >
                <span style={{ color: "var(--text-3)" }}>
                    No sites available. Please create a site first.
                </span>
            </div>
        );
    }

    return (
        <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-3)" }}>
                Publish to Sites
            </label>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {sites.map((site) => {
                    const assoc = value.find((v) => v.siteId === site.id);
                    const selected = !!assoc;

                    return (
                        <div
                            key={site.id}
                            className="overflow-hidden rounded-card"
                            style={{
                                border: `2px solid ${selected ? site.primaryColor : 'var(--border)'}`,
                                background: selected ? `${site.primaryColor}15` : "var(--surface-2)",
                                opacity: disabled ? 0.6 : 1,
                            }}
                        >
                            {/* Site header / toggle selection */}
                            <button
                                type="button"
                                onClick={() => toggleSite(site.id)}
                                disabled={disabled}
                                className="flex w-full items-center gap-2.5 px-3 py-3 text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-3)]"
                                style={{
                                    border: 'none', background: 'transparent',
                                }}
                            >
                                <div
                                    className="flex size-8 shrink-0 items-center justify-center rounded-control"
                                    style={{ backgroundColor: site.primaryColor }}
                                >
                                    {selected ? (
                                        <Check size={16} weight="bold" color="#fff" />
                                    ) : (
                                        <GlobeSimple size={16} weight="fill" color="#fff" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                    <div className="truncate text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                                        {site.name}
                                    </div>
                                    <div className="truncate text-xs" style={{ color: "var(--text-3)" }}>
                                        /site/{site.slug}
                                    </div>
                                </div>
                            </button>

                            {/* Per-site placement controls */}
                            {selected && (
                                <div style={{ borderTop: `1px solid var(--border)` }}>
                                    <div className="flex">
                                        <FlagButton
                                            active={!!assoc?.isHero}
                                            color={site.primaryColor}
                                            disabled={disabled}
                                            onClick={() => toggleFlag(site.id, 'isHero')}
                                            icon={<Star size={12} weight="fill" />}
                                            label="Hero"
                                        />
                                        <FlagButton
                                            active={!!assoc?.isPinned}
                                            color={site.primaryColor}
                                            disabled={disabled}
                                            onClick={() => toggleFlag(site.id, 'isPinned')}
                                            icon={<MapPin size={12} weight="fill" />}
                                            label="Pin"
                                            borderLeft
                                        />
                                    </div>
                                    {value.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setPrimary(site.id)}
                                            disabled={disabled}
                                            className="flex w-full cursor-pointer items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors duration-150 hover:bg-[var(--surface-3)]"
                                            style={{
                                                borderTop: `1px solid var(--border)`,
                                                background: assoc?.isPrimary ? site.primaryColor : 'var(--surface-3)',
                                                color: assoc?.isPrimary ? 'var(--text-1)' : 'var(--text-3)',
                                            }}
                                        >
                                            <Star size={12} weight="fill" />
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
                <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
                    <Star size={10} weight="fill" className="text-[#eab308]" />
                    Primary site digunakan untuk canonical URL (SEO). Hero &amp; Pin diatur terpisah per site.
                </p>
            )}

            {value.length === 0 && (
                <p className="mt-2 text-xs" style={{ color: "var(--color-danger)" }}>
                    Pilih minimal satu site
                </p>
            )}
        </div>
    );
}

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
            className="flex flex-1 cursor-pointer items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors duration-150 hover:bg-[var(--surface-3)]"
            style={{
                border: borderLeft ? `1px solid var(--border)` : 'none',
                borderTop: '1px solid var(--border)',
                background: active ? color : 'var(--surface-3)',
                color: active ? 'var(--text-1)' : 'var(--text-3)',
            }}
        >
            {icon}
            {label}
        </button>
    );
}
