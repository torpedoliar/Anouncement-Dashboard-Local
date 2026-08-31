/**
 * Self-check runtone: listEmployees lib/hris-gateway-client.ts (TASK-39 pull-based sync)
 * Memastikan: URL dibentuk dgn `page`/`limit`, response {data,total} diparse benar,
 * dan throttle module bisa di-skip lewat opts.throttle=false.
 *
 * Menjalankan: npx tsx scripts/test-hris-list-employees.ts
 * Tidak menyentuh gateway asli (fetch diganti stub). Wajib PORTAL_CREDENTIAL_KEY di .env.
 */
import prisma from "@/lib/prisma";
import { encryptCredential } from "@/lib/portal-crypto";
import { listEmployees } from "@/lib/hris-gateway-client";

function assert(cond: boolean, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok - ${msg}`);
}

async function main(): Promise<void> {
    // Stub config singleton di memori (tanpa DB write).
    const cfg = {
        id: 1,
        baseUrl: "https://mock-hris.invalid",
        apiKeyEncrypted: encryptCredential({ username: "hris-admin", password: "test-key" }),
        enabled: true,
    };
    (prisma.hrisGatewayConfig as { findFirst: () => unknown }).findFirst = async () => cfg;

    const originalFetch = global.fetch;

    try {
        // 1) Parse response {data,total} + URL bawa page/limit.
        let capturedUrl = "";
        globalThis.fetch = (async (_url: unknown) => {
            capturedUrl = String(_url);
            return new Response(
                JSON.stringify({
                    data: [{ nik_hris: "00000024", nama_karyawan: "CHRISTHIN", tgl_keluar: null }],
                    total: 4755,
                }),
                { status: 200, headers: { "content-type": "application/json" } },
            );
        }) as typeof fetch;

        const page1 = await listEmployees(1, 50);
        assert(capturedUrl.includes("page=1"), `URL membawa page=1 (${capturedUrl})`);
        assert(capturedUrl.includes("limit=50"), `URL membawa limit=50 (${capturedUrl})`);
        assert(page1.data.length === 1, `data diparse (${page1.data.length} row)`);
        assert(page1.data[0].nama_karyawan === "CHRISTHIN", `row.nama_karyawan terbaca`);
        assert(page1.total === 4755, `total diparse (${page1.total})`);

        // 2) Throttle module: dengan `throttle:false` tidak melempar rate-limit.
        //    Spike assertion: panggil 11x cepat tanpa throttle → tetap sukses (tidak HrisGatewayError).
        let ok = true;
        for (let i = 0; i < 11; i++) {
            try {
                await listEmployees(1, 50, { throttle: false });
            } catch {
                ok = false;
            }
        }
        assert(ok === true, "throttle:false menembus rate-limit client (11x cepat, tak error)");

        console.log("\nSelf-check HRIS listEmployees: PASS");
    } finally {
        globalThis.fetch = originalFetch;
    }
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
