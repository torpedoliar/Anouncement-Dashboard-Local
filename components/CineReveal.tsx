"use client";

import { useEffect } from "react";

/**
 * Fallback scroll-reveal untuk browser tanpa CSS scroll-driven animations.
 *
 * Primer tetap CSS murni (`animation-timeline: view()` di globals.css). Bila
 * tidak didukung, komponen ini memasang SATU IntersectionObserver yang
 * menandai elemen [data-cine] dengan class .in saat masuk viewport — class
 * itulah yang memicu keyframe yang sama. Dipasang sekali di layout site &
 * portal; tanpa observer sama sekali bila API CSS tersedia.
 */
export default function CineReveal() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (CSS.supports?.("animation-timeline: view()")) return;

        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("in");
                        io.unobserve(entry.target);
                    }
                }
            },
            { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
        );

        const observeAll = () => {
            document.querySelectorAll("[data-cine]:not(.in)").forEach((el) => io.observe(el));
        };
        observeAll();
        // Grid feed bertambah lewat pagination — amati ulang tiap mutasi DOM.
        const mo = new MutationObserver(observeAll);
        mo.observe(document.body, { childList: true, subtree: true });

        return () => {
            io.disconnect();
            mo.disconnect();
        };
    }, []);

    return null;
}
