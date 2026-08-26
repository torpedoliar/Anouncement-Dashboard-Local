import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { checkAllPortalAppsHealth, checkAppHealth } from "@/lib/portal-health";
import prisma from "@/lib/prisma";

// POST /api/portal-apps/health-check - Trigger on-demand health check (Admin only or system)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { appId } = body;

        if (appId) {
            const app = await prisma.portalApp.findUnique({
                where: { id: appId },
                select: { id: true, name: true, url: true, loginUrl: true, healthStatus: true },
            });
            if (!app) {
                return NextResponse.json({ error: "Aplikasi tidak ditemukan" }, { status: 404 });
            }
            const result = await checkAppHealth(app);
            return NextResponse.json({ message: "Health check selesai", result });
        }

        const summary = await checkAllPortalAppsHealth();
        return NextResponse.json({ message: "Pemeriksaan kesehatan semua aplikasi selesai", summary });
    } catch (error) {
        console.error("POST /api/portal-apps/health-check error:", error);
        return NextResponse.json({ error: "Gagal menjalankan health check" }, { status: 500 });
    }
}

// GET /api/portal-apps/health-check - Get current status for all active apps
export async function GET() {
    try {
        // Bisa diakses oleh portal user yang login untuk real-time badges
        const portalSession = await getServerSession(portalAuthOptions);
        const adminSession = await getServerSession(authOptions);

        if (!portalSession?.user?.id && !adminSession?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const apps = await prisma.portalApp.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                slug: true,
                healthStatus: true,
                healthStatusCode: true,
                healthLatencyMs: true,
                healthCheckedAt: true,
                healthError: true,
            },
            orderBy: { displayOrder: "asc" },
        });

        const onlineCount = apps.filter((a) => a.healthStatus === "ONLINE").length;
        const degradedCount = apps.filter((a) => a.healthStatus === "DEGRADED").length;
        const offlineCount = apps.filter((a) => a.healthStatus === "OFFLINE").length;

        return NextResponse.json({
            apps,
            stats: {
                total: apps.length,
                online: onlineCount,
                degraded: degradedCount,
                offline: offlineCount,
            },
        });
    } catch (error) {
        console.error("GET /api/portal-apps/health-check error:", error);
        return NextResponse.json({ error: "Gagal mengambil status kesehatan aplikasi" }, { status: 500 });
    }
}
