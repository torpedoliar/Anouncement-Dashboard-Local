"use client";

import { useState } from "react";
import Link from "next/link";
import { SquaresFour } from "@phosphor-icons/react";
import AppCard from "@/components/portal/AppCard";

export interface GridApp {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logoPath?: string | null;
    category?: string | null;
    credentialCount: number;
}

export interface GridGroup {
    id: string;
    name: string;
    apps: GridApp[];
}

const ALL_GROUPS = "__all__";

/**
 * Grid /portal: chip kategori (satu chip per nama grup — dari getPortalLayout, bukan PortalApp.category)
 * + grid responsif 1/2/3/4 kolom. Urutan app dalam grup = urutan server (tanpa re-sort).
 */
export default function GroupedAppGrid({ groups }: { groups: GridGroup[] }) {
    const [activeGroup, setActiveGroup] = useState<string>(ALL_GROUPS);

    const visibleGroups =
        activeGroup === ALL_GROUPS ? groups : groups.filter((g) => g.id === activeGroup);

    const chipClass = (active: boolean) =>
        `rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-150 ${
            active
                ? "border-accent/40 bg-accent-subtle text-accent"
                : "border-border bg-surface-1 text-text-2 hover:bg-surface-2 hover:text-text-1"
        }`;

    return (
        <div className="flex flex-col gap-8">
            {/* Chip row — seleksi client-side, tanpa fetch/URL */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter grup aplikasi">
                <button
                    type="button"
                    aria-pressed={activeGroup === ALL_GROUPS}
                    onClick={() => setActiveGroup(ALL_GROUPS)}
                    className={chipClass(activeGroup === ALL_GROUPS)}
                >
                    Semua
                </button>
                {groups.map((g) => (
                    <button
                        key={g.id}
                        type="button"
                        aria-pressed={activeGroup === g.id}
                        onClick={() => setActiveGroup(g.id)}
                        className={chipClass(activeGroup === g.id)}
                    >
                        {g.name}
                    </button>
                ))}
            </div>

            {visibleGroups.length === 0 ? (
                /* Empty state (hasil filter kosong) */
                <div className="mx-auto max-w-[400px] rounded-sheet border border-border bg-surface-1 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet bg-surface-2">
                        <SquaresFour size={24} className="text-text-2" aria-hidden="true" />
                    </div>
                    <h2 className="mt-6 font-display text-xl font-semibold text-text-1">
                        Belum ada aplikasi di grup ini.
                    </h2>
                    <p className="mt-2 text-sm text-text-2">
                        Tidak ada aplikasi yang dapat ditampilkan saat ini. Atur visibilitas lewat Pengaturan.
                    </p>
                    <Link
                        href="/portal/settings"
                        className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        Buka Pengaturan
                    </Link>
                </div>
            ) : (
                visibleGroups.map((g) => (
                    <section key={g.id}>
                        <h2 className="text-sm font-semibold text-text-2">{g.name}</h2>
                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {g.apps.map((app) => (
                                <AppCard key={app.id} {...app} />
                            ))}
                        </div>
                    </section>
                ))
            )}
        </div>
    );
}