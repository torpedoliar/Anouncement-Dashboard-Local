/**
 * Self-check untuk lib/verify-rate-limit.ts (tanpa DB).
 * Run: npx tsx scripts/test-verify-rate-limit.ts
 */
import { checkVerifyLimit } from "../lib/verify-rate-limit";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const now = 1_000_000;
const store = new Map<string, { count: number; resetAt: number }>();

assertEq(checkVerifyLimit(store, "a", 5, 600_000, now), { allowed: true, remaining: 4 }, "percobaan pertama diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 1), { allowed: true, remaining: 3 }, "percobaan kedua diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 2).allowed, true, "masih diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 3).allowed, true, "diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 4), { allowed: true, remaining: 0 }, "percobaan ke-5 (batas) diizinkan, sisa 0");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 5), { allowed: false, remaining: 0 }, "percobaan ke-6 ditolak");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 600_001), { allowed: true, remaining: 4 }, "window habis → reset");
assertEq(checkVerifyLimit(store, "b", 5, 600_000, now).allowed, true, "key berbeda tidak terpengaruh");

console.log("=== ALL PASS ===");