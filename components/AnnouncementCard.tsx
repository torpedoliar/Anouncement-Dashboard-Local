"use client";

import Link from "next/link";
import Image from "next/image";
import { formatDateShort } from "@/lib/utils";
import { FiEye, FiClock, FiPlay, FiYoutube } from "react-icons/fi";

interface AnnouncementCardProps {
    id: string;
    title: string;
    excerpt?: string;
    slug: string;
    imagePath?: string;
    videoPath?: string | null;
    videoType?: string | null;
    youtubeUrl?: string | null;
    category: {
        name: string;
        color: string;
    };
    createdAt: Date | string;
    viewCount: number;
    isPinned?: boolean;
}

// Extract YouTube video ID for thumbnail
const extractYoutubeId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

export default function AnnouncementCard({
    title,
    excerpt,
    slug,
    imagePath,
    videoPath,
    videoType,
    youtubeUrl,
    category,
    createdAt,
    viewCount,
    isPinned,
}: AnnouncementCardProps) {
    const hasVideo = videoPath || videoType === 'youtube';
    const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
    const thumbnailUrl = videoType === 'youtube' && youtubeId
        ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
        : imagePath;
    return (
        <Link href={`/${slug}`} style={{ display: 'block' }}>
            <article style={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #262626',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}
                className="group hover:border-red-600 hover:-translate-y-2"
            >
                {/* Media - Image or Video Thumbnail */}
                <div style={{
                    position: 'relative',
                    aspectRatio: '16/10',
                    overflow: 'hidden',
                    backgroundColor: '#111',
                }}>
                    {thumbnailUrl || videoPath ? (
                        <>
                            {videoPath && videoType === 'upload' ? (
                                <video
                                    src={videoPath}
                                    muted
                                    preload="metadata"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                                    className="group-hover:scale-110"
                                    onLoadedMetadata={(e) => {
                                        // Seek to 0.1s to ensure frame is loaded
                                        const video = e.currentTarget;
                                        video.currentTime = 0.1;
                                    }}
                                />
                            ) : thumbnailUrl ? (
                                <Image
                                    src={thumbnailUrl}
                                    alt={title}
                                    fill
                                    style={{ objectFit: 'cover', transition: 'transform 0.5s' }}
                                    className="group-hover:scale-110"
                                />
                            ) : null}
                            {hasVideo && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(220, 38, 38, 0.9)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 5,
                                }}>
                                    {videoType === 'youtube' ? <FiYoutube size={24} color="#fff" /> : <FiPlay size={24} color="#fff" />}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                        }}>
                            <span style={{ color: '#333', fontSize: '32px', fontWeight: 'bold' }}>SJA</span>
                        </div>
                    )}

                    {/* Overlay */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
                        opacity: 0.6,
                    }} />

                    {/* Category Badge */}
                    <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        display: 'flex',
                        gap: '8px',
                    }}>
                        <span style={{
                            padding: '6px 12px',
                            backgroundColor: category.color,
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                        }}>
                            {category.name}
                        </span>
                        {isPinned && (
                            <span style={{
                                padding: '6px 12px',
                                backgroundColor: '#dc2626',
                                color: '#fff',
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                            }}>
                                PINNED
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#000',
                    borderTop: '1px solid #1a1a1a',
                }}>
                    {/* Meta */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        color: '#525252',
                        fontSize: '12px',
                        marginBottom: '12px',
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiClock size={12} />
                            {formatDateShort(createdAt)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiEye size={12} />
                            {viewCount} views
                        </span>
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                        color: '#fff',
                        fontSize: '16px',
                        marginBottom: '12px',
                        lineHeight: 1.4,
                    }} className="line-clamp-2 group-hover:text-red-500 transition-colors">
                        {title}
                    </h3>

                    {/* Excerpt */}
                    {excerpt && (
                        <p style={{
                            color: '#737373',
                            fontSize: '14px',
                            marginBottom: '16px',
                            flex: 1,
                            lineHeight: 1.6,
                        }} className="line-clamp-2">
                            {excerpt}
                        </p>
                    )}

                    {/* Read More */}
                    <span style={{
                        color: '#dc2626',
                        fontSize: '13px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: 'auto',
                    }}>
                        Baca Selengkapnya
                        <span className="transition-transform group-hover:translate-x-1">&gt;&gt;</span>
                    </span>
                </div>
            </article>
        </Link>
    );
}
