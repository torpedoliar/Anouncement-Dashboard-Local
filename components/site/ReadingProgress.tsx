"use client";

import { useEffect, useState } from "react";

/** Bar progress baca + "sisa N menit" dari wordCount × sisa proporsi konten. */
export default function ReadingProgress({ targetId, wordCount }: { targetId: string; wordCount: number }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const el = document.getElementById(targetId);
        if (!el) return;
        let frame = 0;
        const update = () => {
            frame = 0;
            const rect = el.getBoundingClientRect();
            const total = rect.height - window.innerHeight;
            const p = total <= 0 ? (rect.top <= 0 ? 1 : 0) : Math.min(1, Math.max(0, -rect.top / total));
            setProgress(p);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [targetId]);

    const minutesLeft = Math.ceil((wordCount * (1 - progress)) / 200);

    return (
        <>
            <div aria-hidden="true" className="fixed inset-x-0 top-0 z-tooltip h-0.5 origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
            {progress > 0.02 && progress < 0.98 && minutesLeft > 0 && (
                <div className="pointer-events-none fixed bottom-4 right-4 z-dropdown rounded-full border border-border bg-surface-1/95 px-3 py-1 font-mono text-[11px] text-text-2 shadow-lvl-1">
                    sisa {minutesLeft} menit
                </div>
            )}
        </>
    );
}
