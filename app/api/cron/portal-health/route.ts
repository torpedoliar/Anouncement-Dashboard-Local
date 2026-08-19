import { NextRequest, NextResponse } from "next/server";
import { checkAllPortalAppsHealth } from "@/lib/portal-health";

// GET /api/cron/portal-health - Periodic background health check (bisa dipanggil scheduler / cron)
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        // Jika CRON_SECRET disetel, verifikasi bearer token
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            // Izinkan juga jika berasal dari internal localhost / dev loop
            const forwardedFor = request.headers.get("x-forwarded-for") || "";
            const host = request.headers.get("host") || "";
            if (!host.includes("localhost") && !host.includes("127.0.0.1") && !forwardedFor.includes("127.0.0.1")) {
                return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
            }
        }

        const summary = await checkAllPortalAppsHealth();
        return NextResponse.json({
            status: "success",
            timestamp: new Date().toISOString(),
            summary: {
                totalApps: summary.totalApps,
                online: summary.onlineCount,
                degraded: summary.degradedCount,
                offline: summary.offlineCount,
                averageLatencyMs: summary.averageLatencyMs,
                globalUptimePercent: summary.globalUptimePercent,
            },
        });
    } catch (error: any) {
        console.error("Cron /api/cron/portal-health error:", error);
        return NextResponse.json({ error: "Failed to execute cron health check" }, { status: 500 });
    }
}
