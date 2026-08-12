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
 * PORTAL_USER: publik → akses (selama isActive);
 * restricted (isPublic=false) → akses hanya jika ada direct access ATAU membership di grup aktif yang memuat app.
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

    const app = await prisma.portalApp.findUnique({
        where: { id: appId },
        select: { isActive: true, isPublic: true },
    });
    if (!app || !app.isActive) return false;
    if (app.isPublic) return true;

    // restricted: direct access
    const direct = await prisma.portalUserAppAccess.count({
        where: { portalUserId, appId },
    });
    if (direct > 0) return true;

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
 * Daftar app yang tampil di grid /portal untuk user.
 * Base = app yang BERHAK diakses:
 * - PORTAL_ADMIN → semua app aktif.
 * - PORTAL_USER  → app publik (isPublic=true) + app restricted (isPublic=false) yang punya
 *                  direct access ATAU membership grup aktif yang memuatnya.
 * Setelah base, filter visibility user (PortalUserAppVisibility) diterapkan.
 * Sort: displayOrder asc, lalu name asc.
 */
export async function getAccessiblePortalApps(portalUserId: string) {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { role: true },
    });
    const isAdmin = user?.role === "PORTAL_ADMIN";

    const allApps = await prisma.portalApp.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { ...APP_SELECT, isPublic: true },
    });

    // App restricted yang user berhak akses (via direct ATAU grup aktif).
    let accessibleRestrictedIds = new Set<string>();
    if (!isAdmin) {
        const restrictedIds = allApps.filter((a) => a.isPublic === false).map((a) => a.id);
        if (restrictedIds.length > 0) {
            const directRows = await prisma.portalUserAppAccess.findMany({
                where: { portalUserId, appId: { in: restrictedIds } },
                select: { appId: true },
            });
            const groupRows = await prisma.portalUserGroup.findMany({
                where: {
                    portalUserId,
                    group: { isActive: true, apps: { some: { appId: { in: restrictedIds } } } },
                },
                select: { group: { select: { apps: { select: { appId: true } } } } },
            });
            accessibleRestrictedIds = new Set([
                ...directRows.map((r) => r.appId),
                ...groupRows.flatMap((g) => g.group.apps.map((a) => a.appId)),
            ]);
        }
    }

    const baseApps = allApps.filter(
        (app) => app.isPublic || isAdmin || accessibleRestrictedIds.has(app.id)
    );

    const { groupOverrides, appOverrides } = await getVisibilityProfile(portalUserId);

    // App yang di-hide via override app=false
    const hiddenAppIds = new Set<string>();
    for (const [appId, v] of appOverrides) if (v === false) hiddenAppIds.add(appId);

    // Grup-hidden
    const hiddenGroupIds = new Set<string>();
    for (const [gid, v] of groupOverrides) if (v === false) hiddenGroupIds.add(gid);

    // App yang termasuk grup hidden (untuk exclude; kecuali override app=true menang)
    const appsInHiddenGroups = new Set<string>();
    if (hiddenGroupIds.size > 0) {
        const groupLinks = await prisma.portalGroupApp.findMany({
            where: { groupId: { in: [...hiddenGroupIds] } },
            select: { appId: true },
        });
        for (const l of groupLinks) appsInHiddenGroups.add(l.appId);
    }

    return baseApps.filter((app) => {
        if (hiddenAppIds.has(app.id)) return false;
        if (appsInHiddenGroups.has(app.id) && appOverrides.get(app.id) !== true) return false;
        return true;
    });
}

/**
 * Kembalikan Set appId yang user mampu akses DIANTARA appIds yang diberikan.
 * PORTAL_ADMIN → semua appIds. Dipakai guard visibility (Task 3).
 */
export async function filterAccessibleAppIds(
    portalUserId: string,
    appIds: string[]
): Promise<Set<string>> {
    if (appIds.length === 0) return new Set();
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { role: true },
    });
    if (user?.role === "PORTAL_ADMIN") return new Set(appIds);

    const apps = await prisma.portalApp.findMany({
        where: { id: { in: appIds } },
        select: { id: true, isPublic: true },
    });

    const restrictedIds = apps.filter((a) => !a.isPublic).map((a) => a.id);
    let allowedRestricted = new Set<string>();
    if (restrictedIds.length > 0) {
        const direct = (await prisma.portalUserAppAccess.findMany({
            where: { portalUserId, appId: { in: restrictedIds } },
            select: { appId: true },
        })).map((r) => r.appId);
        const group = (await prisma.portalUserGroup.findMany({
            where: {
                portalUserId,
                group: { isActive: true, apps: { some: { appId: { in: restrictedIds } } } },
            },
            select: { group: { select: { apps: { select: { appId: true } } } } },
        })).flatMap((g) => g.group.apps.map((a) => a.appId));
        allowedRestricted = new Set([...direct, ...group]);
    }

    return new Set(apps.filter((a) => a.isPublic || allowedRestricted.has(a.id)).map((a) => a.id));
}

/**
 * Cek apakah user sudah simpan kredensial untuk app (health indicator).
 */
export async function hasCredential(
    portalUserId: string,
    appId: string
): Promise<boolean> {
    const cred = await prisma.portalUserAppCredential.findFirst({
        where: { portalUserId, appId },
        select: { id: true },
    });
    return !!cred;
}

// ================= Per-User App Visibility =================

export interface VisibilityProfile {
    needsOnboarding: boolean;
    groupOverrides: Map<string, boolean>;
    appOverrides: Map<string, boolean>;
}

/**
 * Profil visibility per user.
 * needsOnboarding = !PortalUser.onboardingDone (flag eksplisit, BUKAN jumlah row —
 * tombol "Lewati" menghasilkan nol row tapi tetap harus dianggap sudah onboarding).
 */
export async function getVisibilityProfile(portalUserId: string): Promise<VisibilityProfile> {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { onboardingDone: true },
    });
    if (!user) {
        return { needsOnboarding: true, groupOverrides: new Map(), appOverrides: new Map() };
    }

    const rows = await prisma.portalUserAppVisibility.findMany({
        where: { portalUserId },
        select: { groupId: true, appId: true, visible: true },
    });

    const groupOverrides = new Map<string, boolean>();
    const appOverrides = new Map<string, boolean>();
    for (const r of rows) {
        if (r.groupId) groupOverrides.set(r.groupId, r.visible);
        if (r.appId) appOverrides.set(r.appId, r.visible);
    }

    return { needsOnboarding: !user.onboardingDone, groupOverrides, appOverrides };
}

export interface SaveVisibilityInput {
    groupIdsOff: string[];
    appIdsOff: string[];
    appIdsOn: string[];
    skip?: boolean;
}

/**
 * Replace seluruh preferensi visibility user + tandai onboardingDone.
 * Transactional: hapus semua rows → buat ulang (atau skip=true → tidak buat row apa pun).
 *
 * Semantik input:
 * - groupIdsOff  → row (user, groupId, visible=false) — seluruh app grup disembunyikan
 * - appIdsOff    → row (user, appId, visible=false)   — app disembunyikan
 * - appIdsOn     → row (user, appId, visible=true)    — override, app tampil meski grup hidden
 * Semua yang tidak tercantum = visible (default-on).
 */
export async function saveVisibility(portalUserId: string, input: SaveVisibilityInput): Promise<void> {
    const { groupIdsOff, appIdsOff, appIdsOn, skip } = input;

    await prisma.$transaction(async (tx) => {
        await tx.portalUserAppVisibility.deleteMany({ where: { portalUserId } });

        if (!skip) {
            const groupRows = groupIdsOff.map((groupId) => ({
                portalUserId,
                groupId,
                appId: null,
                visible: false,
            }));

            const appRows = [
                ...appIdsOn.map((appId) => ({ portalUserId, groupId: null, appId, visible: true })),
                ...appIdsOff.map((appId) => ({ portalUserId, groupId: null, appId, visible: false })),
            ];

            if (groupRows.length > 0) {
                await tx.portalUserAppVisibility.createMany({ data: groupRows });
            }
            if (appRows.length > 0) {
                await tx.portalUserAppVisibility.createMany({ data: appRows });
            }
        }

        await tx.portalUser.update({
            where: { id: portalUserId },
            data: { onboardingDone: true },
        });
    });
}

/**
 * Ubah visibility satu entitas (groupId ATAU appId).
 * visible=true  → hapus row (default show kembali)
 * visible=false → upsert row visible=false (hidden)
 */
export async function saveVisibilityPartial(
    portalUserId: string,
    input: { groupId?: string; appId?: string; visible: boolean }
): Promise<void> {
    const { groupId, appId, visible } = input;
    if ((groupId ? 1 : 0) + (appId ? 1 : 0) !== 1) {
        throw new Error("saveVisibilityPartial: exactly one of groupId/appId required");
    }

    if (visible) {
        // Default show → hapus override row
        await prisma.portalUserAppVisibility.deleteMany({
            where: {
                portalUserId,
                ...(groupId ? { groupId } : { appId }),
            },
        });
    } else {
        await prisma.portalUserAppVisibility.upsert({
            where: groupId
                ? { portalUserId_groupId: { portalUserId, groupId } }
                : { portalUserId_appId: { portalUserId, appId: appId! } },
            update: { visible: false },
            create: {
                portalUserId,
                groupId: groupId ?? null,
                appId: appId ?? null,
                visible: false,
            },
        });
    }
}
