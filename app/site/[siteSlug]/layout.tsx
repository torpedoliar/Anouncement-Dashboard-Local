import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SiteThemeProvider from "@/components/SiteThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const dynamic = 'force-dynamic';

export default async function SiteLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ siteSlug: string }>;
}) {
    const { siteSlug } = await params;

    const [site, globalSettings] = await Promise.all([
        prisma.site.findUnique({
            where: { slug: siteSlug, isActive: true },
            include: {
                settings: true,
                categories: {
                    orderBy: { order: "asc" },
                    select: { name: true, slug: true },
                },
            },
        }),
        prisma.settings.findFirst(),
    ]);

    if (!site) {
        notFound();
    }

    // Construct custom links for Navbar
    const customLinks = [
        { href: `/site/${site.slug}`, label: "BERANDA" },
        ...site.categories.slice(0, 5).map((cat) => ({
            href: `/site/${site.slug}?category=${cat.slug}`,
            label: cat.name.toUpperCase(),
        })),
        { href: `/site/${site.slug}/search`, label: "PENCARIAN" },
    ];

    // Construct settings for Footer
    const footerSettings = {
        siteName: site.name,
        aboutText: site.settings?.aboutText || `Informasi terbaru dari ${site.name}`,
        logoPath: site.logoPath || globalSettings?.logoPath,
        instagramUrl: site.settings?.instagramUrl || null,
        linkedinUrl: site.settings?.linkedinUrl || null,
        facebookUrl: site.settings?.facebookUrl || null,
        twitterUrl: site.settings?.twitterUrl || null,
        youtubeUrl: site.settings?.youtubeUrl || null,
    };

    return (
        <SiteThemeProvider
            primaryColor={site.primaryColor}
            siteName={site.name}
            siteSlug={site.slug}
        >
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navbar
                    logoPath={site.logoPath || globalSettings?.logoPath}
                    siteName={site.name}
                    customLinks={customLinks}
                />

                <main style={{ flex: 1 }}>
                    {children}
                </main>

                <Footer settings={footerSettings} />
            </div>
        </SiteThemeProvider>
    );
}
