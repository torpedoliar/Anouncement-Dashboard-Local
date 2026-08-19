import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getPortalLayout } from "@/lib/portal-layout";
import { getAccessiblePortalApps } from "@/lib/portal-access";
import prisma from "@/lib/prisma";
import OnboardingWizard from "@/components/portal/OnboardingWizard";
import GroupedAppGrid, { GridGroup } from "@/components/portal/GroupedAppGrid";
import Link from "next/link";
import { SquaresFour } from "@/components/ui/client-icons";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
    const session = await getServerSession(portalAuthOptions);
    const userId = session!.user!.id as string;

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
                        healthStatus: fullApp?.healthStatus ?? "ONLINE",
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