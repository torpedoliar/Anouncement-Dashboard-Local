/**
 * Self-check modul murni beranda portal.
 * Run: npx tsx scripts/test-portal-home.ts
 */
import {
    greetingFor, healthBucket, countHealth, pickFavorites, pickRecent,
    rankApps, iconColor, isPaletteShortcut, type HomeApp,
} from "../lib/portal-home";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const app = (id: string, name: string, extra: Partial<HomeApp> = {}): HomeApp => ({
    id, slug: id, name, groupName: "Umum", credentialCount: 1, ...extra,
});

// Salam
assertEq(greetingFor(5), "Selamat malam", "05:00 → malam");
assertEq(greetingFor(6), "Selamat pagi", "06:00 → pagi");
assertEq(greetingFor(11), "Selamat siang", "11:00 → siang");
assertEq(greetingFor(15), "Selamat sore", "15:00 → sore");
assertEq(greetingFor(18), "Selamat malam", "18:00 → malam");

// Status
assertEq(healthBucket("ONLINE"), "ONLINE", "ONLINE");
assertEq(healthBucket(null), "UNKNOWN", "null → UNKNOWN");
assertEq(healthBucket("WEIRD"), "UNKNOWN", "nilai asing → UNKNOWN");
assertEq(
    countHealth([app("a", "A", { healthStatus: "ONLINE" }), app("b", "B", { healthStatus: "OFFLINE" }), app("c", "C")]),
    { ONLINE: 1, DEGRADED: 0, OFFLINE: 1, UNKNOWN: 1 },
    "hitung status",
);

// Favorit — Review Focus #3: pin untuk app yang tak lagi accessible tidak tampil
const apps = [
    app("hris", "HRIS", { lastUsedAt: "2026-10-02T08:00:00Z" }),
    app("k2", "K2 Workflow", { lastUsedAt: "2026-10-01T08:00:00Z", category: "Workflow" }),
    app("ebs", "Oracle EBS", { lastUsedAt: "2026-09-30T08:00:00Z", groupName: "Keuangan" }),
    app("mail", "Webmail"),
    app("hris", "HRIS", { groupName: "SDM", lastUsedAt: "2026-10-02T08:00:00Z" }), // app sama di grup lain
];
assertEq(pickFavorites(apps, new Set(["k2", "dicabut"])).map((a) => a.id), ["k2"], "favorit hanya app yang tampil, tanpa duplikat");
assertEq(pickFavorites(apps, new Set(["hris"])).map((a) => a.id), ["hris"], "app di dua grup → satu favorit");

// Terakhir dipakai — urut terbaru, tanpa favorit, tanpa yang belum pernah dipakai, dedup
assertEq(pickRecent(apps, new Set()).map((a) => a.id), ["hris", "k2", "ebs"], "recent urut terbaru, dedup, tanpa null");
assertEq(pickRecent(apps, new Set(["hris"])).map((a) => a.id), ["k2", "ebs"], "recent tidak mengulang favorit");
assertEq(pickRecent(apps, new Set(), 2).map((a) => a.id), ["hris", "k2"], "batas jumlah");

// Ranking palette
assertEq(rankApps("", apps).length, 0, "query kosong → kosong (UI menampilkan favorit+recent)");
assertEq(rankApps("k2", apps).map((a) => a.id), ["k2"], "cocok nama");
assertEq(rankApps("work", apps).map((a) => a.id), ["k2"], "awal kata di tengah nama");
assertEq(rankApps("keu", apps).map((a) => a.id), ["ebs"], "cocok nama grup");
assertEq(rankApps("ORACLE", apps).map((a) => a.id), ["ebs"], "tidak peka huruf besar");
assertEq(rankApps("ma", [app("x", "Gmail"), app("y", "Mattermost")]).map((a) => a.id), ["y", "x"], "awal nama di atas tengah");
assertEq(rankApps("hris", apps).length, 1, "hasil palette dedup per id");
assertEq(rankApps("zzz", apps).length, 0, "tanpa hasil");

// Warna ikon deterministik
assertEq(iconColor("HRIS"), iconColor("HRIS"), "warna stabil");
assertEq(/^#[0-9a-f]{6}$/i.test(iconColor("")), true, "nama kosong tetap warna valid");

// Pintasan — Review Focus #5
assertEq(isPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false }), true, "Ctrl+K");
assertEq(isPaletteShortcut({ key: "K", ctrlKey: false, metaKey: true }), true, "Cmd+K");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "BODY" }), true, "/ di halaman");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "INPUT" }), false, "/ di input → tidak");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "TEXTAREA" }), false, "/ di textarea → tidak");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "DIV", targetEditable: true }), false, "/ di contenteditable → tidak");
assertEq(isPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false, targetTag: "INPUT" }), true, "Ctrl+K di input tetap buka");
assertEq(isPaletteShortcut({ key: "k", ctrlKey: false, metaKey: false }), false, "k biasa → tidak");

console.log(process.exitCode ? "=== ADA FAIL ===" : "=== ALL PASS ===");
