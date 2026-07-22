import prisma from "@/lib/prisma";
import { maybeSendNewArticleEmails } from "@/lib/email";
import { logAudit } from "@/lib/audit";

let lastCheck = 0;
const CHECK_INTERVAL = 60000; // Minimum 60s between throttled (render-triggered) runs

export interface SchedulerResult {
    published: number;
    takenDown: number;
    ran: boolean;
}

/**
 * Internal scheduler: auto-publishes (scheduledAt <= now) and auto-takes-down
 * (takedownAt <= now) announcements.
 *
 * Two call sites:
 *  - The admin dashboard render calls it throttled (best-effort, keeps things
 *    moving when no external cron is configured).
 *  - GET /api/scheduler calls it with { force: true } from a real cron job for
 *    reliable, time-accurate execution.
 *
 * On auto-publish it also fires the "new article" newsletter (idempotent) and
 * writes an ActivityLog entry so runs are auditable.
 */
export async function runScheduler(options: { force?: boolean } = {}): Promise<SchedulerResult> {
    const now = Date.now();

    if (!options.force && now - lastCheck < CHECK_INTERVAL) {
        return { published: 0, takenDown: 0, ran: false };
    }
    lastCheck = now;

    const currentTime = new Date();
    let publishedCount = 0;
    let takenDownCount = 0;

    try {
        // 1. Auto-publish
        const toPublish = await prisma.announcement.findMany({
            where: {
                isPublished: false,
                scheduledAt: { lte: currentTime, not: null },
            },
            select: { id: true, title: true },
        });

        for (const announcement of toPublish) {
            await prisma.announcement.update({
                where: { id: announcement.id },
                data: { isPublished: true, scheduledAt: null },
            });
            publishedCount++;
            console.log(`[Scheduler] Auto-published: ${announcement.title}`);

            // Fire the newsletter for the now-published article (idempotent)
            await maybeSendNewArticleEmails(announcement.id).catch((err) =>
                console.error("[Scheduler] Auto-send failed:", err)
            );
        }

        // 2. Auto-takedown
        const toTakedown = await prisma.announcement.findMany({
            where: {
                isPublished: true,
                takedownAt: { lte: currentTime, not: null },
            },
            select: { id: true, title: true },
        });

        for (const announcement of toTakedown) {
            await prisma.announcement.update({
                where: { id: announcement.id },
                data: { isPublished: false, takedownAt: null },
            });
            takenDownCount++;
            console.log(`[Scheduler] Auto-takedown: ${announcement.title}`);
        }

        // Audit log when anything happened. ActivityLog.userId is a required FK,
        // so attribute the system run to the first SuperAdmin (skip if none exists).
        if (publishedCount > 0 || takenDownCount > 0) {
            console.log(`[Scheduler] Completed: ${publishedCount} published, ${takenDownCount} taken down`);
            try {
                const sysUser = await prisma.user.findFirst({
                    where: { isSuperAdmin: true },
                    select: { id: true },
                });
                if (sysUser) {
                    await prisma.activityLog.create({
                        data: {
                            action: "SCHEDULER_RUN",
                            entityType: "SYSTEM",
                            entityId: "scheduler",
                            severity: "INFO",
                            userId: sysUser.id,
                            changes: JSON.stringify({ published: publishedCount, takenDown: takenDownCount }),
                        },
                    });
                }
            } catch (logErr) {
                console.error("[Scheduler] Failed to write activity log:", logErr);
            }

            // Audit trail (SYSTEM actor, no userId needed)
            await logAudit({
                actorType: "SYSTEM",
                category: "SYSTEM",
                action: "SCHEDULER_RUN",
                entityType: "SYSTEM",
                entityId: "scheduler",
                metadata: { published: publishedCount, takenDown: takenDownCount },
            });
        }

        // 3. Audit retention purge
        const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || "365");
        if (retentionDays > 0) {
            const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            try {
                const purged = await prisma.auditLog.deleteMany({
                    where: { createdAt: { lt: cutoff } },
                });
                if (purged.count > 0) {
                    console.log(`[Scheduler] Audit retention: purged ${purged.count} logs older than ${retentionDays} days`);
                    await logAudit({
                        actorType: "SYSTEM",
                        category: "SYSTEM",
                        action: "AUDIT_RETENTION_PURGE",
                        entityType: "AUDIT_LOG",
                        outcome: "SUCCESS",
                        metadata: { purgedCount: purged.count, retentionDays },
                    });
                }
            } catch (purgeErr) {
                console.error("[Scheduler] Audit retention purge failed:", purgeErr);
            }
        }
    } catch (error) {
        console.error("[Scheduler] Error:", error);
    }

    return { published: publishedCount, takenDown: takenDownCount, ran: true };
}
