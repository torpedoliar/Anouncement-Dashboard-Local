/**
 * Self-check recall memori deteksi (DB di-injeksi, tanpa DB nyata).
 * Run: npx tsx scripts/test-memory-recall.ts
 */
import { recallLoginMemory, type MemoryDb } from "../lib/portal-memory-recall";

let failed = 0;
function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

async function main() {
    // DB palsu: ada koreksi di origin ini.
    const db: MemoryDb = {
        async latestCorrection() {
            return { usernameField: "nik", passwordField: "katasandi", httpMethod: "POST", ssoMode: "FORM", correctedAt: new Date("2026-09-01") };
        },
        async latestProfile() {
            return null;
        },
        async latestFingerprint() {
            return null;
        },
    };

    const hit = await recallLoginMemory({ loginUrl: "https://hris.example.com/login", html: "<html></html>" }, db);
    check(hit?.source === "CORRECTION", "recall: koreksi menang atas semuanya");
    check(hit?.config.usernameField === "nik", "recall: config dari koreksi");
    check((hit?.label ?? "").startsWith("MEMORY:"), "recall: label berawalan MEMORY");

    // DB palsu: hanya fingerprint generik.
    const fpDb: MemoryDb = {
        async latestCorrection() { return null; },
        async latestProfile() { return null; },
        async latestFingerprint() {
            return { usernameField: "user", passwordField: "pass", httpMethod: "POST", ssoMode: "FORM" };
        },
    };
    const fp = await recallLoginMemory({ loginUrl: "https://app.example.com/login", html: "<html></html>" }, fpDb);
    check(fp?.source === "FINGERPRINT", "recall: fingerprint generik di bawah koreksi");

    const emptyDb: MemoryDb = {
        async latestCorrection() { return null; },
        async latestProfile() { return null; },
        async latestFingerprint() { return null; },
    };
    const unifiHtml = `<html><head><title>UniFi OS</title></head><body><div ui-view></div></body></html>`;
    const reg = await recallLoginMemory({ loginUrl: "https://192.168.1.20/", html: unifiHtml }, emptyDb);
    check(reg?.source === "REGISTRY", "recall: produk dikenal tanpa DB -> REGISTRY");
    check(reg?.product === "unifi-os", "recall: label produk benar");

    const miss = await recallLoginMemory({ loginUrl: "https://asing.example/", html: "<html><body>halo</body></html>" }, emptyDb);
    check(miss === null, "recall: asing tanpa data -> null");
    console.log(failed === 0 ? "Semua lolos." : `${failed} gagal.`);
    if (failed > 0) process.exit(1);
}

void main();
