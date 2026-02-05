/**
 * Site Homepage
 * Dynamic homepage for each site
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { FiArrowLeft, FiCalendar, FiEye } from "react-icons/fi";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ siteSlug: string }>;
}

async function getSiteData(slug: string) {
    const site = await prisma.site.findUnique({
        where: { slug, isActive: true },
        include: {
            settings: true,
            categories: {
                orderBy: { order: "asc" },
            },
        },
    });

    if (!site) return null;

    // Get announcements for this site
    const announcements = await prisma.announcement.findMany({
        where: {
            isPublished: true,
            sites: { some: { siteId: site.id } },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 12,
        include: {
            category: { select: { name: true, color: true, slug: true } },
            author: { select: { name: true } },
        },
    });

    // Get hero announcement
    const heroAnnouncement = await prisma.announcement.findFirst({
        where: {
            isPublished: true,
            isHero: true,
            sites: { some: { siteId: site.id } },
        },
        include: {
            category: { select: { name: true, color: true, slug: true } },
        },
    });

    return { site, announcements, heroAnnouncement };
}

import FullscreenHero from "@/components/FullscreenHero";

// ... existing imports

export default async function SiteHomePage({ params }: PageProps) {
    const { siteSlug } = await params;
    const data = await getSiteData(siteSlug);

    if (!data) {
        notFound();
    }

    const { site, announcements, heroAnnouncement } = data;
    const settings = site.settings;

    // Prepare hero announcements for fullscreen hero (use hero announcement if exists, otherwise first pinned)
    const heroAnnouncements = heroAnnouncement
        ? [heroAnnouncement]
        : announcements.filter(a => a.isPinned).slice(0, 3);

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#fff" }}>
            {/* Navbar removed - handled by layout */}

            {/* Fullscreen Hero Section */}
            {heroAnnouncements.length > 0 ? (
                <FullscreenHero
                    siteSlug={siteSlug}
                    announcements={heroAnnouncements.map(a => ({
                        id: a.id,
                        slug: a.slug,
                        title: a.title,
                        excerpt: a.excerpt,
                        imagePath: a.imagePath,
                        videoPath: a.videoPath,
                        youtubeUrl: a.youtubeUrl,
                        category: a.category,
                    }))}
                    primaryColor={site.primaryColor}
                />
            ) : (
                // Fallback simple hero when no hero announcements
                <div
                    style={{
                        padding: "80px 24px",
                        textAlign: "center",
                        background: `linear-gradient(180deg, ${site.primaryColor}20 0%, transparent 100%)`,
                    }}
                >
                    <h1 style={{ fontSize: "42px", fontWeight: 800, marginBottom: "12px" }}>
                        {settings?.heroTitle || "Berita & Pengumuman"}
                    </h1>
                    <p style={{ fontSize: "18px", color: "#888", maxWidth: "600px", margin: "0 auto" }}>
                        {settings?.heroSubtitle || "Informasi terbaru dari " + site.name}
                    </p>
                </div>
            )}

            {/* Announcements Grid */}
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px 80px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>
                    Artikel Terbaru
                </h2>

                {announcements.length > 0 ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                            gap: "24px",
                        }}
                    >
                        {announcements
                            .filter((a) => a.id !== heroAnnouncement?.id)
                            .map((announcement) => (
                                <Link
                                    key={announcement.id}
                                    href={`/site/${siteSlug}/${announcement.slug}`}
                                    style={{
                                        display: "block",
                                        textDecoration: "none",
                                        backgroundColor: "#1a1a1a",
                                        borderRadius: "12px",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        overflow: "hidden",
                                        transition: "transform 0.2s",
                                    }}
                                >
                                    {announcement.imagePath && (
                                        <div
                                            style={{
                                                height: "180px",
                                                backgroundImage: `url(${announcement.imagePath})`,
                                                backgroundSize: "cover",
                                                backgroundPosition: "center",
                                            }}
                                        />
                                    )}
                                    <div style={{ padding: "20px" }}>
                                        <span
                                            style={{
                                                display: "inline-block",
                                                padding: "3px 10px",
                                                backgroundColor: announcement.category.color,
                                                color: "#fff",
                                                borderRadius: "4px",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                marginBottom: "12px",
                                            }}
                                        >
                                            {announcement.category.name}
                                        </span>
                                        <h3
                                            style={{
                                                fontSize: "18px",
                                                fontWeight: 600,
                                                color: "#fff",
                                                marginBottom: "8px",
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            {announcement.title}
                                        </h3>
                                        <p
                                            style={{
                                                color: "#888",
                                                fontSize: "14px",
                                                lineHeight: 1.5,
                                                marginBottom: "16px",
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {announcement.excerpt}
                                        </p>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "16px",
                                                color: "#666",
                                                fontSize: "12px",
                                            }}
                                        >
                                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <FiCalendar size={12} />
                                                {formatDistanceToNow(new Date(announcement.createdAt), {
                                                    addSuffix: true,
                                                    locale: id,
                                                })}
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <FiEye size={12} />
                                                {announcement.viewCount}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                    </div>
                ) : (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "60px 20px",
                            backgroundColor: "#1a1a1a",
                            borderRadius: "12px",
                            border: "1px solid rgba(255,255,255,0.1)",
                        }}
                    >
                        <p style={{ color: "#888" }}>Belum ada artikel untuk site ini.</p>
                    </div>
                )}
            </div>

            {/* Footer removed - handled by layout */}
        </div>
    );
}
