/**
 * Self-check pemilihan tema per permukaan.
 * Run: npx tsx scripts/test-theme-key.ts
 */
import { themeKeyForPath, resolveTheme, THEME_PREPAINT_SCRIPT } from "../lib/theme-key";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const store = (o: Record<string, string>) => (k: string) => o[k] ?? null;

assertEq(themeKeyForPath("/site/sja-utama"), { key: "theme:site", fallback: "light" }, "situs → theme:site, default light");
assertEq(themeKeyForPath("/site"), { key: "theme:site", fallback: "light" }, "pemilih situs → theme:site");
assertEq(themeKeyForPath("/portal/app/hris"), { key: "theme:portal", fallback: "dark" }, "portal → theme:portal, default dark");
assertEq(themeKeyForPath("/portal-login"), { key: "theme:portal", fallback: "dark" }, "login portal → theme:portal");
assertEq(themeKeyForPath("/admin/announcements"), { key: "adminTheme", fallback: "system" }, "admin → adminTheme, ikut OS");
assertEq(themeKeyForPath("/sitemap.xml"), { key: "adminTheme", fallback: "system" }, "/sitemap bukan /site");

// Review Focus #1: kunci lama `theme` tidak memengaruhi situs/portal.
assertEq(resolveTheme("/site/a", store({ theme: "dark" }), false), "light", "kunci lama theme=dark → situs tetap Paper");
assertEq(resolveTheme("/portal", store({ theme: "light" }), true), "dark", "kunci lama theme=light → portal tetap Night");
assertEq(resolveTheme("/site/a", store({ "theme:site": "dark" }), false), "dark", "pilihan eksplisit situs dihormati");
assertEq(resolveTheme("/admin", store({ adminTheme: "light" }), false), "light", "admin membaca adminTheme");
assertEq(resolveTheme("/admin", store({}), true), "light", "admin tanpa pilihan → OS light");
assertEq(resolveTheme("/admin", store({}), false), "dark", "admin tanpa pilihan → OS dark");
assertEq(resolveTheme("/site/a", store({ "theme:site": "garbage" }), false), "light", "nilai rusak → default");
assertEq(resolveTheme("/site/a", () => { throw new Error("blocked"); }, false), "light", "storage diblokir → default");

// Script pra-paint harus JavaScript valid dan memakai logika yang sama.
let added: string[] = [];
const fakeWindow = {
    location: { pathname: "/site/x" },
    localStorage: { getItem: (k: string) => (k === "theme" ? "dark" : null) },
    matchMedia: () => ({ matches: false }),
    document: { documentElement: { classList: { add: (c: string) => added.push(c) } } },
};
new Function("window", "location", "localStorage", "document", THEME_PREPAINT_SCRIPT)(
    fakeWindow, fakeWindow.location, fakeWindow.localStorage, fakeWindow.document,
);
assertEq(added, ["theme-light"], "script pra-paint: situs + kunci lama dark → theme-light");
added = [];
fakeWindow.location.pathname = "/portal";
new Function("window", "location", "localStorage", "document", THEME_PREPAINT_SCRIPT)(
    fakeWindow, fakeWindow.location, fakeWindow.localStorage, fakeWindow.document,
);
assertEq(added, [], "script pra-paint: portal → gelap (tanpa class)");

console.log(process.exitCode ? "=== ADA FAIL ===" : "=== ALL PASS ===");
