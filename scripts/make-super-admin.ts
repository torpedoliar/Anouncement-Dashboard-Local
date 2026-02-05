/**
 * Script to make admin@example.com a Super Admin
 * Run with: npx tsx scripts/make-super-admin.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@example.com';

    const user = await prisma.user.update({
        where: { email },
        data: {
            isSuperAdmin: true,
            role: 'ADMIN'
        },
    });

    console.log(`✅ User ${user.email} is now a Super Admin`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   isSuperAdmin: ${user.isSuperAdmin}`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
