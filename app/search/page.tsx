import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnnouncementCard from "@/components/AnnouncementCard";
import SearchBar from "@/components/SearchBar";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

interface SearchPageProps {
    searchParams: Promise<{ q?: string }>;
}

async function searchAnnouncements(query: string) {
    if (!query) return [];

    return prisma.announcement.findMany({
        where: {
            isPublished: true,
            OR: [
                { title: { contains: query, mode: "insensitive" } },
                { content: { contains: query, mode: "insensitive" } },
                { excerpt: { contains: query, mode: "insensitive" } },
            ],
        },
        orderBy: { createdAt: "desc" },
        include: {
            category: { select: { name: true, color: true } },
        },
    });
}

async function getSettings() {
    return prisma.settings.findFirst();
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const { q } = await searchParams;
    const query = q || "";

    const [results, settings] = await Promise.all([
        searchAnnouncements(query),
        getSettings(),
    ]);

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
                        <p className="section-title mb-4">PENCARIAN</p>
                        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-white mb-8">
                            Hasil Pencarian
                        </h1>
                        <SearchBar className="max-w-2xl" />
                    </div>

                    {/* Query Info */}
                    {query && (
                        <p className="text-neutral-400 mb-12 text-lg">
                            Ditemukan <span className="text-white font-semibold">{results.length}</span> hasil untuk
                            <span className="text-red-500 font-semibold"> &ldquo;{query}&rdquo;</span>
                        </p>
                    )}

                    {/* Results Grid */}
                    {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {results.map((announcement, index) => (
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
                                        category={announcement.category}
                                        createdAt={announcement.createdAt}
                                        viewCount={announcement.viewCount}
                                        isPinned={announcement.isPinned}
                                    />
                                </div>
                            ))}
                        </div>
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
