"use client";

import { useEffect, useRef, useState } from "react";
import { isNew, lastVisitKey, parseReadList, pushRead, readKey } from "@/lib/reading-state";

function safeGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * Badge BARU / tanda sudah dibaca untuk satu kartu. Tanpa storage → tidak
 * merender apa pun (tampilan default). lastVisit yang dibandingkan adalah nilai
 * SEBELUM kunjungan ini — EditionStrip baru menulis nilai baru saat pagehide.
 */
export function ReadMarker({ siteSlug, id, createdAt }: { siteSlug: string; id: string; createdAt: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [fresh, setFresh] = useState(false);

    useEffect(() => {
        const read = parseReadList(safeGet(readKey(siteSlug)));
        const card = ref.current?.closest<HTMLElement>("[data-story-card]");
        if (read.includes(id) && card) card.dataset.read = "true";
        setFresh(isNew(createdAt, safeGet(lastVisitKey(siteSlug)), read, id));
    }, [siteSlug, id, createdAt]);

    return (
        <span ref={ref} className="contents">
            {fresh && (
                <span className="ml-2 inline-block rounded-[2px] bg-[var(--site-primary-dark)] px-1.5 py-0.5 align-[2px] font-sans text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--site-text-on-primary)]">
                    Baru
                </span>
            )}
        </span>
    );
}

/** Catat artikel sebagai dibaca saat dibuka. */
export function MarkRead({ siteSlug, id }: { siteSlug: string; id: string }) {
    useEffect(() => {
        try {
            const key = readKey(siteSlug);
            localStorage.setItem(key, JSON.stringify(pushRead(parseReadList(localStorage.getItem(key)), id)));
        } catch {
            // Storage diblokir: status dibaca tidak dicatat.
        }
    }, [siteSlug, id]);
    return null;
}
