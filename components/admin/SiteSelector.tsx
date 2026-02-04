"use client";

/**
 * Site Selector Component
 * Dropdown for selecting current site in admin panel
 */

import { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiCheck, FiGlobe } from 'react-icons/fi';

interface Site {
    id: string;
    name: string;
    slug: string;
    primaryColor?: string;
}

interface SiteSelectorProps {
    onSiteChange?: (site: Site) => void;
}

export default function SiteSelector({ onSiteChange }: SiteSelectorProps) {
    const [sites, setSites] = useState<Site[]>([]);
    const [currentSite, setCurrentSite] = useState<Site | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchSites();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSites = async () => {
        try {
            const res = await fetch('/api/sites');
            if (res.ok) {
                const data = await res.json();
                setSites(data);

                // Get current site from localStorage or use first site
                const savedSiteId = localStorage.getItem('currentSiteId');
                const savedSite = data.find((s: Site) => s.id === savedSiteId);

                if (savedSite) {
                    setCurrentSite(savedSite);
                } else if (data.length > 0) {
                    // Find default site or use first
                    const defaultSite = data.find((s: Site & { isDefault?: boolean }) => s.isDefault) || data[0];
                    setCurrentSite(defaultSite);
                    localStorage.setItem('currentSiteId', defaultSite.id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch sites:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSiteSelect = (site: Site) => {
        setCurrentSite(site);
        setIsOpen(false);
        localStorage.setItem('currentSiteId', site.id);
        onSiteChange?.(site);

        // Trigger a page refresh to reload data with new site context
        window.location.reload();
    };

    if (isLoading) {
        return (
            <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                marginBottom: '16px',
            }}>
                <div style={{ color: '#666', fontSize: '12px' }}>Loading sites...</div>
            </div>
        );
    }

    if (sites.length === 0) {
        return null;
    }

    return (
        <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '16px' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: currentSite?.primaryColor || '#ED1C24',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <FiGlobe color="#fff" size={16} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Current Site
                        </div>
                        <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                            {currentSite?.name || 'Select Site'}
                        </div>
                    </div>
                </div>
                <FiChevronDown
                    color="#888"
                    size={18}
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                    }}
                />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '8px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    overflow: 'hidden',
                }}>
                    {sites.map((site) => (
                        <button
                            key={site.id}
                            type="button"
                            onClick={() => handleSiteSelect(site)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '12px 16px',
                                backgroundColor: currentSite?.id === site.id ? 'rgba(237,28,36,0.1)' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                if (currentSite?.id !== site.id) {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = currentSite?.id === site.id
                                    ? 'rgba(237,28,36,0.1)'
                                    : 'transparent';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    backgroundColor: site.primaryColor || '#ED1C24',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <FiGlobe color="#fff" size={12} />
                                </div>
                                <span style={{ fontSize: '14px', color: '#fff' }}>
                                    {site.name}
                                </span>
                            </div>
                            {currentSite?.id === site.id && (
                                <FiCheck color="#ED1C24" size={16} />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
