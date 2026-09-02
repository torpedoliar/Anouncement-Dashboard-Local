import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import AnnouncementForm from "@/components/admin/AnnouncementForm";
import { resolveAdminSiteId } from "@/lib/site-context";

export const dynamic = "force-dynamic";

function toLocalDatetimeString(date: Date | null | undefined): string | null {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}

async function getAnnouncement(id: string) {
    return prisma.announcement.findUnique({
        where: { id },
        include: {
            sites: true,
            category: true,
        },
    });
}

async function getCategories(siteIds: string[]) {
    if (siteIds.length > 0) {
        const cats = await prisma.category.findMany({
            where: { siteId: { in: siteIds } },
            orderBy: { order: "asc" },
        });
        if (cats.length > 0) return cats;
    }
    // Fallback: fetch all categories if none found for specific siteIds
    return prisma.category.findMany({
        orderBy: { order: "asc" },
    });
}

export default async function EditAnnouncementPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const currentSiteId = await resolveAdminSiteId();
    const announcement = await getAnnouncement(id);

    if (!announcement) {
        notFound();
    }

    const relevantSiteIds = Array.from(
        new Set([
            currentSiteId,
            ...announcement.sites.map((s) => s.siteId),
            announcement.category?.siteId,
        ].filter(Boolean) as string[])
    );

    const categories = await getCategories(relevantSiteIds);

    return (
        <div style={{ padding: '32px' }}>
            {/* Header — judul + deskripsi, tanpa eyebrow. */}
            <div style={{ marginBottom: '32px' }}>
                <h1 className="font-display text-title font-bold" style={{ color: 'var(--text-primary)' }}>
                    Edit Pengumuman
                </h1>
                <p className="text-small" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                    Perbarui pengumuman yang sudah ada
                </p>
            </div>

            {/* Form */}
            <AnnouncementForm
                categories={categories}
                defaultSiteId={currentSiteId}
                initialData={{
                    id: announcement.id,
                    title: announcement.title,
                    content: announcement.content,
                    categoryId: announcement.categoryId,
                    imagePath: announcement.imagePath,
                    videoPath: announcement.videoPath,
                    videoType: announcement.videoType,
                    youtubeUrl: announcement.youtubeUrl,
                    isPublished: announcement.isPublished,
                    allowComments: announcement.allowComments,
                    scheduledAt: toLocalDatetimeString(announcement.scheduledAt),
                    takedownAt: toLocalDatetimeString(announcement.takedownAt),
                    sites: announcement.sites.map(site => ({
                        siteId: site.siteId,
                        isPrimary: site.isPrimary,
                        isHero: site.isHero,
                        isPinned: site.isPinned,
                    })),
                }}
            />
        </div>
    );
}
