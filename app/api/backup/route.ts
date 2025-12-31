import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/backup - Download database backup as JSON
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get current timestamp for filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `backup_${timestamp}.json`;

        // Export all data using Prisma
        const [
            users,
            categories,
            announcements,
            activityLogs,
            settings
        ] = await Promise.all([
            prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    avatar: true,
                    createdAt: true,
                    updatedAt: true,
                    // Exclude passwordHash for security
                }
            }),
            prisma.category.findMany(),
            prisma.announcement.findMany(),
            prisma.activityLog.findMany({
                take: 1000, // Limit logs for backup size
                orderBy: { createdAt: "desc" }
            }),
            prisma.settings.findFirst()
        ]);

        const backupData = {
            version: "2.0",
            createdAt: new Date().toISOString(),
            createdBy: session.user?.email,
            summary: {
                users: users.length,
                categories: categories.length,
                announcements: announcements.length,
                activityLogs: activityLogs.length,
            },
            tables: {
                users,
                categories,
                announcements,
                activityLogs,
                settings
            }
        };

        const jsonContent = JSON.stringify(backupData, null, 2);

        // Return JSON file as download
        return new NextResponse(jsonContent, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Backup error:", error);
        return NextResponse.json(
            { error: "Failed to create backup" },
            { status: 500 }
        );
    }
}

// POST /api/backup - Restore database from JSON backup
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const backupData = await request.json();

        // Validate backup format
        if (!backupData.version || !backupData.tables) {
            return NextResponse.json(
                { error: "Format backup tidak valid. Pastikan file adalah backup yang benar." },
                { status: 400 }
            );
        }

        const restored = {
            settings: false,
            categories: 0,
            announcements: 0,
        };

        // 1. Restore settings
        if (backupData.tables.settings) {
            try {
                const settingsData = {
                    siteName: backupData.tables.settings.siteName,
                    siteDescription: backupData.tables.settings.siteDescription,
                    primaryColor: backupData.tables.settings.primaryColor,
                    logoPath: backupData.tables.settings.logoPath,
                    heroTitle: backupData.tables.settings.heroTitle,
                    heroSubtitle: backupData.tables.settings.heroSubtitle,
                    heroBackgroundPath: backupData.tables.settings.heroBackgroundPath,
                    footerText: backupData.tables.settings.footerText,
                    contactEmail: backupData.tables.settings.contactEmail,
                    socialLinks: backupData.tables.settings.socialLinks,
                };

                await prisma.settings.upsert({
                    where: { id: 1 },
                    update: settingsData,
                    create: { id: 1, ...settingsData }
                });
                restored.settings = true;
            } catch (err) {
                console.error("Error restoring settings:", err);
            }
        }

        // 2. Restore categories
        if (backupData.tables.categories && Array.isArray(backupData.tables.categories)) {
            for (const category of backupData.tables.categories) {
                try {
                    await prisma.category.upsert({
                        where: { slug: category.slug },
                        update: {
                            name: category.name,
                            color: category.color,
                            order: category.order,
                        },
                        create: {
                            name: category.name,
                            slug: category.slug,
                            color: category.color,
                            order: category.order || 0,
                        }
                    });
                    restored.categories++;
                } catch (err) {
                    console.error(`Error restoring category ${category.name}:`, err);
                }
            }
        }

        // 3. Restore announcements
        if (backupData.tables.announcements && Array.isArray(backupData.tables.announcements)) {
            for (const announcement of backupData.tables.announcements) {
                try {
                    // Find category by slug or name
                    let categoryId = announcement.categoryId;
                    if (!categoryId && announcement.category?.slug) {
                        const cat = await prisma.category.findUnique({
                            where: { slug: announcement.category.slug }
                        });
                        categoryId = cat?.id;
                    }

                    if (!categoryId) {
                        // Use first available category
                        const defaultCat = await prisma.category.findFirst();
                        categoryId = defaultCat?.id;
                    }

                    if (categoryId) {
                        await prisma.announcement.upsert({
                            where: { slug: announcement.slug },
                            update: {
                                title: announcement.title,
                                content: announcement.content,
                                excerpt: announcement.excerpt,
                                imagePath: announcement.imagePath,
                                isPublished: announcement.isPublished,
                                isPinned: announcement.isPinned,
                                isHero: announcement.isHero,
                                viewCount: announcement.viewCount || 0,
                                scheduledAt: announcement.scheduledAt ? new Date(announcement.scheduledAt) : null,
                                takedownAt: announcement.takedownAt ? new Date(announcement.takedownAt) : null,
                                categoryId: categoryId,
                            },
                            create: {
                                title: announcement.title,
                                slug: announcement.slug,
                                content: announcement.content,
                                excerpt: announcement.excerpt,
                                imagePath: announcement.imagePath,
                                isPublished: announcement.isPublished ?? false,
                                isPinned: announcement.isPinned ?? false,
                                isHero: announcement.isHero ?? false,
                                viewCount: announcement.viewCount || 0,
                                scheduledAt: announcement.scheduledAt ? new Date(announcement.scheduledAt) : null,
                                takedownAt: announcement.takedownAt ? new Date(announcement.takedownAt) : null,
                                categoryId: categoryId,
                            }
                        });
                        restored.announcements++;
                    }
                } catch (err) {
                    console.error(`Error restoring announcement ${announcement.title}:`, err);
                }
            }
        }

        // Log the restore action
        try {
            await prisma.activityLog.create({
                data: {
                    action: "RESTORE_DATABASE",
                    entityType: "SYSTEM",
                    entityId: "backup",
                    changes: `Restored: ${restored.categories} categories, ${restored.announcements} announcements`,
                    userId: session.user?.id || "system",
                }
            });
        } catch (err) {
            console.error("Error logging restore:", err);
        }

        return NextResponse.json({
            success: true,
            message: "Database berhasil di-restore!",
            restored
        });
    } catch (error) {
        console.error("Restore error:", error);
        return NextResponse.json(
            { error: "Gagal restore database. Periksa format file backup." },
            { status: 500 }
        );
    }
}
