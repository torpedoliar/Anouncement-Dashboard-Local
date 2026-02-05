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
import ArticleHero from "@/components/site/ArticleHero";

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


    // Fetch Comments
    const comments = await prisma.comment.findMany({
        where: {
            announcementId: announcement.id,
            status: "APPROVED",
            parentId: null // Top level comments
        },
        include: {
            replies: {
                where: { status: "APPROVED" },
                orderBy: { createdAt: "asc" }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return { site, announcement, relatedArticles, canonicalUrl, comments };
}

function calculateReadingTime(wordCount: number): string {
    const minutes = Math.ceil(wordCount / 200);
    return `${minutes} menit baca`;
}

function CommentItem({ comment }: { comment: any }) {
    return (
        <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <strong style={{ color: "#fff", fontSize: "14px" }}>{comment.authorName}</strong>
                <span style={{ color: "#666", fontSize: "12px" }}>
                    {format(new Date(comment.createdAt), "dd MMM yyyy", { locale: id })}
                </span>
            </div>
            <p style={{ color: "#bbb", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                {comment.content}
            </p>
            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div style={{ marginLeft: "20px", marginTop: "16px", paddingLeft: "16px", borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
                    {comment.replies.map((reply: any) => (
                        <div key={reply.id} style={{ marginTop: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                <strong style={{ color: "#ddd", fontSize: "13px" }}>{reply.authorName}</strong>
                                <span style={{ color: "#666", fontSize: "11px" }}>
                                    {format(new Date(reply.createdAt), "dd MMM", { locale: id })}
                                </span>
                            </div>
                            <p style={{ color: "#aaa", fontSize: "13px", margin: 0 }}>{reply.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default async function ArticlePage({ params }: PageProps) {
    const { siteSlug, articleSlug } = await params;
    const data = await getArticleData(siteSlug, articleSlug);

    if (!data) {
        notFound();
    }

    const { site, announcement, relatedArticles, canonicalUrl, comments } = data;

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
            />

            {/* Article Content Container */}
            <article style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 24px" }}>


                {/* Hero Media moved up */}

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

            {/* Comments Section */}
            <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px 60px" }}>
                <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "24px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "32px" }}>
                    Komentar ({comments.length})
                </h3>
                {comments.length > 0 ? (
                    <div>
                        {comments.map((comment: any) => (
                            <CommentItem key={comment.id} comment={comment} />
                        ))}
                    </div>
                ) : (
                    <p style={{ color: "#666", fontStyle: "italic" }}>Belum ada komentar.</p>
                )}
            </div>


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
