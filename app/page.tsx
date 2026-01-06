import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AnnouncementCard from "@/components/AnnouncementCard";
import { CategoryFilterClient } from "@/components/CategoryFilter";
import SearchBar from "@/components/SearchBar";
import Footer from "@/components/Footer";
import Pagination from "@/components/Pagination";
import prisma from "@/lib/prisma";

const ITEMS_PER_PAGE = 9;

async function getHeroAnnouncements() {
  return prisma.announcement.findMany({
    where: { isPublished: true, isHero: true },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      excerpt: true,
      slug: true,
      imagePath: true,
      videoPath: true,
      videoType: true,
      youtubeUrl: true,
    },
  });
}

async function getAnnouncements(categorySlug?: string, page: number = 1) {
  const skip = (page - 1) * ITEMS_PER_PAGE;

  const where = {
    isPublished: true,
    ...(categorySlug && { category: { slug: categorySlug } }),
  };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip,
      take: ITEMS_PER_PAGE,
      include: { category: { select: { name: true, color: true, slug: true } } },
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    announcements,
    total,
    totalPages: Math.ceil(total / ITEMS_PER_PAGE),
  };
}

async function getCategories() {
  return prisma.category.findMany({ orderBy: { order: "asc" } });
}

async function getSettings() {
  return prisma.settings.findFirst();
}

export default async function HomePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const categorySlug = searchParams.category;
  const currentPage = parseInt(searchParams.page || "1");

  const [heroAnnouncements, announcementData, categories, settings] = await Promise.all([
    getHeroAnnouncements(),
    getAnnouncements(categorySlug, currentPage),
    getCategories(),
    getSettings(),
  ]);

  const { announcements, totalPages } = announcementData;

  // Find active category name for empty state message
  const activeCategory = categorySlug
    ? categories.find((c: typeof categories[0]) => c.slug === categorySlug)?.name
    : null;

  // Build search params for pagination
  const paginationParams: Record<string, string> = {};
  if (categorySlug) paginationParams.category = categorySlug;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#000' }}>
      <Navbar
        logoPath={settings?.logoPath || undefined}
        siteName={settings?.siteName || "Santos Jaya Abadi"}
      />

      <HeroSection
        announcements={heroAnnouncements}
        heroTitle={settings?.heroTitle || "BERITA & PENGUMUMAN"}
        heroSubtitle={settings?.heroSubtitle || "Informasi terbaru dari perusahaan"}
        heroImage={settings?.heroImage}
      />

      {/* News Section */}
      <section id="news" style={{ padding: '96px 0', backgroundColor: '#000' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          {/* Section Header */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            marginBottom: '64px',
          }}>
            <div>
              <p style={{
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                AKTIVITAS PERUSAHAAN
              </p>
              <h2 style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 'clamp(24px, 4vw, 36px)',
                fontWeight: 700,
                color: '#fff',
              }}>
                Berita & Artikel Terbaru
              </h2>
            </div>

            <div style={{ maxWidth: '480px' }}>
              <SearchBar placeholder="Cari pengumuman..." />
            </div>
          </div>

          {/* Category Filter */}
          <div style={{ marginBottom: '48px' }}>
            <CategoryFilterClient categories={categories} activeCategory={categorySlug || "all"} />
          </div>

          {/* Announcements Grid */}
          {announcements.length > 0 ? (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '32px',
              }}>
                {announcements.map((announcement: typeof announcements[0], index: number) => (
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
                  baseUrl="/"
                  searchParams={paginationParams}
                />
              )}
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '80px 0',
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a1a1a',
            }}>
              <p style={{ color: '#525252', fontSize: '18px', marginBottom: '8px' }}>
                {activeCategory
                  ? `Belum ada artikel di kategori "${activeCategory}".`
                  : 'Belum ada pengumuman yang dipublikasikan.'}
              </p>
              {activeCategory && (
                <a
                  href="/"
                  style={{ color: '#dc2626', fontSize: '14px' }}
                >
                  Lihat semua artikel →
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
