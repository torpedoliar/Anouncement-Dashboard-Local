import prisma from "@/lib/prisma";
import AnnouncementForm from "@/components/admin/AnnouncementForm";

export const dynamic = "force-dynamic";

async function getCategories() {
    return prisma.category.findMany({
        orderBy: { order: "asc" },
    });
}

export default async function NewAnnouncementPage() {
    const categories = await getCategories();

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
            <AnnouncementForm categories={categories} />
        </div>
    );
}
