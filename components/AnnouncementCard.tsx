"use client";

import Link from "next/link";
import Image from "next/image";
import { extractYoutubeId, formatDateShort, readingTimeLabel } from "@/lib/utils";
import { Clock, Play, PushPin, YoutubeLogo } from "@phosphor-icons/react";
import { useRef, useState, useEffect } from "react";

interface AnnouncementCardProps {
    id: string;
    title: string;
    excerpt?: string;
    slug: string;
    // Site-scoped href (/site/${siteSlug}/${slug}). Opsional: setelah T6 menghapus
    // app/search/page.tsx (pemanggil lintas-site terakhir), ini jadi wajib.
    // Sementara absen -> fallback ke /${slug} (hop redirect lewat app/[slug]).
    siteSlug?: string;
    imagePath?: string;
    videoPath?: string | null;
    videoType?: string | null;
    youtubeUrl?: string | null;
    category: {
        name: string;
        color: string;
    };
    createdAt: Date | string;
    isPinned?: boolean;
    /** wordCount dari DB — menampilkan label "N menit baca" di meta. */
    wordCount?: number;
    /** Varian lebar: media kiri, konten kanan (dipakai kartu pertama feed). */
    featured?: boolean;
    /** Kelas/properti tambahan untuk wrapper — dipakai stagger motion (Varian C). */
    style?: React.CSSProperties;
}

export default function AnnouncementCard({
    title,
    excerpt,
    slug,
    siteSlug,
    imagePath,
    videoPath,
    videoType,
    youtubeUrl,
    category,
    createdAt,
    isPinned,
    wordCount,
    featured,
    style,
}: AnnouncementCardProps) {
    const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
    // Thumbnail YouTube (img.youtube.com) jika ada; kalau ada imagePath pakai itu.
    // Elemen <video> hanya untuk kartu dengan videoPath dan TANPA imagePath
    // (tanpa metadata untuk ambil frame, andalkan poster/preview statis).
    const youtubeThumb = videoType === 'youtube' && youtubeId
        ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
        : null;
    const imageThumb = imagePath || null;
    const showVideoFrame = !!videoPath && !imageThumb && !youtubeThumb;
    const hasVideo = videoPath || videoType === 'youtube';

    const videoRef = useRef<HTMLVideoElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // Handle hover/tap events for video playback
    // Works for both desktop (hover) and mobile (tap)
    useEffect(() => {
        if (!showVideoFrame) return;

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQuery.matches) return;

        const videoElement = videoRef.current;
        if (!videoElement) return;

        // Desktop: mouse enter/leave
        const handleMouseEnter = () => {
            setIsHovered(true);
        };

        const handleMouseLeave = () => {
            setIsHovered(false);
        };

        // Mobile: tap/click to toggle play/pause
        const handleTap = () => {
            setIsHovered(prev => !prev);
        };

        videoElement.addEventListener('mouseenter', handleMouseEnter);
        videoElement.addEventListener('mouseleave', handleMouseLeave);
        videoElement.addEventListener('click', handleTap);

        return () => {
            videoElement.removeEventListener('mouseenter', handleMouseEnter);
            videoElement.removeEventListener('mouseleave', handleMouseLeave);
            videoElement.removeEventListener('click', handleTap);
        };
    }, [showVideoFrame]);

    // Play/pause video based on hover state
    useEffect(() => {
        if (!showVideoFrame || isHovered) return;

        const videoElement = videoRef.current;
        if (!videoElement) return;

        // Pause when not hovered, reset to beginning
        videoElement.pause();
        videoElement.currentTime = 0;
    }, [isHovered, showVideoFrame]);

    const href = siteSlug ? `/site/${siteSlug}/${slug}` : `/${slug}`;

    const mediaBlock = (
        <div
            className={`relative overflow-hidden bg-surface-2 ${
                featured ? "aspect-[16/10] md:aspect-auto md:h-full md:w-1/2" : "aspect-[16/10]"
            }`}
        >
            {imageThumb ? (
                <Image
                    src={imageThumb}
                    alt={title}
                    fill
                    sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                />
            ) : youtubeThumb ? (
                <Image
                    src={youtubeThumb}
                    alt={title}
                    fill
                    sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    // YouTube hqdefault ditarik dari host eksternal.
                    unoptimized
                />
            ) : showVideoFrame ? (
                <video
                    ref={videoRef}
                    src={videoPath}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={`Video preview: ${title}`}
                    role="img"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    autoPlay={isHovered}
                />
            ) : (
                // Placeholder bertoken tanpa teks — bukan literal "SJA".
                <div aria-hidden="true" className="h-full w-full bg-surface-2" />
            )}

            {/* Badge play untuk kartu video */}
            {hasVideo && (imageThumb || youtubeThumb || showVideoFrame) && (
                <div
                    className="absolute left-1/2 top-1/2 z-[5] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent"
                    aria-hidden="true"
                >
                    {videoType === 'youtube'
                        ? <YoutubeLogo size={24} style={{ color: 'var(--site-text-on-primary)' }} />
                        : <Play size={24} weight="fill" style={{ color: 'var(--site-text-on-primary)' }} />}
                </div>
            )}
        </div>
    );

    return (
        <Link href={href} style={{ display: 'block', textDecoration: 'none', ...style }}>
            <article
                className={`group h-full overflow-hidden border border-border bg-surface-1 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-accent ${
                    featured ? "flex flex-col md:flex-row" : "flex flex-col"
                }`}
                style={{ transitionTimingFunction: "var(--motion-ease)" }}
            >
                {mediaBlock}

                {/* Content */}
                <div className={`flex flex-1 flex-col border-t border-border p-6 ${featured ? "md:border-l md:border-t-0" : ""}`}>
                    {/* Urutan baca: kategori -> judul -> excerpt -> meta. Kategori
                        berupa kotak warna kecil + teks, bukan pill isian — lebih
                        editorial dan tak perlu kalkulasi kontras warna kategori. */}
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
                        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.08em] text-text-2">
                            <span aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: category.color }} />
                            {category.name}
                        </span>
                        {isPinned && (
                            <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.08em] text-accent">
                                <PushPin size={12} weight="fill" />
                                Pinned
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h3
                        className={`font-serif font-bold leading-snug text-text-1 line-clamp-2 transition-colors duration-150 group-hover:text-accent ${
                            featured ? "text-title" : "text-heading"
                        }`}
                    >
                        {title}
                    </h3>

                    {/* Excerpt */}
                    {excerpt && (
                        <p className={`mb-4 mt-2 flex-1 text-small leading-relaxed text-text-2 ${featured ? "line-clamp-3" : "line-clamp-2"}`}>
                            {excerpt}
                        </p>
                    )}

                    {/* Meta — di bawah excerpt. viewCount dibuang (popularitas
                        internal bukan info yang dipakai pembaca memutuskan). */}
                    <div className="mt-auto flex items-center gap-2 font-mono text-caption tabular-nums text-text-3">
                        <Clock size={12} />
                        {formatDateShort(createdAt)}
                        {wordCount ? <span>· {readingTimeLabel(wordCount)}</span> : null}
                    </div>
                </div>
            </article>
        </Link>
    );
}
