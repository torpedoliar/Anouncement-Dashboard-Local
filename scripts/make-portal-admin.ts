/**
 * Promote a portal user to PORTAL_ADMIN role.
 * Usage: npx tsx scripts/make-portal-admin.ts <email>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage: npx tsx scripts/make-portal-admin.ts <email>");
        process.exit(1);
    }

    const user = await prisma.portalUser.findUnique({ where: { email } });
    if (!user) {
        console.error(`Portal user ${email} tidak ditemukan.`);
        process.exit(1);
    }

    await prisma.portalUser.update({
        where: { id: user.id },
        data: { role: "PORTAL_ADMIN" },
    });

    console.log(`✓ ${email} sekarang PORTAL_ADMIN`);
}

main()
    .catch((e) => {
        console.error("Error:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
