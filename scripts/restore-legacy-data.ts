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

    // 2. Read Backup File
    const backupPath = path.join(process.cwd(), BACKUP_FILE);
    if (!fs.existsSync(backupPath)) {
        console.error(`❌ Backup file not found: ${backupPath}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(backupPath, 'utf-8');
    const lines = fileContent.split('\n');
    console.log(`📂 Read backup file: ${lines.length} lines`);

    let restoreStats = {
        categories: 0,
        announcements: 0,
        relationships: 0
    };

    // 3. Process Categories
    // Parsing COPY public.categories (id, name, slug, color, "order", "createdAt")
    console.log("🔄 Restoring Categories...");
    let inCategories = false;
    for (const line of lines) {
        if (line.startsWith('COPY public.categories')) {
            inCategories = true;
            continue;
        }
        if (inCategories && line.trim() === '\\.') {
            inCategories = false;
            break;
        }
        if (inCategories && line.trim()) {
            const cols = line.split('\t');
            if (cols.length < 6) continue;

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
                } else {
                    // console.log(`Skipping existing category: ${name}`);
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
        if (line.startsWith('COPY public.announcements')) {
            inAnnouncements = true;
            continue;
        }
        if (inAnnouncements && line.trim() === '\\.') {
            inAnnouncements = false;
            break;
        }
        if (inAnnouncements && line.trim()) {
            // Split by tab
            const cols = line.split('\t');
            // Ensure we have enough columns (approx 21 based on dumps)
            if (cols.length < 15) continue;

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
                        // authorId: val(authorId) // Skip author for safety
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
    console.log(`📊 Categories Restored: ${restoreStats.categories}`);
    console.log(`📊 Announcements Restored: ${restoreStats.announcements}`);
    console.log(`🔗 Site Links Created:   ${restoreStats.relationships}`);
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
