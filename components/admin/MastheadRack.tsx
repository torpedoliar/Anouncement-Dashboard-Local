"use client";

import { useState, useEffect, useRef } from "react";
import { CaretDown, Check, Globe } from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";

interface Site {
    id: string;
    name: string;
    slug: string;
    primaryColor?: string;
    _count?: { announcementSites?: number; liveCount?: number; scheduledCount?: number };
}

/**
 * Masthead rack — per-site color swatch + name + slug + live count.
 * Replaces SiteSelector. Switching re-tints via SiteThemeProvider (accent
 * = --site-primary) and reloads after the context cookie is set.
 */
export default function MastheadRack() {
    const [sites, setSites] = useState<Site[]>([]);
    const [currentSite, setCurrentSite] = useState<Site | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    useEffect(() => {
        fetchSites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const syncContext = async (site: Site) => {
        const res = await fetch("/api/context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ siteId: site.id, siteSlug: site.slug }),
        });
        if (!res.ok) throw new Error(`Context update failed: ${res.status}`);
    };

    const fetchSites = async () => {
        try {
            const res = await fetch("/api/sites");
            if (res.ok) {
                const data: Site[] = await res.json();
                setSites(data);
                const savedSiteId = localStorage.getItem("currentSiteId");
                const savedSite = data.find((s) => s.id === savedSiteId);
                const activeSite =
                    savedSite ||
                    (data as (Site & { isDefault?: boolean })[]).find((s) => s.isDefault) ||
                    (data.length > 0 ? data[0] : null);
                if (activeSite) {
                    setCurrentSite(activeSite);
                    localStorage.setItem("currentSiteId", activeSite.id);
                    // Sync server cookie so server components read the same site.
                    try {
                        await syncContext(activeSite);
                    } catch (err) {
                        console.error("Failed to sync site context:", err);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch sites:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSiteSelect = async (site: Site) => {
        setCurrentSite(site);
        setIsOpen(false);
        localStorage.setItem("currentSiteId", site.id);
        try {
            await syncContext(site);
            window.location.reload();
        } catch (error) {
            console.error("Failed to set site context:", error);
            showToast("Gagal mengganti site. Coba lagi.", "error");
        }
    };

    if (isLoading) {
        return (
            <div className="rounded-control bg-surface-1 px-3 py-2.5 text-xs text-text-3">
                Memuat site…
            </div>
        );
    }
    if (sites.length === 0 || !currentSite) {
        return null;
    }

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                id="masthead-rack-toggle"
                onClick={() => setIsOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface-1 px-3 py-2 text-left cursor-pointer transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control"
                        style={{ backgroundColor: currentSite.primaryColor || "var(--site-primary)" }}
                        aria-hidden="true"
                    >
                        <Globe size={14} weight="bold" className="shrink-0 text-white" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-text-1">
                            {currentSite.name}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-text-3">
                            {currentSite.slug}
                            {currentSite._count?.liveCount !== undefined &&
                                ` · ${currentSite._count.liveCount} live · ${currentSite._count.scheduledCount ?? 0} terjadwal`}
                        </span>
                    </span>
                </span>
                <CaretDown size={14} className={`shrink-0 text-text-3 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {isOpen && (
                <div
                    className="absolute left-0 right-0 top-full z-dropdown mt-2 max-h-72 overflow-y-auto rounded-sheet border border-border bg-surface-1 shadow-lvl-3 p-1"
                    role="listbox"
                    aria-label="Daftar site"
                >
                    {sites.map((site) => {
                        const active = currentSite.id === site.id;
                        return (
                            <button
                                key={site.id}
                                type="button"
                                onClick={() => handleSiteSelect(site)}
                                className={`flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                                    active ? "bg-accent/10" : "hover:bg-surface-2"
                                }`}
                            >
                                <span
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control"
                                    style={{ backgroundColor: site.primaryColor || "var(--site-primary)" }}
                                    aria-hidden="true"
                                >
                                    <Globe size={12} weight="bold" className="shrink-0 text-white" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] text-text-1">{site.name}</span>
                                    <span className="block truncate font-mono text-[11px] text-text-3">{site.slug}</span>
                                </span>
                                {active && <Check size={16} className="shrink-0 text-accent" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
