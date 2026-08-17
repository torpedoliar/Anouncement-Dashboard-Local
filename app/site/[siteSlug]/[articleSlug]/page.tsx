/**
 * Article Detail Page for Site
 * Shows individual article within a site context
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ArticleHero from "@/components/site/ArticleHero";
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

    // Check if this is the primary site for canonical URL
    const primarySite = announcement.sites.find((s) => s.isPrimary)?.site;
    const isPrimarySite = primarySite?.id === site.id;
    const canonicalUrl = isPrimarySite
        ? null
        : `/site/${primarySite?.slug}/${announcement.slug}`;

    return { site, announcement, relatedArticles, canonicalUrl };
}

function calculateReadingTime(wordCount: number): string {
    const minutes = Math.ceil(wordCount / 200);
    return `${minutes} menit baca`;
}

export default async function ArticlePage({ params }: PageProps) {
    const { siteSlug, articleSlug } = await params;
    const data = await getArticleData(siteSlug, articleSlug);

    if (!data) {
        notFound();
    }

    const { site, announcement, relatedArticles, canonicalUrl } = data;

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#fff" }}>
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
                title={announcement.title}
                category={announcement.category}
                author={announcement.author}
                createdAt={announcement.createdAt}
                wordCount={announcement.wordCount}
                viewCount={announcement.viewCount}
                imagePath={announcement.imagePath}
                videoPath={announcement.videoPath}
                youtubeUrl={announcement.youtubeUrl}
                siteSlug={siteSlug}
                backHref={`/site/${siteSlug}`}
                backLabel={`Kembali ke ${site.name}`}
            />

            {/* Article Content Container */}
            <article style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 24px" }}>
                {/* Hero Media moved up */}

                {/* Content */}
                <div
                    className="prose-santos"
                    dangerouslySetInnerHTML={{ __html: announcement.content }}
                />

                {/* Syndication notice */}
                {announcement.sites.length > 1 && (
                    <div
                        style={{
                            marginTop: "48px",
                            padding: "16px 20px",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            borderRadius: "8px",
                            fontSize: "13px",
                            color: "#888",
                        }}
                    >
                        Artikel ini juga tersedia di:{" "}
                        {announcement.sites
                            .filter((s) => s.site.id !== site.id)
                            .map((s) => (
                                <Link
                                    key={s.site.id}
                                    href={`/site/${s.site.slug}/${announcement.slug}`}
                                    style={{
                                        color: site.primaryColor,
                                        textDecoration: "none",
                                        marginLeft: "8px",
                                    }}
                                >
                                    {s.site.name}
                                </Link>
                            ))}
                    </div>
                )}
            </article>

            {/* Comments Section */}
            {announcement.allowComments && (
                <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px 60px" }}>
                    <CommentSection announcementId={announcement.id} />
                </div>
            )}

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
                <div
                    style={{
                        maxWidth: "1200px",
                        margin: "0 auto",
                        padding: "48px 24px 80px",
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                    }}
                >
                    <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>
                        Artikel Terkait
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
                            gap: "20px",
                        }}
                    >
                        {relatedArticles.map((article) => (
                            <AnnouncementCard
                                key={article.id}
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

            {/* Footer */}
            <div
                style={{
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    padding: "24px",
                    textAlign: "center",
                    color: "#666",
                    fontSize: "13px",
                }}
            >
                © {new Date().getFullYear()} {site.name}. All rights reserved.
            </div>
        </div>
    );
}

