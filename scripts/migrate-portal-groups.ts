/**
 * Migration script: PortalApp.category → PortalGroup
 *
 * Idempotent — safe to run multiple times.
 * - Creates PortalGroup per unique non-null category
 * - Links apps via PortalGroupApp
 * - Does NOT modify or delete existing PortalUserAppAccess (direct overrides preserved)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("=== Portal Groups Migration ===\n");

    // 1. Get all unique non-null categories
    const categories = await prisma.portalApp.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ["category"],
    });

    const uniqueCategories = categories
        .map((c) => c.category!)
        .filter(Boolean);

    console.log(`Found ${uniqueCategories.length} unique categories: ${uniqueCategories.join(", ") || "(none)"}\n`);

    let groupsCreated = 0;
    let appsLinked = 0;

    // 2. For each category, upsert group + link apps
    for (const categoryName of uniqueCategories) {
        // Upsert group (idempotent)
        const group = await prisma.portalGroup.upsert({
            where: { name: categoryName },
            update: {}, // no-op if exists
            create: { name: categoryName },
        });

        // Check if this was a new group (createdAt within last 2 seconds)
        const isNew = group.createdAt.getTime() > Date.now() - 2000;
        if (isNew) {
            groupsCreated++;
            console.log(`  [CREATE] Group: "${categoryName}" (${group.id})`);
        } else {
            console.log(`  [EXIST]  Group: "${categoryName}" (${group.id})`);
        }

        // Get all apps in this category
        const apps = await prisma.portalApp.findMany({
            where: { category: categoryName },
            select: { id: true, name: true },
        });

        // Link apps to group (upsert each, idempotent)
        for (const app of apps) {
            const existing = await prisma.portalGroupApp.findUnique({
                where: { groupId_appId: { groupId: group.id, appId: app.id } },
            });

            if (!existing) {
                await prisma.portalGroupApp.create({
                    data: { groupId: group.id, appId: app.id },
                });
                appsLinked++;
                console.log(`    [LINK]  App: "${app.name}" → Group: "${categoryName}"`);
            } else {
                console.log(`    [EXIST] App: "${app.name}" already in group`);
            }
        }
    }

    // 3. Summary
    const totalGroups = await prisma.portalGroup.count();
    const totalLinks = await prisma.portalGroupApp.count();
    const totalDirectAccess = await prisma.portalUserAppAccess.count();

    console.log("\n=== Migration Summary ===");
    console.log(`Groups created this run : ${groupsCreated}`);
    console.log(`Apps linked this run    : ${appsLinked}`);
    console.log(`Total groups            : ${totalGroups}`);
    console.log(`Total group-app links   : ${totalLinks}`);
    console.log(`Direct access preserved : ${totalDirectAccess} (untouched)`);
    console.log(`Users affected          : 0 (access unchanged)`);
    console.log("\nMigration complete.");
}

main()
    .catch((e) => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
