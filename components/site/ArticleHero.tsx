"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarBlank, User, Clock, SpeakerHigh, SpeakerSlash, ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { extractYoutubeId, readingTimeLabel } from "@/lib/utils";

interface ArticleHeroProps {
    id: string;
    title: string;
    category: { name: string; slug: string; color: string };
    author?: { name: string } | null;
    createdAt: Date | string;
    wordCount: number;
    /** @deprecated tidak lagi ditampilkan (critique 2026-08-17). */
    viewCount?: number;
    imagePath?: string | null;
    videoPath?: string | null;
    youtubeUrl?: string | null;
    siteSlug: string;
    backHref?: string;
    backLabel?: string;
}

// ponytail: teks & kontrol hero memakai putih tetap (bukan token tema) — selalu di
// atas scrim gelap media, di kedua tema; token tema akan jadi gelap saat theme-light.
export default function ArticleHero({
    id: storyId,
    title,
    category,
    author,
    createdAt,
    wordCount,
    imagePath,
    videoPath,
    youtubeUrl,
    siteSlug,
    backHref,
    backLabel,
}: ArticleHeroProps) {
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
    const hasVideo = !!videoPath;
    const hasYoutube = !!youtubeId && !hasVideo;
    const hasImage = !!imagePath && !hasVideo && !hasYoutube;

    return (
        <div className="relative flex h-[min(55vh,420px)] w-full items-end overflow-hidden bg-surface-2">
            {/* 1. Media — view-transition-name sama dengan media kartu (transisi kartu → artikel) */}
            <div className="absolute inset-0 z-0" style={{ viewTransitionName: `story-${storyId}` }}>
                {hasVideo && (
                    <>
                        <video
                            ref={videoRef}
                            src={videoPath!}
                            autoPlay
                            muted={isMuted}
                            loop
                            playsInline
                            preload="metadata"
                            poster={imagePath || undefined}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                        <button
                            type="button"
                            onClick={toggleMute}
                            aria-label={isMuted ? "Aktifkan suara video" : "Bisukan suara video"}
                            className="absolute bottom-[30px] right-[30px] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            {isMuted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}
                        </button>
                    </>
                )}

                {hasYoutube && (
                    <iframe
                        title={`Video: ${title}`}
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&rel=0&modestbranding=1`}
                        className="pointer-events-none absolute inset-0 h-full w-full border-0 object-cover"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                )}

                {hasImage && (
                    <div
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${imagePath})` }}
                    />
                )}
            </div>

            {/* 2. Scrim keterbacaan — hitam tetap, bukan warna tema */}
            <div className="absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.1)_40%,rgba(0,0,0,0.95)_100%)]" />

            {/* 3. Konten */}
            <div className="relative z-20 mx-auto w-full max-w-[1000px] px-6 pb-16">
                {backHref && backLabel && (
                    <Link
                        href={backHref}
                        className="mb-3 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-white/90 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span className="leading-snug">{backLabel}</span>
                    </Link>
                )}

                <div>
                    <Link
                        href={`/site/${siteSlug}?category=${category.slug}`}
                        className="mb-3.5 inline-block rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase leading-none tracking-[0.06em] shadow-[0_1px_8px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        style={{ backgroundColor: category.color, color: "var(--site-text-on-primary, #fff)" }}
                    >
                        {category.name}
                    </Link>
                </div>

                <h1 className="mb-6 font-serif text-[clamp(32px,5vw,56px)] font-bold leading-[1.1] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)]">
                    {title}
                </h1>

                <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-white/85">
                    {author && (
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                                <User size={14} aria-hidden="true" />
                            </div>
                            <span>{author.name}</span>
                        </div>
                    )}
                    <span className="flex items-center gap-1.5">
                        <CalendarBlank size={16} className="opacity-70" aria-hidden="true" />
                        {format(new Date(createdAt), "dd MMMM yyyy", { locale: id })}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock size={16} className="opacity-70" aria-hidden="true" />
                        {readingTimeLabel(wordCount)}
                    </span>
                </div>
            </div>
        </div>
    );
}
