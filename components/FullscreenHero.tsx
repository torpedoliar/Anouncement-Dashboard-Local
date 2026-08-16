"use client";

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight, FiVolume2, FiVolumeX } from "react-icons/fi";

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
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (currentIndex >= announcements.length) {
            setCurrentIndex(0);
        }
    }, [announcements.length, currentIndex]);

    useEffect(() => {
        if (!isAutoPlaying || announcements.length <= 1) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const interval = window.setInterval(() => {
            setCurrentIndex((index) => (index + 1) % announcements.length);
        }, 6000);

        return () => window.clearInterval(interval);
    }, [announcements.length, isAutoPlaying]);

    const current = announcements[currentIndex];
    if (!current) return null;

    const youtubeId = getYoutubeId(current.youtubeUrl);
    const hasMultipleAnnouncements = announcements.length > 1;
    const goToPrevious = () => {
        setCurrentIndex((index) => (index === 0 ? announcements.length - 1 : index - 1));
    };
    const goToNext = () => {
        setCurrentIndex((index) => (index + 1) % announcements.length);
    };

    return (
        <section
            aria-label="Artikel unggulan"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
            style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                overflow: "hidden",
                backgroundColor: "var(--bg-primary)",
            }}
        >
            {youtubeId ? (
                <iframe
                    title={`Video latar ${current.title}`}
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&rel=0&modestbranding=1`}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    tabIndex={-1}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: "none" }}
                />
            ) : current.videoPath ? (
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                >
                    <source src={current.videoPath} type="video/mp4" />
                </video>
            ) : current.imagePath ? (
                <div
                    role="img"
                    aria-label={current.title}
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `url(${current.imagePath})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
            ) : (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(135deg, ${primaryColor}40 0%, var(--bg-primary) 100%)`,
                    }}
                />
            )}

            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.32) 58%, rgba(0,0,0,0.48) 100%)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "flex-end",
                    padding: "clamp(1rem, 4vw, 3.75rem)",
                    paddingRight: "clamp(1rem, 12vw, 12rem)",
                }}
            >
                <p style={{ color: primaryColor, fontSize: "clamp(0.625rem, 1vw, 0.75rem)", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                    Pengumuman unggulan
                </p>
                <Link href={`/site/${siteSlug}/${current.slug}`} style={{ color: "var(--text-primary)", textDecoration: "none", maxWidth: "52rem" }}>
                    <h1 style={{ fontSize: "clamp(1.25rem, 3.8vw, 3.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "0.75rem", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                        {current.title}
                    </h1>
                </Link>
                {current.excerpt && (
                    <p style={{ color: "rgba(255,255,255,0.88)", fontSize: "clamp(0.75rem, 1.25vw, 1rem)", lineHeight: 1.55, maxWidth: "38rem", marginBottom: "1rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {current.excerpt}
                    </p>
                )}
                <Link href={`/site/${siteSlug}/${current.slug}`} style={{ color: primaryColor, fontSize: "clamp(0.75rem, 1.1vw, 0.875rem)", fontWeight: 700, textDecoration: "none" }}>
                    Baca selengkapnya <span aria-hidden="true">→</span>
                </Link>
            </div>

            <div style={{ position: "absolute", right: "clamp(0.75rem, 2.5vw, 3rem)", bottom: "clamp(0.75rem, 2.5vw, 2.5rem)", zIndex: 2, display: "flex", gap: "0.5rem" }}>
                {current.videoPath && !youtubeId && (
                    <button
                        type="button"
                        onClick={() => setIsMuted((muted) => !muted)}
                        aria-label={isMuted ? "Aktifkan suara video" : "Bisukan suara video"}
                        style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.45)", color: "var(--text-primary)", cursor: "pointer", display: "grid", placeItems: "center" }}
                    >
                        {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
                    </button>
                )}
                {hasMultipleAnnouncements && (
                    <>
                        <button type="button" onClick={goToPrevious} aria-label="Artikel hero sebelumnya" style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.45)", color: "var(--text-primary)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                            <FiChevronLeft size={20} />
                        </button>
                        <button type="button" onClick={goToNext} aria-label="Artikel hero berikutnya" style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.45)", color: "var(--text-primary)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                            <FiChevronRight size={20} />
                        </button>
                    </>
                )}
            </div>

            {hasMultipleAnnouncements && (
                <div aria-label="Pilih artikel hero" style={{ position: "absolute", bottom: "clamp(0.75rem, 2.5vw, 2rem)", left: "50%", transform: "translateX(-50%)", zIndex: 2, display: "flex", gap: "0.5rem" }}>
                    {announcements.map((announcement, index) => (
                        <button
                            key={announcement.id}
                            type="button"
                            onClick={() => setCurrentIndex(index)}
                            aria-label={`Tampilkan artikel hero ${index + 1}: ${announcement.title}`}
                            aria-current={index === currentIndex ? "true" : undefined}
                            style={{ width: index === currentIndex ? "2rem" : "0.5rem", height: "0.25rem", borderRadius: "999px", backgroundColor: index === currentIndex ? primaryColor : "rgba(255,255,255,0.5)", border: 0, cursor: "pointer", transition: "width var(--motion-fast) var(--motion-ease)" }}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
