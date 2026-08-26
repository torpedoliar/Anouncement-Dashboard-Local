import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getPortalLayout } from "@/lib/portal-layout";
import { getAccessiblePortalApps } from "@/lib/portal-access";
import { triggerHealthCheckIfStale } from "@/lib/portal-health";
import prisma from "@/lib/prisma";
import OnboardingWizard from "@/components/portal/OnboardingWizard";
import GroupedAppGrid, { GridGroup } from "@/components/portal/GroupedAppGrid";
import SsoErrorBanner from "@/components/portal/SsoErrorBanner";
import Link from "next/link";
import { SquaresFour } from "@/components/ui/client-icons";

export const dynamic = "force-dynamic";

interface PortalPageProps {
    searchParams: Promise<{ error?: string; app?: string }>;
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
    const session = await getServerSession(portalAuthOptions);
    const userId = session!.user!.id as string;

    // Kegagalan SSO dari route REROUTE/POST kembali ke sini via query param.
    // Tampilkan penyebabnya agar pengguna tidak melihat portal "diam saja".
    const { error: ssoError, app: ssoErrorApp } = await searchParams;

    // Segarkan status kesehatan di latar belakang (throttled 5 menit, tidak di-await).
    // Tanpa ini tidak ada yang pernah menjalankan health check dan semua app tetap 'UNKNOWN'.
    triggerHealthCheckIfStale();

    const { needsOnboarding, groups } = await getPortalLayout(userId);

    if (needsOnboarding) {
        return <OnboardingWizard groups={groups} mode="onboarding" />;
    }

    // App yang benar-benar tampil = hasil filter visibility (getAccessiblePortalApps).
    const visibleApps = await getAccessiblePortalApps(userId);

    // Batch query credential untuk hindari N+1
    const visibleIds = visibleApps.map((a) => a.id);
    const credRows = visibleIds.length
        ? await prisma.portalUserAppCredential.groupBy({
              by: ['appId'],
              where: { portalUserId: userId, appId: { in: visibleIds } },
              _count: { _all: true },
          })
        : [];
    const credCountMap = new Map(credRows.map((r) => [r.appId, r._count._all]));

    // Kelompokkan per-grup: app yang tampil disebar sesuai kelompoknya.
    const appById = new Map(visibleApps.map((a) => [a.id, a]));
    const gridGroups: GridGroup[] = groups
        .map((g) => ({
            id: g.id,
            name: g.name,
            apps: g.apps
                .filter((a) => appById.has(a.id))
                .map((a) => {
                    const fullApp = appById.get(a.id);
                    return {
                        ...a,
                        credentialCount: credCountMap.get(a.id) ?? 0,
                        // Jangan paksa "ONLINE": itu menampilkan badge hijau palsu untuk
                        // app yang belum pernah dicek. Biarkan apa adanya; AppCard menangani UNKNOWN.
                        healthStatus: fullApp?.healthStatus ?? null,
                        healthLatencyMs: fullApp?.healthLatencyMs ?? null,
                        healthError: fullApp?.healthError ?? null,
                        healthCheckedAt: fullApp?.healthCheckedAt ?? null,
                    };
                }),
        }))
        .filter((g) => g.apps.length > 0);

    return (
        <div className="mx-auto max-w-[1200px] p-8">
            <div className="mb-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">PORTAL SSO</p>
                <h1 className="font-display text-2xl font-semibold text-text-1">Aplikasi Saya</h1>
            </div>

            {ssoError && <SsoErrorBanner error={ssoError} appSlug={ssoErrorApp} />}

            {gridGroups.length === 0 ? (
                <div className="mx-auto max-w-[400px] rounded-sheet border border-border bg-surface-1 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet bg-surface-2">
                        <SquaresFour size={24} className="text-text-2" aria-hidden="true" />
                    </div>
                    <h2 className="mt-6 font-display text-xl font-semibold text-text-1">Belum ada aplikasi</h2>
                    <p className="mt-2 text-sm text-text-2">
                        Tidak ada aplikasi yang dapat ditampilkan saat ini. Atur visibilitas lewat Pengaturan.
                    </p>
                    <Link
                        href="/portal/settings"
                        className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        Buka Pengaturan
                    </Link>
                </div>
            ) : (
                <GroupedAppGrid groups={gridGroups} />
            )}
        </div>
    );
}