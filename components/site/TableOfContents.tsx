"use client";

import { useEffect, useRef, useState } from "react";
import { ListBullets } from "@phosphor-icons/react";
import { slugify } from "@/lib/utils";

interface Heading { id: string; text: string; level: 2 | 3 }

/** Daftar isi dari h2/h3 di konten artikel. Tampil hanya bila ≥ 3 heading. */
export default function TableOfContents({ containerSelector }: { containerSelector: string }) {
    const [headings, setHeadings] = useState<Heading[]>([]);
    const [active, setActive] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const root = document.querySelector(containerSelector);
        if (!root) return;
        const used = new Set<string>();
        const found: Heading[] = [];
        root.querySelectorAll<HTMLHeadingElement>("h2, h3").forEach((h) => {
            const text = h.textContent?.trim() ?? "";
            if (!text) return;
            if (!h.id) {
                let id = slugify(text) || "bagian";
                for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`;
                h.id = id;
            }
            used.add(h.id);
            h.style.scrollMarginTop = "96px";
            found.push({ id: h.id, text, level: h.tagName === "H2" ? 2 : 3 });
        });
        setHeadings(found);

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: "-80px 0px -70% 0px" },
        );
        found.forEach((h) => {
            const el = document.getElementById(h.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [containerSelector]);

    if (headings.length < 3) return null;

    const list = (onPick?: () => void) => (
        <ol className="space-y-1.5 text-sm">
            {headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                    <a
                        href={`#${h.id}`}
                        onClick={onPick}
                        aria-current={active === h.id ? "location" : undefined}
                        className={`block rounded-[2px] border-l-2 py-0.5 pl-3 leading-snug transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                            active === h.id ? "border-accent text-text-1" : "border-transparent text-text-3 hover:text-text-1"
                        }`}
                    >
                        {h.text}
                    </a>
                </li>
            ))}
        </ol>
    );

    return (
        <>
            {/* Desktop: kolom melayang di kiri konten */}
            <nav aria-label="Daftar isi" className="fixed left-[max(16px,calc(50%-400px-240px))] top-32 hidden w-52 xl:block">
                <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-3">Daftar isi</p>
                {list()}
            </nav>

            {/* Ponsel & tablet: tombol membuka dialog */}
            <button
                type="button"
                onClick={() => dialogRef.current?.showModal()}
                className="fixed bottom-4 left-4 z-dropdown inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-sm font-semibold text-text-1 shadow-lvl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:hidden"
            >
                <ListBullets size={16} aria-hidden="true" />
                Daftar isi
            </button>
            <dialog
                ref={dialogRef}
                aria-label="Daftar isi"
                onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
                className="m-0 mt-auto w-full max-w-none rounded-t-sheet border border-border bg-surface-1 p-6 text-text-1 backdrop:bg-black/50"
            >
                <p className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-3">Daftar isi</p>
                {list(() => dialogRef.current?.close())}
            </dialog>
        </>
    );
}
