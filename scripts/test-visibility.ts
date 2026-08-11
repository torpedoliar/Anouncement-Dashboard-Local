/**
 * Self-check untuk getVisibilityProfile + saveVisibility + saveVisibilityPartial.
 * Run: npx tsx scripts/test-visibility.ts
 * Membutuhkan DATABASE_URL (dev db: docker compose up -d db + npm run dev).
 * Membuat data test idempotent lalu membersihkannya di finally.
 */

import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
    console.log("=== Test: Portal User App Visibility ===");

    // 1. Buat user test (nik unik per run)
    const nik = `test-vis-${Date.now()}`;
    const user = await prisma.portalUser.create({
        data: { nik, passwordHash: "x", name: "Test Visibility" },
    });
    const uid = user.id;

    // 2. Buat grup + 2 app (upsert by unique name/slug, idempotent)
    const group = await prisma.portalGroup.upsert({
        where: { name: "Test-Grup-Vis" },
        update: {},
        create: { name: "Test-Grup-Vis", description: "temp" },
    });
    const appA = await prisma.portalApp.upsert({
        where: { slug: "test-vis-a" },
        update: {},
        create: { slug: "test-vis-a", name: "Test Vis A", url: "https://a.test", isActive: true },
    });
    const appB = await prisma.portalApp.upsert({
        where: { slug: "test-vis-b" },
        update: {},
        create: { slug: "test-vis-b", name: "Test Vis B", url: "https://b.test", isActive: true },
    });
    await prisma.portalGroupApp.upsert({
        where: { groupId_appId: { groupId: group.id, appId: appA.id } },
        update: {},
        create: { groupId: group.id, appId: appA.id },
    });
    await prisma.portalGroupApp.upsert({
        where: { groupId_appId: { groupId: group.id, appId: appB.id } },
        update: {},
        create: { groupId: group.id, appId: appB.id },
    });

    const { getVisibilityProfile, saveVisibility, saveVisibilityPartial } = await import("../lib/portal-access");

    try {
        // 3. Fresh user: needsOnboarding = true
        let profile = await getVisibilityProfile(uid);
        assertEq(profile.needsOnboarding, true, "fresh user needsOnboarding");

        // 4. Lewati (skip) → onboardingDone=true, 0 rows, wizard tidak muncul lagi
        await saveVisibility(uid, { groupIdsOff: [], appIdsOff: [], appIdsOn: [], skip: true });
        profile = await getVisibilityProfile(uid);
        assertEq(profile.needsOnboarding, false, "skip sets onboardingDone");
        assertEq(profile.groupOverrides.size, 0, "skip → no group rows");

        // 5. Sembunyikan grup (akses eksplisit via partial)
        await saveVisibility(uid, { groupIdsOff: [group.id], appIdsOff: [], appIdsOn: [], skip: false });
        profile = await getVisibilityProfile(uid);
        assertEq(profile.groupOverrides.get(group.id), false, "group hidden");
        assertEq(profile.appOverrides.size, 0, "no app rows");

        // 6. Simpan: sembunyikan grup tapi override appB on → appB override visible=true
        await saveVisibility(uid, { groupIdsOff: [group.id], appIdsOff: [], appIdsOn: [appB.id], skip: false });
        profile = await getVisibilityProfile(uid);
        assertEq(profile.appOverrides.get(appB.id), true, "appB override on");

        // 7. Partial: sembunyikan app individu
        await saveVisibilityPartial(uid, { appId: appA.id, visible: false });
        profile = await getVisibilityProfile(uid);
        assertEq(profile.appOverrides.get(appA.id), false, "partial hide appA");

        // 8. Partial: tampilkan lagi (hapus row → default show)
        await saveVisibilityPartial(uid, { appId: appA.id, visible: true });
        profile = await getVisibilityProfile(uid);
        assertEq(profile.appOverrides.has(appA.id), false, "partial show removes row");

        // 9. Grid: user menyembunyikan grup (appB override on) → grid hanya appB
        const { getAccessiblePortalApps } = await import("../lib/portal-access");
        await saveVisibility(uid, { groupIdsOff: [group.id], appIdsOff: [], appIdsOn: [appB.id], skip: false });
        let grid = await getAccessiblePortalApps(uid);
        const gridIds = grid.map((a) => a.slug);
        assertEq(gridIds.includes("test-vis-a"), false, "appA hidden (via group)");
        assertEq(gridIds.includes("test-vis-b"), true, "appB shown (app override on)");

        // 10. App baru di grup hidden → tetap tersembunyi (konsisten grup override)
        const appC = await prisma.portalApp.create({
            data: { slug: "test-vis-c", name: "Test Vis C", url: "https://c.test", isActive: true },
        });
        await prisma.portalGroupApp.create({ data: { groupId: group.id, appId: appC.id } });
        grid = await getAccessiblePortalApps(uid);
        assertEq(grid.map((a) => a.slug).includes("test-vis-c"), false, "appC in hidden group stays hidden");

        // 11. App baru di grup NON-hidden → tampil default
        const group2 = await prisma.portalGroup.create({ data: { name: "Test-Grup-Vis2", description: "temp" } });
        const appD = await prisma.portalApp.create({
            data: { slug: "test-vis-d", name: "Test Vis D", url: "https://d.test", isActive: true },
        });
        await prisma.portalGroupApp.create({ data: { groupId: group2.id, appId: appD.id } });
        grid = await getAccessiblePortalApps(uid);
        assertEq(grid.map((a) => a.slug).includes("test-vis-d"), true, "appD in visible group shows");

        // 12. Grid: semua on (reset) → semua app test tampil
        await saveVisibility(uid, { groupIdsOff: [], appIdsOff: [], appIdsOn: [], skip: false });
        grid = await getAccessiblePortalApps(uid);
        assertEq(grid.map((a) => a.slug).includes("test-vis-a"), true, "all on → appA shows");
        assertEq(grid.map((a) => a.slug).includes("test-vis-d"), true, "all on → appD shows");

        console.log("\n=== ALL PASS ===");
    } finally {
        // Cleanup — jangan menyisakan data test
        await prisma.portalUserAppVisibility.deleteMany({ where: { portalUserId: uid } }).catch(() => {});
        await prisma.portalUser.delete({ where: { id: uid } }).catch(() => {});
        // Hapus group2 & link-nya (appC tidak dilink ke group2)
        await prisma.portalGroup.deleteMany({ where: { name: { startsWith: "Test-Grup-Vis" } } }).catch(() => {});
        await prisma.portalApp.deleteMany({ where: { slug: { startsWith: "test-vis-" } } }).catch(() => {});
    }
}

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = actual === expected;
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });