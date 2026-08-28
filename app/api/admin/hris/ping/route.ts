import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { pingGateway, HrisGatewayError } from "@/lib/hris-gateway-client";
import { logAudit } from "@/lib/audit";

// ============================================================================
// HRIS Gateway Ping API (TASK-29) — test konektivitas gateway
//   POST /api/admin/hris/ping → { healthStatus, lastPingAt, error? }
// Auth: SuperAdmin only.
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        let ok: boolean;
        let status = "unknown";
        let error: string | null = null;

        try {
            const ping = await pingGateway();
            ok = ping.ok;
            status = ping.status;
        } catch (err: unknown) {
            ok = false;
            error = err instanceof HrisGatewayError ? err.message : "Gagal menghubungi gateway HRIS";
            if (err instanceof HrisGatewayError && err.code === "CONFIG") {
                return NextResponse.json(
                    { error: "Konfigurasi gateway HRIS belum disetel" },
                    { status: 400 }
                );
            }
        }

        // Simpan hasil ping di config singleton
        await prisma.hrisGatewayConfig.upsert({
            where: { id: 1 },
            update: {
                lastPingAt: new Date(),
                pingError: error,
                enabled: ok ? true : undefined,
            },
            create: {
                id: 1,
                baseUrl: "",
                apiKeyEncrypted: "",
                enabled: ok,
                lastPingAt: new Date(),
                pingError: error,
            },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "SYSTEM",
            action: "HRIS_PING",
            entityType: "HRIS",
            entityId: "ping",
            outcome: ok ? "SUCCESS" : "FAILURE",
            metadata: { status, error },
            request,
        }).catch(() => {});

        const healthStatus = ok ? "ONLINE" : "OFFLINE";
        return NextResponse.json({
            healthStatus,
            lastPingAt: new Date().toISOString(),
            ...(error ? { error } : {}),
            ok,
        });
    } catch (error) {
        console.error("HRIS ping error:", error);
        return NextResponse.json({ error: "Failed to ping HRIS gateway" }, { status: 500 });
    }
}