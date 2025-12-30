import Link from "next/link";
import Image from "next/image";
import { formatDateShort } from "@/lib/utils";
import { FiEye, FiClock } from "react-icons/fi";

interface AnnouncementCardProps {
    id: string;
    title: string;
    excerpt?: string;
    slug: string;
    imagePath?: string;
    category: {
        name: string;
        color: string;
    };
    createdAt: Date | string;
    viewCount: number;
    isPinned?: boolean;
}

export default function AnnouncementCard({
    title,
    excerpt,
    slug,
    imagePath,
    category,
    createdAt,
    viewCount,
    isPinned,
}: AnnouncementCardProps) {
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
                {/* Image */}
                <div style={{
                    position: 'relative',
                    aspectRatio: '16/10',
                    overflow: 'hidden',
                    backgroundColor: '#111',
                }}>
                    {imagePath ? (
                        <Image
                            src={imagePath}
                            alt={title}
                            fill
                            style={{ objectFit: 'cover', transition: 'transform 0.5s' }}
                            className="group-hover:scale-110"
                        />
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
