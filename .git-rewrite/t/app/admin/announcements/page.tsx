import prisma from "@/lib/prisma";
import AnnouncementsList from "@/components/admin/AnnouncementsList";

export const dynamic = "force-dynamic";

async function getAnnouncements() {
    return prisma.announcement.findMany({
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: {
            category: { select: { name: true, color: true } },
        },
    });
}

async function getCategories() {
    return prisma.category.findMany({
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
