"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlass, House, PlusCircle, FileText } from "@phosphor-icons/react";
import { adminNavGroups } from "@/lib/admin-nav";

interface PaletteItem {
    id: string;
    label: string;
    hint?: string;
    onSelect: () => void;
}

// ponytail: action set is static for now (Phase 1); "content" lands Phase 2 when
// announcement search + "switch site" rack land. Add when the data surfaces exist.
function buildActions(router: ReturnType<typeof useRouter>, pathname: string) {
    const items: PaletteItem[] = [
        { id: "action-new", label: "Buat pengumuman baru", hint: "Aksi", onSelect: () => router.push("/admin/announcements/new") },
        { id: "goto-home", label: "Dashboard", hint: "Navigasi", onSelect: () => router.push("/admin") },
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
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const pathname = usePathname();

    const allItems = useMemo(() => buildActions(router, pathname), [router, pathname]);

    const results = useMemo(() => {
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
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    // Keyboard nav within results
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
                item.onSelect();
            }
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[18vh]">
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
                        placeholder="Cari aksi, navigasi… (Ctrl+K)"
                        className="w-full bg-transparent py-1 text-sm text-text-1 placeholder:text-text-3 focus:outline-none"
                        aria-label="Cari aksi"
                    />
                </div>

                {/* Results */}
                <ul className="max-h-72 overflow-y-auto py-1" role="listbox" aria-label="Hasil pencarian">
                    {results.length === 0 && (
                        <li className="px-3 py-3 text-sm text-text-3">Tidak ada hasil untuk “{query}”</li>
                    )}
                    {results.map((item, idx) => {
                        const active = idx === activeIndex;
                        return (
                            <li key={item.id} role="option" aria-selected={active}>
                                <button
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => {
                                        setOpen(false);
                                        item.onSelect();
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm ${
                                        active ? "bg-accent/10 text-accent" : "text-text-1"
                                    } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                                >
                                    <span className="shrink-0 text-text-3">
                                        {item.id.startsWith("action-") ? <PlusCircle size={16} aria-hidden="true" /> : item.id === "goto-home" ? <House size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
                                    </span>
                                    <span className="truncate">{item.label}</span>
                                    {item.hint && <span className="ml-auto shrink-0 text-xs text-text-3">{item.hint}</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
