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
            prisma.announcement.findMany({
                include: {
                    category: { select: { name: true, slug: true } }
                }
            }),
            prisma.activityLog.findMany({
                take: 1000, // Limit logs for backup size
                orderBy: { createdAt: "desc" }
            }),
            prisma.settings.findFirst()
        ]);

        const backupData = {
            version: "1.0",
            createdAt: new Date().toISOString(),
            createdBy: session.user?.email,
            data: {
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

        if (!backupData.version || !backupData.tables) {
            return NextResponse.json(
                { error: "Invalid backup format" },
                { status: 400 }
            );
        }

        // Restore settings
        if (backupData.tables.settings) {
            const { id, ...settingsData } = backupData.tables.settings;
            await prisma.settings.upsert({
                where: { id: 1 },
                update: settingsData,
                create: { id: 1, ...settingsData }
            });
        }

        // Restore categories
        if (backupData.tables.categories) {
            for (const category of backupData.tables.categories) {
                const { id, ...categoryData } = category;
                await prisma.category.upsert({
                    where: { slug: category.slug },
                    update: categoryData,
                    create: categoryData
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: "Backup restored successfully",
            restored: {
                settings: !!backupData.tables.settings,
                categories: backupData.tables.categories?.length || 0
            }
        });
    } catch (error) {
        console.error("Restore error:", error);
        return NextResponse.json(
            { error: "Failed to restore backup" },
            { status: 500 }
        );
    }
}
