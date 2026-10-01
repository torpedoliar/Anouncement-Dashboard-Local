"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { iconColor, rankApps, type HomeApp } from "@/lib/portal-home";

/** Dialog <dialog> native: fokus terkunci & Esc bawaan browser. */
export default function CommandPalette({
    open,
    onClose,
    apps,
    suggestions,
}: {
    open: boolean;
    onClose: () => void;
    apps: HomeApp[];
    suggestions: HomeApp[];
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            setQuery("");
            setActive(0);
            d.showModal();
        } else if (!open && d.open) {
            d.close();
        }
    }, [open]);

    const results = query.trim() ? rankApps(query, apps).slice(0, 8) : suggestions;

    const go = (app: HomeApp) => {
        window.location.href = `/portal/app/${app.slug}`;
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active]);
        }
    };

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            onClick={(e) => e.target === ref.current && onClose()}
            aria-label="Cari aplikasi"
            className="portal-palette m-0 mx-auto mt-[12vh] w-[min(560px,calc(100vw-32px))] rounded-sheet border border-border bg-surface-1 p-0 text-text-1 shadow-lvl-3 backdrop:bg-black/50"
        >
            <div className="flex items-center gap-3 border-b border-border px-4">
                <MagnifyingGlass size={18} className="shrink-0 text-text-3" aria-hidden="true" />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Ketik nama aplikasi…"
                    aria-label="Nama aplikasi"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="palette-list"
                    aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
                    className="h-14 w-full bg-transparent text-base outline-none placeholder:text-text-3"
                />
                <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-3">Esc</kbd>
            </div>
            <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
                {!query.trim() && results.length > 0 && (
                    <li role="presentation" className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-3">
                        Favorit &amp; terakhir dipakai
                    </li>
                )}
                {results.map((app, i) => (
                    <li
                        key={app.id}
                        id={`palette-${app.id}`}
                        role="option"
                        aria-selected={i === active}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(app)}
                        className={`flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 ${i === active ? "bg-surface-2" : ""}`}
                    >
                        <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-sm font-bold text-white"
                            style={{ backgroundColor: iconColor(app.name) }}
                            aria-hidden="true"
                        >
                            {app.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{app.name}</span>
                            <span className="block truncate text-xs text-text-3">{app.groupName}</span>
                        </span>
                        {i === active && <span className="text-xs text-text-3">Enter ↵</span>}
                    </li>
                ))}
                {query.trim() && results.length === 0 && (
                    <li role="presentation" className="px-3 py-6 text-center text-sm text-text-3">
                        Tidak ada aplikasi bernama &ldquo;{query}&rdquo;.
                    </li>
                )}
            </ul>
        </dialog>
    );
}
