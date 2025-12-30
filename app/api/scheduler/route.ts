import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/scheduler
// This endpoint should be called by cron job every minute
// It handles:
// 1. Auto-publish: scheduledAt <= now AND isPublished = false
// 2. Auto-takedown: takedownAt <= now AND isPublished = true

export async function GET(request: Request) {
    try {
        // Verify cron secret (required for security)
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        // CRON_SECRET must be configured
        if (!cronSecret) {
            console.error("[Scheduler] CRON_SECRET not configured");
            return NextResponse.json(
                { error: "Scheduler not configured. Set CRON_SECRET in environment." },
                { status: 500 }
            );
        }

        // Validate authorization header
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const now = new Date();
        let publishedCount = 0;
        let takenDownCount = 0;

        // 1. Auto-publish announcements
        const toPublish = await prisma.announcement.findMany({
            where: {
                isPublished: false,
                scheduledAt: {
                    lte: now,
                    not: null,
                },
            },
        });

        for (const announcement of toPublish) {
            await prisma.announcement.update({
                where: { id: announcement.id },
                data: {
                    isPublished: true,
                    scheduledAt: null, // Clear schedule after publishing
                },
            });
            publishedCount++;
            console.log(`[Scheduler] Auto-published: ${announcement.title}`);
        }

        // 2. Auto-takedown announcements
        const toTakedown = await prisma.announcement.findMany({
            where: {
                isPublished: true,
                takedownAt: {
                    lte: now,
                    not: null,
                },
            },
        });

        for (const announcement of toTakedown) {
            await prisma.announcement.update({
                where: { id: announcement.id },
                data: {
                    isPublished: false,
                    takedownAt: null, // Clear takedown date
                },
            });
            takenDownCount++;
            console.log(`[Scheduler] Auto-takedown: ${announcement.title}`);
        }

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            published: publishedCount,
            takenDown: takenDownCount,
            message: `Published: ${publishedCount}, Taken down: ${takenDownCount}`,
        });
    } catch (error) {
        console.error("[Scheduler] Error:", error);
        return NextResponse.json(
            { error: "Scheduler failed" },
            { status: 500 }
        );
    }
}
