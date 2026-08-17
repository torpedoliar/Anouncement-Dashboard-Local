"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FilePdf } from "@phosphor-icons/react";
import PdfInline from "@/components/site/PdfInline";

interface ArticleContentProps {
    html: string;
}

interface LampiranItem {
    src: string;
    label: string;
}

/** Basename dari data-src (D-10): segmen terakhir dari path URL, tanpa query/hash. */
function basename(src: string): string {
    const path = src.split(/[?#]/)[0];
    const seg = path.split("/").filter(Boolean).pop();
    return seg || src;
}

/**
 * Reader-side hydrator (Phase 12-03).
 *
 * Merender prosa artikel apa adanya (`.prose-santos` + dangerouslySetInnerHTML)
 * lalu me-mount PdfInline ke setiap placeholder `div[data-pdf]` dan menyusun
 * daftar "Lampiran" (dedup by src, urutan kemunculan pertama) persis di bawah
 * konten — sumber tunggal: href Lampiran == data-src yang sama dengan embed.
 */
export default function ArticleContent({ html }: ArticleContentProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const rootsRef = useRef<Root[]>([]);
    const [lampiran, setLampiran] = useState<LampiranItem[]>([]);

    useEffect(() => {
        const container = contentRef.current;

        // Bongkar viewer lama sebelum re-mount (html berubah) — jangan sampai
        // stacked multiple viewers.
        for (const root of rootsRef.current) {
            root.unmount();
        }
        rootsRef.current = [];

        if (!container) return;

        const placeholders = Array.from(container.querySelectorAll("div[data-pdf]"));
        const roots: Root[] = [];
        const seen = new Set<string>();
        const items: LampiranItem[] = [];

        for (const el of placeholders) {
            const src = el.getAttribute("data-src");
            if (!src) continue;

            // Kosongkan isi placeholder sebelum mount (guard re-render).
            el.replaceChildren();

            const root = createRoot(el);
            root.render(
                <PdfInline
                    src={src}
                    filename={el.getAttribute("data-filename") || undefined}
                />
            );
            roots.push(root);

            // Dedup lampiran oleh data-src, pertahankan kemunculan pertama.
            if (!seen.has(src)) {
                seen.add(src);
                items.push({
                    src,
                    label: el.getAttribute("data-filename") || basename(src),
                });
            }
        }

        rootsRef.current = roots;
        setLampiran(items);

        return () => {
            for (const root of roots) {
                root.unmount();
            }
        };
    }, [html]);

    return (
        <>
            <div
                className="prose-santos"
                dangerouslySetInnerHTML={{ __html: html }}
                ref={contentRef}
            />

            {/* Lampiran: hanya muncul kalau ada data-src (D-10); di bawah prosa,
                di atas notice syndication di page. */}
            {lampiran.length > 0 && (
                <section className="mt-8 border-t border-border pt-4" aria-label="Lampiran">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-1">
                        Lampiran
                    </h2>
                    <ul className="mt-3 space-y-2">
                        {lampiran.map((item) => (
                            <li key={item.src} className="flex items-center gap-2.5">
                                <FilePdf
                                    size={18}
                                    weight="bold"
                                    className="shrink-0 text-accent"
                                    aria-hidden="true"
                                />
                                <span className="truncate text-sm text-text-2" title={item.label}>
                                    {item.label}
                                </span>
                                <a
                                    href={item.src}
                                    download
                                    className="ml-auto shrink-0 text-xs font-medium text-accent underline decoration-current underline-offset-2 transition-colors hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                >
                                    Unduh
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}
