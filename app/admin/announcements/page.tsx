import prisma from "@/lib/prisma";
import AnnouncementsList from "@/components/admin/AnnouncementsList";
import { getCurrentSiteId } from "@/lib/site-context";

export const dynamic = "force-dynamic";

async function getAnnouncements() {
    const siteId = await getCurrentSiteId();
    
    // If siteId is present, filter announcements that belong to this site
    // Also include site relationships so the frontend can display them if needed
    const whereClause = siteId ? { sites: { some: { siteId } } } : {};

    const announcements = await prisma.announcement.findMany({
        where: whereClause,
        orderBy: [{ createdAt: "desc" }],
        include: {
            category: { select: { name: true, color: true } },
            sites: {
                include: {
                    site: { select: { id: true, name: true, slug: true } }
                }
            }
        },
    });

    // When a site context is active, surface that site's per-site pin/hero flags
    // and sort pinned-first for this site. Otherwise fall back to the global flags.
    if (!siteId) return announcements;

    return announcements
        .map((a) => {
            const here = a.sites.find((s) => s.siteId === siteId);
            return {
                ...a,
                isPinned: here?.isPinned ?? a.isPinned,
                isHero: here?.isHero ?? a.isHero,
            };
        })
        .sort((x, y) => Number(y.isPinned) - Number(x.isPinned));
}

async function getCategories() {
    const siteId = await getCurrentSiteId();
    const whereClause = siteId ? { siteId } : {};
    
    return prisma.category.findMany({
        where: whereClause,
        orderBy: { order: "asc" },
    });
}

export default async function AnnouncementsPage() {
    const [announcements, categories] = await Promise.all([
        getAnnouncements(),
        getCategories(),
    ]);

    return (
        <AnnouncementsList
            announcements={announcements}
            categories={categories}
        />
    );
}
