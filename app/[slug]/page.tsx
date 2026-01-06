import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementCard from "@/components/AnnouncementCard";
import CommentSection from "@/components/CommentSection";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { FiArrowLeft, FiEye, FiCalendar, FiUser, FiClock } from "react-icons/fi";
import ArticleVideoPlayer from "@/components/ArticleVideoPlayer";

// Enable ISR with 60s revalidation for article pages
export const revalidate = 60;

interface AnnouncementPageProps {
    params: Promise<{ slug: string }>;
}

async function getAnnouncement(slug: string) {
    const announcement = await prisma.announcement.findUnique({
        where: { slug },
        include: {
            category: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (announcement) {
        // Non-blocking: increment view count without waiting
        prisma.announcement.update({
            where: { id: announcement.id },
            data: { viewCount: { increment: 1 } },
        }).catch(() => {
            // Ignore errors - view count is not critical
        });
    }

    return announcement;
}

async function getRelatedAnnouncements(categoryId: string, excludeId: string) {
    return prisma.announcement.findMany({
        where: {
            categoryId,
            isPublished: true,
            id: { not: excludeId },
        },
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
            category: { select: { name: true, color: true } },
        },
    });
}

async function getSettings() {
    return prisma.settings.findFirst();
}

// Calculate reading time
function calculateReadingTime(content: string): number {
    const text = content.replace(/<[^>]*>/g, "");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

export default async function AnnouncementPage({ params }: AnnouncementPageProps) {
    const { slug } = await params;
    const [announcement, settings] = await Promise.all([
        getAnnouncement(slug),
        getSettings(),
    ]);

    if (!announcement) {
        notFound();
    }

    const relatedAnnouncements = await getRelatedAnnouncements(
        announcement.categoryId,
        announcement.id
    );

    const readingTime = calculateReadingTime(announcement.content);

    return (
        <main style={{ minHeight: '100vh', backgroundColor: '#000' }}>
            <Navbar
                logoPath={settings?.logoPath || undefined}
                siteName={settings?.siteName || "Santos Jaya Abadi"}
            />

            {/* Hero Media - Video or Image */}
            <section style={{
                position: 'relative',
                height: '70vh',
                minHeight: '500px',
            }}>
                {/* Video Upload */}
                {announcement.videoPath && announcement.videoType === 'upload' ? (
                    <ArticleVideoPlayer
                        videoPath={announcement.videoPath}
                        title={announcement.title}
                    />
                ) : /* YouTube */
                    announcement.videoType === 'youtube' && announcement.youtubeUrl ? (
                        <ArticleVideoPlayer
                            youtubeUrl={announcement.youtubeUrl}
                            title={announcement.title}
                        />
                    ) : /* Image */
                        announcement.imagePath ? (
                            <Image
                                src={announcement.imagePath}
                                alt={announcement.title}
                                fill
                                style={{ objectFit: 'cover' }}
                                priority
                            />
                        ) : (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(to bottom right, #171717, #000, #262626)',
                            }} />
                        )}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.5), #000)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.6), transparent, rgba(0,0,0,0.3))',
                    pointerEvents: 'none',
                }} />

                {/* Content */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                }}>
                    <div style={{
                        maxWidth: '896px',
                        margin: '0 auto',
                        padding: '0 24px 64px',
                        width: '100%',
                    }}>
                        {/* Back Link */}
                        <Link
                            href="/"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#a3a3a3',
                                marginBottom: '32px',
                                fontSize: '14px',
                                textDecoration: 'none',
                            }}
                        >
                            <FiArrowLeft size={16} />
                            Kembali ke Beranda
                        </Link>

                        {/* Category */}
                        <span
                            style={{
                                display: 'inline-block',
                                padding: '6px 16px',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                marginBottom: '24px',
                                textTransform: 'uppercase',
                                backgroundColor: announcement.category.color,
                                color: '#fff',
                            }}
                        >
                            {announcement.category.name}
                        </span>

                        {/* Title */}
                        <h1 style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: 'clamp(28px, 5vw, 48px)',
                            fontWeight: 700,
                            color: '#fff',
                            lineHeight: 1.2,
                            marginBottom: '24px',
                        }}>
                            {announcement.title}
                        </h1>

                        {/* Meta */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '24px',
                            color: '#a3a3a3',
                            fontSize: '14px',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiCalendar size={16} />
                                {formatDate(announcement.createdAt)}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiEye size={16} />
                                {announcement.viewCount + 1} views
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiClock size={16} />
                                {readingTime} menit baca
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Content */}
            <section style={{
                padding: '64px 0',
                backgroundColor: '#000',
            }}>
                <div style={{
                    maxWidth: '896px',
                    margin: '0 auto',
                    padding: '0 24px',
                }}>
                    {/* Contributor/Author Box */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '20px 24px',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #262626',
                        marginBottom: '48px',
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: '#dc2626',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>
                                {announcement.author?.name?.charAt(0).toUpperCase() || 'A'}
                            </span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{
                                color: '#525252',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                marginBottom: '4px',
                            }}>
                                KONTRIBUTOR
                            </p>
                            <p style={{
                                color: '#fff',
                                fontSize: '16px',
                                fontWeight: 600,
                            }}>
                                {announcement.author?.name || 'Admin'}
                            </p>
                            <p style={{
                                color: '#737373',
                                fontSize: '13px',
                            }}>
                                Dipublikasikan pada {formatDate(announcement.createdAt)}
                                {announcement.updatedAt && announcement.updatedAt > announcement.createdAt && (
                                    <> • Diperbarui {formatDate(announcement.updatedAt)}</>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Excerpt */}
                    {announcement.excerpt && (
                        <p style={{
                            fontSize: '20px',
                            color: '#d4d4d4',
                            lineHeight: 1.75,
                            marginBottom: '48px',
                            fontWeight: 300,
                        }}>
                            {announcement.excerpt}
                        </p>
                    )}

                    {/* Main Content */}
                    <div
                        style={{
                            color: '#d4d4d4',
                            fontSize: '18px',
                            lineHeight: 1.8,
                        }}
                        dangerouslySetInnerHTML={{ __html: announcement.content }}
                    />

                    {/* Tags/Category Reminder */}
                    <div style={{
                        marginTop: '48px',
                        paddingTop: '32px',
                        borderTop: '1px solid #262626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <span style={{ color: '#525252', fontSize: '13px' }}>Kategori:</span>
                        <span
                            style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                backgroundColor: announcement.category.color,
                                color: '#fff',
                            }}
                        >
                            {announcement.category.name}
                        </span>
                    </div>
                </div>
            </section>

            {/* Comments Section */}
            <section style={{
                padding: '64px 0',
                borderTop: '1px solid #262626',
                backgroundColor: '#0a0a0a',
            }}>
                <div style={{
                    maxWidth: '896px',
                    margin: '0 auto',
                    padding: '0 24px',
                }}>
                    <CommentSection announcementId={announcement.id} />
                </div>
            </section>

            {/* Related Announcements */}
            {relatedAnnouncements.length > 0 && (
                <section style={{
                    padding: '64px 0',
                    borderTop: '1px solid #262626',
                    backgroundColor: '#000',
                }}>
                    <div style={{
                        maxWidth: '1280px',
                        margin: '0 auto',
                        padding: '0 24px',
                    }}>
                        <p style={{
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.2em',
                            marginBottom: '16px',
                        }}>
                            BACA JUGA
                        </p>
                        <h2 style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '28px',
                            fontWeight: 700,
                            color: '#fff',
                            marginBottom: '48px',
                        }}>
                            Artikel Terkait
                        </h2>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: '32px',
                        }}>
                            {relatedAnnouncements.map((item) => (
                                <AnnouncementCard
                                    key={item.id}
                                    id={item.id}
                                    title={item.title}
                                    excerpt={item.excerpt || undefined}
                                    slug={item.slug}
                                    imagePath={item.imagePath || undefined}
                                    videoPath={item.videoPath}
                                    videoType={item.videoType}
                                    youtubeUrl={item.youtubeUrl}
                                    category={item.category}
                                    createdAt={item.createdAt}
                                    viewCount={item.viewCount}
                                    isPinned={item.isPinned}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <Footer />
        </main>
    );
}
