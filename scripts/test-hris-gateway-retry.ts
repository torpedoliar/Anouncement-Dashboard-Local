/**
 * Self-check runtone: retry logic lib/hris-gateway-client.ts
 * Memastikan: 5xx → retry (backoff), lalu sukses; 4xx → tidak retry.
 *
 * Menjalankan: npx tsx scripts/test-hris-gateway-retry.ts
 * Tidak menyentuh gateway asli (fetch diganti stub). Wajib PORTAL_CREDENTIAL_KEY di .env.
 */
import prisma from "@/lib/prisma";
import { encryptCredential } from "@/lib/portal-crypto";
import {
    pingGateway,
    lookupNIK,
    HrisGatewayError,
} from "@/lib/hris-gateway-client";

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
        // 1) Retry succeed: 500 → 500 → 200
        let reqCount = 0;
        globalThis.fetch = (async () => {
            reqCount++;
            if (reqCount <= 2) {
                return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
            }
            return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
        }) as typeof fetch;

        const ping = await pingGateway();
        assert(reqCount === 3, `5xx retry: 3 request (dapat ${reqCount})`);
        assert(ping.ok === true, `ping sukses setelah retry`);

        // 2) 4xx → NO retry
        reqCount = 0;
        globalThis.fetch = (async () => {
            reqCount++;
            return new Response(JSON.stringify({ error: "NIK not found" }), { status: 404 });
        }) as typeof fetch;

        let threw4xx = false;
        try {
            await lookupNIK("123");
        } catch (err: unknown) {
            threw4xx = err instanceof HrisGatewayError && err.status === 404;
        }
        assert(reqCount === 1, "4xx tidak di-retry (1 request)");
        assert(threw4xx === true, "4xx melempar HrisGatewayError status 404");

        console.log("\nSelf-check HRIS gateway retry: PASS");
    } finally {
        globalThis.fetch = originalFetch;
    }
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});