"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarBlank, User, Eye, Clock, SpeakerHigh, SpeakerSlash, ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";

interface ArticleHeroProps {
    title: string;
    category: { name: string; slug: string; color: string };
    author?: { name: string } | null;
    createdAt: Date | string;
    wordCount: number;
    viewCount: number;
    imagePath?: string | null;
    videoPath?: string | null;
    youtubeUrl?: string | null;
    siteSlug: string;
    backHref?: string;
    backLabel?: string;
}

export default function ArticleHero({
    title,
    category,
    author,
    createdAt,
    wordCount,
    viewCount,
    imagePath,
    videoPath,
    youtubeUrl,
    siteSlug,
    backHref,
    backLabel
}: ArticleHeroProps) {
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    function calculateReadingTime(count: number): string {
        const minutes = Math.ceil(count / 200);
        return `${minutes} menit baca`;
    }

    // Determine what media to show
    // Priority: Video > YouTube > Image
    const extractYoutubeId = (url?: string | null) => {
        if (!url) return null;
        const match = url.match(/^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return match?.[1]?.length === 11 ? match[1] : null;
    };

    const youtubeId = extractYoutubeId(youtubeUrl);
    const hasVideo = !!videoPath;
    const hasYoutube = !!youtubeId && !hasVideo;
    const hasImage = !!imagePath && !hasVideo && !hasYoutube;

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                // 85vh+600px memakan 94% viewport mobile (floor 600px menang di
                // 360x640). Turunkan ke min(55vh, 420px) supaya dua baris pertama
                // isi artikel terlihat tanpa scroll. (T2.4)
                height: "min(55vh, 420px)",
                overflow: "hidden",
                display: "flex",
                alignItems: "flex-end", // Align content to bottom
                backgroundColor: "var(--bg-primary)"
            }}
        >
            {/* 1. Media Layer */}
            <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}>
                {hasVideo && (
                    <>
                        <video
                            ref={videoRef}
                            src={videoPath!}
                            autoPlay
                            muted={isMuted}
                            loop
                            playsInline
                            preload="none"
                            poster={imagePath || undefined}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                position: "absolute",
                                top: 0,
                                left: 0
                            }}
                        />
                        {/* Mute Toggle Button */}
                        <button
                            onClick={toggleMute}
                            style={{
                                position: "absolute",
                                bottom: "30px",
                                right: "30px",
                                zIndex: 30,
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                backgroundColor: "rgba(255,255,255,0.2)",
                                backdropFilter: "blur(4px)",
                                border: "1px solid rgba(255,255,255,0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                // ponytail: warna fixed-light, bukan token tema —
                                // konten ini selalu di atas gradient gelap, di kedua tema
                                // (token tema di sini malah jadi teks gelap saat theme-light).
                                color: "#FFFFFF",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            {isMuted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}
                        </button>
                    </>
                )}

                {hasYoutube && (
                    <iframe
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&rel=0&modestbranding=1`}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            position: "absolute",
                            top: 0,
                            left: 0,
                            pointerEvents: "none" // Prevent interaction for background feel
                        }}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                )}

                {hasImage && (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            backgroundImage: `url(${imagePath})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                        }}
                    />
                )}
            </div>

            {/* 2. Gradient Overlay for Readability */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    // ponytail: gradient hitam fixed — scrim keterbacaan di atas
                    // media, bukan warna tema.
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.95) 100%)",
                    zIndex: 10
                }}
            />

            {/* 3. Content Layer */}
            <div
                style={{
                    position: "relative",
                    zIndex: 20,
                    width: "100%",
                    maxWidth: "1000px",
                    margin: "0 auto",
                    padding: "0 24px 64px 24px"
                }}
            >
                {/* Back Link — satu pemilik (T2.2), mendasar di atas badge kategori.
                    Token-native, tinggi sentuh 44px. Gap ke badge diperkecil supaya
                    tidak menabrak bila back label panjang / wrap. */}
                {backHref && backLabel && (
                    <Link
                        href={backHref}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            minHeight: "44px",
                            color: "rgba(255,255,255,0.92)",
                            fontSize: "13px",
                            fontWeight: 600,
                            textDecoration: "none",
                            marginBottom: "12px",
                        }}
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span style={{ lineHeight: 1.35 }}>{backLabel}</span>
                    </Link>
                )}

                {/* Category Badge */}
                <Link
                    href={`/site/${siteSlug}?category=${category.slug}`}
                    style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        backgroundColor: category.color,
                        color: "var(--site-text-on-primary, #fff)",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        textDecoration: "none",
                        marginBottom: "14px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        lineHeight: 1,
                        boxShadow: "0 1px 8px rgba(0,0,0,0.18)",
                    }}
                >
                    {category.name}
                </Link>

                {/* Title */}
                <h1
                    className="font-serif"
                    style={{
                        fontSize: "clamp(32px, 5vw, 56px)", // Responsive font size
                        fontWeight: 700,
                        lineHeight: 1.1,
                        marginBottom: "24px",
                        // ponytail: fixed-light, bukan token tema — judul selalu di
                        // atas gradient gelap; token tema jadi gelap saat theme-light.
                        color: "#FFFFFF",
                        textShadow: "0 2px 4px rgba(0,0,0,0.5)"
                    }}
                >
                    {title}
                </h1>

                {/* Meta Data */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "24px",
                        // ponytail: fixed-light — meta di atas gradient gelap, kedua tema.
                        color: "rgba(255,255,255,0.87)",
                        fontSize: "14px",
                        fontWeight: 500
                    }}
                >
                    {author && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <User size={14} />
                            </div>
                            <span>{author.name}</span>
                        </div>
                    )}
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <CalendarBlank size={16} style={{ opacity: 0.7 }} />
                        {format(new Date(createdAt), "dd MMMM yyyy", { locale: id })}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={16} style={{ opacity: 0.7 }} />
                        {calculateReadingTime(wordCount)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Eye size={16} style={{ opacity: 0.7 }} />
                        {viewCount} views
                    </span>
                </div>
            </div>
        </div>
    );
}
