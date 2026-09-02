import prisma from "@/lib/prisma";
import AnnouncementForm from "@/components/admin/AnnouncementForm";
import { resolveAdminSiteId } from "@/lib/site-context";

export const dynamic = "force-dynamic";

async function getCategories(siteId: string | null) {
    if (siteId) {
        const cats = await prisma.category.findMany({
            where: { siteId },
            orderBy: { order: "asc" },
        });
        if (cats.length > 0) return cats;
    }
    return prisma.category.findMany({
        orderBy: { order: "asc" },
    });
}

export default async function NewAnnouncementPage() {
    const currentSiteId = await resolveAdminSiteId();
    const categories = await getCategories(currentSiteId);

    return (
        <div style={{ padding: '32px' }}>
            {/* Header — judul + deskripsi, tanpa eyebrow. */}
            <div style={{ marginBottom: '32px' }}>
                <h1 className="font-display text-title font-bold" style={{ color: 'var(--text-primary)' }}>
                    Buat Pengumuman Baru
                </h1>
                <p className="text-small" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                    Tambahkan pengumuman baru ke dashboard
                </p>
            </div>

            {/* Form */}
            <AnnouncementForm categories={categories} defaultSiteId={currentSiteId} />
        </div>
    );
}
