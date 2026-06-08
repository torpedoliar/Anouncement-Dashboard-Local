import prisma from "@/lib/prisma";
import AnnouncementsList from "@/components/admin/AnnouncementsList";
import { resolveAdminSiteId } from "@/lib/site-context";

export const dynamic = "force-dynamic";

async function getAnnouncements(siteId: string | null) {
    // Always scope to a site. If we truly cannot resolve one, return nothing
    // rather than leaking every site's announcements.
    if (!siteId) return [];

    const announcements = await prisma.announcement.findMany({
        where: { sites: { some: { siteId } } },
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

    // Surface this site's per-site pin/hero flags and sort pinned-first.
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

async function getCategories(siteId: string | null) {
    if (!siteId) return [];
    return prisma.category.findMany({
        where: { siteId },
        orderBy: { order: "asc" },
    });
}

export default async function AnnouncementsPage() {
    const siteId = await resolveAdminSiteId();
    const [announcements, categories] = await Promise.all([
        getAnnouncements(siteId),
        getCategories(siteId),
    ]);

    return (
        <AnnouncementsList
            announcements={announcements}
            categories={categories}
        />
    );
}
