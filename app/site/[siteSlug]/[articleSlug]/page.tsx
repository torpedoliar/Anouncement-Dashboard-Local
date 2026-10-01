/**
 * Article Detail Page for Site
 * Shows individual article within a site context
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ArticleHero from "@/components/site/ArticleHero";
import ArticleContent from "@/components/site/ArticleContent";
import AnnouncementCard from "@/components/AnnouncementCard";
import CommentSection from "@/components/CommentSection";

// Thumbnail/reading helpers sekarang hidup di dalam AnnouncementCard (T4) —
// helper lokal extractYoutubeId/getThumbnailUrl dihapus.

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ siteSlug: string; articleSlug: string }>;
}

async function getArticleData(siteSlug: string, articleSlug: string) {
    // Get site first
    const site = await prisma.site.findUnique({
        where: { slug: siteSlug, isActive: true },
        select: { id: true, name: true, slug: true, primaryColor: true },
    });

    if (!site) return null;

    // Get announcement that belongs to this site
    const announcement = await prisma.announcement.findFirst({
        where: {
            slug: articleSlug,
            isPublished: true,
            sites: { some: { siteId: site.id } },
        },
        include: {
            category: { select: { name: true, color: true, slug: true } },
            author: { select: { name: true } },
            sites: {
                include: {
                    site: { select: { id: true, name: true, slug: true } },
                },
            },
        },
    });

    if (!announcement) return null;

    // Increment view count
    await prisma.announcement.update({
        where: { id: announcement.id },
        data: { viewCount: { increment: 1 } },
    });

    // Get related articles from the same site
    const relatedArticles = await prisma.announcement.findMany({
        where: {
            isPublished: true,
            categoryId: announcement.categoryId,
            id: { not: announcement.id },
            sites: { some: { siteId: site.id } },
        },
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
            category: { select: { name: true, color: true } },
        },
    });

    // Canonical URL (IN-04): utamakan junction bertanda isPrimary; data legacy
    // bisa tak punya satu pun — fallback ke situs pertama. Tanpa situs sama
    // sekali (atau sedang dilihat di situs primernya) -> tanpa canonical.
    const primarySite =
        announcement.sites.find((s) => s.isPrimary)?.site ?? announcement.sites[0]?.site;
    const isPrimarySite = primarySite?.id === site.id;
    const canonicalUrl =
        primarySite && !isPrimarySite ? `/site/${primarySite.slug}/${announcement.slug}` : null;

    return { site, announcement, relatedArticles, canonicalUrl };
}

export default async function ArticlePage({ params }: PageProps) {
    const { siteSlug, articleSlug } = await params;
    const data = await getArticleData(siteSlug, articleSlug);

    if (!data) {
        notFound();
    }

    const { site, announcement, relatedArticles, canonicalUrl } = data;

    return (
        <div className="min-h-screen bg-surface-0 text-text-1">
            {/* Canonical link for syndicated content */}
            {canonicalUrl && (
                <link rel="canonical" href={canonicalUrl} />
            )}

            {/* Navbar */}
            {/* Back link kini ditangani ArticleHero (lihat T2.2); blok <nav> lokal
                yang tertimbun di bawah Navbar fixed (zIndex 200 vs sticky 100)
                sudah dihapus agar tidak ada dua landmark <nav> per halaman. */}

            {/* Hero Section */}
            <ArticleHero
                id={announcement.id}
                title={announcement.title}
                category={announcement.category}
                author={announcement.author}
                createdAt={announcement.createdAt}
                wordCount={announcement.wordCount}
                imagePath={announcement.imagePath}
                videoPath={announcement.videoPath}
                youtubeUrl={announcement.youtubeUrl}
                siteSlug={siteSlug}
                backHref={`/site/${siteSlug}`}
                backLabel={`Kembali ke ${site.name}`}
            />

            {/* Article Content Container */}
            <article className="mx-auto max-w-[800px] px-6 pb-12 pt-8">
                {/* Hero Media moved up */}

                {/* Content */}
                <ArticleContent html={announcement.content} />

                {/* Syndication notice */}
                {announcement.sites.length > 1 && (
                    <div className="mt-12 rounded-card bg-surface-1 px-5 py-4 text-[13px] text-text-3">
                        Artikel ini juga tersedia di:{" "}
                        {announcement.sites
                            .filter((s) => s.site.id !== site.id)
                            .map((s) => (
                                <Link
                                    key={s.site.id}
                                    href={`/site/${s.site.slug}/${announcement.slug}`}
                                    className="ml-2 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                >
                                    {s.site.name}
                                </Link>
                            ))}
                    </div>
                )}
            </article>

            {/* Comments Section */}
            {announcement.allowComments && (
                <div className="mx-auto max-w-[800px] px-6 pb-16">
                    <CommentSection announcementId={announcement.id} />
                </div>
            )}

            {/* Related Articles — scroll-reveal saat masuk viewport */}
            {relatedArticles.length > 0 && (
                <div
                    data-cine
                    className="mx-auto max-w-[1200px] border-t border-border px-6 pb-20 pt-12"
                >
                    <h2 className="mb-6 text-2xl font-bold">
                        Artikel Terkait
                    </h2>
                    <div
                        className="cine-stagger grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]"
                    >
                        {relatedArticles.map((article, i) => (
                            <AnnouncementCard
                                key={article.id}
                                style={{ "--i": Math.min(i, 11) } as React.CSSProperties}
                                id={article.id}
                                title={article.title}
                                excerpt={article.excerpt || undefined}
                                slug={article.slug}
                                siteSlug={siteSlug}
                                imagePath={article.imagePath || undefined}
                                videoPath={article.videoPath}
                                videoType={article.videoType}
                                youtubeUrl={article.youtubeUrl}
                                category={article.category}
                                createdAt={article.createdAt}
                                isPinned={article.isPinned}
                            />
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

