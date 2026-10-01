"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import AppTile from "@/components/portal/AppTile";
import CommandPalette from "@/components/portal/CommandPalette";
import { useToast } from "@/contexts/ToastContext";
import { getRelativeTime } from "@/lib/utils";
import {
    countHealth, greetingFor, healthBucket, isPaletteShortcut, pickFavorites, pickRecent,
    type HealthBucket, type HomeApp,
} from "@/lib/portal-home";

interface HomeGroup {
    id: string;
    name: string;
    apps: HomeApp[];
}

const COLLAPSE_AFTER = 12;
const STATUS_ORDER: { bucket: HealthBucket; label: string; dot: string }[] = [
    { bucket: "ONLINE", label: "normal", dot: "bg-success" },
    { bucket: "DEGRADED", label: "lambat", dot: "bg-warning" },
    { bucket: "OFFLINE", label: "gangguan", dot: "bg-danger" },
    { bucket: "UNKNOWN", label: "belum dicek", dot: "bg-text-3" },
];

function readCollapsed(groupId: string): boolean {
    try {
        return localStorage.getItem(`portal:collapsed:${groupId}`) === "1";
    } catch {
        return false;
    }
}

function writeCollapsed(groupId: string, collapsed: boolean) {
    try {
        if (collapsed) localStorage.setItem(`portal:collapsed:${groupId}`, "1");
        else localStorage.removeItem(`portal:collapsed:${groupId}`);
    } catch {
        // Storage diblokir: status lipat hanya untuk sesi ini.
    }
}

/** Panah kiri/kanan/atas/bawah memindah fokus antar tile dalam satu grid. */
function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!keys.includes(e.key)) return;
    const tiles = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>("[data-app-tile]"));
    const i = tiles.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.round(e.currentTarget.clientWidth / tiles[0].getBoundingClientRect().width));
    const delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -cols : cols;
    const next = tiles[i + delta];
    if (next) {
        e.preventDefault();
        next.focus();
    }
}

export default function PortalHome({
    userName,
    groups,
    pinnedIds,
    openPalette = false,
}: {
    userName: string;
    groups: HomeGroup[];
    pinnedIds: string[];
    openPalette?: boolean;
}) {
    const { error: toastError } = useToast();
    const [pinned, setPinned] = useState(() => new Set(pinnedIds));
    const [filter, setFilter] = useState<HealthBucket | null>(null);
    const [paletteOpen, setPaletteOpen] = useState(openPalette);
    // Salam netral saat SSR; diganti salam sesuai jam perangkat setelah mount.
    const [greeting, setGreeting] = useState("Halo");
    const [today, setToday] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const firstName = userName.split(" ")[0] || userName;

    const allApps = useMemo(() => groups.flatMap((g) => g.apps), [groups]);
    const favorites = pickFavorites(allApps, pinned);
    const recent = pickRecent(allApps, pinned);
    const health = countHealth(allApps);
    const suggestions = [...favorites, ...pickRecent(allApps, pinned, 6)].slice(0, 8);

    useEffect(() => {
        const now = new Date();
        setGreeting(greetingFor(now.getHours()));
        setToday(new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now));
        setCollapsed(Object.fromEntries(groups.map((g) => [g.id, g.apps.length > COLLAPSE_AFTER && readCollapsed(g.id)])));
        if (openPalette) window.history.replaceState(null, "", "/portal");
    }, [groups, openPalette]);

    const paletteOpenRef = useRef(paletteOpen);
    paletteOpenRef.current = paletteOpen;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (!paletteOpenRef.current && isPaletteShortcut({
                key: e.key,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                targetTag: t?.tagName,
                targetEditable: t?.isContentEditable,
            })) {
                e.preventDefault();
                setPaletteOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const togglePin = async (app: HomeApp) => {
        const next = !pinned.has(app.id);
        const apply = (on: boolean) =>
            setPinned((prev) => {
                const s = new Set(prev);
                if (on) s.add(app.id);
                else s.delete(app.id);
                return s;
            });
        apply(next); // optimistik
        try {
            const res = await fetch(`/api/portal/apps/${app.id}/pin`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ pinned: next }),
            });
            if (!res.ok) throw new Error(String(res.status));
        } catch {
            apply(!next);
            toastError(null, "Gagal menyimpan favorit");
        }
    };

    const show = (app: HomeApp) => !filter || healthBucket(app.healthStatus) === filter;

    return (
        <div className="relative">
            <div aria-hidden="true" className="portal-mesh pointer-events-none absolute inset-x-0 top-0 h-[320px]" />
            <div className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-8 sm:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="font-display text-title font-semibold text-text-1">
                            {greeting}, {firstName}
                        </h1>
                        <p className="mt-1 min-h-[1.25rem] text-small text-text-2">{today}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        className="inline-flex h-10 min-w-[240px] items-center gap-2 rounded-control border border-border bg-surface-1 px-3 text-sm text-text-3 transition-colors duration-150 hover:border-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <MagnifyingGlass size={16} aria-hidden="true" />
                        Cari aplikasi…
                        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-2">Ctrl K</kbd>
                    </button>
                </div>

                {favorites.length > 0 && (
                    <section aria-labelledby="fav-h" className="mt-8">
                        <h2 id="fav-h" className="portal-label">Favorit</h2>
                        <div onKeyDown={onGridKeyDown} className="portal-grid mt-2">
                            {favorites.map((app) => (
                                <AppTile key={app.id} app={app} pinned onTogglePin={togglePin} />
                            ))}
                        </div>
                    </section>
                )}

                {recent.length > 0 && (
                    <section aria-labelledby="recent-h" className="mt-8">
                        <h2 id="recent-h" className="portal-label">Terakhir dipakai</h2>
                        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                            {recent.map((app) => (
                                <div key={app.id} className="flex items-center gap-3 rounded-sheet border border-border bg-surface-1 pr-3">
                                    <div className="w-[76px] shrink-0">
                                        <AppTile app={app} pinned={pinned.has(app.id)} onTogglePin={togglePin} size="md" />
                                    </div>
                                    <span className="text-xs text-text-3">{getRelativeTime(app.lastUsedAt!)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="portal-label m-0">Semua aplikasi</h2>
                    <div role="group" aria-label="Filter status aplikasi" className="flex flex-wrap gap-1.5">
                        {STATUS_ORDER.filter((s) => health[s.bucket] > 0).map((s) => (
                            <button
                                key={s.bucket}
                                type="button"
                                aria-pressed={filter === s.bucket}
                                onClick={() => setFilter((f) => (f === s.bucket ? null : s.bucket))}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                                    filter === s.bucket ? "border-accent/40 bg-accent-subtle text-text-1" : "border-border bg-surface-1 text-text-2 hover:text-text-1"
                                }`}
                            >
                                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                                {health[s.bucket]} {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {groups.map((g) => {
                    const apps = g.apps.filter(show);
                    if (apps.length === 0) return null;
                    const collapsible = g.apps.length > COLLAPSE_AFTER;
                    const grid = (
                        <div onKeyDown={onGridKeyDown} className="portal-grid mt-2">
                            {apps.map((app) => (
                                <AppTile key={app.id} app={app} pinned={pinned.has(app.id)} onTogglePin={togglePin} />
                            ))}
                        </div>
                    );
                    return (
                        <section key={g.id} aria-label={g.name} className="mt-6">
                            {collapsible ? (
                                <details
                                    open={!collapsed[g.id]}
                                    onToggle={(e) => {
                                        const isCollapsed = !(e.currentTarget as HTMLDetailsElement).open;
                                        writeCollapsed(g.id, isCollapsed);
                                    }}
                                >
                                    <summary className="portal-label cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                                        {g.name} <span className="font-normal normal-case tracking-normal text-text-3">({apps.length})</span>
                                    </summary>
                                    {grid}
                                </details>
                            ) : (
                                <>
                                    <h3 className="portal-label">{g.name}</h3>
                                    {grid}
                                </>
                            )}
                        </section>
                    );
                })}
            </div>

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} apps={allApps} suggestions={suggestions} />
        </div>
    );
}
