import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AnnouncementCard from "@/components/AnnouncementCard";
import { CategoryFilterClient } from "@/components/CategoryFilter";
import SearchBar from "@/components/SearchBar";
import Footer from "@/components/Footer";
import prisma from "@/lib/prisma";
import { runScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// Run scheduler on homepage load (throttled to once per minute)
async function checkScheduler() {
  await runScheduler();
}

async function getHeroAnnouncements() {
  return prisma.announcement.findMany({
    where: { isPublished: true, isHero: true },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, excerpt: true, slug: true, imagePath: true },
  });
}

async function getAnnouncements(categorySlug?: string) {
  return prisma.announcement.findMany({
    where: {
      isPublished: true,
      ...(categorySlug && { category: { slug: categorySlug } }),
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 9,
    include: { category: { select: { name: true, color: true, slug: true } } },
  });
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
  searchParams: Promise<{ category?: string }>;
}) {
  // Run auto-scheduler check
  await checkScheduler();

  const searchParams = await searchParamsPromise;
  const categorySlug = searchParams.category;

  const [heroAnnouncements, announcements, categories, settings] = await Promise.all([
    getHeroAnnouncements(),
    getAnnouncements(categorySlug),
    getCategories(),
    getSettings(),
  ]);

  // Find active category name for empty state message
  const activeCategory = categorySlug
    ? categories.find((c: typeof categories[0]) => c.slug === categorySlug)?.name
    : null;

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
                    category={announcement.category}
                    createdAt={announcement.createdAt}
                    viewCount={announcement.viewCount}
                    isPinned={announcement.isPinned}
                  />
                </div>
              ))}
            </div>
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

          {/* View All Link */}
          {announcements.length >= 9 && (
            <div style={{ textAlign: 'center', marginTop: '64px' }}>
              <a
                href="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px 32px',
                  border: '1px solid #dc2626',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  transition: 'all 0.3s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#dc2626';
                }}
              >
                LIHAT SEMUA BERITA
              </a>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main >
  );
}
