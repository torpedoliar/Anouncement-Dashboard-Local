"use client";

/**
 * Read-only masthead preview of the announcement.
 * Props mirror the form state; no persistence or editing.
 */

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";

interface MediaImage {
    type: "image";
    url: string | null;
}
interface MediaVideo {
    type: "video";
    url: string | null;
}
interface MediaYoutube {
    type: "youtube";
    url: string | null;
}
type Media = MediaImage | MediaVideo | MediaYoutube;

export interface AnnouncementPreviewProps {
    title: string;
    content: string;
    category?: string;
    media?: Media | null;
    siteName?: string;
    primaryColor?: string;
}

export default function AnnouncementPreview({
    title,
    content,
    category,
    media,
    siteName,
    primaryColor,
}: AnnouncementPreviewProps) {
    const [safeContent, setSafeContent] = useState("");

    useEffect(() => {
        if (content) {
            setSafeContent(DOMPurify.sanitize(content, { USE_PROFILES: { html: true } }));
        } else {
            setSafeContent("");
        }
    }, [content]);

    const isEmpty = !title && !content && (!media || media.type === "image" && !media.url);

    // Extract YouTube ID for iframe embed
    const youtubeId =
        media?.type === "youtube" && media.url
            ? media.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
                ?.[1]
            : null;

    if (isEmpty) {
        return (
            <div
                className="flex flex-col items-center justify-center gap-3 rounded-card p-8 text-center"
                style={{ background: "var(--surface-2)", border: `1px dashed var(--border)` }}
            >
                <div style={{ fontSize: "32px", opacity: 0.4 }}>📰</div>
                <p style={{ color: "var(--text-3)", fontSize: "14px", margin: 0 }}>
                    Preview akan muncul di sini saat Anda mulai menulis.
                </p>
            </div>
        );
    }

    return (
        <article
            className="flex flex-col gap-4"
            style={{
                background: "var(--surface-1)",
                border: `1px solid var(--border)`,
                borderRadius: "var(--radius-card)",
                overflow: "hidden",
            }}
        >
            {/* Masthead header */}
            <div style={{ borderBottom: `1px solid var(--border)` }}>
                <div className="flex items-center gap-2 px-5 py-3">
                    {primaryColor && (
                        <span
                            className="inline-block size-3 rounded-sm"
                            style={{ backgroundColor: primaryColor }}
                            aria-label="Warna utama situs"
                        />
                    )}
                    {siteName && (
                        <span style={{ color: "var(--text-2)", fontSize: "13px", fontWeight: 500 }}>
                            {siteName}
                        </span>
                    )}
                    {category && (
                        <span
                            className="inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-xs font-semibold"
                            style={{
                                background: `${category}18`,
                                color: category,
                            }}
                        >
                            {category}
                        </span>
                    )}
                </div>
                {title && (
                    <h2
                        className="px-5 pb-4"
                        style={{
                            fontSize: "22px",
                            fontWeight: 700,
                            lineHeight: 1.3,
                            color: "var(--text-1)",
                        }}
                    >
                        {title}
                    </h2>
                )}
            </div>

            {/* Media block */}
            {media && (media.type === "image" || media.type === "video" || youtubeId) && (
                <div className="relative overflow-hidden">
                    {media.type === "image" && media.url && (
                        <img
                            src={media.url}
                            alt=""
                            className="w-full"
                            style={{ maxHeight: "260px", objectFit: "cover" }}
                        />
                    )}
                    {media.type === "video" && media.url && (
                        <video
                            src={media.url}
                            controls
                            className="w-full"
                            style={{ maxHeight: "260px", background: "var(--surface-0)" }}
                        />
                    )}
                    {media.type === "youtube" && youtubeId && (
                        <div
                            className="relative"
                            style={{ paddingBottom: "56.25%", height: 0 }}
                        >
                            <iframe
                                src={`https://www.youtube.com/embed/${youtubeId}`}
                                className="absolute inset-0 size-full"
                                style={{ border: 0 }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Preview YouTube"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            {safeContent && (
                <div
                    className="prose-santos prose-sm px-5 pb-5"
                    style={{ color: "var(--text-2)", fontSize: "14px", lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: safeContent }}
                />
            )}

            {/* Content visible when empty but title exists */}
            {!safeContent && title && (
                <div className="px-5 pb-4">
                    <p style={{ color: "var(--text-3)", fontSize: "13px", fontStyle: "italic", margin: 0 }}>
                        Belum ada konten.
                    </p>
                </div>
            )}
        </article>
    );
}
