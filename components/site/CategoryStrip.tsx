"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface CategoryStripItem {
    label: string;
    href: string;
    active: boolean;
}

/**
 * Strip kategori editorial — tautan horizontal-scroll dengan marker aksen
 * yang MELUNCUR ke item aktif (transisi left/width lewat token motion).
 * Posisi marker diukur dari DOM (offsetLeft/offsetWidth) sehingga mengikuti
 * lebar label berapa pun, dan diukur ulang saat resize / pergantian item.
 *
 * Client component karena pengukuran; navigasi tetap <Link> biasa (SSR,
 * crawlable, keyboard-accessible). Tanpa JS marker hanya tidak tampil —
 * state aktif tetap terbaca dari warna + aria-current.
 */
export default function CategoryStrip({ items }: { items: CategoryStripItem[] }) {
    const navRef = useRef<HTMLElement>(null);
    const [marker, setMarker] = useState<{ left: number; width: number; visible: boolean }>({
        left: 0,
        width: 0,
        visible: false,
    });

    useEffect(() => {
        const measure = () => {
            const nav = navRef.current;
            const active = nav?.querySelector<HTMLAnchorElement>('[data-active="true"]');
            if (nav && active) {
                setMarker({ left: active.offsetLeft, width: active.offsetWidth, visible: true });
            } else {
                setMarker((m) => ({ ...m, visible: false }));
            }
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [items]);

    return (
        <nav
            ref={navRef}
            aria-label="Filter kategori"
            className="category-strip relative flex gap-6 overflow-x-auto border-b border-border"
        >
            {items.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    data-active={item.active}
                    aria-current={item.active ? "true" : undefined}
                    className={`whitespace-nowrap py-3 text-small font-semibold uppercase tracking-[0.08em] transition-colors duration-150 ${
                        item.active ? "text-text-1" : "text-text-3 hover:text-text-1"
                    }`}
                >
                    {item.label}
                </Link>
            ))}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 h-[2px] bg-accent"
                style={{
                    left: marker.left,
                    width: marker.width,
                    opacity: marker.visible ? 1 : 0,
                    transition:
                        "left var(--motion-standard) var(--motion-ease), width var(--motion-standard) var(--motion-ease), opacity var(--motion-fast) var(--motion-ease)",
                }}
            />
        </nav>
    );
}
