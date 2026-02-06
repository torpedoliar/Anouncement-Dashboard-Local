/**
 * Quick Fix Script - Mark Baseline Migration
 * This is a simpler alternative to the full mark-baseline-applied.ts
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickMark() {
    try {
        console.log('🔧 Quick baseline marking...');

        // Check if table exists
        const tableCheck = await prisma.$queryRawUnsafe(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = '_prisma_migrations'
            );
        `);

        console.log('Table exists:', tableCheck);

        // Mark baseline  
        await prisma.$executeRawUnsafe(`
            INSERT INTO "_prisma_migrations" 
            (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
            VALUES 
            (
                gen_random_uuid(),
                '8d225ed9e0673177',
                NOW(),
                '20260206000000_baseline_multisite',
                NULL,
                NULL,
                NOW(),
                1
            )
            ON CONFLICT (migration_name) DO NOTHING;
        `);

        console.log('✅ Baseline marked!');

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

quickMark();
