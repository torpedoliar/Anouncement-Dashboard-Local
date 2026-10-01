// This is a server component
import { prisma } from "@/lib/prisma";
import { Globe } from "@/components/ui/client-icons";
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
        <div className="site-paper min-h-screen bg-surface-0 text-text-1">
            {/* Masthead Kapal Api — versi kalem (revisi): merah tidak lagi flat
                menyala; tinggi dipangkas dan diberi napas sebelum grid.
                Teks putih fixed-light: selalu di atas gradient merah brand. */}
            <div className="border-b border-black/10 bg-[linear-gradient(135deg,var(--brand-red-dark)_0%,var(--brand-red)_55%,var(--brand-red-light)_100%)] px-6 pb-8 pt-9 text-center">
                {settings?.logoPath ? (
                    <div className="relative mx-auto mb-4 h-[88px] w-[88px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                        <Image
                            src={settings.logoPath}
                            alt="Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                ) : (
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.16)]">
                        <Globe size={32} color="#C41920" />
                    </div>
                )}
                <h1 className="mb-2.5 font-serif text-[clamp(24px,4vw,38px)] font-bold leading-[1.15] text-white [text-wrap:balance]">
                    Pilih Site
                </h1>
                <p className="mx-auto max-w-[560px] text-[15px] leading-relaxed text-white/90">
                    Pilih salah satu site untuk melihat berita dan pengumuman terbaru
                </p>
            </div>

            {/* Sites Grid — diberi napas atas supaya tidak menabrak masthead */}
            <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-8">
                {sites.length > 0 ? (
                    <div className="cine-stagger grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(350px,100%),1fr))]">
                        {sites.map((site, i) => (
                            <div key={site.id} style={{ "--i": i } as React.CSSProperties}>
                                <SitePickerCard site={site} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-card border border-accent/30 bg-accent-subtle">
                            <Globe size={24} className="text-accent" aria-hidden="true" />
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
            <div className="border-t border-border p-6 text-center text-[13px] text-text-3">
                © {new Date().getFullYear()} Santos Jaya Abadi. All rights reserved.
            </div>
        </div>
    );
}
