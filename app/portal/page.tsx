import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getPortalLayout } from "@/lib/portal-layout";
import { getAccessiblePortalApps } from "@/lib/portal-access";
import { triggerHealthCheckIfStale } from "@/lib/portal-health";
import prisma from "@/lib/prisma";
import OnboardingWizard from "@/components/portal/OnboardingWizard";
import PortalHome from "@/components/portal/PortalHome";
import SsoErrorBanner from "@/components/portal/SsoErrorBanner";
import Link from "next/link";
import { SquaresFour } from "@/components/ui/client-icons";

export const dynamic = "force-dynamic";

interface PortalPageProps {
    searchParams: Promise<{ error?: string; app?: string; cari?: string }>;
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
    const session = await getServerSession(portalAuthOptions);
    const userId = session!.user!.id as string;

    // Kegagalan SSO dari route REROUTE/POST kembali ke sini via query param.
    // Tampilkan penyebabnya agar pengguna tidak melihat portal "diam saja".
    const { error: ssoError, app: ssoErrorApp, cari } = await searchParams;

    // Segarkan status kesehatan di latar belakang (throttled 5 menit, tidak di-await).
    // Tanpa ini tidak ada yang pernah menjalankan health check dan semua app tetap 'UNKNOWN'.
    triggerHealthCheckIfStale();

    const { needsOnboarding, groups } = await getPortalLayout(userId);

    if (needsOnboarding) {
        return <OnboardingWizard groups={groups} mode="onboarding" />;
    }

    // App yang benar-benar tampil = hasil filter visibility (getAccessiblePortalApps).
    const visibleApps = await getAccessiblePortalApps(userId);

    // Batch query credential + lastUsedAt + pin untuk hindari N+1.
    const visibleIds = visibleApps.map((a) => a.id);
    const [credRows, pinRows] = visibleIds.length
        ? await Promise.all([
              prisma.portalUserAppCredential.groupBy({
                  by: ["appId"],
                  where: { portalUserId: userId, appId: { in: visibleIds } },
                  _count: { _all: true },
                  _max: { lastUsedAt: true },
              }),
              prisma.portalUserAppPin.findMany({
                  where: { portalUserId: userId, appId: { in: visibleIds } },
                  select: { appId: true },
                  orderBy: { createdAt: "asc" },
              }),
          ])
        : [[], []];
    const credByApp = new Map(credRows.map((r) => [r.appId, r]));

    const appById = new Map(visibleApps.map((a) => [a.id, a]));
    const homeGroups = groups
        .map((g) => ({
            id: g.id,
            name: g.name,
            apps: g.apps
                .filter((a) => appById.has(a.id))
                .map((a) => {
                    const full = appById.get(a.id)!;
                    const cred = credByApp.get(a.id);
                    return {
                        id: a.id,
                        slug: a.slug,
                        name: a.name,
                        description: a.description,
                        logoPath: a.logoPath,
                        category: a.category,
                        groupName: g.name,
                        credentialCount: cred?._count._all ?? 0,
                        // Jangan paksa "ONLINE": app yang belum dicek tetap UNKNOWN.
                        healthStatus: full.healthStatus ?? null,
                        healthLatencyMs: full.healthLatencyMs ?? null,
                        healthError: full.healthError ?? null,
                        lastUsedAt: cred?._max.lastUsedAt?.toISOString() ?? null,
                    };
                }),
        }))
        .filter((g) => g.apps.length > 0);

    return (
        <>
            {ssoError && (
                <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-8">
                    <SsoErrorBanner error={ssoError} appSlug={ssoErrorApp} />
                </div>
            )}
            {homeGroups.length === 0 ? (
                <div className="mx-auto max-w-[1200px] p-8">
                    {/* empty state lama dipertahankan apa adanya */}
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
                </div>
            ) : (
                <PortalHome
                    userName={session!.user!.name ?? ""}
                    groups={homeGroups}
                    pinnedIds={pinRows.map((p) => p.appId)}
                    openPalette={cari === "1"}
                />
            )}
        </>
    );
}
