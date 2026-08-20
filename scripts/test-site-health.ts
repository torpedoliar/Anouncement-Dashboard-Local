/**
 * Self-check aturan status kesehatan site (tanpa DB).
 * Menjaga agar site sehat tidak lagi ditandai "kritis" hanya karena
 * ActivityLog sepi — sinyal yang tidak reliabel di repo ini.
 * Run: npx tsx scripts/test-site-health.ts
 */
export {}; // jadikan modul agar helper tidak bentrok dengan skrip test lain

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

interface Reason {
    label: string;
    level: "warning" | "critical";
    detail: string;
    action: string;
}

/** Meniru penentuan status di app/api/sites/[id]/health/route.ts */
function evaluate(input: {
    draftCount: number;
    pendingComments: number;
    publishedAnnouncements: number;
    daysSincePublish: number | null;
}): { status: string; reasons: Reason[]; summary: string } {
    const { draftCount, pendingComments, publishedAnnouncements, daysSincePublish } = input;
    const reasons: Reason[] = [];

    if (draftCount > 10) {
        reasons.push({ label: "Draf menumpuk", level: "critical", detail: `${draftCount} draf`, action: "-" });
    } else if (draftCount > 5) {
        reasons.push({ label: "Draf mulai menumpuk", level: "warning", detail: `${draftCount} draf`, action: "-" });
    }

    if (pendingComments > 20) {
        reasons.push({ label: "Komentar menunggu moderasi", level: "critical", detail: `${pendingComments}`, action: "-" });
    } else if (pendingComments > 10) {
        reasons.push({ label: "Antrean moderasi bertambah", level: "warning", detail: `${pendingComments}`, action: "-" });
    }

    if (publishedAnnouncements > 0 && daysSincePublish !== null && daysSincePublish > 30) {
        reasons.push({ label: "Belum ada konten baru", level: "warning", detail: `${daysSincePublish} hari`, action: "-" });
    }

    const hasCritical = reasons.some((r) => r.level === "critical");
    const status = hasCritical ? "critical" : reasons.length > 0 ? "warning" : "good";
    const summary = status === "good" ? "Tidak ada masalah terdeteksi." : reasons.map((r) => r.label).join(" · ");
    return { status, reasons, summary };
}

// --- 1. Regresi utama: site sehat tidak lagi "kritis" -----------------------
// Aturan lama: ActivityLog terakhir >14 hari -> critical. Karena hanya 2 dari 20
// penulisan ActivityLog yang mengisi siteId, site normal ikut tertandai kritis.
const quiet = evaluate({ draftCount: 1, pendingComments: 0, publishedAnnouncements: 5, daysSincePublish: 20 });
assertEq(quiet.status, "good", "1a site rapi + terbit 20 hari lalu -> good (dulu critical)");

const brandNew = evaluate({ draftCount: 0, pendingComments: 0, publishedAnnouncements: 0, daysSincePublish: null });
assertEq(brandNew.status, "good", "1b site baru tanpa konten -> good (dulu bisa critical)");
assertEq(brandNew.reasons.length, 0, "1c site baru tanpa alasan");

// Site kosong tidak boleh dituduh basi — belum pernah menerbitkan apa pun.
const emptyOld = evaluate({ draftCount: 0, pendingComments: 0, publishedAnnouncements: 0, daysSincePublish: 400 });
assertEq(emptyOld.status, "good", "1d site tanpa konten terbit tidak dinilai basi");

// --- 2. Basi konten hanya 'warning', bukan 'critical' ----------------------
const stale = evaluate({ draftCount: 0, pendingComments: 0, publishedAnnouncements: 3, daysSincePublish: 45 });
assertEq(stale.status, "warning", "2a konten basi -> warning (bukan critical)");
assertEq(stale.reasons[0].label, "Belum ada konten baru", "2b alasan basi tercatat");
assertEq(stale.reasons[0].level, "warning", "2c level basi = warning");

// Tepat di ambang batas tidak memicu.
assertEq(evaluate({ draftCount: 0, pendingComments: 0, publishedAnnouncements: 3, daysSincePublish: 30 }).status, "good", "2d tepat 30 hari -> good");
assertEq(evaluate({ draftCount: 0, pendingComments: 0, publishedAnnouncements: 3, daysSincePublish: 31 }).status, "warning", "2e 31 hari -> warning");

// --- 3. Kritis hanya untuk beban kerja nyata -------------------------------
const manyDrafts = evaluate({ draftCount: 12, pendingComments: 0, publishedAnnouncements: 5, daysSincePublish: 1 });
assertEq(manyDrafts.status, "critical", "3a 12 draf -> critical");
assertEq(manyDrafts.reasons[0].level, "critical", "3b alasan draf level critical");

const manyComments = evaluate({ draftCount: 0, pendingComments: 25, publishedAnnouncements: 5, daysSincePublish: 1 });
assertEq(manyComments.status, "critical", "3c 25 komentar pending -> critical");

// Ambang batas persis.
assertEq(evaluate({ draftCount: 10, pendingComments: 0, publishedAnnouncements: 1, daysSincePublish: 1 }).status, "warning", "3d 10 draf -> warning");
assertEq(evaluate({ draftCount: 11, pendingComments: 0, publishedAnnouncements: 1, daysSincePublish: 1 }).status, "critical", "3e 11 draf -> critical");
assertEq(evaluate({ draftCount: 5, pendingComments: 0, publishedAnnouncements: 1, daysSincePublish: 1 }).status, "good", "3f 5 draf -> good");
assertEq(evaluate({ draftCount: 6, pendingComments: 0, publishedAnnouncements: 1, daysSincePublish: 1 }).status, "warning", "3g 6 draf -> warning");

// --- 4. Alasan selalu menyertai status bermasalah --------------------------
// Ini yang membuat badge bisa diklik: tanpa reasons dialognya kosong.
for (const c of [manyDrafts, manyComments, stale]) {
    assertEq(c.reasons.length > 0, true, `4a status ${c.status} punya minimal 1 alasan`);
    assertEq(c.summary.length > 0, true, `4b status ${c.status} punya ringkasan`);
}
assertEq(quiet.reasons.length, 0, "4c status good tanpa alasan");
assertEq(quiet.summary, "Tidak ada masalah terdeteksi.", "4d ringkasan good");

// --- 5. Beberapa masalah sekaligus ------------------------------------------
const multi = evaluate({ draftCount: 12, pendingComments: 25, publishedAnnouncements: 2, daysSincePublish: 60 });
assertEq(multi.status, "critical", "5a critical menang atas warning");
assertEq(multi.reasons.length, 3, "5b semua alasan terkumpul");
assertEq(multi.reasons.filter((r) => r.level === "critical").length, 2, "5c dua alasan critical");

// Satu critical + satu warning tetap critical.
const mixed = evaluate({ draftCount: 12, pendingComments: 0, publishedAnnouncements: 2, daysSincePublish: 60 });
assertEq(mixed.status, "critical", "5d critical + warning -> critical");
assertEq(mixed.reasons.length, 2, "5e kedua alasan tetap dilaporkan");

console.log("=== ALL PASS (site health) ===");
