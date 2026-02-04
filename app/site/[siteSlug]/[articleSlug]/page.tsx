/**
 * Article Detail Page for Site
 * Shows individual article within a site context
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { FiArrowLeft, FiCalendar, FiUser, FiEye, FiClock } from "react-icons/fi";

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
            <nav
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 24px",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    position: "sticky",
                    top: 0,
                    backgroundColor: "rgba(10,10,10,0.9)",
                    backdropFilter: "blur(10px)",
                    zIndex: 100,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <Link
                        href={`/site/${siteSlug}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "#888",
                            textDecoration: "none",
                        }}
                    >
                        <FiArrowLeft size={18} />
                        <span>Kembali ke {site.name}</span>
                    </Link>
                </div>
            </nav>

            {/* Article */}
            <article style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 24px" }}>
                {/* Category */}
                <Link
                    href={`/site/${siteSlug}?category=${announcement.category.slug}`}
                    style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        backgroundColor: announcement.category.color,
                        color: "#fff",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                        marginBottom: "20px",
                    }}
                >
                    {announcement.category.name}
                </Link>

                {/* Title */}
                <h1
                    style={{
                        fontSize: "42px",
                        fontWeight: 800,
                        lineHeight: 1.2,
                        marginBottom: "24px",
                    }}
                >
                    {announcement.title}
                </h1>

                {/* Meta */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "20px",
                        color: "#888",
                        fontSize: "14px",
                        marginBottom: "32px",
                        paddingBottom: "32px",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}
                >
                    {announcement.author && (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <FiUser size={14} />
                            {announcement.author.name}
                        </span>
                    )}
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FiCalendar size={14} />
                        {format(new Date(announcement.createdAt), "dd MMMM yyyy", { locale: id })}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FiClock size={14} />
                        {calculateReadingTime(announcement.wordCount)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FiEye size={14} />
                        {announcement.viewCount} views
                    </span>
                </div>

                {/* Featured Image */}
                {announcement.imagePath && (
                    <div
                        style={{
                            marginBottom: "32px",
                            borderRadius: "12px",
                            overflow: "hidden",
                        }}
                    >
                        <img
                            src={announcement.imagePath}
                            alt={announcement.title}
                            style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                            }}
                        />
                    </div>
                )}

                {/* Content */}
                <div
                    className="article-content"
                    style={{
                        fontSize: "17px",
                        lineHeight: 1.8,
                        color: "#e0e0e0",
                    }}
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
                                {article.imagePath && (
                                    <div
                                        style={{
                                            height: "140px",
                                            backgroundImage: `url(${article.imagePath})`,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                        }}
                                    />
                                )}
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
