const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_FILE = process.argv[2] || 'db_backup_20260205_093159.sql';

async function restoreLegacyData() {
    console.log("🚀 Starting Legacy Data Restoration...");

    // Get default site
    const defaultSite = await prisma.site.findFirst({ where: { isDefault: true } });
    if (!defaultSite) {
        console.error("❌ No Default Site found!");
        process.exit(1);
    }
    console.log(`✅ Default Site: ${defaultSite.name}`);

    // Get default author
    const defaultAuthor = await prisma.user.findFirst({ where: { email: 'admin@example.com' } });
    if (!defaultAuthor) {
        console.warn("⚠️ No default author found.");
    } else {
        console.log(`✅ Default Author: ${defaultAuthor.name}`);
    }

    // Read backup file
    const backupPath = path.join(process.cwd(), BACKUP_FILE);
    if (!fs.existsSync(backupPath)) {
        console.error(`❌ Backup file not found: ${backupPath}`);
        process.exit(1);
    }

    const buffer = fs.readFileSync(backupPath);
    let fileContent = buffer.includes(0x00) ? buffer.toString('ucs2') : buffer.toString('utf-8');
    const lines = fileContent.replace(/\r\n/g, '\n').split('\n');
    console.log(`📂 Read ${lines.length} lines`);

    const stats = { categories: 0, announcements: 0, comments: 0, links: 0 };

    // Process categories
    console.log("🔄 Restoring Categories...");
    let inCat = false;
    for (const line of lines) {
        if (line.includes('COPY public.categories')) { inCat = true; continue; }
        if (inCat && line.trim() === '\\.') { inCat = false; break; }
        if (inCat && line.trim()) {
            const [id, name, slug, color, orderStr, createdAt] = line.split('\t');
            try {
                const exists = await prisma.category.findUnique({ where: { id } });
                if (!exists) {
                    await prisma.category.create({
                        data: {
                            id,
                            name,
                            slug: slug === '\\N' ? `cat-${Date.now()}` : slug,
                            color: color === '\\N' ? '#ED1C24' : color,
                            order: parseInt(orderStr) || 0,
                            createdAt: new Date(createdAt === '\\N' ? new Date() : createdAt),
                            siteId: defaultSite.id
                        }
                    });
                    stats.categories++;
                }
            } catch (err) {
                console.error(`Error restoring category ${name}:`, err.message);
            }
        }
    }

    // Process announcements
    console.log("🔄 Restoring Announcements...");
    let inAnn = false;
    for (const line of lines) {
        if (line.includes('COPY public.announcements')) { inAnn = true; continue; }
        if (inAnn && line.trim() === '\\.') { inAnn = false; break; }
        if (inAnn && line.trim()) {
            const cols = line.split('\t');
            if (cols.length < 10) continue;

            const [id, title, slug, excerpt, content, imagePath, videoPath, videoType, youtubeUrl, isPinned, isHero,
                isPublished, scheduledAt, takedownAt, viewCount, wordCount, createdAt, updatedAt,
                draftContent, draftUpdatedAt, categoryId] = cols;

            const val = v => v === '\\N' ? null : v;
            const bool = v => v === 't';
            const date = v => v === '\\N' ? null : new Date(v);
            const int = v => v === '\\N' ? 0 : parseInt(v);

            try {
                await prisma.announcement.upsert({
                    where: { id },
                    update: {},
                    create: {
                        id, title, slug,
                        excerpt: val(excerpt),
                        content: val(content) || "",
                        imagePath: val(imagePath),
                        videoPath: val(videoPath),
                        videoType: val(videoType),
                        youtubeUrl: val(youtubeUrl),
                        isPinned: bool(isPinned),
                        isHero: bool(isHero),
                        isPublished: bool(isPublished),
                        scheduledAt: date(scheduledAt),
                        takedownAt: date(takedownAt),
                        viewCount: int(viewCount),
                        wordCount: int(wordCount),
                        createdAt: date(createdAt) || new Date(),
                        updatedAt: date(updatedAt) || new Date(),
                        draftContent: val(draftContent),
                        draftUpdatedAt: date(draftUpdatedAt),
                        categoryId,
                        authorId: defaultAuthor ? defaultAuthor.id : undefined
                    }
                });
                stats.announcements++;

                // Create site link
                const linkExists = await prisma.announcementSite.findUnique({
                    where: { announcementId_siteId: { announcementId: id, siteId: defaultSite.id } }
                });
                if (!linkExists) {
                    await prisma.announcementSite.create({
                        data: {
                            announcementId: id,
                            siteId: defaultSite.id,
                            isPrimary: true,
                            publishedAt: date(createdAt) || new Date()
                        }
                    });
                    stats.links++;
                }
            } catch (err) {
                console.error(`Error restoring announcement ${id}:`, err.message);
            }
        }
    }

    // Process comments
    console.log("🔄 Restoring Comments...");
    let inCom = false;
    for (const line of lines) {
        if (line.includes('COPY public.comments')) { inCom = true; continue; }
        if (inCom && line.trim() === '\\.') { inCom = false; break; }
        if (inCom && line.trim()) {
            const cols = line.split('\t');
            if (cols.length < 9) continue;

            const [id, announcementId, authorName, authorEmail, content, status, moderatedAt, moderatorId, parentId, createdAt] = cols;
            const val = v => v === '\\N' ? null : v;
            const date = v => v === '\\N' ? null : new Date(v);

            try {
                const annExists = await prisma.announcement.findUnique({ where: { id: announcementId } });
                if (!annExists) continue;

                await prisma.comment.upsert({
                    where: { id },
                    update: {},
                    create: {
                        id,
                        announcementId,
                        authorName: val(authorName) || 'Anonymous',
                        authorEmail: val(authorEmail),
                        content: val(content) || '',
                        status: val(status) || 'PENDING',
                        moderatedAt: date(moderatedAt),
                        moderatorId: val(moderatorId),
                        parentId: val(parentId),
                        createdAt: date(createdAt) || new Date()
                    }
                });
                stats.comments++;
            } catch (err) {
                console.error(`Error restoring comment ${id}:`, err.message);
            }
        }
    }

    console.log("\n=================================");
    console.log("✅ RESTORATION COMPLETE");
    console.log(`📊 Categories: ${stats.categories}`);
    console.log(`📊 Announcements: ${stats.announcements}`);
    console.log(`📊 Comments: ${stats.comments}`);
    console.log(`🔗 Site Links: ${stats.links}`);
    console.log("=================================\n");
}

restoreLegacyData()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
