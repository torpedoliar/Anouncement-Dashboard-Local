"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlass, House, PlusCircle, FileText, ArrowsLeftRight } from "@phosphor-icons/react";
import { adminNavGroups } from "@/lib/admin-nav";
import { deriveAnnouncementStatus } from "@/lib/announcement-status";
import StatusPill from "@/components/ui/StatusPill";

interface PaletteItem {
    id: string;
    label: string;
    hint?: string;
    onSelect: () => void;
}

interface AnnouncementResult {
    id: string;
    title: string;
    category?: { name?: string; color?: string } | null;
    primarySite?: { id: string; name?: string; slug?: string } | null;
    isPublished: boolean;
    scheduledAt?: string | null;
    takedownAt?: string | null;
}

interface AnnouncementListResponse {
    data?: AnnouncementResult[];
    pagination?: { total?: number };
}

function buildActions(router: ReturnType<typeof useRouter>, pathname: string) {
    const items: PaletteItem[] = [
        { id: "action-new", label: "Buat pengumuman baru", hint: "Aksi", onSelect: () => router.push("/admin/announcements/new") },
        { id: "goto-home", label: "Dashboard", hint: "Navigasi", onSelect: () => router.push("/admin") },
        { id: "action-switch-site", label: "Ganti situs", hint: "Aksi", onSelect: () => {
            // Reuses the masthead rack's existing context flow (POST /api/context lives there).
            setTimeout(() => document.getElementById("masthead-rack-toggle")?.click(), 50);
        } },
    ];
    for (const group of adminNavGroups) {
        for (const item of group.items) {
            const isOn = pathname === item.href;
            items.push({
                id: `nav-${item.href}`,
                label: item.label,
                hint: group.title + (isOn ? " · saat ini" : ""),
                onSelect: () => router.push(item.href),
            });
        }
    }
    return items;
}

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [announcements, setAnnouncements] = useState<AnnouncementResult[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const pathname = usePathname();

    const allItems = useMemo(() => buildActions(router, pathname), [router, pathname]);

    const staticResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allItems;
        return allItems.filter((i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q));
    }, [query, allItems]);

    // Global Ctrl/Cmd+K toggler
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((v) => !v);
            } else if (e.key === "Escape") {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Reset state on open
    useEffect(() => {
        if (open) {
            setQuery("");
            setActiveIndex(0);
            setAnnouncements([]);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    // Debounced announcement search — only while open and query is non-empty.
    // Scoped to the current site via localStorage (same key MastheadRack caches),
    // falling back to all accessible sites when no site is selected yet.
    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (!q) {
            setAnnouncements([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const siteId = typeof window !== "undefined" ? localStorage.getItem("currentSiteId") : null;
                const url =
                    `/api/announcements?q=${encodeURIComponent(q)}&includeAll=true&limit=8` +
                    (siteId ? `&siteId=${encodeURIComponent(siteId)}` : "");
                const res = await fetch(url);
                if (!res.ok) throw new Error(`search failed: ${res.status}`);
                const data: AnnouncementListResponse = await res.json();
                setAnnouncements(data.data ?? []);
            } catch (error) {
                // Keep static actions/navigation usable when search fails or loads.
                console.error("Palette announcement search failed:", error);
                setAnnouncements([]);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [query, open]);

    // Flattened list of interactive results (static + announcement search results),
    // ordered so static items stay on top and announcement hits follow.
    const results = useMemo(() => {
        const items: (PaletteItem | { id: string; type: "announcement"; data: AnnouncementResult })[] = [
            ...staticResults,
            ...announcements.map((a) => ({ id: `announcement-${a.id}`, type: "announcement" as const, data: a })),
        ];
        return items;
    }, [staticResults, announcements]);

    const onInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const item = results[activeIndex];
            if (item) {
                setOpen(false);
                if ("type" in item && item.type === "announcement") {
                    router.push(`/admin/announcements/${(item as { data: AnnouncementResult }).data.id}/edit`);
                } else {
                    (item as PaletteItem).onSelect();
                }
            }
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-modal flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 pt-[18vh]">
            {/* Backdrop click closes */}
            <div className="absolute inset-0" onClick={() => setOpen(false)} aria-hidden="true" />

            <div className="relative w-full max-w-xl rounded-sheet border border-border bg-surface-1 shadow-lvl-3 p-2">
                {/* Search input */}
                <div className="flex items-center gap-2 border-b border-border px-3 pb-2">
                    <MagnifyingGlass size={20} className="text-text-3" aria-hidden="true" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        onKeyDown={onInputKeyDown}
                        placeholder="Cari aksi, navigasi, pengumuman… (Ctrl+K)"
                        className="w-full bg-transparent py-1 text-sm text-text-1 placeholder:text-text-3 focus:outline-none"
                        aria-label="Cari aksi, navigasi, atau pengumuman"
                    />
                </div>

                {/* Results */}
                <ul className="max-h-72 overflow-y-auto py-1" role="listbox" aria-label="Hasil pencarian">
                    {results.length === 0 && (
                        <li className="px-3 py-3 text-sm text-text-3">Tidak ada hasil untuk “{query}”</li>
                    )}
                    {results.map((item, idx) => {
                        const active = idx === activeIndex;
                        const isAnnouncement = "type" in item && item.type === "announcement";
                        return (
                            <li key={item.id} role="option" aria-selected={active}>
                                <button
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => {
                                        setOpen(false);
                                        if (isAnnouncement) {
                                            router.push(`/admin/announcements/${(item as { data: AnnouncementResult }).data.id}/edit`);
                                        } else {
                                            (item as PaletteItem).onSelect();
                                        }
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm ${
                                        active ? "bg-accent/10 text-accent" : "text-text-1"
                                    } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                                >
                                    <span className="shrink-0 text-text-3">
                                        {isAnnouncement ? (
                                            <FileText size={16} aria-hidden="true" />
                                        ) : (item as PaletteItem).id.startsWith("action-") ? (
                                            (item as PaletteItem).id === "action-switch-site" ? (
                                                <ArrowsLeftRight size={16} aria-hidden="true" />
                                            ) : (
                                                <PlusCircle size={16} aria-hidden="true" />
                                            )
                                        ) : (item as PaletteItem).id === "goto-home" ? (
                                            <House size={16} aria-hidden="true" />
                                        ) : (
                                            <FileText size={16} aria-hidden="true" />
                                        )}
                                    </span>
                                    <span className="truncate">
                                        {isAnnouncement
                                            ? (item as { data: AnnouncementResult }).data.title
                                            : (item as PaletteItem).label}
                                    </span>
                                    {isAnnouncement && (
                                        <span className="shrink-0">
                                            <StatusPill
                                                status={deriveAnnouncementStatus({
                                                    isPublished: (item as { data: AnnouncementResult }).data.isPublished,
                                                    scheduledAt: (item as { data: AnnouncementResult }).data.scheduledAt,
                                                    takedownAt: (item as { data: AnnouncementResult }).data.takedownAt,
                                                })}
                                            />
                                        </span>
                                    )}
                                    {!isAnnouncement && (item as PaletteItem).hint && (
                                        <span className="ml-auto shrink-0 text-xs text-text-3">{(item as PaletteItem).hint}</span>
                                    )}
                                    {isAnnouncement && (
                                        <span className="ml-auto shrink-0 truncate text-xs text-text-3">
                                            {(item as { data: AnnouncementResult }).data.primarySite?.name ??
                                                (item as { data: AnnouncementResult }).data.category?.name ??
                                                "Pengumuman"}
                                        </span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
