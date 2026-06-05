import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Backup format version. Bumped to 3.0 when multi-site tables were added.
const BACKUP_VERSION = "3.0";

// GET /api/backup - Download a full database backup as JSON (SuperAdmin only)
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `backup_${timestamp}.json`;

        // Export every table needed to fully reconstruct the multi-site state.
        // IDs are preserved so foreign keys restore correctly.
        const [
            users,
            sites,
            siteSettings,
            userSiteAccess,
            categories,
            announcements,
            announcementSites,
            comments,
            analytics,
            mediaLibrary,
            newsletterSubscribers,
            emailTemplates,
            activityLogs,
            settings,
        ] = await Promise.all([
            prisma.user.findMany(), // includes passwordHash so restore keeps logins working
            prisma.site.findMany(),
            prisma.siteSettings.findMany(),
            prisma.userSiteAccess.findMany(),
            prisma.category.findMany(),
            prisma.announcement.findMany(),
            prisma.announcementSite.findMany(),
            prisma.comment.findMany(),
            prisma.analytics.findMany(),
            prisma.mediaLibrary.findMany(),
            prisma.newsletterSubscriber.findMany(),
            prisma.emailTemplate.findMany(),
            prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
            prisma.settings.findFirst(),
        ]);

        const tables = {
            users,
            sites,
            siteSettings,
            userSiteAccess,
            categories,
            announcements,
            announcementSites,
            comments,
            analytics,
            mediaLibrary,
            newsletterSubscribers,
            emailTemplates,
            activityLogs,
            settings,
        };

        const backupData = {
            version: BACKUP_VERSION,
            createdAt: new Date().toISOString(),
            createdBy: session.user?.email,
            summary: Object.fromEntries(
                Object.entries(tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : v ? 1 : 0])
            ),
            tables,
        };

        return new NextResponse(JSON.stringify(backupData, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Backup error:", error);
        return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
    }
}

// Restore one table by upserting each row. Rows come from parsed JSON (untyped),
// so callbacks receive `any` and rely on Prisma's runtime validation.
async function restoreById(
    rows: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsertOne: (row: any) => Promise<unknown>
): Promise<number> {
    if (!Array.isArray(rows)) return 0;
    let count = 0;
    for (const row of rows) {
        try {
            await upsertOne(row);
            count++;
        } catch (err) {
            console.error("Restore row failed:", err);
        }
    }
    return count;
}

// POST /api/backup - Restore database from a JSON backup (SuperAdmin only)
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const backupData = await request.json();
        if (!backupData.version || !backupData.tables) {
            return NextResponse.json(
                { error: "Format backup tidak valid. Pastikan file adalah backup yang benar." },
                { status: 400 }
            );
        }

        const t = backupData.tables;
        const restored: Record<string, number | boolean> = {};

        // Legacy backups (v2.x) only carried 5 tables and no IDs for sites.
        const isLegacy = String(backupData.version).startsWith("2");

        if (isLegacy) {
            // Fall back to the previous best-effort behaviour: settings + categories +
            // announcements attached to the default site. Multi-site data is absent.
            return await restoreLegacy(backupData, session.user.id);
        }

        // --- Full restore. Order respects foreign-key dependencies. ---

        // 1. Users (preserve id + passwordHash)
        restored.users = await restoreById(t.users, (u) =>
            prisma.user.upsert({
                where: { id: u.id },
                update: stripDates(u),
                create: withDates(u),
            })
        );

        // 2. Sites
        restored.sites = await restoreById(t.sites, (s) =>
            prisma.site.upsert({ where: { id: s.id }, update: stripDates(s), create: withDates(s) })
        );

        // 3. Site settings (unique on siteId)
        restored.siteSettings = await restoreById(t.siteSettings, (ss) =>
            prisma.siteSettings.upsert({
                where: { siteId: ss.siteId },
                update: stripDates(ss, ["id"]),
                create: withDates(ss),
            })
        );

        // 4. User-site access
        restored.userSiteAccess = await restoreById(t.userSiteAccess, (ua) =>
            prisma.userSiteAccess.upsert({ where: { id: ua.id }, update: ua, create: ua })
        );

        // 5. Categories
        restored.categories = await restoreById(t.categories, (c) =>
            prisma.category.upsert({ where: { id: c.id }, update: stripDates(c), create: withDates(c) })
        );

        // 6. Announcements
        restored.announcements = await restoreById(t.announcements, (a) =>
            prisma.announcement.upsert({ where: { id: a.id }, update: stripDates(a), create: withDates(a) })
        );

        // 7. Announcement-site syndication (carries per-site hero/pin)
        restored.announcementSites = await restoreById(t.announcementSites, (as) =>
            prisma.announcementSite.upsert({ where: { id: as.id }, update: withDates(as), create: withDates(as) })
        );

        // 8. Comments (self-referential parentId; upsert by id tolerates ordering)
        restored.comments = await restoreById(t.comments, (cm) =>
            prisma.comment.upsert({ where: { id: cm.id }, update: withDates(cm), create: withDates(cm) })
        );

        // 9. Analytics
        restored.analytics = await restoreById(t.analytics, (an) =>
            prisma.analytics.upsert({ where: { id: an.id }, update: withDates(an), create: withDates(an) })
        );

        // 10. Media library
        restored.mediaLibrary = await restoreById(t.mediaLibrary, (m) =>
            prisma.mediaLibrary.upsert({ where: { id: m.id }, update: withDates(m), create: withDates(m) })
        );

        // 11. Newsletter subscribers
        restored.newsletterSubscribers = await restoreById(t.newsletterSubscribers, (n) =>
            prisma.newsletterSubscriber.upsert({ where: { id: n.id }, update: withDates(n), create: withDates(n) })
        );

        // 12. Email templates
        restored.emailTemplates = await restoreById(t.emailTemplates, (e) =>
            prisma.emailTemplate.upsert({ where: { id: e.id }, update: withDates(e), create: withDates(e) })
        );

        // 13. Global settings singleton
        if (t.settings) {
            try {
                const { id: _omit, updatedAt: _u, ...data } = t.settings;
                void _omit; void _u;
                await prisma.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
                restored.settings = true;
            } catch (err) {
                console.error("Error restoring settings:", err);
                restored.settings = false;
            }
        }

        await prisma.activityLog.create({
            data: {
                action: "RESTORE_DATABASE",
                entityType: "SYSTEM",
                entityId: "backup",
                severity: "WARNING",
                changes: JSON.stringify(restored),
                userId: session.user.id,
            },
        });

        return NextResponse.json({ success: true, message: "Database berhasil di-restore!", restored });
    } catch (error) {
        console.error("Restore error:", error);
        return NextResponse.json(
            { error: "Gagal restore database. Periksa format file backup." },
            { status: 500 }
        );
    }
}

// Coerce ISO date strings back to Date objects and keep all other fields.
// Returns `any` so the resulting object satisfies each Prisma model's create/update
// input — restored rows already carry every required scalar field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withDates(row: Record<string, unknown>): any {
    const out: Record<string, unknown> = { ...row };
    for (const key of Object.keys(out)) {
        if ((key.endsWith("At") || key === "date") && typeof out[key] === "string") {
            const d = new Date(out[key] as string);
            if (!isNaN(d.getTime())) out[key] = d;
        }
    }
    return out;
}

// Same as withDates but drops keys that must not be overwritten on update.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripDates(row: Record<string, unknown>, omit: string[] = []): any {
    const out = withDates(row) as Record<string, unknown>;
    for (const k of ["createdAt", ...omit]) delete out[k];
    return out;
}

// Legacy v2.x restore path (settings + categories + announcements -> default site).
async function restoreLegacy(backupData: { tables: Record<string, unknown> }, userId: string) {
    const restored = { settings: false, categories: 0, announcements: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = backupData.tables as any;

    if (t.settings) {
        try {
            const s = t.settings;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any = {
                siteName: s.siteName, primaryColor: s.primaryColor, logoPath: s.logoPath,
                heroTitle: s.heroTitle, heroSubtitle: s.heroSubtitle,
            };
            await prisma.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
            restored.settings = true;
        } catch (err) { console.error("Legacy settings restore failed:", err); }
    }

    const defaultSite = await prisma.site.findFirst({ where: { isDefault: true } });
    const siteId = defaultSite?.id;

    if (siteId && Array.isArray(t.categories)) {
        for (const c of t.categories) {
            try {
                await prisma.category.upsert({
                    where: { slug_siteId: { slug: c.slug, siteId } },
                    update: { name: c.name, color: c.color, order: c.order ?? 0, siteId },
                    create: { name: c.name, slug: c.slug, color: c.color, order: c.order ?? 0, siteId },
                });
                restored.categories++;
            } catch (err) { console.error(`Legacy category ${c.name} failed:`, err); }
        }
    }

    if (siteId && Array.isArray(t.announcements)) {
        for (const a of t.announcements as Record<string, unknown>[]) {
            try {
                let categoryId = a.categoryId as string | undefined;
                if (!categoryId) categoryId = (await prisma.category.findFirst({ where: { siteId } }))?.id;
                if (!categoryId) continue;

                const saved = await prisma.announcement.upsert({
                    where: { slug: a.slug as string },
                    update: {
                        title: a.title as string, content: a.content as string,
                        excerpt: a.excerpt as string | null, imagePath: a.imagePath as string | null,
                        isPublished: (a.isPublished as boolean) ?? false,
                        isPinned: (a.isPinned as boolean) ?? false, isHero: (a.isHero as boolean) ?? false,
                        viewCount: (a.viewCount as number) ?? 0, categoryId,
                    },
                    create: {
                        title: a.title as string, slug: a.slug as string, content: a.content as string,
                        excerpt: a.excerpt as string | null, imagePath: a.imagePath as string | null,
                        isPublished: (a.isPublished as boolean) ?? false,
                        isPinned: (a.isPinned as boolean) ?? false, isHero: (a.isHero as boolean) ?? false,
                        viewCount: (a.viewCount as number) ?? 0, categoryId,
                    },
                });
                // Attach to default site so the article is not orphaned post-restore
                await prisma.announcementSite.upsert({
                    where: { announcementId_siteId: { announcementId: saved.id, siteId } },
                    update: { isPrimary: true, isHero: saved.isHero, isPinned: saved.isPinned },
                    create: { announcementId: saved.id, siteId, isPrimary: true, isHero: saved.isHero, isPinned: saved.isPinned },
                });
                restored.announcements++;
            } catch (err) { console.error(`Legacy announcement restore failed:`, err); }
        }
    }

    try {
        await prisma.activityLog.create({
            data: {
                action: "RESTORE_DATABASE", entityType: "SYSTEM", entityId: "backup-legacy",
                severity: "WARNING",
                changes: `Legacy restore: ${restored.categories} categories, ${restored.announcements} announcements`,
                userId,
            },
        });
    } catch (err) { console.error("Error logging legacy restore:", err); }

    return NextResponse.json({ success: true, message: "Database berhasil di-restore (legacy)!", restored });
}
