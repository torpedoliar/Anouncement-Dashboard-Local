import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

// No ISR — redirect to canonical site-scoped URL runs on every request and
// needs fresh data to determine the correct site. Stale cache would break it.
export const dynamic = "force-dynamic";

interface AnnouncementPageProps {
    params: Promise<{ slug: string }>;
}

/**
 * Resolve the canonical per-site URL for a bare /<slug> article.
 * Legacy links must land on a site-scoped page so data stays isolated per site.
 */
async function getCanonicalSitePath(slug: string): Promise<string | null> {
    const announcement = await prisma.announcement.findUnique({
        where: { slug },
        select: {
            sites: {
                select: { isPrimary: true, site: { select: { slug: true } } },
            },
        },
    });
    if (!announcement || announcement.sites.length === 0) return null;
    const primary = announcement.sites.find((s) => s.isPrimary) ?? announcement.sites[0];
    return `/site/${primary.site.slug}/${slug}`;
}

export default async function AnnouncementPage({ params }: AnnouncementPageProps) {
    const { slug } = await params;

    // Redirect legacy bare-slug URLs to the article's site-scoped canonical page,
    // so per-site data separation is preserved instead of rendering globally.
    const canonical = await getCanonicalSitePath(slug);
    // Orphan (tanpa relasi site) → ke site picker, tidak pernah 404. Tidak ada artikel hilang.
    redirect(canonical ?? "/site");
}
