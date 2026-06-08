import prisma from "@/lib/prisma";
import AnnouncementForm from "@/components/admin/AnnouncementForm";
import { resolveAdminSiteId } from "@/lib/site-context";

export const dynamic = "force-dynamic";

async function getCategories(siteId: string | null) {
    // Only this site's categories; never every site's (prevents picking a
    // category that belongs to another tenant).
    if (!siteId) return [];
    return prisma.category.findMany({
        where: { siteId },
        orderBy: { order: "asc" },
    });
}

export default async function NewAnnouncementPage() {
    const currentSiteId = await resolveAdminSiteId();
    const categories = await getCategories(currentSiteId);

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
                    BUAT BARU
                </p>
                <h1 style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#fff',
                }}>
                    Buat Pengumuman Baru
                </h1>
                <p style={{ color: '#737373', marginTop: '4px' }}>
                    Tambahkan pengumuman baru ke dashboard
                </p>
            </div>

            {/* Form */}
            <AnnouncementForm categories={categories} defaultSiteId={currentSiteId} />
        </div>
    );
}
