import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { runHrisSync } from "@/lib/hris-sync";
import { logAudit } from "@/lib/audit";

// ============================================================================
// HRIS Sync API (TASK-29) — admin manual trigger
//   GET  /api/admin/hris/sync  → status lastSyncAt (last sync summary)
//   POST /api/admin/hris/sync  → jalankan sync manual (HRIS authoritative)
// Auth: SuperAdmin only (config enterprise).
// ============================================================================

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const totalUsers = await prisma.portalUser.count();
        const activeUsers = await prisma.portalUser.count({ where: { isActive: true } });
        const jitUsers = await prisma.portalUser.count({ where: { passwordHash: null } });
        const cfg = await prisma.hrisGatewayConfig.findFirst({ select: { lastSyncAt: true, lastPingAt: true } });

        return NextResponse.json({
            status: "ok",
            lastSyncAt: cfg?.lastSyncAt ?? null,
            lastPingAt: cfg?.lastPingAt ?? null,
            summary: {
                totalUsers,
                activeUsers,
                jitUsers,
            },
            nextScheduledAt: null, // cron 6h belum ada di repo (deliverable #8: TODO manual trigger)
        });
    } catch (error) {
        console.error("Error fetching HRIS sync status:", error);
        return NextResponse.json({ error: "Failed to fetch HRIS sync status" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        // Body optional: { full?: boolean } — default incremental (hanya yang belum/jarang sync)
        const body = await request.json().catch(() => null);
        const full = Boolean(body?.full);

        const result = await runHrisSync({ full });

        // Simpan lastSyncAt di config singleton (per-run timestamp) — include baseUrl/apiKey just in case
        await prisma.hrisGatewayConfig.upsert({
            where: { id: 1 },
            update: { lastSyncAt: new Date() },
            create: { id: 1, baseUrl: "", apiKeyEncrypted: "", enabled: false, lastSyncAt: new Date() },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "SYSTEM",
            action: "HRIS_SYNC_TRIGGERED",
            entityType: "HRIS",
            entityId: "sync",
            metadata: { full, totalProcessed: result.totalProcessed, updated: result.updated, deactivated: result.deactivated },
            request,
        }).catch(() => {});

        return NextResponse.json({
            ...result,
            jobId: `sync-${Date.now()}`,
            nextSyncAt: null,
        });
    } catch (error) {
        console.error("HRIS sync error:", error);
        return NextResponse.json({ error: "Failed to run HRIS sync" }, { status: 500 });
    }
}