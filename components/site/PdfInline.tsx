"use client";

import { useRef } from "react";
import { DownloadSimple, ArrowsOutSimple } from "@phosphor-icons/react";

interface PdfInlineProps {
    src: string;
    filename?: string;
}

/**
 * Inline native PDF viewer (Phase 12-03).
 *
 * Renders at the `[data-pdf]` placeholder on the public article page via the
 * layered fallback chain (D-05/D-08):
 *   <object application/pdf>  ->  <iframe>  ->  object fallback content
 * (paragraph + download link as a DIRECT child of <object>, so it surfaces when
 * the load itself fails — X-Frame-Options / non-PDF / network — not only when
 * iframes are unsupported). Never opens a tab/window automatically. The ONLY
 * tab-opening path is the Fullscreen fallback, and it fires on an explicit
 * click AND only when the Fullscreen API is unavailable.
 */
export default function PdfInline({ src, filename }: PdfInlineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const label = filename || "PDF";

    const handleFullscreen = () => {
        const el = containerRef.current;
        if (!el) return;

        // Fullscreen API unavailable -> the only fallback is opening `src` in a
        // new tab, gated on availability and fied only on an explicit click
        // (never automatic).
        if (typeof document.fullscreenEnabled === "undefined" || !el.requestFullscreen) {
            window.open(src, "_blank", "noopener,noreferrer");
            return;
        }

        if (document.fullscreenElement) {
            void document.exitFullscreen?.();
        } else {
            void el.requestFullscreen().catch(() => {});
        }
    };

    return (
        <div ref={containerRef} className="pdf-viewer">
            {/* Toolbar: Download (stays on page) + Fullscreen (explicit click) */}
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3 py-2">
                <span className="truncate text-xs font-medium text-text-2" title={label}>
                    {label}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                    <a
                        href={src}
                        download
                        aria-label="Unduh PDF"
                        title="Unduh PDF"
                        className="inline-flex size-7 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-3 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                    </a>
                    <button
                        type="button"
                        onClick={handleFullscreen}
                        aria-label="Tampilkan layar penuh"
                        title="Tampilkan layar penuh"
                        className="inline-flex size-7 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-3 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <ArrowsOutSimple size={16} weight="bold" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Layered fallback (WR-01): object -> iframe -> fallback content.
                Paragraf + tautan unduh adalah ANAK LANGSUNG <object>, bukan anak
                <iframe> — fallback iframe hanya tampil saat browser tak mendukung
                iframe sama sekali, sedangkan kegagalan muat iframe (X-Frame-Options,
                non-PDF, network) justru kasus yang harus mendegrade ke tautan. */}
            <object
                type="application/pdf"
                data={src}
                aria-label={label}
                className="pdf-viewer-body"
            >
                <iframe src={src} title={label} className="size-full" />
                <div className="flex h-full flex-col items-center justify-center gap-3 px-3 py-6 text-center">
                    <p className="text-sm text-text-2">PDF tidak dapat ditampilkan inline.</p>
                    <a
                        href={src}
                        download
                        className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text-1 transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <DownloadSimple size={14} weight="bold" aria-hidden="true" />
                        Unduh PDF
                    </a>
                </div>
            </object>
        </div>
    );
}
