/**
 * Promote a portal user to PORTAL_ADMIN role.
 * Usage: npx tsx scripts/make-portal-admin.ts <nik>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const nik = process.argv[2];
    if (!nik) {
        console.error("Usage: npx tsx scripts/make-portal-admin.ts <nik>");
        process.exit(1);
    }

    const user = await prisma.portalUser.findUnique({ where: { nik } });
    if (!user) {
        console.error(`Portal user ${nik} tidak ditemukan.`);
        process.exit(1);
    }

    await prisma.portalUser.update({
        where: { id: user.id },
        data: { role: "PORTAL_ADMIN" },
    });

    console.log(`✓ ${nik} sekarang PORTAL_ADMIN`);
}

main()
    .catch((e) => {
        console.error("Error:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
