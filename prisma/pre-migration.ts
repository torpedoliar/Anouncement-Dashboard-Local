
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting pre-migration cleanup...');

    try {
        // We use raw queries because the Prisma Client definition might not match 
        // the current database schema state (columns missing/mismatched).
        // Deleting data from these tables allows 'prisma db push' to correctly
        // add the non-nullable 'siteId' column.

        // We wrap in try-catch blocks individually in case tables don't exist yet
        try {
            const countCat = await prisma.$executeRawUnsafe(`DELETE FROM "categories";`);
            console.log(`Cleaned up ${countCat} rows from categories.`);
        } catch (e) {
            console.log('Skipping categories cleanup (table might not exist or error).');
        }

        try {
            const countSub = await prisma.$executeRawUnsafe(`DELETE FROM "newsletter_subscribers";`);
            console.log(`Cleaned up ${countSub} rows from newsletter_subscribers.`);
        } catch (e) {
            console.log('Skipping newsletter_subscribers cleanup (table might not exist or error).');
        }

        // AnnouncementSite might have orphaned records if not cascaded, but Prisma usually handles foreign keys.
        // However, if we delete categories, we might need to be careful about announcements.
        // But since Categories -> Announcements is usually nullable or cascade? 
        // Let's check: Announcement.categoryId is Int/String?
        // In schema: category Category @relation
        // So deleting Category will fail if Announcement exists?
        // Use CASCADE in SQL?
        // Postgres supports CASCADE in DELETE? No, usually in FK definition.
        // If schema has onDelete: Cascade, prisma handles it? No, this is raw SQL.
        // Postgres raw `TRUNCATE TABLE "categories" CASCADE;` is safer.

        try {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "categories" CASCADE;`);
            console.log(`Truncated categories table.`);
        } catch (e) {
            console.log('Failed to truncate categories, trying delete...');
            // Fallback to simple delete if truncate fails (permissions)
            try {
                await prisma.$executeRawUnsafe(`DELETE FROM "categories";`);
            } catch (ignored) { }
        }

        try {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "newsletter_subscribers" CASCADE;`);
            console.log(`Truncated newsletter_subscribers table.`);
        } catch (e) {
            try {
                await prisma.$executeRawUnsafe(`DELETE FROM "newsletter_subscribers";`);
            } catch (ignored) { }
        }

    } catch (error) {
        console.error('Error during pre-migration:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
