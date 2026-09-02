/**
 * Site Search Page
 * Pencarian artikel dalam satu site (isolasi per-site dijaga).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MagnifyingGlass } from "@/components/ui/client-icons";
import AnnouncementCard from "@/components/AnnouncementCard";

// Thumbnail/reading helpers sekarang hidup di dalam AnnouncementCard (T4).

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
        backgroundColor: active ? "var(--site-primary-alpha)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-2)",
    };
}

export default async function SiteSearchPage({ params, searchParams }: PageProps) {
    const { siteSlug } = await params;
    const { q, category } = await searchParams;
    const query = q || "";
    const data = await searchArticles(siteSlug, query, category);

    if (!data) {
        notFound();
    }

    const { site, announcements } = data;

    // URL helper untuk chip kategori (pertahankan query saat ganti kategori).
    const buildCategoryUrl = (slug: string | null) => {
        const params = new URLSearchParams();
        if (slug) params.set("category", slug);
        if (query) params.set("q", query);
        return `/site/${siteSlug}/search${params.toString() ? `?${params.toString()}` : ""}`;
    };

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--surface-0)", color: "var(--text-1)" }}>
            {/* Halaman search mendapat Navbar dari site layout (T2.2 menghapus
                blok <nav> lokal yang tertimbun). */}

            {/* Header Pencarian */}
            <div style={{
                padding: "48px 24px",
                textAlign: "center",
                background: `linear-gradient(180deg, ${site.primaryColor}15 0%, transparent 100%)`,
            }}>
                <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "24px" }}>
                    <MagnifyingGlass style={{ marginRight: "12px", verticalAlign: "middle" }} aria-hidden="true" />
                    Pencarian
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
                        defaultValue={query}
                        placeholder="Cari artikel di site ini…"
                        aria-label="Kata kunci pencarian"
                        style={{
                            flex: 1,
                            padding: "14px 20px",
                            backgroundColor: "var(--surface-1)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            color: "var(--text-1)",
                            fontSize: "16px",
                        }}
                    />
                    <button type="submit" style={{
                        padding: "14px 28px",
                        backgroundColor: "var(--accent)",
                        border: "none",
                        borderRadius: "8px",
                        color: "var(--site-text-on-primary)",
                        fontWeight: 600,
                        cursor: "pointer",
                        minHeight: "44px",
                    }}>
                        Cari
                    </button>
                </form>

                {/* Chip kategori — token-native, aria-pressed (konsisten dengan T5) */}
                <nav aria-label="Filter kategori" style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                    <Link
                        href={buildCategoryUrl(null)}
                        aria-pressed={!category}
                        style={chipStyle(!category)}
                    >
                        Semua
                    </Link>
                    {site.categories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={buildCategoryUrl(cat.slug)}
                            aria-pressed={category === cat.slug}
                            style={chipStyle(category === cat.slug)}
                        >
                            {cat.name}
                        </Link>
                    ))}
                </nav>
            </div>

            {/* Hasil */}
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px 80px" }}>
                {query && (
                    <p style={{ color: "var(--text-3)", marginBottom: "24px" }}>
                        {announcements.length} hasil untuk &quot;{query}&quot;
                    </p>
                )}

                {announcements.length > 0 ? (
                    <div
                        className="cine-stagger"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))",
                            gap: "24px",
                        }}
                    >
                        {announcements.map((a, i) => (
                            <AnnouncementCard
                                key={a.id}
                                style={{ "--i": Math.min(i, 11) } as React.CSSProperties}
                                id={a.id}
                                title={a.title}
                                excerpt={a.excerpt || undefined}
                                slug={a.slug}
                                siteSlug={siteSlug}
                                imagePath={a.imagePath || undefined}
                                videoPath={a.videoPath}
                                videoType={a.videoType}
                                youtubeUrl={a.youtubeUrl}
                                category={a.category}
                                createdAt={a.createdAt}
                                isPinned={a.isPinned}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{
                        textAlign: "center",
                        padding: "60px 20px",
                        backgroundColor: "var(--surface-1)",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                    }}>
                        <MagnifyingGlass size={48} style={{ color: "var(--text-3)", marginBottom: "16px" }} aria-hidden="true" />
                        <p style={{ color: "var(--text-3)" }}>
                            {query ? `Tidak ada hasil untuk "${query}"` : "Masukkan kata kunci pencarian"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
