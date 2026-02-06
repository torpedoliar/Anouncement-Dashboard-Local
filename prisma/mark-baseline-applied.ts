/**
 * Script to Mark Baseline Migration as Applied
 * 
 * PURPOSE:
 * Creates a baseline migration record without executing the migration SQL.
 * This is needed because the current production database already matches
 * the schema, so we only need to mark it as "already migrated" to establish
 * migration history.
 * 
 * SAFETY:
 * - Does NOT modify any tables or data
 * - Only inserts a record into _prisma_migrations table
 * - Uses ON CONFLICT DO NOTHING to prevent duplicates
 * 
 * USAGE:
 * npx tsx prisma/mark-baseline-applied.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Looking for baseline migration...');

    // Find the baseline migration directory
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const migrations = fs.readdirSync(migrationsDir);
    const baselineMigration = migrations.find(m => m.includes('baseline'));

    if (!baselineMigration) {
        console.error('❌ Baseline migration not found!');
        console.log('Available migrations:', migrations);
        throw new Error('Baseline migration not found. Please create it first with: npx prisma migrate dev --name baseline_multisite --create-only');
    }

    console.log(`✅ Found baseline migration: ${baselineMigration}`);

    // Read the migration.sql file to calculate checksum
    const migrationSqlPath = path.join(migrationsDir, baselineMigration, 'migration.sql');
    const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

    // Calculate simple checksum (Prisma uses SHA256 of migration SQL)
    const crypto = require('crypto');
    const checksum = crypto.createHash('sha256').update(migrationSql).digest('hex');

    console.log(`📝 Migration checksum: ${checksum.substring(0, 16)}...`);

    // Check if migration already exists
    const existing = await prisma.$queryRawUnsafe(`
        SELECT * FROM "_prisma_migrations" 
        WHERE migration_name = '${baselineMigration}'
    `);

    if (Array.isArray(existing) && existing.length > 0) {
        console.log('⚠️  Migration already marked as applied. Skipping.');
        return;
    }

    // Mark migration as applied
    console.log('📥 Marking migration as applied...');

    await prisma.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations" 
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES 
        (
            gen_random_uuid(), 
            '${checksum}', 
            NOW(), 
            '${baselineMigration}', 
            NULL, 
            NULL, 
            NOW(), 
            1
        )
        ON CONFLICT (migration_name) DO NOTHING;
    `);

    console.log('✅ Baseline migration successfully marked as applied!');
    console.log('');
    console.log('📊 Migration status:');

    const status = await prisma.$queryRawUnsafe(`
        SELECT migration_name, finished_at, applied_steps_count 
        FROM "_prisma_migrations" 
        ORDER BY finished_at DESC 
        LIMIT 5
    `);

    console.table(status);
}

main()
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
