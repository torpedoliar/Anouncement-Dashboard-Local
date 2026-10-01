/**
 * Self-check status baca situs publik (localStorage per perangkat).
 * Run: npx tsx scripts/test-reading-state.ts
 */
import {
    parseReadList, pushRead, isNew, countNew, editionLabel, timeBucket, readKey, lastVisitKey, READ_LIMIT,
} from "../lib/reading-state";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

// Review Focus #4: storage korup
assertEq(parseReadList(null), [], "null → []");
assertEq(parseReadList("{rusak"), [], "JSON rusak → []");
assertEq(parseReadList('{"a":1}'), [], "bukan array → []");
assertEq(parseReadList('["a",2,null,"b"]'), ["a", "b"], "elemen non-string dibuang");

assertEq(pushRead(["a", "b"], "c"), ["a", "b", "c"], "tambah di akhir");
assertEq(pushRead(["a", "b"], "a"), ["b", "a"], "dibaca ulang → pindah ke akhir, tanpa duplikat");
const full = Array.from({ length: READ_LIMIT }, (_, i) => `id${i}`);
const pushed = pushRead(full, "baru");
assertEq([pushed.length, pushed[0], pushed[pushed.length - 1]], [READ_LIMIT, "id1", "baru"], "FIFO di batas");

const lastVisit = "2026-10-01T00:00:00.000Z";
assertEq(isNew("2026-10-02T01:00:00.000Z", lastVisit, [], "x"), true, "lebih baru dari kunjungan → baru");
assertEq(isNew("2026-09-30T01:00:00.000Z", lastVisit, [], "x"), false, "lebih lama → bukan baru");
assertEq(isNew("2026-10-02T01:00:00.000Z", lastVisit, ["x"], "x"), false, "sudah dibaca → bukan baru");
assertEq(isNew("2026-10-02T01:00:00.000Z", null, [], "x"), false, "kunjungan pertama → tidak ada badge");
assertEq(isNew("bukan-tanggal", lastVisit, [], "x"), false, "tanggal rusak → bukan baru");
assertEq(
    countNew([{ id: "a", createdAt: "2026-10-02T00:00:00Z" }, { id: "b", createdAt: "2026-10-02T00:00:00Z" }, { id: "c", createdAt: "2026-09-01T00:00:00Z" }], lastVisit, ["b"]),
    1,
    "hitung baru",
);

assertEq(editionLabel(6), "Edisi Pagi", "06 → pagi");
assertEq(editionLabel(17), "Edisi Pagi", "17 → pagi");
assertEq(editionLabel(18), "Edisi Malam", "18 → malam");
assertEq(editionLabel(3), "Edisi Malam", "03 → malam");

// Pengelompokan waktu, zona Asia/Jakarta (UTC+7)
const now = "2026-10-02T03:00:00.000Z"; // 10:00 WIB, Kamis
assertEq(timeBucket("2026-10-01T18:00:00.000Z", now), "today", "01:00 WIB hari ini");
assertEq(timeBucket("2026-10-01T16:00:00.000Z", now), "week", "23:00 WIB kemarin → minggu ini");
assertEq(timeBucket("2026-09-26T03:00:00.000Z", now), "week", "6 hari lalu → minggu ini");
assertEq(timeBucket("2026-09-24T03:00:00.000Z", now), "older", "8 hari lalu → sebelumnya");

assertEq(readKey("sja-utama"), "site:sja-utama:read", "kunci dibaca");
assertEq(lastVisitKey("sja-utama"), "site:sja-utama:lastVisit", "kunci kunjungan");

console.log(process.exitCode ? "=== ADA FAIL ===" : "=== ALL PASS ===");
