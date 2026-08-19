/**
 * Site Homepage
 * Dynamic homepage for each site
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FullscreenHero from "@/components/FullscreenHero";
import AnnouncementCard from "@/components/AnnouncementCard";
import Pagination from "@/components/Pagination";

// Thumbnail/reading helpers sekarang hidup di dalam AnnouncementCard (T4) —
// helper lokal extractYoutubeId/getThumbnailUrl dihapus.

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ siteSlug: string }>;
    searchParams: Promise<{ page?: string; category?: string }>;
}

const FEED_PER_PAGE = 12;

async function getSiteData(slug: string, page: number, categorySlug?: string) {
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

    // Feed dan hero rail adalah query terpisah. Hero tak boleh hilang hanya
    // karena lebih tua dari 12 artikel terbaru. Filter kategori HANYA ke feed,
    // bukan hero (T5.B) — hero tetap newest-first lintas kategori.
    const feedWhere = {
        isPublished: true,
        sites: { some: { siteId: site.id } },
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    };
    const skip = (page - 1) * FEED_PER_PAGE;

    const [rawAnnouncements, rawHeroAnnouncements, totalAnnouncements] = await Promise.all([
        prisma.announcement.findMany({
            where: feedWhere,
            orderBy: [{ createdAt: "desc" }],
            skip,
            take: FEED_PER_PAGE,
            include: announcementInclude,
        }),
        prisma.announcement.findMany({
            where: {
                isPublished: true,
                sites: { some: { siteId: site.id } },
                OR: [
                    { sites: { some: { siteId: site.id, isHero: true } } },
                    { isHero: true },
                ],
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: announcementInclude,
        }),
        prisma.announcement.count({ where: feedWhere }),
    ]);

    const withSitePlacement = (announcement: (typeof rawAnnouncements)[number]) => ({
        ...announcement,
        isPinned: announcement.sites[0]?.isPinned ?? false,
        isHeroOnSite: announcement.sites[0]?.isHero ?? false,
    });

    // Feed pinned-first; hero rail newest-first.
    const announcements = rawAnnouncements
        .map(withSitePlacement)
        .sort((x, y) => Number(y.isPinned) - Number(x.isPinned));
    const heroAnnouncements = rawHeroAnnouncements.map(withSitePlacement);
    const totalPages = Math.ceil(totalAnnouncements / FEED_PER_PAGE);

    return { site, announcements, heroAnnouncements, totalPages };
}

export default async function SiteHomePage({ params, searchParams }: PageProps) {
    const { siteSlug } = await params;
    const { page: pageParam, category: categorySlug } = await searchParams;
    const currentPage = Math.max(1, parseInt(pageParam || "1") || 1);
    const data = await getSiteData(siteSlug, currentPage, categorySlug);

    if (!data) {
        notFound();
    }

    const { site, announcements, heroAnnouncements: publishedHeroAnnouncements, totalPages } = data;
    const settings = site.settings;

    // Prioritaskan artikel hero; jika kurang dari 5, lengkapi dengan artikel terbaru/pinned
    // agar hero carousel selalu memiliki konten rotasi otomatis (hingga 5 artikel).
    const heroMap = new Map<string, (typeof announcements)[number]>();
    publishedHeroAnnouncements.forEach((a) => heroMap.set(a.id, a));
    if (heroMap.size < 5) {
        announcements.forEach((a) => {
            if (heroMap.size < 5 && !heroMap.has(a.id)) {
                heroMap.set(a.id, a);
            }
        });
    }
    const heroAnnouncements = Array.from(heroMap.values());
    const heroAnnouncement = heroAnnouncements[0] ?? null;

    // Pinned di-render sebagai baris lebar penuh di atas grid kronologis (T5.C).
    // Saat filter kategori aktif, pinned juga difilter agar konsisten dengan feed.
    const pinnedFeedItems = announcements.filter((a) => a.isPinned && a.id !== heroAnnouncement?.id);
    const chronologicalFeed = announcements.filter((a) => !a.isPinned && a.id !== heroAnnouncement?.id);

    // Parameter pagination meneruskan kategori aktif supaya pindah halaman tak
    // mereset filter (T5.B).
    const paginationParams: Record<string, string> = {};
    if (categorySlug) paginationParams.category = categorySlug;

    // Chip kategori aktif (T5.B) — link navigasi, aria-pressed menyatakan state.
    const buildCategoryUrl = (slug: string | null) => {
        const params = new URLSearchParams();
        if (slug) params.set("category", slug);
        // Reset ke halaman 1 saat ganti kategori.
        return `/site/${siteSlug}${params.toString() ? `?${params.toString()}` : ""}`;
    };

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
                {/* Category chips (T5.B) — di halaman ini sendiri, bukan hanya
                    link navbar yang runtuh jadi hamburger di mobile. */}
                <nav aria-label="Filter kategori" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                    <Link
                        href={buildCategoryUrl(null)}
                        aria-pressed={!categorySlug}
                        style={chipStyle(!categorySlug)}
                    >
                        Semua
                    </Link>
                    {site.categories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={buildCategoryUrl(cat.slug)}
                            aria-pressed={categorySlug === cat.slug}
                            style={chipStyle(categorySlug === cat.slug)}
                        >
                            {cat.name}
                        </Link>
                    ))}
                </nav>

                <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>
                    Artikel Terbaru
                </h2>

                {announcements.length > 0 ? (
                    <>
                        {/* Pinned row (T5.C) — lebar penuh di atas grid kronologis */}
                        {pinnedFeedItems.length > 0 && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px", marginBottom: "32px" }}>
                                {pinnedFeedItems.map((announcement) => (
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
                        )}

                        {/* Grid kronologis murni */}
                        {chronologicalFeed.length > 0 && (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))",
                                    gap: "24px",
                                }}
                            >
                                {chronologicalFeed.map((announcement) => (
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
                                    />
                                ))}
                            </div>
                        )}

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            baseUrl={`/site/${siteSlug}`}
                            searchParams={paginationParams}
                        />
                    </>
                ) : (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "60px 20px",
                        }}
                    >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card border border-accent/30 bg-accent-subtle">
                            <span className="text-xl font-semibold text-accent">SJA</span>
                        </div>
                        <h2 className="mt-4 font-display text-lg font-semibold text-text-1">
                            Belum ada artikel untuk {site.name}
                        </h2>
                        <p className="mx-auto mt-3 max-w-[420px] text-sm text-text-2">
                            Setelah artikel dipublikasikan, entri akan muncul di sini.
                        </p>
                        <Link
                            href="/site"
                            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2"
                        >
                            Pilih site lain
                        </Link>
                    </div>
                )}
            </div>

            {/* Footer removed - handled by layout */}
        </div>
    );
}

function chipStyle(active: boolean): React.CSSProperties {
    return {
        display: "inline-flex",
        alignItems: "center",
        minHeight: "36px",
        padding: "6px 14px",
        fontSize: "13px",
        fontWeight: 600,
        borderRadius: "999px",
        textDecoration: "none",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-2)",
    };
}
