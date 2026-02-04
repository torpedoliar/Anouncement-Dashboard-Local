/**
 * Site Search Page
 * Search articles within a specific site
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { FiArrowLeft, FiSearch, FiCalendar, FiEye } from "react-icons/fi";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ siteSlug: string }>;
    searchParams: Promise<{ q?: string; category?: string }>;
}

async function searchArticles(siteSlug: string, query: string, categorySlug?: string) {
    const site = await prisma.site.findUnique({
        where: { slug: siteSlug, isActive: true },
        include: {
            categories: { orderBy: { order: "asc" } },
        },
    });

    if (!site) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
        isPublished: true,
        sites: { some: { siteId: site.id } },
    };

    if (query) {
        where.OR = [
            { title: { contains: query, mode: "insensitive" } },
            { content: { contains: query, mode: "insensitive" } },
        ];
    }

    if (categorySlug) {
        where.category = { slug: categorySlug };
    }

    const announcements = await prisma.announcement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
            category: { select: { name: true, color: true, slug: true } },
        },
    });

    return { site, announcements };
}

export default async function SiteSearchPage({ params, searchParams }: PageProps) {
    const { siteSlug } = await params;
    const { q, category } = await searchParams;
    const data = await searchArticles(siteSlug, q || "", category);

    if (!data) {
        notFound();
    }

    const { site, announcements } = data;

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#fff" }}>
            {/* Navbar */}
            <nav style={{
                display: "flex",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                position: "sticky",
                top: 0,
                backgroundColor: "rgba(10,10,10,0.9)",
                backdropFilter: "blur(10px)",
                zIndex: 100,
            }}>
                <Link href={`/site/${siteSlug}`} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#888",
                    textDecoration: "none",
                }}>
                    <FiArrowLeft size={18} />
                    <span>Back to {site.name}</span>
                </Link>
            </nav>

            {/* Search Header */}
            <div style={{
                padding: "48px 24px",
                textAlign: "center",
                background: `linear-gradient(180deg, ${site.primaryColor}15 0%, transparent 100%)`,
            }}>
                <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "24px" }}>
                    <FiSearch style={{ marginRight: "12px", verticalAlign: "middle" }} />
                    Search
                </h1>

                <form action={`/site/${siteSlug}/search`} method="GET" style={{
                    maxWidth: "600px",
                    margin: "0 auto",
                    display: "flex",
                    gap: "12px",
                }}>
                    <input
                        type="text"
                        name="q"
                        defaultValue={q}
                        placeholder="Search articles..."
                        style={{
                            flex: 1,
                            padding: "14px 20px",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#fff",
                            fontSize: "16px",
                        }}
                    />
                    <button type="submit" style={{
                        padding: "14px 28px",
                        backgroundColor: site.primaryColor,
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}>
                        Search
                    </button>
                </form>

                {/* Categories */}
                <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                    <Link href={`/site/${siteSlug}/search${q ? `?q=${q}` : ""}`} style={{
                        padding: "6px 14px",
                        backgroundColor: !category ? site.primaryColor : "rgba(255,255,255,0.05)",
                        borderRadius: "20px",
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: "13px",
                    }}>
                        All
                    </Link>
                    {site.categories.map((cat) => (
                        <Link key={cat.id} href={`/site/${siteSlug}/search?${q ? `q=${q}&` : ""}category=${cat.slug}`} style={{
                            padding: "6px 14px",
                            backgroundColor: category === cat.slug ? cat.color : "rgba(255,255,255,0.05)",
                            borderRadius: "20px",
                            color: "#fff",
                            textDecoration: "none",
                            fontSize: "13px",
                        }}>
                            {cat.name}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Results */}
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px 80px" }}>
                {q && (
                    <p style={{ color: "#888", marginBottom: "24px" }}>
                        {announcements.length} result{announcements.length !== 1 ? "s" : ""} for &quot;{q}&quot;
                    </p>
                )}

                {announcements.length > 0 ? (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                        gap: "24px",
                    }}>
                        {announcements.map((a) => (
                            <Link key={a.id} href={`/site/${siteSlug}/${a.slug}`} style={{
                                display: "block",
                                textDecoration: "none",
                                backgroundColor: "#1a1a1a",
                                borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.1)",
                                overflow: "hidden",
                            }}>
                                {a.imagePath && (
                                    <div style={{
                                        height: "180px",
                                        backgroundImage: `url(${a.imagePath})`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                    }} />
                                )}
                                <div style={{ padding: "20px" }}>
                                    <span style={{
                                        display: "inline-block",
                                        padding: "3px 10px",
                                        backgroundColor: a.category.color,
                                        color: "#fff",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        marginBottom: "12px",
                                    }}>
                                        {a.category.name}
                                    </span>
                                    <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>
                                        {a.title}
                                    </h3>
                                    <p style={{ color: "#888", fontSize: "14px", marginBottom: "16px" }}>
                                        {a.excerpt}
                                    </p>
                                    <div style={{ display: "flex", gap: "16px", color: "#666", fontSize: "12px" }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <FiCalendar size={12} />
                                            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: id })}
                                        </span>
                                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <FiEye size={12} />
                                            {a.viewCount}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div style={{
                        textAlign: "center",
                        padding: "60px 20px",
                        backgroundColor: "#1a1a1a",
                        borderRadius: "12px",
                    }}>
                        <FiSearch size={48} color="#666" style={{ marginBottom: "16px" }} />
                        <p style={{ color: "#888" }}>
                            {q ? `No results for "${q}"` : "Enter a search term"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
