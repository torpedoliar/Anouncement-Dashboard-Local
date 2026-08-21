/**
 * Self-check untuk sharedCookieDomain — pemetaan host portal vs host aplikasi.
 * Run: npx tsx scripts/test-cookie-domain.ts
 */
import { sharedCookieDomain } from "../lib/portal-sso-relay";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

delete process.env.PORTAL_SSO_COOKIE_DOMAIN;

// Host identik → cookie bisa dipasang langsung
assertEq(sharedCookieDomain("k2prodapp", "k2prodapp"), "k2prodapp", "host identik");

// Port di host header TIDAK boleh membatalkan kecocokan (Docker memetakan 3100→3000)
assertEq(sharedCookieDomain("localhost:3100", "localhost"), "localhost", "port diabaikan pada host identik");

// Berbagi domain induk → cookie di-scope ke domain induk
assertEq(sharedCookieDomain("portal.sja.co.id", "app.sja.co.id"), ".sja.co.id", "domain induk dibagi");
assertEq(sharedCookieDomain("portal.sja.co.id:443", "app.sja.co.id"), ".sja.co.id", "port diabaikan pada domain induk");

// Beda domain → null (portal TIDAK boleh berpura-pura bisa memasang cookie)
assertEq(sharedCookieDomain("portal.a.com", "k2prodapp"), null, "beda domain → null");
assertEq(sharedCookieDomain("portal.a.com", "app.b.com"), null, "TLD berbeda → null");

// Hanya berbagi TLD ("id") tidak cukup — cookie lintas-organisasi
assertEq(sharedCookieDomain("portal.aaa.id", "app.bbb.id"), null, "berbagi TLD saja → null");

// Override eksplisit selalu menang
process.env.PORTAL_SSO_COOKIE_DOMAIN = ".sja.co.id";
assertEq(sharedCookieDomain("portal.a.com", "k2prodapp"), ".sja.co.id", "override env menang");
delete process.env.PORTAL_SSO_COOKIE_DOMAIN;

console.log("=== ALL PASS ===");
