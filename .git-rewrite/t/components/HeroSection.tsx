"use client";

import Link from "next/link";
import Image from "next/image";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useState, useEffect, useCallback } from "react";

interface HeroAnnouncement {
    id: string;
    title: string;
    excerpt?: string | null;
    slug: string;
    imagePath?: string | null;
}

interface HeroSectionProps {
    announcements: HeroAnnouncement[];
    heroTitle?: string;
    heroSubtitle?: string;
    heroImage?: string | null;
}

export default function HeroSection({
    announcements,
    heroTitle = "BERITA & PENGUMUMAN",
    heroSubtitle = "Informasi terbaru dari perusahaan",
    heroImage,
}: HeroSectionProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const nextSlide = useCallback(() => {
        if (announcements.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, [announcements.length]);

    const prevSlide = useCallback(() => {
        if (announcements.length === 0) return;
        setCurrentIndex((prev) =>
            prev === 0 ? announcements.length - 1 : prev - 1
        );
    }, [announcements.length]);

    useEffect(() => {
        if (!isAutoPlaying || announcements.length <= 1) return;
        const interval = setInterval(nextSlide, 6000);
        return () => clearInterval(interval);
    }, [isAutoPlaying, nextSlide, announcements.length]);

    const currentAnnouncement = announcements[currentIndex];

    if (announcements.length === 0) {
        return (
            <section style={{
                position: 'relative',
                height: '100vh',
                background: heroImage ? undefined : 'linear-gradient(135deg, #1a0000 0%, #000000 50%, #0a0a0a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {heroImage && (
                    <>
                        <Image
                            src={heroImage}
                            alt="Hero Background"
                            fill
                            style={{ objectFit: 'cover' }}
                            priority
                        />
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.9) 100%)',
                        }} />
                    </>
                )}
                <div style={{ textAlign: 'center', padding: '0 24px' }}>
                    <p style={{
                        color: '#dc2626',
                        fontSize: '12px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        marginBottom: '16px',
                    }}>
                        PENGUMUMAN
                    </p>
                    <h1 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: 'clamp(32px, 6vw, 64px)',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '16px',
                    }}>
                        {heroTitle}
                    </h1>
                    <p style={{ color: '#737373', fontSize: '18px' }}>
                        {heroSubtitle}
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section
            style={{
                position: 'relative',
                height: '100vh',
                overflow: 'hidden',
                backgroundColor: '#000',
            }}
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
        >
            {/* Background Image */}
            <div style={{ position: 'absolute', inset: 0 }}>
                {currentAnnouncement?.imagePath ? (
                    <Image
                        src={currentAnnouncement.imagePath}
                        alt={currentAnnouncement.title}
                        fill
                        style={{ objectFit: 'cover', transform: 'scale(1.05)' }}
                        priority
                    />
                ) : heroImage ? (
                    <Image
                        src={heroImage}
                        alt="Hero Background"
                        fill
                        style={{ objectFit: 'cover', transform: 'scale(1.05)' }}
                        priority
                    />
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #1a0000 0%, #000000 50%, #0a0a0a 100%)',
                    }} />
                )}
                {/* Overlays */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,1) 100%)',
                }} />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, transparent 50%, rgba(0,0,0,0.4) 100%)',
                }} />
            </div>

            {/* Content */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                height: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                paddingBottom: '120px',
            }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', width: '100%' }}>
                    <div style={{ maxWidth: '720px' }} className="animate-slide-up">
                        {/* Category Label */}
                        <p style={{
                            color: '#dc2626',
                            fontSize: '12px',
                            fontWeight: 600,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            marginBottom: '16px',
                        }}>
                            PENGUMUMAN TERBARU
                        </p>

                        {/* Title */}
                        <h1 style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: 'clamp(28px, 5vw, 52px)',
                            fontWeight: 700,
                            color: '#fff',
                            marginBottom: '24px',
                            lineHeight: 1.2,
                        }}>
                            {currentAnnouncement?.title}
                        </h1>

                        {/* Excerpt */}
                        {currentAnnouncement?.excerpt && (
                            <p style={{
                                color: '#d4d4d4',
                                fontSize: '18px',
                                marginBottom: '32px',
                                lineHeight: 1.7,
                                maxWidth: '600px',
                            }}>
                                {currentAnnouncement.excerpt}
                            </p>
                        )}

                        {/* CTA */}
                        <Link
                            href={`/${currentAnnouncement?.slug}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#dc2626',
                                fontSize: '14px',
                                fontWeight: 700,
                            }}
                        >
                            Baca Selengkapnya
                            <span>&gt;&gt;</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Navigation Controls */}
            {announcements.length > 1 && (
                <>
                    {/* Arrow Buttons */}
                    <div style={{
                        position: 'absolute',
                        bottom: '120px',
                        right: '48px',
                        zIndex: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                    }}>
                        <button
                            onClick={prevSlide}
                            style={{
                                width: '48px',
                                height: '48px',
                                border: '1px solid #404040',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                background: 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#dc2626';
                                e.currentTarget.style.backgroundColor = '#dc2626';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#404040';
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <FiChevronLeft size={20} />
                        </button>
                        <button
                            onClick={nextSlide}
                            style={{
                                width: '48px',
                                height: '48px',
                                border: '1px solid #404040',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                background: 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#dc2626';
                                e.currentTarget.style.backgroundColor = '#dc2626';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#404040';
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <FiChevronRight size={20} />
                        </button>
                    </div>

                    {/* Slide Indicators */}
                    <div style={{
                        position: 'absolute',
                        bottom: '60px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 20,
                        display: 'flex',
                        gap: '12px',
                    }}>
                        {announcements.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                style={{
                                    height: '4px',
                                    width: index === currentIndex ? '48px' : '24px',
                                    backgroundColor: index === currentIndex ? '#dc2626' : '#525252',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                }}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
