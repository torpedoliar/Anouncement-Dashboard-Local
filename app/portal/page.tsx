import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getPortalLayout } from "@/lib/portal-layout";
import { getAccessiblePortalApps } from "@/lib/portal-access";
import prisma from "@/lib/prisma";
import OnboardingWizard from "@/components/portal/OnboardingWizard";
import GroupedAppGrid, { GridGroup } from "@/components/portal/GroupedAppGrid";
import { FiGrid } from "react-icons/fi";

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
        ? await prisma.portalUserAppCredential.findMany({
              where: { portalUserId: userId, appId: { in: visibleIds } },
              select: { appId: true },
          })
        : [];
    const credSet = new Set(credRows.map((c) => c.appId));

    // Kelompokkan per-grup: app yang tampil disebar sesuai kelompoknya.
    const appById = new Map(visibleApps.map((a) => [a.id, a]));
    const gridGroups: GridGroup[] = groups
        .map((g) => ({
            id: g.id,
            name: g.name,
            apps: g.apps
                .filter((a) => appById.has(a.id))
                .map((a) => ({ ...a, hasCredential: credSet.has(a.id) })),
        }))
        .filter((g) => g.apps.length > 0);

    return (
        <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ marginBottom: "32px" }}>
                <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>PORTAL SSO</p>
                <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0 }}>Aplikasi Saya</h1>
            </div>

            {gridGroups.length === 0 ? (
                <div style={{ padding: "64px", textAlign: "center", backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "12px" }}>
                    <FiGrid size={48} color="#262626" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
                        Belum ada aplikasi yang ditampilkan. Atur lewat Pengaturan.
                    </p>
                </div>
            ) : (
                <GroupedAppGrid groups={gridGroups} />
            )}
        </div>
    );
}