import prisma from "@/lib/prisma";

/**
 * Cek apakah portal user bisa akses app tertentu.
 * PORTAL_ADMIN bypass access check (future: semua app aktif).
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
            appAccess: { where: { appId }, select: { id: true } },
        },
    });
    if (!user || !user.isActive) return false;
    if (user.role === "PORTAL_ADMIN") return true; // future bypass
    return user.appAccess.length > 0;
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
 * PORTAL_ADMIN: semua app aktif. PORTAL_USER: hanya yang di-assign.
 */
export async function getAccessiblePortalApps(portalUserId: string) {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: {
            role: true,
            appAccess: {
                include: {
                    app: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            description: true,
                            logoPath: true,
                            url: true,
                            category: true,
                            displayOrder: true,
                        },
                    },
                },
            },
        },
    });
    if (!user) return [];
    if (user.role === "PORTAL_ADMIN") {
        return prisma.portalApp.findMany({
            where: { isActive: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        });
    }
    return user.appAccess
        .filter((a) => a.app)
        .map((a) => a.app)
        .sort((a, b) => a.displayOrder - b.displayOrder);
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
