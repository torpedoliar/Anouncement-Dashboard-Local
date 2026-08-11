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

    // Direct access check — app must be active (consistent with getAccessiblePortalApps).
    // Inactive apps are inaccessible regardless of access method.
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
