/**
 * Backfill ActivityLog → AuditLog
 *
 * One-time, idempotent script. Run after migration:
 *   npx tsx scripts/backfill-audit-log.ts
 *
 * Maps old ActivityLog entries to new AuditLog format.
 * Skips already-backfilled entries (checks metadata.backfilled).
 */

import { PrismaClient, AuditCategory } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, AuditCategory> = {
    ANNOUNCEMENT: "CONTENT",
    CATEGORY: "CONTENT",
    COMMENT: "CONTENT",
    USER: "USER_MGMT",
    USER_SESSION: "AUTH",
    SETTINGS: "CONFIG",
    EMAIL_SETTINGS: "CONFIG",
    SYSTEM: "SYSTEM",
};

async function main() {
    const oldLogs = await prisma.activityLog.findMany({
        orderBy: { createdAt: "asc" },
    });

    console.log(`Backfill ${oldLogs.length} ActivityLog → AuditLog...`);

    let count = 0;
    let skipped = 0;

    for (const log of oldLogs) {
        // Check if already backfilled (idempotent)
        const existing = await prisma.auditLog.findFirst({
            where: {
                actorType: "ADMIN_USER",
                actorId: log.userId,
                action: log.action,
                entityType: log.entityType,
                createdAt: log.createdAt,
                metadata: {
                    path: ["backfilled"],
                    equals: true,
                },
            },
        });

        if (existing) {
            skipped++;
            continue;
        }

        await prisma.auditLog.create({
            data: {
                actorType: "ADMIN_USER",
                actorId: log.userId,
                category: CATEGORY_MAP[log.entityType] || "SYSTEM",
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                outcome: "SUCCESS",
                changes: log.changes,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                severity: log.severity || "INFO",
                siteId: log.siteId,
                createdAt: log.createdAt,
                metadata: { backfilled: true, originalId: log.id },
            },
        });
        count++;
    }

    console.log(`✓ Backfill selesai: ${count} baris di-insert, ${skipped} baris di-skip (sudah ada)`);
}

main()
    .catch((e) => {
        console.error("Backfill gagal:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
