/**
 * Article Detail Page for Site
 * Shows individual article within a site context
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { FiPlay } from "react-icons/fi";

function extractYoutubeId(url: string | null | undefined): string | null {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return m?.[1] ?? null;
}
function getThumbnailUrl(a: { imagePath: string | null; videoPath: string | null; videoType: string | null; youtubeUrl: string | null }): string | null {
    const yId = extractYoutubeId(a.youtubeUrl);
    if (a.videoType === "youtube" && yId) return `https://img.youtube.com/vi/${yId}/hqdefault.jpg`;
    return a.imagePath;
}
import ArticleHero from "@/components/site/ArticleHero";
import CommentSection from "@/components/CommentSection";

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
                            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                            gap: "20px",
                        }}
                    >
                        {relatedArticles.map((article) => (
                            <Link
                                key={article.id}
                                href={`/site/${siteSlug}/${article.slug}`}
                                style={{
                                    display: "block",
                                    textDecoration: "none",
                                    backgroundColor: "#1a1a1a",
                                    borderRadius: "10px",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    overflow: "hidden",
                                }}
                            >
                                {(() => {
                                    const thumb = getThumbnailUrl(article);
                                    const hasVideo = !!article.videoPath || article.videoType === "youtube";
                                    if (thumb) {
                                        return (
                                            <div style={{ height: "140px", backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                                                {hasVideo && (
                                                    <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(220,38,38,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <FiPlay size={12} color="#fff" style={{ marginLeft: 2 }} />
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    }
                                    if (article.videoPath) {
                                        return (
                                            <div style={{ height: "140px", position: "relative", overflow: "hidden", backgroundColor: "#111" }}>
                                                <video src={article.videoPath} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(220,38,38,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <FiPlay size={12} color="#fff" style={{ marginLeft: 2 }} />
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <div style={{ padding: "16px" }}>
                                    <span
                                        style={{
                                            display: "inline-block",
                                            padding: "3px 8px",
                                            backgroundColor: article.category.color,
                                            color: "#fff",
                                            borderRadius: "4px",
                                            fontSize: "10px",
                                            fontWeight: 600,
                                            marginBottom: "10px",
                                        }}
                                    >
                                        {article.category.name}
                                    </span>
                                    <h3
                                        style={{
                                            fontSize: "16px",
                                            fontWeight: 600,
                                            color: "#fff",
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {article.title}
                                    </h3>
                                </div>
                            </Link>
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

