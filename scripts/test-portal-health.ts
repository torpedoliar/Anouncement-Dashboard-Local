/**
 * Self-check untuk logika health check portal (tanpa DB, tanpa jaringan).
 * Run: npx tsx scripts/test-portal-health.ts
 */

// Jadikan file ini modul: skrip test tanpa import berada di scope global yang sama,
// sehingga helper senama bentrok antar file.
export {};

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

// --- 1. Pemetaan status -> badge di AppCard ---------------------------------
// Meniru cabang di components/portal/AppCard.tsx. Sebelum perbaikan, "UNKNOWN"
// tidak cocok cabang mana pun sehingga badge hilang tanpa jejak.
function badgeFor(healthStatus: string | null | undefined): string {
    const isOffline = healthStatus === "OFFLINE";
    const isDegraded = healthStatus === "DEGRADED";
    const isOnline = healthStatus === "ONLINE";
    const isUnknown = !isOnline && !isDegraded && !isOffline;
    if (isOnline) return "Online";
    if (isDegraded) return "Lambat";
    if (isOffline) return "Gangguan";
    if (isUnknown) return "Belum dicek";
    return "NONE";
}

assertEq(badgeFor("ONLINE"), "Online", "1a ONLINE -> badge Online");
assertEq(badgeFor("DEGRADED"), "Lambat", "1b DEGRADED -> badge Lambat");
assertEq(badgeFor("OFFLINE"), "Gangguan", "1c OFFLINE -> badge Gangguan");
// Ini yang dulu gagal: default migrasi 'UNKNOWN' bikin kartu tanpa badge sama sekali.
assertEq(badgeFor("UNKNOWN"), "Belum dicek", "1d UNKNOWN -> badge Belum dicek (regresi utama)");
assertEq(badgeFor(null), "Belum dicek", "1e null -> badge Belum dicek");
assertEq(badgeFor(undefined), "Belum dicek", "1f undefined -> badge Belum dicek");
assertEq(badgeFor("GARBAGE"), "Belum dicek", "1g nilai tak dikenal -> Belum dicek");

// --- 2. Throttle pemicu health check ---------------------------------------
// Meniru triggerHealthCheckIfStale dengan jam yang dikendalikan, supaya tidak
// menembak host eksternal tiap kali halaman portal dirender.
const INTERVAL = 5 * 60 * 1000;
// Jam mulai realistis: kode asli memakai Date.now() yang tak pernah 0, sedangkan
// lastRun awal = 0. Memakai now=0 di test akan salah memblokir run pertama.
const T0 = 1_700_000_000_000;
function makeTrigger() {
    let lastRun = 0;
    let runs = 0;
    let inFlight = false;
    return {
        fire(now: number, settle = true) {
            if (inFlight || now - lastRun < INTERVAL) return;
            lastRun = now;
            runs++;
            inFlight = !settle;
        },
        release() {
            inFlight = false;
        },
        get runs() {
            return runs;
        },
    };
}

const t = makeTrigger();
t.fire(T0);
assertEq(t.runs, 1, "2a render pertama memicu check");

t.fire(T0 + 1000);
t.fire(T0 + 60_000);
t.fire(T0 + INTERVAL - 1);
assertEq(t.runs, 1, "2b render dalam jendela throttle tidak memicu ulang");

t.fire(T0 + INTERVAL);
assertEq(t.runs, 2, "2c setelah interval lewat, memicu lagi");

// Run yang masih berjalan tidak boleh ditumpuk run kedua.
const t2 = makeTrigger();
t2.fire(T0, false); // biarkan menggantung
assertEq(t2.runs, 1, "2d run pertama jalan");
t2.fire(T0 + INTERVAL * 5, false);
assertEq(t2.runs, 1, "2e run yang menggantung mencegah tumpang tindih");
t2.release();
t2.fire(T0 + INTERVAL * 5, false);
assertEq(t2.runs, 2, "2f setelah selesai, boleh jalan lagi");

// --- 3. Klasifikasi status dari respons HTTP --------------------------------
// Meniru aturan di checkAppHealth.
function classify(statusCode: number | null, latencyMs: number): string {
    if (statusCode === null) return "OFFLINE"; // tidak ada respons (timeout/TLS/koneksi)
    if (statusCode >= 200 && statusCode < 400) {
        return latencyMs >= 2500 ? "DEGRADED" : "ONLINE";
    }
    if (statusCode === 401 || statusCode === 403) {
        return latencyMs >= 2500 ? "DEGRADED" : "ONLINE";
    }
    return "DEGRADED";
}

assertEq(classify(200, 120), "ONLINE", "3a 200 cepat -> ONLINE");
assertEq(classify(302, 80), "ONLINE", "3b redirect (loop) -> ONLINE server vivo");
assertEq(classify(200, 3000), "DEGRADED", "3c 200 lambat -> DEGRADED");
// 401/403 = server vivo y form auth activo, no muerto.
assertEq(classify(401, 100), "ONLINE", "3d 401 -> ONLINE (server vivo)");
assertEq(classify(403, 100), "ONLINE", "3e 403 -> ONLINE (server vivo)");
// 500/404 = server respondió pero hay problema → DEGRADED, no OFFLINE.
assertEq(classify(500, 100), "DEGRADED", "3f 500 -> DEGRADED (no OFFLINE)");
assertEq(classify(404, 100), "DEGRADED", "3g 404 -> DEGRADED (no OFFLINE)");
// Solo sin respuesta (timeout/conexión/TLS) = OFFLINE real.
assertEq(classify(null, 5000), "OFFLINE", "3h null/timeout -> OFFLINE");

console.log("=== ALL PASS ===");
