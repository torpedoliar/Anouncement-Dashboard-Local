"use client";

import { useEffect, useState } from "react";
import { countNew, editionLabel, lastVisitKey, parseReadList, readKey } from "@/lib/reading-state";

/**
 * Strip edisi di atas masthead: tanggal · edisi · "N baru sejak kunjungan terakhir".
 * lastVisit diperbarui saat pagehide supaya badge BARU tetap tampil selama
 * kunjungan berjalan.
 */
export default function EditionStrip({ siteSlug, items }: { siteSlug: string; items: { id: string; createdAt: string }[] }) {
    const [state, setState] = useState<{ date: string; edition: string; fresh: number } | null>(null);

    useEffect(() => {
        const now = new Date();
        let fresh = 0;
        try {
            fresh = countNew(items, localStorage.getItem(lastVisitKey(siteSlug)), parseReadList(localStorage.getItem(readKey(siteSlug))));
        } catch {
            fresh = 0;
        }
        setState({
            date: new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now),
            edition: editionLabel(now.getHours()),
            fresh,
        });

        const save = () => {
            try {
                localStorage.setItem(lastVisitKey(siteSlug), new Date().toISOString());
            } catch {
                // abaikan
            }
        };
        window.addEventListener("pagehide", save);
        return () => window.removeEventListener("pagehide", save);
    }, [siteSlug, items]);

    return (
        <div className="border-b border-border">
            <div className="mx-auto flex min-h-9 max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-3">
                <span>{state?.date ?? " "}</span>
                <span>{state?.edition}</span>
                <span aria-live="polite">
                    {state && state.fresh > 0 ? `${state.fresh} baru sejak kunjungan terakhir` : ""}
                </span>
            </div>
        </div>
    );
}
