import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { lookupNIK, HrisGatewayError } from "@/lib/hris-gateway-client";
import { logAudit } from "@/lib/audit";

// ============================================================================
// JIT (Just-In-Time) provisioning (TASK-29, desain Jim §2; TASK-41B password default)
//
// Saat NIK ditemukan valid+eligible di HRIS tapi belum ada PortalUser → auto-create
// akun portal dengan password default (TASK-41B) sehingga user bisa langsung login.
// Dipanggil dari alur aktivasi set-password (BUKAN dari portal-auth.ts — file itu
// hanya dibolehkan modifikasi null-guard).
// ============================================================================

// SECURITY: default password lemah — user wajib ganti (backlog).
// USER-SUPERVISED: dipilih user via god; admin bisa resync utk reset kuat.
export const JIT_DEFAULT_PASSWORD = "12345";

export type JitProvisionResult =
    | { status: "created"; userId: string }
    | { status: "exists"; userId: string }
    | { status: "not_found" } // NIK tidak valid di HRIS (`valid: false`)
    | { status: "not_eligible" } // NIK valid tapi tidak eligible di HRIS
    | { status: "unavailable" }; // gateway belum dikonfigurasi / gagal — jangan JIT

/** Mask NIK untuk audit (jangan pernah log NIK utuh — aturan riset Kevin). */
export function maskNik(nik: string): string {
    if (nik.length <= 3) return "*".repeat(Math.min(nik.length, 3));
    return `${nik.slice(0, 3)}${"*".repeat(Math.min(nik.length - 3, 4))}`;
}

/**
 * JIT provision: jika PortalUser dengan NIK belum ada, lookup ke HRIS. Kalau
 * valid+eligible → buat akun JIT (passwordHash=NULL). Idempoten & race-safe
 * (unique constraint `nik`; double-check sebelum create).
 */
export async function provisionJitPortalUser(nik: string): Promise<JitProvisionResult> {
    const existing = await prisma.portalUser.findUnique({
        where: { nik },
        select: { id: true },
    });
    if (existing) return { status: "exists", userId: existing.id };

    let lookup;
    try {
        lookup = await lookupNIK(nik);
    } catch (err: unknown) {
        if (err instanceof HrisGatewayError && err.code === "CONFIG") {
            // Gateway belum disetel → jangan JIT, jangan error palsu ke user.
            return { status: "unavailable" };
        }
        // Timeout/network → degrade (desain Jim §2.5: fallback ke cek lokal, jangan JIT).
        return { status: "unavailable" };
    }

    if (!lookup.valid) return { status: "not_found" };
    if (!lookup.eligible) return { status: "not_eligible" };

    // Race: dua request bersamaan bisa lolos cek di atas; unique constraint menolak.
    const created = await prisma.portalUser.create({
        data: {
            nik,
            name: lookup.namaKaryawan || nik,
            email: lookup.email ?? null,
            nikHris: lookup.nikHris ?? null,
            nikSantos: lookup.nikSantos ?? null,
            eligible: true,
            isActive: true,
            // TASK-41B: password default (bcrypt) — user langsung bisa login NIK + 12345.
            // SECURITY: default password lemah — user wajib ganti (backlog).
            passwordHash: await bcrypt.hash(JIT_DEFAULT_PASSWORD, 10),
            lastSyncAt: new Date(),
        },
    });

    await logAudit({
        actorType: "SYSTEM",
        category: "USER_MGMT",
        action: "PORTAL_JIT_PROVISIONED",
        entityType: "PORTAL_USER",
        entityId: created.id,
        changes: { nik: maskNik(nik) },
        severity: "INFO",
    }).catch(() => {});

    return { status: "created", userId: created.id };
}