/**
 * Site Homepage
 * Dynamic homepage for each site
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FullscreenHero from "@/components/FullscreenHero";
import AnnouncementCard from "@/components/AnnouncementCard";

// Thumbnail/reading helpers sekarang hidup di dalam AnnouncementCard (T4) —
// helper lokal extractYoutubeId/getThumbnailUrl dihapus.

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

    const announcementInclude = {
        category: { select: { name: true, color: true, slug: true } },
        author: { select: { name: true } },
        sites: {
            where: { siteId: site.id },
            select: { isHero: true, isPinned: true },
        },
    };

    // The article grid and hero rail are separate queries. A hero must not vanish
    // simply because it is older than the twelve most recent grid items.
    const [rawAnnouncements, rawHeroAnnouncements] = await Promise.all([
        prisma.announcement.findMany({
            where: {
                isPublished: true,
                sites: { some: { siteId: site.id } },
            },
            orderBy: [{ createdAt: "desc" }],
            take: 12,
            include: announcementInclude,
        }),
        prisma.announcement.findMany({
            where: {
                isPublished: true,
                sites: { some: { siteId: site.id, isHero: true } },
            },
            orderBy: [{ createdAt: "desc" }],
            take: 5,
            include: announcementInclude,
        }),
    ]);

    const withSitePlacement = (announcement: (typeof rawAnnouncements)[number]) => ({
        ...announcement,
        isPinned: announcement.sites[0]?.isPinned ?? false,
        isHeroOnSite: announcement.sites[0]?.isHero ?? false,
    });

    // Keep the article feed pinned-first, while the hero rail stays newest-first.
    const announcements = rawAnnouncements
        .map(withSitePlacement)
        .sort((x, y) => Number(y.isPinned) - Number(x.isPinned));
    const heroAnnouncements = rawHeroAnnouncements.map(withSitePlacement);

    return { site, announcements, heroAnnouncements };
}

export default async function SiteHomePage({ params }: PageProps) {
    const { siteSlug } = await params;
    const data = await getSiteData(siteSlug);

    if (!data) {
        notFound();
    }

    const { site, announcements, heroAnnouncements: publishedHeroAnnouncements } = data;
    const settings = site.settings;

    // Every published hero for this site is passed to the rail, newest first.
    // Pinned articles remain a fallback only when no article has hero placement.
    const heroAnnouncements = publishedHeroAnnouncements.length > 0
        ? publishedHeroAnnouncements
        : announcements.filter((announcement) => announcement.isPinned).slice(0, 3);
    const heroAnnouncement = heroAnnouncements[0] ?? null;

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
                            gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))",
                            gap: "24px",
                        }}
                    >
                        {announcements
                            .filter((a) => a.id !== heroAnnouncement?.id)
                            .map((announcement) => (
                                <AnnouncementCard
                                    key={announcement.id}
                                    id={announcement.id}
                                    title={announcement.title}
                                    excerpt={announcement.excerpt || undefined}
                                    slug={announcement.slug}
                                    siteSlug={siteSlug}
                                    imagePath={announcement.imagePath || undefined}
                                    videoPath={announcement.videoPath}
                                    videoType={announcement.videoType}
                                    youtubeUrl={announcement.youtubeUrl}
                                    category={announcement.category}
                                    createdAt={announcement.createdAt}
                                    isPinned={announcement.isPinned}
                                />
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
