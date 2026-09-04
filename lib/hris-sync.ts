import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { listEmployees, HrisGatewayError } from "@/lib/hris-gateway-client";
import type { HrisEmployeeRow } from "@/lib/hris-gateway-client";
import { maskNik, JIT_DEFAULT_PASSWORD } from "@/lib/hris-jit";
import { logAudit } from "@/lib/audit";
import { reconcileAndApply } from "@/lib/portal-group-sync";
import { Prisma } from "@prisma/client";

// ============================================================================
// HRIS sync service (TASK-39, rework pull-based)
//
// SEBELUM (TASK-29, push-based): loop PortalUser EXISTING → /auth/lookup per NIK.
//   Bug: portal kosong → 0 diproses (tarik pertama = 0 data).
//
// SEKARANG (TASK-39, pull-based): tarik daftar karyawan dari GET /employees
//   (paginated, max 50/halaman) lalu JIT-create yang belum ada + update yang
//   sudah ada. HRIS-authoritative: overwrite name/email/nikHris/nikSantos/
//   departemen/jabatan/eligible/lastSyncAt. eligible = tgl_keluar === null.
//   eligible=false → isActive=false (blokir akses portal) dan TIDAK di-create.
//
// Idempotent, per-row error dicatat & lanjut (desain Jim §3.4).
// `opts.full`/`opts.intervalMs` dipertahankan demi kompatibel dengan route,
// namun tidak lagi berpengaruh: pull-based selalu menarik semua halaman.
// ============================================================================

// Gateway `limit` max 50 per halaman (god-verified via curl 2026-08-31).
const PAGE_LIMIT = 50;

// Throttle client 10 req/min (riset Kevin) → 60s / 10 = 6s antar halaman.
// Sync melewati throttle module (listEmployees({throttle:false})) dan mengatur
// delay sendiri agar tidak flood gateway (BOUNDARIES TASK-39).
const PAGE_DELAY_MS = 6000;

export interface HrisSyncResult {
    totalProcessed: number;
    updated: number;
    unchanged: number;
    deactivated: number;
    /** JIT user baru yang dibuat dari /employees (TASK-39). */
    created: number;
    errors: Array<{ nik: string; error: string }>;
    jobId: string;
    /** Hasil reconcile departemen → group (Spec #1) — undefined bila belum jalan. */
    groupSync?: {
        groupsCreated: number;
        membersAdded: number;
        membersRemoved: number;
        missingDepartments: number;
        removedInactive: number;
        newDepartments: string[];
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Hash password default JIT — dihitung SEKALI per run (bcrypt ~100ms/hash;
 * 4755 row × per-row = menit-menit sia-sia). compare() baca salt dari hash
 * itu sendiri, jadi satu hash valid untuk semua user.
 */
let jitDefaultHash: Promise<string> | null = null;
function getJitDefaultHash(): Promise<string> {
    jitDefaultHash ??= bcrypt.hash(JIT_DEFAULT_PASSWORD, 10);
    return jitDefaultHash;
}

/** Extract identifier utama baris /employees (nik_hris, fallback nik_santos). */
function rowNik(row: HrisEmployeeRow): string {
    return row.nik_hris || row.nik_santos || "";
}

/** eligible dari tgl_keluar === null (god-verified: indikator paling akurat). */
function rowEligible(row: HrisEmployeeRow): boolean {
    return row.tgl_keluar === null || row.tgl_keluar === undefined;
}

/**
 * Sinkronkan SEMUA karyawan dari HRIS `/employees` ke PortalUser (pull-based).
 *   — Tarik halaman demi halaman (limit 50), delay 6s antar halaman.
 *   — Belum ada di portal & eligible → JIT-create (passwordHash=null).
 *   — Belum ada & non-eligible → skip (jangan create akun nonaktif).
 *   — Sudah ada → update HRIS-authoritative; eligible=false → isActive=false.
 * Manual trigger via POST /api/admin/hris/sync (cron 6h = follow-up terpisah).
 */
export async function runHrisSync(
    opts: { full?: boolean; intervalMs?: number } = {} // dipertahankan demi signature route; pull-based mengabaikannya
): Promise<HrisSyncResult> {
    void opts; // pull selalu menarik SEMUA halaman — full/intervalMs tak berlaku lagi
    const result: HrisSyncResult = {
        totalProcessed: 0,
        updated: 0,
        unchanged: 0,
        deactivated: 0,
        created: 0,
        errors: [],
        jobId: `sync-${Date.now()}`,
    };

    // total rows dari halaman pertama; total pages = ceil(total / PAGE_LIMIT).
    const firstPage = await listEmployees(1, PAGE_LIMIT, { throttle: false });
    const total = firstPage.total || firstPage.data.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

    for (let page = 1; page <= totalPages; page++) {
        let rows: HrisEmployeeRow[];
        if (page === 1) {
            rows = firstPage.data;
        } else {
            await sleep(PAGE_DELAY_MS);
            try {
                rows = (await listEmployees(page, PAGE_LIMIT, { throttle: false })).data;
            } catch (err: unknown) {
                // Gagal ambil satu halaman → catat, lanjut halaman berikutnya.
                // Client sudah retry 5xx; jika masih gagal, jangan runtuhkan batch.
                result.errors.push({
                    nik: `page:${page}`,
                    error: err instanceof HrisGatewayError ? err.message : "Gagal ambil halaman /employees",
                });
                continue;
            }
        }

        for (const row of rows) {
            try {
                await syncEmployeeRow(row, result);
            } catch (err: unknown) {
                // Per-row error: catat & lanjut (desain Jim §3.4 — tak menggagalkan batch).
                result.errors.push({
                    nik: maskNik(rowNik(row)),
                    error: err instanceof Error ? err.message : "Gagal sinkron baris karyawan",
                });
            }
        }
    }

    // Per-run audit summary
    if (result.totalProcessed > 0) {
        const severity = result.errors.length > 0 ? "WARNING" : "INFO";
        await logAudit({
            actorType: "SYSTEM",
            category: "SYSTEM",
            action: "HRIS_SYNC_RUN",
            entityType: "HRIS",
            entityId: "sync",
            severity,
            metadata: {
                totalProcessed: result.totalProcessed,
                updated: result.updated,
                unchanged: result.unchanged,
                created: result.created,
                deactivated: result.deactivated,
                failedCount: result.errors.length,
                errors: result.errors.slice(0, 20),
            },
        }).catch(() => {});
    }

    // Sinkronisasi departemen → group (Spec #1, tiket #3): dijalankan di akhir
    // run yang sama, TIDAK menggagalkan sync bila gagal (cuma catat error).
    try {
        const { plan, applied } = await reconcileAndApply();
        result.groupSync = {
            groupsCreated: applied.groupsCreated,
            membersAdded: applied.membersAdded,
            membersRemoved: applied.membersRemoved,
            missingDepartments: plan.missingDepartments.length,
            removedInactive: plan.removedInactive.length,
            newDepartments: plan.newDepartments,
        };
        await logAudit({
            actorType: "SYSTEM",
            category: "PORTAL",
            action: "PORTAL_GROUP_SYNC",
            entityType: "PortalGroup",
            entityId: "reconcile",
            metadata: { ...result.groupSync },
        }).catch(() => {});
    } catch (err: unknown) {
        result.errors.push({
            nik: "group-sync",
            error: err instanceof Error ? err.message : "Gagal reconcile group departemen",
        });
    }

    return result;
}

/**
 * Proses SATU baris karyawan dari /employees:
 *   — existing (match by nik/nikHris/nikSantos) → update HRIS-authoritative.
 *   — belum ada & eligible → JIT-create; belum ada & non-eligible → skip.
 */
async function syncEmployeeRow(row: HrisEmployeeRow, result: HrisSyncResult): Promise<void> {
    result.totalProcessed++;

    const nik = rowNik(row);
    if (!nik) {
        // Baris tanpa identifier apa pun — tak bisa diproses. Catat, jangan crash.
        result.errors.push({ nik: "(kosong)", error: "Baris /employees tanpa nik_hris/nik_santos" });
        return;
    }

    const eligible = rowEligible(row);

    // Match existing lintas identifier — user bisa dibuat dari alur set-password
    // dengan NIK mana pun; jangan duplikat hanya karena beda kolom NIK.
    const existing = await prisma.portalUser.findFirst({
        where: {
            OR: [{ nik }, { nikHris: nik }, { nikSantos: nik }] as Prisma.PortalUserWhereInput[],
        },
    });

    if (!existing) {
        if (!eligible) {
            // Jangan create akun non-eligible (BOUNDARIES TASK-39). Skip diam-diam.
            return;
        }
        await prisma.portalUser.create({
            data: {
                nik,
                name: row.nama_karyawan || nik,
                email: row.email ?? null,
                nikHris: row.nik_hris ?? null,
                nikSantos: row.nik_santos ?? null,
                departemen: row.nama_departemen ?? null,
                jabatan: row.nama_jabatan ?? null,
                eligible: true,
                isActive: true,
                // TASK-41B: password default — user baru langsung bisa login NIK + 12345.
                // SECURITY: default password lemah — user wajib ganti (backlog).
                passwordHash: await getJitDefaultHash(),
                lastSyncAt: new Date(),
            },
        });
        result.created++;
        return;
    }

    // Sudah ada → update HRIS-authoritative (kontrak TASK-39 output #3d).
    const updates: Prisma.PortalUserUpdateInput = {
        name: row.nama_karyawan || existing.name,
        email: row.email ?? null,
        nikHris: row.nik_hris ?? null,
        nikSantos: row.nik_santos ?? null,
        departemen: row.nama_departemen ?? null,
        jabatan: row.nama_jabatan ?? null,
        eligible,
        lastSyncAt: new Date(),
    };
    if (!eligible) {
        // HRIS authoritative: non-eligible → nonaktifkan (D4). Sync TIDAK pernah
        // meng-aktifkan kembali (isActive=true hanya lewat admin manual).
        updates.isActive = false;
    }

    const changed =
        updates.name !== existing.name ||
        updates.email !== existing.email ||
        updates.nikHris !== existing.nikHris ||
        updates.nikSantos !== existing.nikSantos ||
        updates.departemen !== existing.departemen ||
        updates.jabatan !== existing.jabatan ||
        updates.eligible !== existing.eligible ||
        (updates.isActive === false && existing.isActive);

    await prisma.portalUser.update({ where: { id: existing.id }, data: updates });

    if (changed) {
        result.updated++;
        if (updates.isActive === false && existing.isActive) result.deactivated++;
    } else {
        // Data identik; update di atas tetap jalan demi refresh lastSyncAt.
        result.unchanged++;
    }
}
