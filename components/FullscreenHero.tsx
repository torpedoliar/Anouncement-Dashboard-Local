"use client";

import { useEffect, useState, useRef } from "react";
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

export default function FullscreenHero({ siteSlug, announcements, primaryColor }: FullscreenHeroProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const current = announcements[currentIndex];

    // No hero announcements
    if (!announcements || announcements.length === 0) {
        return null;
    }

    const goToPrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? announcements.length - 1 : prev - 1));
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === announcements.length - 1 ? 0 : prev + 1));
    };

    // Extract YouTube video ID
    const getYoutubeId = (url: string | null) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    };

    const youtubeId = getYoutubeId(current.youtubeUrl);

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", backgroundColor: "#000" }}>
            {/* Background Media */}
            {youtubeId ? (
                // YouTube Video Background
                <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                    <iframe
                        style={{
                            width: "100vw",
                            height: "100vh",
                            pointerEvents: "none",
                            transform: "scale(1.2)",
                            transformOrigin: "center center",
                        }}
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&showinfo=0&rel=0&modestbranding=1`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            ) : current.videoPath ? (
                // Local Video Background
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
                >
                    <source src={current.videoPath} type="video/mp4" />
                </video>
            ) : current.imagePath ? (
                // Image Background
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `url(${current.imagePath})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        zIndex: 0,
                    }}
                />
            ) : (
                // Fallback Gradient
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(135deg, ${primaryColor}40 0%, #0a0a0a 100%)`,
                        zIndex: 0,
                    }}
                />
            )}

            {/* Dark Overlay */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.5) 100%)",
                    zIndex: 1,
                }}
            />

            {/* Content Overlay */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "60px 48px",
                    zIndex: 2,
                }}
            >
                <p style={{
                    color: primaryColor,
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    marginBottom: "16px"
                }}>
                    PENGUMUMAN TERBARU
                </p>

                <Link
                    href={`/site/${siteSlug}/${current.slug}`}
                    style={{ textDecoration: "none" }}
                >
                    <h1
                        style={{
                            fontSize: "clamp(32px, 5vw, 56px)",
                            fontWeight: 900,
                            color: "#fff",
                            marginBottom: "12px",
                            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                            maxWidth: "800px",
                        }}
                    >
                        {current.title}
                    </h1>
                </Link>

                {current.excerpt && (
                    <p
                        style={{
                            fontSize: "16px",
                            color: "rgba(255,255,255,0.8)",
                            maxWidth: "600px",
                            lineHeight: 1.6,
                            marginBottom: "24px",
                        }}
                    >
                        {current.excerpt}
                    </p>
                )}

                <Link
                    href={`/site/${siteSlug}/${current.slug}`}
                    style={{
                        color: primaryColor,
                        fontSize: "14px",
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    Baca Selengkapnya →
                </Link>
            </div>

            {/* Navigation Controls */}
            <div
                style={{
                    position: "absolute",
                    bottom: "80px",
                    right: "48px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    zIndex: 3,
                }}
            >
                {/* Mute Toggle (for local video) */}
                {current.videoPath && !youtubeId && (
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
                    </button>
                )}

                {/* Prev/Next Buttons */}
                {announcements.length > 1 && (
                    <>
                        <button
                            onClick={goToPrev}
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                backgroundColor: "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: "#fff",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <FiChevronLeft size={20} />
                        </button>
                        <button
                            onClick={goToNext}
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                backgroundColor: "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: "#fff",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <FiChevronRight size={20} />
                        </button>
                    </>
                )}
            </div>

            {/* Slide Indicators */}
            {announcements.length > 1 && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "40px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: "8px",
                        zIndex: 3,
                    }}
                >
                    {announcements.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            style={{
                                width: idx === currentIndex ? "32px" : "8px",
                                height: "4px",
                                borderRadius: "2px",
                                backgroundColor: idx === currentIndex ? primaryColor : "rgba(255,255,255,0.3)",
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
