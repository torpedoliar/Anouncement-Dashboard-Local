import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import AnnouncementForm from "@/components/admin/AnnouncementForm";

export const dynamic = "force-dynamic";

async function getAnnouncement(id: string) {
    return prisma.announcement.findUnique({
        where: { id },
    });
}

async function getCategories() {
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

    const [announcement, categories] = await Promise.all([
        getAnnouncement(id),
        getCategories(),
    ]);

    if (!announcement) {
        notFound();
    }

    return (
        <div style={{ padding: '32px' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <p style={{
                    color: '#dc2626',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    marginBottom: '4px',
                }}>
                    EDIT
                </p>
                <h1 style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#fff',
                }}>
                    Edit Pengumuman
                </h1>
                <p style={{ color: '#737373', marginTop: '4px' }}>
                    Perbarui pengumuman yang sudah ada
                </p>
            </div>

            {/* Form */}
            <AnnouncementForm
                categories={categories}
                initialData={{
                    id: announcement.id,
                    title: announcement.title,
                    content: announcement.content,
                    categoryId: announcement.categoryId,
                    imagePath: announcement.imagePath,
                    videoPath: announcement.videoPath,
                    videoType: announcement.videoType,
                    youtubeUrl: announcement.youtubeUrl,
                    isHero: announcement.isHero,
                    isPinned: announcement.isPinned,
                    isPublished: announcement.isPublished,
                    scheduledAt: announcement.scheduledAt?.toISOString().slice(0, 16) || null,
                    takedownAt: announcement.takedownAt?.toISOString().slice(0, 16) || null,
                }}
            />
        </div>
    );
}
