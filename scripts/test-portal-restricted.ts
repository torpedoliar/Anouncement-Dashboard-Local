/**
 * Self-check aturan akses restricted (murni predikat, tanpa DB).
 * Run: npx tsx scripts/test-portal-restricted.ts
 */
export {}; // jadikan modul agar helper tidak bentrok dengan skrip test lain

type Role = "PORTAL_ADMIN" | "PORTAL_USER";

interface AccessContext {
    role: Role;
    isPublic: boolean;
    isActive: boolean;
    hasDirect: boolean;
    hasActiveGroup: boolean;
}

/** Predikat yang SEPERSIS dengan logika canAccessPortalApp (Task 2). */
function canAccess(ctx: AccessContext): boolean {
    if (!ctx.isActive) return false;
    if (ctx.role === "PORTAL_ADMIN") return true;
    if (ctx.isPublic) return true;
    return ctx.hasDirect || ctx.hasActiveGroup;
}

function assertEq(actual: boolean, expected: boolean, label: string) {
    const ok = actual === expected;
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${actual} expected=${expected}`);
    if (!ok) process.exitCode = 1;
}

const pub: AccessContext = { role: "PORTAL_USER", isPublic: true, isActive: true, hasDirect: false, hasActiveGroup: false };
assertEq(canAccess(pub), true, "publik + user biasa → akses");

const admin: AccessContext = { role: "PORTAL_ADMIN", isPublic: false, isActive: true, hasDirect: false, hasActiveGroup: false };
assertEq(canAccess(admin), true, "restricted + admin → akses");

const restrNo: AccessContext = { role: "PORTAL_USER", isPublic: false, isActive: true, hasDirect: false, hasActiveGroup: false };
assertEq(canAccess(restrNo), false, "restricted + no access → tolak");

const restrDirect: AccessContext = { role: "PORTAL_USER", isPublic: false, isActive: true, hasDirect: true, hasActiveGroup: false };
assertEq(canAccess(restrDirect), true, "restricted + direct → akses");

const restrGroup: AccessContext = { role: "PORTAL_USER", isPublic: false, isActive: true, hasDirect: false, hasActiveGroup: true };
assertEq(canAccess(restrGroup), true, "restricted + grup aktif → akses");

const inactive: AccessContext = { role: "PORTAL_USER", isPublic: true, isActive: false, hasDirect: true, hasActiveGroup: true };
assertEq(canAccess(inactive), false, "app non-aktif → tolak walau direct/grup");

console.log("\n=== ALL PASS (akses restricted) ===");
