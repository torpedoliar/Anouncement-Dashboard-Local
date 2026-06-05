import { NextResponse } from "next/server";
import { runScheduler } from "@/lib/scheduler";

// GET /api/scheduler
// Call this from a real cron job every minute for reliable, time-accurate
// publish/takedown (the admin-render trigger is only best-effort).
//
// Example (crontab):
//   * * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/scheduler
export async function GET(request: Request) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            console.error("[Scheduler] CRON_SECRET not configured");
            return NextResponse.json(
                { error: "Scheduler not configured. Set CRON_SECRET in environment." },
                { status: 500 }
            );
        }

        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // force: bypass the render-throttle so cron always runs on schedule
        const result = await runScheduler({ force: true });

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            published: result.published,
            takenDown: result.takenDown,
            message: `Published: ${result.published}, Taken down: ${result.takenDown}`,
        });
    } catch (error) {
        console.error("[Scheduler] Error:", error);
        return NextResponse.json({ error: "Scheduler failed" }, { status: 500 });
    }
}
