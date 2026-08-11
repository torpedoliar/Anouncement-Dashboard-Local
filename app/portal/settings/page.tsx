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
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <VisibilitySettings groups={groups} initialHiddenGroups={initialHiddenGroups} initialHiddenApps={initialHiddenApps} />
        </div>
    );
}