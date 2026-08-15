import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getPortalLayout } from "@/lib/portal-layout";
import { getVisibilityProfile } from "@/lib/portal-access";
import VisibilitySettings from "@/components/portal/VisibilitySettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const session = await getServerSession(portalAuthOptions);
    const userId = session!.user!.id as string;
    const { groups } = await getPortalLayout(userId);
    const { groupOverrides, appOverrides } = await getVisibilityProfile(userId);

    const initialHiddenGroups = [...groupOverrides.entries()]
        .filter(([, v]) => v === false).map(([gid]) => gid);
    const initialHiddenApps = [...appOverrides.entries()]
        .filter(([, v]) => v === false).map(([aid]) => aid);

    return (
        <div className="mx-auto max-w-[900px] p-8">
            <div className="mb-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">PORTAL SSO</p>
                <h1 className="font-display text-2xl font-semibold text-text-1">Pengaturan</h1>
            </div>
            <VisibilitySettings groups={groups} initialHiddenGroups={initialHiddenGroups} initialHiddenApps={initialHiddenApps} />
        </div>
    );
}