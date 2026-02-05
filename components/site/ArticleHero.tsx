"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { FiCalendar, FiUser, FiEye, FiClock, FiVolume2, FiVolumeX } from "react-icons/fi";
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
    siteSlug
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
    const hasVideo = !!videoPath;
    const hasYoutube = !!youtubeUrl && !hasVideo;
    const hasImage = !!imagePath && !hasVideo && !hasYoutube;

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "85vh", // Large cover height
                minHeight: "600px",
                overflow: "hidden",
                display: "flex",
                alignItems: "flex-end", // Align content to bottom
                backgroundColor: "#000"
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
                                color: "#fff",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            {isMuted ? <FiVolumeX size={20} /> : <FiVolume2 size={20} />}
                        </button>
                    </>
                )}

                {hasYoutube && (
                    <iframe
                        src={`${youtubeUrl!.replace("watch?v=", "embed/")}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeUrl!.split('v=')[1]}`}
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
                {/* Category Badge */}
                <Link
                    href={`/site/${siteSlug}?category=${category.slug}`}
                    style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        backgroundColor: category.color,
                        color: "#fff",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 700,
                        textDecoration: "none",
                        marginBottom: "16px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                    }}
                >
                    {category.name}
                </Link>

                {/* Title */}
                <h1
                    style={{
                        fontSize: "clamp(32px, 5vw, 56px)", // Responsive font size
                        fontWeight: 800,
                        lineHeight: 1.1,
                        marginBottom: "24px",
                        color: "#fff",
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
                        color: "#ddd",
                        fontSize: "14px",
                        fontWeight: 500
                    }}
                >
                    {author && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FiUser size={14} />
                            </div>
                            <span>{author.name}</span>
                        </div>
                    )}
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FiCalendar size={16} style={{ opacity: 0.7 }} />
                        {format(new Date(createdAt), "dd MMMM yyyy", { locale: id })}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FiClock size={16} style={{ opacity: 0.7 }} />
                        {calculateReadingTime(wordCount)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FiEye size={16} style={{ opacity: 0.7 }} />
                        {viewCount} views
                    </span>
                </div>
            </div>
        </div>
    );
}
