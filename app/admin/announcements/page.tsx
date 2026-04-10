import prisma from "@/lib/prisma";
import AnnouncementsList from "@/components/admin/AnnouncementsList";
import { getCurrentSiteId } from "@/lib/site-context";

export const dynamic = "force-dynamic";

async function getAnnouncements() {
    const siteId = await getCurrentSiteId();
    
    // If siteId is present, filter announcements that belong to this site
    // Also include site relationships so the frontend can display them if needed
    const whereClause = siteId ? { sites: { some: { siteId } } } : {};

    return prisma.announcement.findMany({
        where: whereClause,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: {
            category: { select: { name: true, color: true } },
            sites: {
                include: {
                    site: { select: { id: true, name: true, slug: true } }
                }
            }
        },
    });
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
