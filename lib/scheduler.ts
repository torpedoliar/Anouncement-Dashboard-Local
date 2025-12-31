import prisma from "@/lib/prisma";

let lastCheck = 0;
const CHECK_INTERVAL = 60000; // Check every 60 seconds minimum

/**
 * Internal scheduler that checks for scheduled publish/takedown
 * Called automatically on API requests
 */
export async function runScheduler(): Promise<{
    published: number;
    takenDown: number;
}> {
    const now = Date.now();

    // Throttle: only run if 60 seconds have passed since last check
    if (now - lastCheck < CHECK_INTERVAL) {
        return { published: 0, takenDown: 0 };
    }

    lastCheck = now;
    const currentTime = new Date();
    let publishedCount = 0;
    let takenDownCount = 0;

    try {
        // 1. Auto-publish: scheduledAt <= now AND isPublished = false
        const toPublish = await prisma.announcement.findMany({
            where: {
                isPublished: false,
                scheduledAt: {
                    lte: currentTime,
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
            console.log(`[Auto-Scheduler] Published: ${announcement.title}`);
        }

        // 2. Auto-takedown: takedownAt <= now AND isPublished = true
        const toTakedown = await prisma.announcement.findMany({
            where: {
                isPublished: true,
                takedownAt: {
                    lte: currentTime,
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
            console.log(`[Auto-Scheduler] Takedown: ${announcement.title}`);
        }

        if (publishedCount > 0 || takenDownCount > 0) {
            console.log(`[Auto-Scheduler] Completed: ${publishedCount} published, ${takenDownCount} taken down`);
        }
    } catch (error) {
        console.error("[Auto-Scheduler] Error:", error);
    }

    return { published: publishedCount, takenDown: takenDownCount };
}
