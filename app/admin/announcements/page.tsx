import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AnnouncementsList from "@/components/admin/AnnouncementsList";
import { getCurrentSiteId } from "@/lib/site-context";
import { getDefaultSite } from "@/lib/site-access";

export const dynamic = "force-dynamic";

/**
 * Resolve the admin's active site: the cookie if set, otherwise the user's
 * default/first accessible site. Never returns null when any site exists, so
 * the list is always scoped to exactly one site (no cross-site leak even when
 * the cookie is missing — e.g. Secure-cookie dropped over plain HTTP).
 */
async function resolveSiteId(): Promise<string | null> {
    const cookieSiteId = await getCurrentSiteId();
    if (cookieSiteId) return cookieSiteId;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    const fallback = await getDefaultSite(session.user.id);
    return fallback?.id ?? null;
}

async function getAnnouncements(siteId: string | null) {
    // Always scope to a site. If we truly cannot resolve one, return nothing
    // rather than leaking every site's announcements.
    if (!siteId) return [];

    const announcements = await prisma.announcement.findMany({
        where: { sites: { some: { siteId } } },
        orderBy: [{ createdAt: "desc" }],
        include: {
            category: { select: { name: true, color: true } },
            sites: {
                include: {
                    site: { select: { id: true, name: true, slug: true } }
                }
            }
        },
    });

    // Surface this site's per-site pin/hero flags and sort pinned-first.
    return announcements
        .map((a) => {
            const here = a.sites.find((s) => s.siteId === siteId);
            return {
                ...a,
                isPinned: here?.isPinned ?? a.isPinned,
                isHero: here?.isHero ?? a.isHero,
            };
        })
        .sort((x, y) => Number(y.isPinned) - Number(x.isPinned));
}

async function getCategories(siteId: string | null) {
    if (!siteId) return [];
    return prisma.category.findMany({
        where: { siteId },
        orderBy: { order: "asc" },
    });
}

export default async function AnnouncementsPage() {
    const siteId = await resolveSiteId();
    const [announcements, categories] = await Promise.all([
        getAnnouncements(siteId),
        getCategories(siteId),
    ]);

    return (
        <AnnouncementsList
            announcements={announcements}
            categories={categories}
        />
    );
}
