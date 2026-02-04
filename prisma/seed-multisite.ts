/**
 * Multi-Site Migration Seed Script
 * Run this after database migration to:
 * 1. Create default site from existing settings
 * 2. Associate existing announcements/categories to default site
 * 3. Make the first user a SuperAdmin
 * 
 * Usage: npx ts-node prisma/seed-multisite.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting multi-site migration seed...\n');

    // Step 1: Create default site
    console.log('📦 Creating default site...');

    // Get existing settings if any
    const existingSettings = await prisma.settings.findFirst();

    const defaultSite = await prisma.site.upsert({
        where: { slug: 'sja-utama' },
        update: {},
        create: {
            name: existingSettings?.siteName || 'SJA Utama',
            slug: 'sja-utama',
            description: 'Site utama Santos Jaya Abadi',
            primaryColor: '#ED1C24',
            isActive: true,
            isDefault: true,
        },
    });
    console.log(`   ✅ Created site: ${defaultSite.name} (${defaultSite.id})`);

    // Step 2: Create site settings from existing settings
    console.log('\n📝 Creating site settings...');

    await prisma.siteSettings.upsert({
        where: { siteId: defaultSite.id },
        update: {},
        create: {
            siteId: defaultSite.id,
            heroTitle: existingSettings?.heroTitle || 'Berita & Pengumuman',
            heroSubtitle: existingSettings?.heroSubtitle || 'Informasi terbaru',
            heroImage: existingSettings?.heroImage || null,
            heroVideoPath: existingSettings?.heroVideoPath || null,
            heroVideoType: existingSettings?.heroVideoType || null,
            heroYoutubeUrl: existingSettings?.heroYoutubeUrl || null,
            aboutText: existingSettings?.aboutText || null,
            instagramUrl: existingSettings?.instagramUrl || null,
            facebookUrl: existingSettings?.facebookUrl || null,
            twitterUrl: existingSettings?.twitterUrl || null,
            linkedinUrl: existingSettings?.linkedinUrl || null,
            youtubeUrl: existingSettings?.youtubeUrl || null,
            commentAutoApprove: existingSettings?.commentAutoApprove || false,
        },
    });
    console.log('   ✅ Created site settings');

    // Step 3: Update categories with siteId
    console.log('\n📂 Updating categories...');

    const categories = await prisma.category.findMany({
        where: { siteId: null as unknown as string }, // Find categories without siteId
    });

    if (categories.length > 0) {
        await prisma.category.updateMany({
            where: { siteId: null as unknown as string },
            data: { siteId: defaultSite.id },
        });
        console.log(`   ✅ Updated ${categories.length} categories with default site`);
    } else {
        console.log('   ℹ️  No categories to update (already have siteId or none exist)');
    }

    // Step 4: Create announcement-site associations
    console.log('\n📰 Creating announcement-site associations...');

    const announcements = await prisma.announcement.findMany({
        where: {
            sites: { none: {} }, // Announcements with no site associations
        },
    });

    if (announcements.length > 0) {
        for (const announcement of announcements) {
            await prisma.announcementSite.upsert({
                where: {
                    announcementId_siteId: {
                        announcementId: announcement.id,
                        siteId: defaultSite.id,
                    },
                },
                update: {},
                create: {
                    announcementId: announcement.id,
                    siteId: defaultSite.id,
                    isPrimary: true,
                },
            });
        }
        console.log(`   ✅ Created ${announcements.length} announcement-site associations`);
    } else {
        console.log('   ℹ️  No announcements to associate (already have sites or none exist)');
    }

    // Step 5: Update newsletter subscribers with siteId
    console.log('\n📧 Updating newsletter subscribers...');

    // Note: This requires the siteId field to be nullable first in migration
    // Then run this script, then make it required
    const subscribers = await prisma.$executeRaw`
    UPDATE newsletter_subscribers 
    SET site_id = ${defaultSite.id} 
    WHERE site_id IS NULL
  `;
    console.log(`   ✅ Updated subscribers with default site`);

    // Step 6: Make first user SuperAdmin
    console.log('\n👤 Setting up SuperAdmin...');

    const firstUser = await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' },
    });

    if (firstUser) {
        await prisma.user.update({
            where: { id: firstUser.id },
            data: { isSuperAdmin: true },
        });
        console.log(`   ✅ Made ${firstUser.email} a SuperAdmin`);

        // Also give them access to the default site
        await prisma.userSiteAccess.upsert({
            where: {
                userId_siteId: {
                    userId: firstUser.id,
                    siteId: defaultSite.id,
                },
            },
            update: {},
            create: {
                userId: firstUser.id,
                siteId: defaultSite.id,
                role: 'SITE_ADMIN',
            },
        });
        console.log('   ✅ Added SuperAdmin to default site as SITE_ADMIN');
    } else {
        console.log('   ⚠️  No users found to make SuperAdmin');
    }

    // Step 7: Update media library with null siteId (shared)
    console.log('\n🖼️  Media library unchanged (siteId null = shared)');

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Multi-site migration seed completed!');
    console.log('='.repeat(50));
    console.log(`
Summary:
- Default site: ${defaultSite.name} (${defaultSite.slug})
- Categories updated: ${categories.length}
- Announcements associated: ${announcements.length}
- SuperAdmin: ${firstUser?.email || 'None'}

Next steps:
1. Review the default site at /admin/sites
2. Create additional sites as needed
3. Assign users to sites via /admin/sites/[id]/users
  `);
}

main()
    .catch((e) => {
        console.error('❌ Migration seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
