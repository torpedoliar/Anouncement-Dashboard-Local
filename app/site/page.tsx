// This is a server component
import { prisma } from "@/lib/prisma";
import { FiGlobe } from "react-icons/fi";
import SitePickerCard from "@/components/SitePickerCard";
import Image from "next/image";

export const dynamic = "force-dynamic";

async function getActiveSites() {
    return await prisma.site.findMany({
        where: { isActive: true },
        include: {
            settings: {
                select: {
                    heroTitle: true,
                    heroSubtitle: true,
                },
            },
            _count: {
                select: {
                    announcementSites: true,
                    categories: true,
                },
            },
        },
        orderBy: [
            { isDefault: "desc" },
            { name: "asc" },
        ],
    });
}

async function getGlobalSettings() {
    return await prisma.settings.findFirst();
}

export default async function SitePickerPage() {
    const [sites, settings] = await Promise.all([
        getActiveSites(),
        getGlobalSettings()
    ]);

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "#0a0a0a",
                color: "#fff",
            }}
        >
            {/* Masthead Kapal Api Committed (T9) — blok merah penuh teks putih,
                bukan gradient-clipped. Skala di clamp supaya proporsional. */}
            <div
                style={{
                    padding: "64px 24px 48px",
                    textAlign: "center",
                    backgroundColor: "var(--brand-red)",
                }}
            >
                {settings?.logoPath ? (
                    <div style={{ position: 'relative', width: '120px', height: '120px', margin: "0 auto 24px" }}>
                        <Image
                            src={settings.logoPath}
                            alt="Logo"
                            fill
                            style={{ objectFit: 'contain' }}
                        />
                    </div>
                ) : (
                    <div
                        style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "20px",
                            backgroundColor: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 24px",
                        }}
                    >
                        <FiGlobe size={40} color="#ED1C24" />
                    </div>
                )}
                <h1
                    style={{
                        fontSize: "clamp(28px, 5vw, 48px)",
                        fontWeight: 800,
                        marginBottom: "16px",
                        color: "var(--site-text-on-primary, #fff)",
                    }}
                >
                    Pilih Site
                </h1>
                <p
                    style={{
                        fontSize: "18px",
                        color: "rgba(255,255,255,0.9)",
                        maxWidth: "600px",
                        margin: "0 auto",
                    }}
                >
                    Pilih salah satu site untuk melihat berita dan pengumuman terbaru
                </p>
            </div>

            {/* Sites Grid */}
            <div
                style={{
                    maxWidth: "1200px",
                    margin: "0 auto",
                    padding: "0 24px 80px",
                }}
            >
                {sites.length > 0 ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))",
                            gap: "24px",
                        }}
                    >
                        {sites.map((site) => (
                            <SitePickerCard key={site.id} site={site} />
                        ))}
                    </div>
                ) : (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "60px 20px",
                        }}
                    >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card border border-accent/30 bg-accent-subtle">
                            <FiGlobe size={24} className="text-accent" aria-hidden="true" />
                        </div>
                        <h2 className="mt-4 font-display text-lg font-semibold text-text-1">
                            Belum Ada Site
                        </h2>
                        <p className="mx-auto mt-3 max-w-[420px] text-sm text-text-2">
                            Belum ada site yang aktif. Hubungi admin untuk menyiapkan site pertama.
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div
                style={{
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    padding: "24px",
                    textAlign: "center",
                    color: "#666",
                    fontSize: "13px",
                }}
            >
                © {new Date().getFullYear()} Santos Jaya Abadi. All rights reserved.
            </div>
        </div>
    );
}
