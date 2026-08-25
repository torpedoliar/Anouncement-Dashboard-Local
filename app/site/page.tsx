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
                backgroundColor: "var(--surface-0)",
                color: "var(--text-1)",
            }}
        >
            {/* Masthead Kapal Api — versi kalem (revisi): merah tidak lagi flat
                menyala; tinggi dipangkas dan diberi napas sebelum grid.
                Teks putih fixed-light: selalu di atas gradient merah brand. */}
            <div
                style={{
                    padding: "36px 24px 32px",
                    textAlign: "center",
                    background: "linear-gradient(135deg, var(--brand-red-dark) 0%, var(--brand-red) 55%, var(--brand-red-light) 100%)",
                    borderBottom: "1px solid rgba(0,0,0,0.12)",
                }}
            >
                {settings?.logoPath ? (
                    <div style={{ position: 'relative', width: '88px', height: '88px', margin: "0 auto 16px", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.18))" }}>
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
                            width: "64px",
                            height: "64px",
                            borderRadius: "16px",
                            backgroundColor: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 16px",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
                        }}
                    >
                        <FiGlobe size={32} color="#C41920" />
                    </div>
                )}
                <h1
                    style={{
                        fontSize: "clamp(24px, 4vw, 38px)",
                        fontWeight: 800,
                        lineHeight: 1.15,
                        marginBottom: "10px",
                        color: "#fff",
                        textWrap: "balance",
                    }}
                >
                    Pilih Site
                </h1>
                <p
                    style={{
                        fontSize: "15px",
                        lineHeight: 1.6,
                        color: "rgba(255,255,255,0.88)",
                        maxWidth: "560px",
                        margin: "0 auto",
                    }}
                >
                    Pilih salah satu site untuk melihat berita dan pengumuman terbaru
                </p>
            </div>

            {/* Sites Grid — diberi napas atas supaya tidak menabrak masthead */}
            <div
                style={{
                    maxWidth: "1200px",
                    margin: "0 auto",
                    padding: "32px 24px 80px",
                }}
            >
                {sites.length > 0 ? (
                    <div
                        className="cine-stagger"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))",
                            gap: "24px",
                        }}
                    >
                        {sites.map((site, i) => (
                            <div key={site.id} style={{ "--i": i } as React.CSSProperties}>
                                <SitePickerCard site={site} />
                            </div>
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
                    borderTop: "1px solid var(--border)",
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--text-3)",
                    fontSize: "13px",
                }}
            >
                © {new Date().getFullYear()} Santos Jaya Abadi. All rights reserved.
            </div>
        </div>
    );
}
