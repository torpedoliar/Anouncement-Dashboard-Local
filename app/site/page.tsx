"use client";

// NOT "use client" - this is a server component
import { prisma } from "@/lib/prisma";
import { FiGlobe } from "react-icons/fi";
import SitePickerCard from "@/components/SitePickerCard";

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

export default async function SitePickerPage() {
    const sites = await getActiveSites();

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "#0a0a0a",
                color: "#fff",
            }}
        >
            {/* Hero Section */}
            <div
                style={{
                    padding: "80px 24px",
                    textAlign: "center",
                    background: "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)",
                }}
            >
                <div
                    style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "20px",
                        backgroundColor: "#ED1C24",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 24px",
                    }}
                >
                    <FiGlobe size={40} color="#fff" />
                </div>
                <h1
                    style={{
                        fontSize: "48px",
                        fontWeight: 800,
                        marginBottom: "16px",
                        background: "linear-gradient(135deg, #fff 0%, #888 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Pilih Site
                </h1>
                <p
                    style={{
                        fontSize: "18px",
                        color: "#888",
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
                            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
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
                            backgroundColor: "#1a1a1a",
                            borderRadius: "16px",
                            border: "1px solid rgba(255,255,255,0.1)",
                        }}
                    >
                        <FiGlobe size={48} color="#666" style={{ marginBottom: "16px" }} />
                        <h3 style={{ fontSize: "18px", marginBottom: "8px", color: "#fff" }}>
                            Belum Ada Site
                        </h3>
                        <p style={{ color: "#888" }}>
                            Site sedang dalam pengembangan. Silakan kembali lagi nanti.
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
