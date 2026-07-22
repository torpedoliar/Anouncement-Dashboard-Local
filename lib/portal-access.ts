import prisma from "@/lib/prisma";

const APP_SELECT = {
    id: true,
    name: true,
    slug: true,
    description: true,
    logoPath: true,
    url: true,
    category: true,
    displayOrder: true,
} as const;

/**
 * Cek apakah portal user bisa akses app tertentu.
 * PORTAL_ADMIN bypass access check (semua app aktif).
 * PORTAL_USER: true jika ada direct access ATAU membership di grup aktif yang memuat app.
 */
export async function canAccessPortalApp(
    portalUserId: string,
    appId: string
): Promise<boolean> {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: {
            isActive: true,
            role: true,
        },
    });
    if (!user || !user.isActive) return false;
    if (user.role === "PORTAL_ADMIN") return true;

    // Single query: direct access OR group membership with active group containing the app
    const count = await prisma.portalUserAppAccess.count({
        where: {
            portalUserId,
            appId,
            app: { isActive: true },
        },
    });
    if (count > 0) return true;

    const groupCount = await prisma.portalUserGroup.count({
        where: {
            portalUserId,
            group: {
                isActive: true,
                apps: { some: { appId } },
            },
        },
    });
    return groupCount > 0;
}

/**
 * Cek akses by slug (untuk route /portal/app/[appSlug]).
 */
export async function canAccessPortalAppBySlug(
    portalUserId: string,
    appSlug: string
): Promise<boolean> {
    const app = await prisma.portalApp.findUnique({
        where: { slug: appSlug },
        select: { id: true, isActive: true },
    });
    if (!app || !app.isActive) return false;
    return canAccessPortalApp(portalUserId, app.id);
}

/**
 * Daftar app yang bisa diakses user (untuk grid /portal).
 * PORTAL_ADMIN: semua app aktif.
 * PORTAL_USER: union + dedup (by app.id) dari:
 *   1. App via PortalUserGroup → PortalGroup(isActive) → PortalGroupApp → PortalApp(isActive)
 *   2. App via PortalUserAppAccess → PortalApp(isActive) (direct override)
 * Sort: displayOrder asc, lalu name asc.
 */
export async function getAccessiblePortalApps(portalUserId: string) {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { role: true },
    });
    if (!user) return [];

    // PORTAL_ADMIN: semua app aktif
    if (user.role === "PORTAL_ADMIN") {
        return prisma.portalApp.findMany({
            where: { isActive: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        });
    }

    // Query 1: apps via groups
    const groupApps = await prisma.portalGroupApp.findMany({
        where: {
            group: {
                isActive: true,
                members: { some: { portalUserId } },
            },
            app: { isActive: true },
        },
        select: { app: { select: APP_SELECT } },
    });

    // Query 2: apps via direct access
    const directApps = await prisma.portalUserAppAccess.findMany({
        where: {
            portalUserId,
            app: { isActive: true },
        },
        select: { app: { select: APP_SELECT } },
    });

    // Union + dedup by app.id
    const seen = new Set<string>();
    const result: typeof groupApps[number]["app"][] = [];
    for (const row of [...groupApps, ...directApps]) {
        if (!seen.has(row.app.id)) {
            seen.add(row.app.id);
            result.push(row.app);
        }
    }

    // Sort: displayOrder asc, name asc
    return result.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

/**
 * Cek apakah user sudah simpan kredensial untuk app (health indicator).
 */
export async function hasCredential(
    portalUserId: string,
    appId: string
): Promise<boolean> {
    const cred = await prisma.portalUserAppCredential.findUnique({
        where: { portalUserId_appId: { portalUserId, appId } },
        select: { id: true },
    });
    return !!cred;
}
