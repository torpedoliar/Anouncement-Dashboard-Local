import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getPortalLayout } from "@/lib/portal-layout";
import { getVisibilityProfile } from "@/lib/portal-access";
import prisma from "@/lib/prisma";
import OnboardingWizard from "@/components/portal/OnboardingWizard";
import GroupedAppGrid, { GridGroup } from "@/components/portal/GroupedAppGrid";
import AppCard from "@/components/portal/AppCard";
import { FiGrid } from "react-icons/fi";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
    const session = await getServerSession(portalAuthOptions);
    const userId = session!.user!.id as string;

    const { needsOnboarding, groups } = await getPortalLayout(userId);

    if (needsOnboarding) {
        return <OnboardingWizard groups={groups} mode="onboarding" />;
    }

    // Semua app aktif (batch query credential untuk hindari N+1)
    const allAppIds = groups.flatMap((g) => g.apps.map((a) => a.id));
    const credRows = allAppIds.length
        ? await prisma.portalUserAppCredential.findMany({
              where: { portalUserId: userId, appId: { in: allAppIds } },
              select: { appId: true },
          })
        : [];
    const credSet = new Set(credRows.map((c) => c.appId));

    // Grid hanya menampilkan app yang tidak user sembunyikan
    const { groupOverrides, appOverrides } = await getVisibilityProfile(userId);
    const isHidden = (app: { id: string }, groupId: string): boolean => {
        if (appOverrides.get(app.id) === false) return true;
        if (groupOverrides.get(groupId) === false && appOverrides.get(app.id) !== true) return true;
        return false;
    };
    const gridGroups: GridGroup[] = groups
        .map((g) => ({
            id: g.id,
            name: g.name,
            apps: g.apps
                .filter((a) => !isHidden(a, g.id))
                .map((a) => ({ ...a, hasCredential: credSet.has(a.id) })),
        }))
        .filter((g) => g.apps.length > 0);

    // App aktif tanpa grup → seksi "Lainnya"
    const groupedIds = new Set(groups.flatMap((g) => g.apps.map((a) => a.id)));
    const ungrouped = await prisma.portalApp.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
            id: true, name: true, slug: true, description: true, logoPath: true, category: true,
        },
    });
    const extraApps = ungrouped
        .filter((a) => !groupedIds.has(a.id) && !isHidden(a, ""))
        .map((a) => ({ ...a, hasCredential: credSet.has(a.id) }));

    return (
        <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ marginBottom: "32px" }}>
                <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>PORTAL SSO</p>
                <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0 }}>Aplikasi Saya</h1>
            </div>

            {gridGroups.length === 0 && extraApps.length === 0 ? (
                <div style={{ padding: "64px", textAlign: "center", backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "12px" }}>
                    <FiGrid size={48} color="#262626" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
                        Belum ada aplikasi yang ditampilkan. Atur lewat Pengaturan.
                    </p>
                </div>
            ) : (
                <>
                    {gridGroups.length > 0 && <GroupedAppGrid groups={gridGroups} />}
                    {extraApps.length > 0 && (
                        <section style={{ marginTop: "32px" }}>
                            <h2 style={{ color: "var(--text-secondary)", fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>Lainnya</h2>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                                {extraApps.map((app) => (
                                    <AppCard key={app.id} {...app} />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}