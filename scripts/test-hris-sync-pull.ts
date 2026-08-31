/**
 * Self-check runtone: runHrisSync pull-based (TASK-39/41).
 * Memastikan: (1) baris eligible baru di-JIT-create DENGAN passwordHash terisi
 * (bcrypt, default 12345 — TASK-41B), (2) baris non-eligible baru DI-SKIP,
 * (3) existing eligible=false → update isActive=false, (4) summary counter benar.
 *
 * Menjalankan: npx tsx scripts/test-hris-sync-pull.ts
 * Tidak menyentuh gateway asli (fetch+prisma dstub). Halaman tunggal → tanpa delay 6s.
 */
import prisma from "@/lib/prisma";
import { encryptCredential } from "@/lib/portal-crypto";
import { compare } from "bcryptjs";
import { runHrisSync } from "@/lib/hris-sync";
import type { PortalUser } from "@prisma/client";

function assert(cond: boolean, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok - ${msg}`);
}

async function main(): Promise<void> {
    // Stub config singleton (pola test-hris-gateway-retry.ts).
    const cfg = {
        id: 1,
        baseUrl: "https://mock-hris.invalid",
        apiKeyEncrypted: encryptCredential({ username: "hris-admin", password: "test-key" }),
        enabled: true,
    };
    (prisma.hrisGatewayConfig as { findFirst: () => unknown }).findFirst = async () => cfg;

    // Existing user utk path "update eligible=false".
    const existingUser = {
        id: "u-exist-1",
        nik: "00000026",
        name: "OLD NAME",
        email: null,
        nikHris: null,
        nikSantos: null,
        departemen: null,
        jabatan: null,
        eligible: true,
        isActive: true,
        passwordHash: "$2a$10$existing",
        lastSyncAt: null,
    } as unknown as PortalUser;

    const createdRows: Array<Record<string, unknown>> = [];
    const updatedRows: Array<Record<string, unknown>> = [];

    (prisma.portalUser as unknown as Record<string, unknown>).findFirst = async (args: {
        where: { OR: Array<{ nik?: string }> };
    }) => {
        const nik = args.where.OR[0].nik;
        return nik === existingUser.nik ? existingUser : null;
    };
    (prisma.portalUser as unknown as Record<string, unknown>).create = async (args: {
        data: Record<string, unknown>;
    }) => {
        createdRows.push(args.data);
        return { id: `c-${createdRows.length}` };
    };
    (prisma.portalUser as unknown as Record<string, unknown>).update = async (args: {
        data: Record<string, unknown>;
    }) => {
        updatedRows.push(args.data);
        return { id: existingUser.id };
    };

    // Stub fetch: SATU halaman, 3 baris (create eligible / skip non-eligible / deactivate existing).
    const originalFetch = global.fetch;
    globalThis.fetch = (async () => {
        return new Response(
            JSON.stringify({
                data: [
                    {
                        nik_hris: "00000024", nik_santos: "2130406", nama_karyawan: "NEW EMP",
                        email: "new@x.co.id", nama_departemen: "PROCUREMENT",
                        nama_jabatan: "MANAGER", tgl_keluar: null,
                    },
                    {
                        nik_hris: "00000025", nik_santos: "2130407", nama_karyawan: "EXIT EMP",
                        email: null, tgl_keluar: "2026-01-01",
                    },
                    {
                        nik_hris: "00000026", nik_santos: "2130408", nama_karyawan: "RESIGNED EMP",
                        email: null, tgl_keluar: "2025-06-30",
                    },
                ],
                total: 3,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
        );
    }) as typeof fetch;

    try {
        const result = await runHrisSync({ full: true });

        // 3 baris: 1 create (eligible baru), 1 skip (non-eligible baru), 1 deactivate (existing).
        assert(result.totalProcessed === 3, `totalProcessed=3 (dapat ${result.totalProcessed})`);
        assert(result.created === 1, `created=1 (dapat ${result.created})`);
        assert(result.updated === 1, `updated=1 (dapat ${result.updated})`);
        assert(result.deactivated === 1, `deactivated=1 (dapat ${result.deactivated})`);

        // TASK-41B inti: JIT-create membawa passwordHash terisi (bukan null) dan
        // cocok dgn default 12345.
        const newEmp = createdRows.find((r) => r.nik === "00000024");
        assert(newEmp !== undefined, "baris eligible baru di-create");
        const hash = newEmp?.passwordHash as string;
        assert(typeof hash === "string" && hash.length > 20, "passwordHash terisi (bcrypt hash)");
        assert((await compare("12345", hash)) === true, "passwordHash cocok dgn default 12345");
        assert(newEmp?.departemen === "PROCUREMENT" && newEmp?.jabatan === "MANAGER", "departemen/jabatan terisi");

        // TASK-39: baris non-eligible baru TIDAK di-create.
        assert(!createdRows.some((r) => r.nik === "00000025"), "baris non-eligible TIDAK di-create");

        // Existing eligible=false → isActive=false.
        assert(updatedRows.length === 1, "satu baris existing ter-update");
        assert(updatedRows[0]?.isActive === false, "existing eligible=false → isActive=false");
        assert(updatedRows[0]?.eligible === false, "existing eligible ikut false");

        console.log("\nSelf-check HRIS sync pull-based: PASS");
    } finally {
        globalThis.fetch = originalFetch;
    }
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
