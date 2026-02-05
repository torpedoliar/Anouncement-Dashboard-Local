const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuration
const BACKUP_FILE = process.argv[2] || 'db_backup_20260205_093159.sql';

/**
 * Main Restoration Function
 */
async function restoreLegacyData() {
    console.log("🚀 Starting Legacy Data Restoration...");

    // 1. Get Default Site
    const defaultSite = await prisma.site.findFirst({
        where: { isDefault: true }
    });

    if (!defaultSite) {
        console.error("❌ No Default Site found! Please run seed script first.");
        process.exit(1);
    }
    console.log(`✅ Default Site Found: ${defaultSite.name} (${defaultSite.id})`);

    // 2. Get Default Author (SuperAdmin)
    const defaultAuthor = await prisma.user.findFirst({
        where: { email: 'admin@example.com' } // Ensure this matches seed.ts
    });

    if (!defaultAuthor) {
        console.warn("⚠️ No Default Author (admin@example.com) found. Authors will be null.");
    } else {
        console.log(`✅ Default Author Found: ${defaultAuthor.name} (${defaultAuthor.id})`);
    }

    // 2. Read Backup File
    const backupPath = path.join(process.cwd(), BACKUP_FILE);
    if (!fs.existsSync(backupPath)) {
        console.error(`❌ Backup file not found: ${backupPath}`);
        process.exit(1);
    }

    // Read as buffer first to detect encoding
    const buffer = fs.readFileSync(backupPath);
    let fileContent = buffer.toString('utf-8');

    // Check for UTF-16 LE (Common in PowerShell dumps) - Null bytes validation
    if (buffer.includes(0x00)) {
        console.log("⚠️ Detected UTF-16 LE encoding. Switching decoder...");
        fileContent = buffer.toString('ucs2');
    }

    // Normalize newlines and split
    const lines = fileContent.replace(/\r\n/g, '\n').split('\n');
    console.log(`📂 Read backup file: ${lines.length} lines`);

    categories: 0,
        announcements: 0,
            relationships: 0,
                comments: 0
};

// 3. Process Categories
// Parsing COPY public.categories (id, name, slug, color, "order", "createdAt")
console.log("🔄 Restoring Categories...");
let inCategories = false;
for (const line of lines) {
    if (line.includes('COPY public.categories')) {
        console.log("  -> Found Categories block!");
        inCategories = true;
        continue;
    }
    if (inCategories && line.trim() === '\\.') {
        console.log("  -> End of Categories block.");
        inCategories = false;
        break;
    }
    if (inCategories && line.trim()) {
        const cols = line.split('\t');
        if (cols.length < 6) {
            console.warn("  -> Skipping invalid category line (cols < 6):", line.substring(0, 50));
            continue;
        }

        const [id, name, slug, color, orderStr, createdAt] = cols;

        // Clean up values (\N -> null)
        const cleanSlug = slug === '\\N' ? `category-${Date.now()}` : slug;

        try {
            // Check if exists
            let cat = await prisma.category.findFirst({
                where: { id: id }
            });

            if (!cat) {
                await prisma.category.create({
                    data: {
                        id,
                        name,
                        slug: cleanSlug,
                        color: color === '\\N' ? '#ED1C24' : color,
                        order: parseInt(orderStr) || 0,
                        createdAt: new Date(createdAt === '\\N' ? new Date() : createdAt),
                        siteId: defaultSite.id // Inject Site ID
                    }
                });
                restoreStats.categories++;
                console.log(`  -> Restored Category: ${name}`);
            } else {
                console.log(`  -> Skipped existing category: ${name} (${id})`);
            }
        } catch (err: any) {
            console.error(`Error restoring category ${name}:`, err.message);
        }
    }
}

// 4. Process Announcements
// Parsing COPY public.announcements (..., wordCount, ...)
console.log("🔄 Restoring Announcements...");
let inAnnouncements = false;
for (const line of lines) {
    if (line.includes('COPY public.announcements')) {
        console.log("  -> Found Announcements block!");
        inAnnouncements = true;
        continue;
    }
    if (inAnnouncements && line.trim() === '\\.') {
        console.log("  -> End of Announcements block.");
        inAnnouncements = false;
        break;
    }
    if (inAnnouncements && line.trim()) {
        // Split by tab
        const cols = line.split('\t');
        // Ensure we have enough columns (approx 21 based on dumps)
        // Reduced strictness for debug
        if (cols.length < 10) {
            console.warn("  -> Skipping invalid announcement line (cols < 10):", line.substring(0, 50));
            continue;
        }

        // Map columns based on backup structure (Updated with wordCount at index 15)
        // id(0), title(1), slug(2), excerpt(3), content(4), imagePath(5), videoPath(6), videoType(7), youtubeUrl(8), isPinned(9), isHero(10), isPublished(11), scheduledAt(12), takedownAt(13), viewCount(14), wordCount(15), createdAt(16), updatedAt(17), draftContent(18), draftUpdatedAt(19), categoryId(20), authorId(21)

        const [
            id, title, slug, excerpt, content, imagePath,
            videoPath, videoType, youtubeUrl, isPinned, isHero, isPublished,
            scheduledAt, takedownAt, viewCount, wordCount, createdAt, updatedAt,
            draftContent, draftUpdatedAt, categoryId, authorId
        ] = cols;

        // Helper to clean values
        const val = (v: any) => (v === '\\N' ? null : v);
        const boolVal = (v: any) => (v === 't');
        const dateVal = (v: any) => (v === '\\N' ? null : new Date(v));
        const intVal = (v: any) => (v === '\\N' ? 0 : parseInt(v));

        try {
            // Upsert Announcement
            await prisma.announcement.upsert({
                where: { id: id },
                update: {}, // Don't update if exists
                create: {
                    id,
                    title,
                    slug,
                    excerpt: val(excerpt),
                    content: val(content) || "",
                    imagePath: val(imagePath),
                    videoPath: val(videoPath),
                    videoType: val(videoType),
                    youtubeUrl: val(youtubeUrl),
                    isPinned: boolVal(isPinned),
                    isHero: boolVal(isHero),
                    isPublished: boolVal(isPublished),
                    scheduledAt: dateVal(scheduledAt),
                    takedownAt: dateVal(takedownAt),
                    viewCount: intVal(viewCount),
                    wordCount: intVal(wordCount),
                    createdAt: dateVal(createdAt) || new Date(),
                    updatedAt: dateVal(updatedAt) || new Date(),
                    draftContent: val(draftContent),
                    draftUpdatedAt: dateVal(draftUpdatedAt),
                    categoryId: categoryId,
                    categoryId: categoryId,
                    authorId: defaultAuthor ? defaultAuthor.id : undefined // Link to SuperAdmin
                }
            });

            restoreStats.announcements++;
            if (restoreStats.announcements === 1) {
                console.log(`ℹ️ First restored announcement: [${id}] ${title}`);
            }

            // Link to Default Site (The Multi-Site Magic)
            const existingLink = await prisma.announcementSite.findUnique({
                where: {
                    announcementId_siteId: {
                        announcementId: id,
                        siteId: defaultSite.id
                    }
                }
            });

            if (!existingLink) {
                await prisma.announcementSite.create({
                    data: {
                        announcementId: id,
                        siteId: defaultSite.id,
                        isPrimary: true, // Legacy content is primary
                        publishedAt: dateVal(createdAt) || new Date()
                    }
                });
                restoreStats.relationships++;
            }

        } catch (err: any) {
            console.error(`Error restoring announcement ${id} (${title}):`, err.message);
            if (err && err.message && err.message.includes("Foreign key constraint failed")) {
                console.warn("  -> Likely missing Category. Skipping.");
            }
        }
    }
}

console.log("\n=================================");
console.log("✅ RESTORATION COMPLETE");
console.log(`📊 Categories Restored:    ${restoreStats.categories}`);
console.log(`📊 Announcements Restored: ${restoreStats.announcements}`);
console.log(`📊 Comments Restored:      ${restoreStats.comments}`);
console.log(`🔗 Site Links Created:     ${restoreStats.relationships}`);
console.log("=================================\n");
}

restoreLegacyData()
    .catch((e: any) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
