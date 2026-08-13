import prisma from "@/lib/prisma";
import AnnouncementsList from "@/components/admin/AnnouncementsList";
import { resolveAdminSiteId } from "@/lib/site-context";

export const dynamic = "force-dynamic";

async function getAnnouncements(siteId: string | null) {
    if (!siteId) return [];

    const announcements = await prisma.announcement.findMany({
        where: { sites: { some: { siteId } } },
        orderBy: [{ createdAt: "desc" }],
        include: {
            category: { select: { name: true, color: true } },
            author: { select: { name: true } },
            sites: {
                include: {
                    site: { select: { id: true, name: true, slug: true } }
                }
            },
        },
    });

    return announcements
        .map((a) => {
            const here = a.sites.find((s) => s.siteId === siteId);
            return {
                ...a,
                isPinned: here?.isPinned ?? a.isPinned,
                isHero: here?.isHero ?? a.isHero,
                primarySite: ((): { name: string; slug: string } | null => {
                    const primary = a.sites.find((s) => s.isPrimary);
                    if (primary) return primary.site;
                    const scoped = a.sites.find((s) => s.siteId === siteId);
                    if (scoped) return scoped.site;
                    const first = a.sites[0];
                    if (first) return first.site;
                    return null;
                })(),
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
