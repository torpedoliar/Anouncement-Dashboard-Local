"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
    CaretLeft,
    CaretRight,
    SpeakerHigh,
    SpeakerSlash,
    Pause,
    Play,
    ArrowRight,
} from "@phosphor-icons/react";

interface HeroAnnouncement {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    imagePath: string | null;
    videoPath: string | null;
    youtubeUrl: string | null;
    category: {
        name: string;
        color: string;
        slug: string;
    };
}

interface FullscreenHeroProps {
    siteSlug: string;
    announcements: HeroAnnouncement[];
    primaryColor: string;
}

function getYoutubeId(url: string | null) {
    if (!url) return null;
    const match = url.match(/^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match?.[1]?.length === 11 ? match[1] : null;
}

export default function FullscreenHero({ siteSlug, announcements, primaryColor }: FullscreenHeroProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [isPausedByUser, setIsPausedByUser] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const count = announcements.length;
    const hasMultiple = count > 1;

    // Reset index if out of bounds
    useEffect(() => {
        if (currentIndex >= count && count > 0) {
            setCurrentIndex(0);
        }
    }, [count, currentIndex]);

    // Auto-advance interval (5 detik), berjalan selama tidak di-pause manual dan tidak di-hover
    useEffect(() => {
        if (isPausedByUser || isHovered || count <= 1) return;
        if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % count);
        }, 5000);

        return () => clearInterval(interval);
    }, [count, isPausedByUser, isHovered, currentIndex]);

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev === 0 ? count - 1 : prev - 1));
    }, [count]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % count);
    }, [count]);

    if (!announcements || count === 0) return null;

    const current = announcements[currentIndex] || announcements[0];
    const youtubeId = getYoutubeId(current.youtubeUrl);

    return (
        <section
            aria-label="Artikel unggulan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative w-full overflow-hidden bg-surface-0"
            style={{
                aspectRatio: "16 / 9",
                minHeight: "360px",
                maxHeight: "720px",
            }}
        >
            {/* Slide Layers with smooth crossfade */}
            {announcements.map((item, idx) => {
                const isActive = idx === currentIndex;
                const itemYoutubeId = getYoutubeId(item.youtubeUrl);

                return (
                    <div
                        key={item.id}
                        aria-hidden={!isActive}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                            isActive ? "opacity-100 z-0 pointer-events-auto" : "opacity-0 -z-10 pointer-events-none"
                        }`}
                    >
                        {itemYoutubeId && isActive ? (
                            <iframe
                                title={`Video latar ${item.title}`}
                                src={`https://www.youtube.com/embed/${itemYoutubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${itemYoutubeId}&playsinline=1&rel=0&modestbranding=1`}
                                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                tabIndex={-1}
                                className="absolute inset-0 h-full w-full border-0 pointer-events-none object-cover"
                            />
                        ) : item.videoPath && isActive ? (
                            <video
                                ref={isActive ? videoRef : undefined}
                                autoPlay
                                loop
                                muted={isMuted}
                                playsInline
                                className="absolute inset-0 h-full w-full object-cover"
                            >
                                <source src={item.videoPath} type="video/mp4" />
                            </video>
                        ) : item.imagePath ? (
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out"
                                style={{
                                    backgroundImage: `url(${item.imagePath})`,
                                    transform: isActive ? "scale(1.02)" : "scale(1)",
                                }}
                            />
                        ) : (
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor}35 0%, var(--surface-0) 100%)`,
                                }}
                            />
                        )}
                    </div>
                );
            })}

            {/* Gradient Overlay for Readability */}
            <div
                aria-hidden="true"
                className="absolute inset-0 z-[1] bg-gradient-to-t from-black/90 via-black/40 to-black/50"
            />

            {/* Active Content Caption */}
            <div className="absolute inset-0 z-[2] flex flex-col justify-end p-6 md:p-12 lg:p-16 pr-16 md:pr-32">
                <div className="max-w-4xl space-y-2 md:space-y-3">
                    <div className="flex items-center gap-2.5">
                        <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-sm"
                            style={{ backgroundColor: current.category?.color || primaryColor }}
                        >
                            {current.category?.name || "Pengumuman Unggulan"}
                        </span>
                        {hasMultiple && (
                            <span className="font-mono text-xs text-white/70">
                                {currentIndex + 1} / {count}
                            </span>
                        )}
                    </div>

                    <Link
                        href={`/site/${siteSlug}/${current.slug}`}
                        className="group block"
                    >
                        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight text-white drop-shadow-md transition-colors group-hover:text-white/90">
                            {current.title}
                        </h1>
                    </Link>

                    {current.excerpt && (
                        <p className="line-clamp-2 max-w-2xl text-sm sm:text-base text-white/85 leading-relaxed">
                            {current.excerpt}
                        </p>
                    )}

                    <div className="pt-2">
                        <Link
                            href={`/site/${siteSlug}/${current.slug}`}
                            className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-white transition-transform duration-150 hover:translate-x-1"
                            style={{ color: primaryColor }}
                        >
                            <span>Baca selengkapnya</span>
                            <ArrowRight size={16} weight="bold" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right-Bottom Controls */}
            <div className="absolute bottom-6 right-6 z-[3] flex items-center gap-2">
                {hasMultiple && (
                    <button
                        type="button"
                        onClick={() => setIsPausedByUser((p) => !p)}
                        aria-label={!isPausedByUser ? "Jeda rotasi otomatis" : "Putar rotasi otomatis"}
                        aria-pressed={isPausedByUser}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/80 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
                    >
                        {!isPausedByUser ? <Pause size={18} weight="bold" /> : <Play size={18} weight="bold" />}
                    </button>
                )}

                {current.videoPath && !youtubeId && (
                    <button
                        type="button"
                        onClick={() => setIsMuted((m) => !m)}
                        aria-label={isMuted ? "Aktifkan suara video" : "Bisukan suara video"}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/80 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
                    >
                        {isMuted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}
                    </button>
                )}

                {hasMultiple && (
                    <>
                        <button
                            type="button"
                            onClick={goToPrevious}
                            aria-label="Artikel hero sebelumnya"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/80 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
                        >
                            <CaretLeft size={20} weight="bold" />
                        </button>
                        <button
                            type="button"
                            onClick={goToNext}
                            aria-label="Artikel hero berikutnya"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/80 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
                        >
                            <CaretRight size={20} weight="bold" />
                        </button>
                    </>
                )}
            </div>

            {/* Bottom Indicators */}
            {hasMultiple && (
                <div
                    aria-label="Pilih artikel hero"
                    className="absolute bottom-6 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-1.5"
                >
                    {announcements.map((item, idx) => {
                        const isActive = idx === currentIndex;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setCurrentIndex(idx)}
                                aria-label={`Tampilkan artikel hero ${idx + 1}: ${item.title}`}
                                aria-current={isActive ? "true" : undefined}
                                className="group flex h-8 items-center px-1.5 focus:outline-none"
                            >
                                <span
                                    className="block h-1 rounded-full transition-all duration-300 ease-out"
                                    style={{
                                        width: isActive ? "28px" : "8px",
                                        backgroundColor: isActive ? primaryColor : "rgba(255, 255, 255, 0.4)",
                                    }}
                                />
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
