"use client";

import Link from "next/link";
import Image from "next/image";
import { formatDateShort } from "@/lib/utils";
import { FiClock, FiPlay, FiYoutube } from "react-icons/fi";
import { getContrastColor } from "@/components/SiteThemeProvider";

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
    siteSlug,
    imagePath,
    videoPath,
    videoType,
    youtubeUrl,
    category,
    createdAt,
    isPinned,
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

    const href = siteSlug ? `/site/${siteSlug}/${slug}` : `/${slug}`;
    return (
        <Link href={href} style={{ display: 'block', textDecoration: 'none' }}>
            <article style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                transition: 'transform var(--motion-standard) var(--motion-ease), border-color var(--motion-standard) var(--motion-ease)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}
                className="group hover:border-accent hover:-translate-y-2"
            >
                {/* Media - Image, YouTube thumbnail, or Video frame */}
                <div style={{
                    position: 'relative',
                    aspectRatio: '16/10',
                    overflow: 'hidden',
                    backgroundColor: 'var(--bg-card)',
                }}>
                    {imageThumb ? (
                        <Image
                            src={imageThumb}
                            alt={title}
                            fill
                            style={{ objectFit: 'cover', transition: 'transform 0.5s' }}
                            className="group-hover:scale-110"
                        />
                    ) : youtubeThumb ? (
                        <Image
                            src={youtubeThumb}
                            alt={title}
                            fill
                            style={{ objectFit: 'cover', transition: 'transform 0.5s' }}
                            className="group-hover:scale-110"
                            // YouTube hqdefault ditarik dari host eksternal.
                            unoptimized
                        />
                    ) : showVideoFrame ? (
                        <video
                            src={`${videoPath}#t=0.1`}
                            muted
                            playsInline
                            preload="none"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                            className="group-hover:scale-110"
                            onLoadedMetadata={(e) => {
                                const video = e.currentTarget;
                                video.currentTime = 0.1;
                            }}
                        />
                    ) : (
                        // Placeholder bertoken tanpa teks — bukan literal "SJA".
                        <div style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'var(--bg-tertiary)',
                        }} />
                    )}

                    {/* Overlay */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
                        opacity: 0.6,
                        pointerEvents: 'none',
                    }} />

                    {/* Badge play untuk kartu video */}
                    {hasVideo && (imageThumb || youtubeThumb || showVideoFrame) && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 5,
                        }}>
                            {videoType === 'youtube'
                                ? <FiYoutube size={24} style={{ color: 'var(--site-text-on-primary)' }} />
                                : <FiPlay size={24} style={{ color: 'var(--site-text-on-primary)' }} />}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--bg-primary)',
                    borderTop: '1px solid var(--bg-tertiary)',
                }}>
                    {/* Urutan baca: kategori -> judul -> excerpt -> tanggal.
                        Meta dulu di atas judul; kategori pindah ke atas judul
                        supaya kedekatan mengikat label ke objeknya. T7: teks
                        badge dipilih runtime lewat getContrastColor agar kontras
                        lolos AA juga di kategori kuning/cerah. */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <span style={{
                            padding: '4px 10px',
                            backgroundColor: category.color,
                            color: getContrastColor(category.color),
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                        }}>
                            {category.name}
                        </span>
                        {isPinned && (
                            /* Badge PINNED sebelumnya memakai --brand-red polos sehingga
                               menyatu dengan badge kategori yang warnanya mirip merah.
                               Sekarang dibedakan lewat outline + latar netral, bukan
                               mengandalkan warna isian yang bisa bertabrakan. */
                            <span style={{
                                padding: '3px 9px',
                                backgroundColor: 'transparent',
                                color: 'var(--brand-red)',
                                border: '1.5px solid var(--brand-red)',
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}>
                                <span aria-hidden="true">📌</span>
                                PINNED
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontSize: '16px',
                        marginBottom: '12px',
                        lineHeight: 1.4,
                    }} className="line-clamp-2 group-hover:text-accent transition-colors">
                        {title}
                    </h3>

                    {/* Excerpt */}
                    {excerpt && (
                        <p style={{
                            color: 'var(--text-muted)',
                            fontSize: '14px',
                            marginBottom: '16px',
                            flex: 1,
                            lineHeight: 1.6,
                        }} className="line-clamp-2">
                            {excerpt}
                        </p>
                    )}

                    {/* Meta — di bawah excerpt. viewCount dibuang (popularitas
                        internal bukan info yang dipakai pembaca memutuskan). */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-tertiary)',
                        fontSize: '12px',
                        marginTop: 'auto',
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiClock size={12} />
                            {formatDateShort(createdAt)}
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    );
}
