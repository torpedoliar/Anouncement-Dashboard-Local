/**
 * Site Homepage
 * Dynamic homepage for each site
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Masthead from "@/components/site/Masthead";
import FrontPage from "@/components/site/FrontPage";
import CategoryStrip from "@/components/site/CategoryStrip";
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

    // Halaman depan murni = tanpa filter kategori & halaman pertama. Di luar
    // itu (filter/pagination) yang tampil hanya masthead + feed terfilter.
    const isFrontPage = !categorySlug && currentPage === 1;

    // Prioritaskan artikel hero; jika kurang dari 4, lengkapi dengan artikel
    // terbaru/pinned agar halaman depan punya lead + 3 story sekunder.
    const heroMap = new Map<string, (typeof announcements)[number]>();
    publishedHeroAnnouncements.forEach((a) => heroMap.set(a.id, a));
    if (heroMap.size < 4) {
        announcements.forEach((a) => {
            if (heroMap.size < 4 && !heroMap.has(a.id)) {
                heroMap.set(a.id, a);
            }
        });
    }
    const frontStories = Array.from(heroMap.values());
    const lead = frontStories[0] ?? null;
    const secondary = frontStories.slice(1, 4);
    const frontIds = new Set(frontStories.map((a) => a.id));

    // Story yang tampil di halaman depan tidak diulang di feed bawahnya.
    const feedItems = isFrontPage
        ? announcements.filter((a) => !frontIds.has(a.id))
        : announcements;

    // Pinned di-render sebagai baris lebar penuh di atas grid kronologis (T5.C).
    // Saat filter kategori aktif, pinned juga difilter agar konsisten dengan feed.
    const pinnedFeedItems = feedItems.filter((a) => a.isPinned);
    const chronologicalFeed = feedItems.filter((a) => !a.isPinned);

    // Parameter pagination meneruskan kategori aktif supaya pindah halaman tak
    // mereset filter (T5.B).
    const paginationParams: Record<string, string> = {};
    if (categorySlug) paginationParams.category = categorySlug;

    const buildCategoryUrl = (slug: string | null) => {
        const params = new URLSearchParams();
        if (slug) params.set("category", slug);
        // Reset ke halaman 1 saat ganti kategori.
        return `/site/${siteSlug}${params.toString() ? `?${params.toString()}` : ""}`;
    };

    const stripItems = [
        { label: "Semua", href: buildCategoryUrl(null), active: !categorySlug },
        ...site.categories.map((cat) => ({
            label: cat.name,
            href: buildCategoryUrl(cat.slug),
            active: categorySlug === cat.slug,
        })),
    ];

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--surface-0)", color: "var(--text-1)" }}>
            {/* Nameplate koran — selalu tampil, juga saat feed kosong */}
            <Masthead
                siteName={site.name}
                tagline={settings?.heroSubtitle || `Informasi terbaru dari ${site.name}`}
            />

            {/* Halaman depan editorial: lead + story sekunder (tanpa timer/JS) */}
            {isFrontPage && lead && (
                <FrontPage
                    siteSlug={siteSlug}
                    lead={{
                        id: lead.id,
                        slug: lead.slug,
                        title: lead.title,
                        excerpt: lead.excerpt,
                        imagePath: lead.imagePath,
                        videoPath: lead.videoPath,
                        videoType: lead.videoType,
                        youtubeUrl: lead.youtubeUrl,
                        wordCount: lead.wordCount,
                        category: lead.category,
                        createdAt: lead.createdAt,
                    }}
                    secondary={secondary.map((a) => ({
                        id: a.id,
                        slug: a.slug,
                        title: a.title,
                        excerpt: a.excerpt,
                        imagePath: a.imagePath,
                        videoPath: a.videoPath,
                        videoType: a.videoType,
                        youtubeUrl: a.youtubeUrl,
                        wordCount: a.wordCount,
                        category: a.category,
                        createdAt: a.createdAt,
                    }))}
                />
            )}

            {/* Announcements Grid */}
            <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-6">
                <CategoryStrip items={stripItems} />

                {announcements.length > 0 ? (
                    <div className="pt-8">
                        {/* Pinned row (T5.C) — lebar penuh di atas grid kronologis */}
                        {pinnedFeedItems.length > 0 && (
                            <div className="mb-8 grid grid-cols-1 gap-6">
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
                                        wordCount={announcement.wordCount}
                                        featured
                                    />
                                ))}
                            </div>
                        )}

                        {/* Grid kronologis murni — stagger entrance (Varian C).
                            Kartu pertama tampil featured hanya di halaman depan. */}
                        {chronologicalFeed.length > 0 && (
                            <div
                                className="cine-stagger grid gap-6"
                                style={{
                                    gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))",
                                }}
                            >
                                {chronologicalFeed.map((announcement, i) => {
                                    const featured = isFrontPage && i === 0;
                                    return (
                                        <AnnouncementCard
                                            key={announcement.id}
                                            style={{
                                                "--i": Math.min(i, 11),
                                                gridColumn: featured ? "1 / -1" : undefined,
                                            } as React.CSSProperties}
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
                                            wordCount={announcement.wordCount}
                                            featured={featured}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {feedItems.length === 0 && (
                            <p className="py-12 text-center text-small text-text-3">
                                Semua artikel sudah tampil di halaman depan.
                            </p>
                        )}

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            baseUrl={`/site/${siteSlug}`}
                            searchParams={paginationParams}
                        />
                    </div>
                ) : (
                    <div className="py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card border border-accent/30 bg-accent-subtle">
                            <span className="font-serif text-xl font-bold text-accent">
                                {site.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <h2 className="mt-4 font-serif text-heading font-semibold text-text-1">
                            Belum ada artikel untuk {site.name}
                        </h2>
                        <p className="mx-auto mt-3 max-w-[420px] text-small text-text-2">
                            Setelah artikel dipublikasikan, entri akan muncul di sini.
                        </p>
                        <Link
                            href="/site"
                            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 text-small font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2"
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
