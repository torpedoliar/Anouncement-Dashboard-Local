import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementCard from "@/components/AnnouncementCard";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { FiArrowLeft, FiEye, FiCalendar } from "react-icons/fi";

export const dynamic = "force-dynamic";

interface AnnouncementPageProps {
    params: Promise<{ slug: string }>;
}

async function getAnnouncement(slug: string) {
    const announcement = await prisma.announcement.findUnique({
        where: { slug },
        include: {
            category: true,
        },
    });

    if (announcement) {
        // Increment view count
        await prisma.announcement.update({
            where: { id: announcement.id },
            data: { viewCount: { increment: 1 } },
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

    return (
        <main style={{ minHeight: '100vh', backgroundColor: '#000' }}>
            <Navbar
                logoPath={settings?.logoPath || undefined}
                siteName={settings?.siteName || "Santos Jaya Abadi"}
            />

            {/* Hero Image */}
            <section style={{
                position: 'relative',
                height: '70vh',
                minHeight: '500px',
            }}>
                {announcement.imagePath ? (
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
                }} />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.6), transparent, rgba(0,0,0,0.3))',
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
