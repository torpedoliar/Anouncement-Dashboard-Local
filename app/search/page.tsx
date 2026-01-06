import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementCard from "@/components/AnnouncementCard";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

interface SearchPageProps {
    searchParams: Promise<{ q?: string; page?: string }>;
}

const ITEMS_PER_PAGE = 12;

async function searchAnnouncements(query: string, page: number = 1) {
    if (!query) return { announcements: [], total: 0, totalPages: 0 };

    const skip = (page - 1) * ITEMS_PER_PAGE;

    const where = {
        isPublished: true,
        OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { content: { contains: query, mode: "insensitive" as const } },
            { excerpt: { contains: query, mode: "insensitive" as const } },
        ],
    };

    const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: ITEMS_PER_PAGE,
            include: {
                category: { select: { name: true, color: true } },
            },
        }),
        prisma.announcement.count({ where }),
    ]);

    return {
        announcements,
        total,
        totalPages: Math.ceil(total / ITEMS_PER_PAGE),
    };
}

async function getSettings() {
    return prisma.settings.findFirst();
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const { q, page } = await searchParams;
    const query = q || "";
    const currentPage = parseInt(page || "1");

    const [resultData, settings] = await Promise.all([
        searchAnnouncements(query, currentPage),
        getSettings(),
    ]);

    const { announcements, total, totalPages } = resultData;

    // Build search params for pagination
    const paginationParams: Record<string, string> = {};
    if (query) paginationParams.q = query;

    return (
        <main className="min-h-screen bg-black">
            <Navbar
                logoPath={settings?.logoPath || undefined}
                siteName={settings?.siteName || "Santos Jaya Abadi"}
            />

            {/* Spacer for fixed navbar */}
            <div className="h-20" />

            <section className="py-16 lg:py-24">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    {/* Back Link */}
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-neutral-400 hover:text-red-500 mb-12 transition-colors text-sm"
                    >
                        <FiArrowLeft className="w-4 h-4" />
                        Kembali ke Beranda
                    </Link>

                    {/* Search Header */}
                    <div className="mb-16">
                        <p className="section-title mb-4" style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600, letterSpacing: '0.2em' }}>PENCARIAN</p>
                        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-white mb-8" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            Hasil Pencarian
                        </h1>
                        <div style={{ maxWidth: '672px' }}>
                            <SearchBar />
                        </div>
                    </div>

                    {/* Query Info */}
                    {query && (
                        <p className="text-neutral-400 mb-12 text-lg">
                            Ditemukan <span className="text-white font-semibold">{total}</span> hasil untuk
                            <span className="text-red-500 font-semibold"> &ldquo;{query}&rdquo;</span>
                        </p>
                    )}

                    {/* Results Grid */}
                    {announcements.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {announcements.map((announcement, index) => (
                                    <div
                                        key={announcement.id}
                                        className="animate-slide-up"
                                        style={{ animationDelay: `${index * 0.1}s` }}
                                    >
                                        <AnnouncementCard
                                            id={announcement.id}
                                            title={announcement.title}
                                            excerpt={announcement.excerpt || undefined}
                                            slug={announcement.slug}
                                            imagePath={announcement.imagePath || undefined}
                                            videoPath={announcement.videoPath}
                                            videoType={announcement.videoType}
                                            youtubeUrl={announcement.youtubeUrl}
                                            category={announcement.category}
                                            createdAt={announcement.createdAt}
                                            viewCount={announcement.viewCount}
                                            isPinned={announcement.isPinned}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    baseUrl="/search"
                                    searchParams={paginationParams}
                                />
                            )}
                        </>
                    ) : query ? (
                        <div className="text-center py-20">
                            <p className="text-neutral-400 text-lg mb-4">
                                Tidak ada hasil untuk &ldquo;{query}&rdquo;
                            </p>
                            <p className="text-neutral-500 text-sm">
                                Coba kata kunci yang berbeda atau lebih umum
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-neutral-400 text-lg">
                                Masukkan kata kunci untuk mencari pengumuman
                            </p>
                        </div>
                    )}
                </div>
            </section>

            <Footer />
        </main>
    );
}
