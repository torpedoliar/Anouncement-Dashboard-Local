"use client";

import { useEffect, useState } from "react";
import { FiPlay } from "react-icons/fi";

interface SiteHeroProps {
    settings: any;
    primaryColor: string;
    siteName: string;
}

export default function SiteHero({ settings, primaryColor, siteName }: SiteHeroProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const title = settings?.heroTitle || "Berita & Pengumuman";
    const subtitle = settings?.heroSubtitle || `Informasi terbaru dari ${siteName}`;

    // 1. YouTube Video Background
    if (settings?.heroYoutubeUrl) {
        // Extract video ID
        const getVideoId = (url: string) => {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        };
        const videoId = getVideoId(settings.heroYoutubeUrl);

        if (videoId) {
            return (
                <div style={{ position: "relative", height: "500px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
                    <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                        <iframe
                            style={{ width: "100%", height: "100%", pointerEvents: "none", transform: "scale(1.5)" }}
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&showinfo=0&rel=0`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                    {/* Overlay */}
                    <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1 }} />

                    {/* Content */}
                    <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px" }}>
                        <h1 style={{ fontSize: "48px", fontWeight: 800, marginBottom: "16px", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
                            {title}
                        </h1>
                        <p style={{ fontSize: "20px", color: "rgba(255,255,255,0.9)", maxWidth: "700px", margin: "0 auto", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                            {subtitle}
                        </p>
                    </div>
                </div>
            );
        }
    }

    // 2. Local Video Background
    if (settings?.heroVideoPath) {
        return (
            <div style={{ position: "relative", height: "500px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
                >
                    <source src={settings.heroVideoPath} type={settings.heroVideoType || "video/mp4"} />
                </video>
                {/* Overlay */}
                <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1 }} />

                {/* Content */}
                <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px" }}>
                    <h1 style={{ fontSize: "48px", fontWeight: 800, marginBottom: "16px", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
                        {title}
                    </h1>
                    <p style={{ fontSize: "20px", color: "rgba(255,255,255,0.9)", maxWidth: "700px", margin: "0 auto", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                        {subtitle}
                    </p>
                </div>
            </div>
        );
    }

    // 3. Image Background
    if (settings?.heroImage) {
        return (
            <div style={{
                position: "relative",
                height: "500px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: `url(${settings.heroImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: "#111"
            }}>
                {/* Overlay */}
                <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1 }} />

                {/* Content */}
                <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px" }}>
                    <h1 style={{ fontSize: "48px", fontWeight: 800, marginBottom: "16px", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
                        {title}
                    </h1>
                    <p style={{ fontSize: "20px", color: "rgba(255,255,255,0.9)", maxWidth: "700px", margin: "0 auto", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                        {subtitle}
                    </p>
                </div>
            </div>
        );
    }

    // 4. Fallback (Gradient)
    return (
        <div style={{
            height: "400px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, #1a1a1a 0%, #000 100%)`,
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Abstract Decorative Elements */}
            <div style={{ position: "absolute", top: "-50px", left: "-50px", width: "300px", height: "300px", background: primaryColor, filter: "blur(150px)", opacity: 0.2, borderRadius: "50%" }}></div>
            <div style={{ position: "absolute", bottom: "-50px", right: "-50px", width: "300px", height: "300px", background: primaryColor, filter: "blur(150px)", opacity: 0.2, borderRadius: "50%" }}></div>

            <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px" }}>
                <h1 style={{ fontSize: "48px", fontWeight: 800, marginBottom: "16px", color: "#fff" }}>
                    {title}
                </h1>
                <p style={{ fontSize: "18px", color: "#a3a3a3", maxWidth: "600px", margin: "0 auto" }}>
                    {subtitle}
                </p>
            </div>
        </div>
    );
}
