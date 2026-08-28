import prisma from "@/lib/prisma";
import { lookupNIK } from "@/lib/hris-gateway-client";
import { maskNik } from "@/lib/hris-jit";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// ============================================================================
// HRIS sync service (TASK-29, desain Jim §3)
// HRIS authoritative: overwrite name/email/nikHris/nikSantos/eligible.
// eligible=false → isActive=false (blokir akses portal), sesuai D4.
// Idempotent, per-row error dicatat, `lastSyncAt` di-update per row.
// ============================================================================

export interface HrisSyncResult {
    totalProcessed: number;
    updated: number;
    unchanged: number;
    deactivated: number;
    errors: Array<{ nik: string; error: string }>;
}

/**
 * Sinkronkan semua PortalUser yang aktif ke HRIS.
 * `full` = iterasi semua user aktif; incremental (default) = hanya user yang
 * `lastSyncAt` sudah TUA (lebih dari interval) ATAU belum pernah sync. Mode
 * incremental ini menghindari hammering gateway tiap 6 jam di skala besar.
 */
export async function runHrisSync(opts: { full?: boolean; intervalMs?: number } = {}): Promise<HrisSyncResult> {
    const interval = opts.intervalMs ?? 6 * 60 * 60 * 1000; // default: 6 jam
    const cutoff = new Date(Date.now() - interval);

    const where = opts.full
        ? {}
        : {
              OR: [
                  { lastSyncAt: { lt: cutoff } },
                  { lastSyncAt: null },
              ] as Prisma.PortalUserWhereInput[],
          };

    const users = await prisma.portalUser.findMany({ where });
    const result: HrisSyncResult = { totalProcessed: users.length, updated: 0, unchanged: 0, deactivated: 0, errors: [] };

    for (const user of users) {
        try {
            // throttle opt-out: sync batch mengontrol delay sendiri, bukan throttle module
            const lookup = await lookupNIK(user.nik, { throttle: false });
            if (!lookup.valid) {
                // NIK tidak valid di HRIS — catat error; JANGAN deaktivasi (bisa transient).
                result.errors.push({ nik: maskNik(user.nik), error: "NIK tidak valid di HRIS" });
                continue;
            }

            const updates: Prisma.PortalUserUpdateInput = {
                name: lookup.namaKaryawan ?? user.name,
                email: lookup.email ?? null,
                nikHris: lookup.nikHris ?? null,
                nikSantos: lookup.nikSantos ?? null,
                eligible: lookup.eligible,
                lastSyncAt: new Date(),
            };
            if (!lookup.eligible) {
                // HRIS authoritative: non-eligible → nonaktifkan (D4)
                updates.isActive = false;
            }

            const changed =
                updates.name !== user.name ||
                updates.email !== user.email ||
                updates.nikHris !== user.nikHris ||
                updates.nikSantos !== user.nikSantos ||
                updates.eligible !== user.eligible ||
                (updates.isActive === false && user.isActive);

            if (changed) {
                await prisma.portalUser.update({ where: { id: user.id }, data: updates });
                result.updated++;
                if (updates.isActive === false && user.isActive) result.deactivated++;
            } else {
                result.unchanged++;
            }
        } catch (err: unknown) {
            // Per-row error: catat & lanjut (desain Jim §3.4 — tidak menggagalkan batch)
            result.errors.push({
                nik: maskNik(user.nik),
                error: err instanceof Error ? err.message : "Gagal lookup HRIS",
            });
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
                deactivated: result.deactivated,
                failedCount: result.errors.length,
                errors: result.errors.slice(0, 20),
            },
        }).catch(() => {});
    }

    return result;
}