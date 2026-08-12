import prisma from "@/lib/prisma";
import { getVisibilityProfile, getAccessiblePortalApps } from "@/lib/portal-access";

export interface PortalLayoutGroup {
    id: string;
    name: string;
    apps: Array<{
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        logoPath?: string | null;
        category?: string | null;
        displayOrder: number;
        hasCredential: boolean;
    }>;
}

/**
 * Bangun struktur "grup → apps" untuk wizard & pengaturan.
 * - needsOnboarding = !onboardingDone (flag eksplisit)
 * - groups = grup aktif dengan app aktif yang user BERHAK akses (publik + restricted berhak);
 *   app yang hidden visibilitas tetap disertakan agar /portal/settings bisa reveal kembali.
 * - hasCredential placeholder false; diisi konsumen via query credential
 */
export async function getPortalLayout(portalUserId: string) {
    const { needsOnboarding } = await getVisibilityProfile(portalUserId);

    // App yang berhak diakses user (publik + restricted yang punya akses) — sumber tunggal.
    const accessible = await getAccessiblePortalApps(portalUserId);
    const accessibleIds = new Set(accessible.map((a) => a.id));

    const groupsRaw = await prisma.portalGroup.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            apps: {
                where: { app: { isActive: true } },
                select: {
                    app: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            description: true,
                            logoPath: true,
                            category: true,
                            displayOrder: true,
                        },
                    },
                },
                orderBy: { app: { displayOrder: "asc" } },
            },
        },
        orderBy: { name: "asc" },
    });

    const groups: PortalLayoutGroup[] = groupsRaw
        .map((g) => ({
            id: g.id,
            name: g.name,
            apps: g.apps
                .map(({ app }) => ({ ...app, hasCredential: false }))
                .filter((a) => accessibleIds.has(a.id)),
        }))
        .filter((g) => g.apps.length > 0);

    return { needsOnboarding, groups };
}