/**
 * Site Access Utilities
 * Permission checking for multi-site access control
 */

import { prisma } from '@/lib/prisma';
import { SiteRole } from '@prisma/client';

export interface UserSitePermission {
    siteId: string;
    siteSlug: string;
    siteName: string;
    role: SiteRole;
}

export interface UserWithSiteAccess {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
    siteAccess: UserSitePermission[];
}

/**
 * Get user with their site access permissions
 */
export async function getUserWithSiteAccess(userId: string): Promise<UserWithSiteAccess | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            siteAccess: {
                include: {
                    site: {
                        select: {
                            id: true,
                            slug: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (!user) return null;

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        siteAccess: user.siteAccess.map((access) => ({
            siteId: access.siteId,
            siteSlug: access.site.slug,
            siteName: access.site.name,
            role: access.role,
        })),
    };
}

/**
 * Check if user can access a specific site
 */
export async function canAccessSite(userId: string, siteId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            isSuperAdmin: true,
            siteAccess: {
                where: { siteId },
                select: { id: true },
            },
        },
    });

    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.siteAccess.length > 0;
}

/**
 * Check if user can access a site by slug
 */
export async function canAccessSiteBySlug(userId: string, siteSlug: string): Promise<boolean> {
    const site = await prisma.site.findUnique({
        where: { slug: siteSlug },
        select: { id: true },
    });

    if (!site) return false;
    return canAccessSite(userId, site.id);
}

/**
 * Get user's role for a specific site
 */
export async function getUserSiteRole(userId: string, siteId: string): Promise<SiteRole | 'SUPERADMIN' | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            isSuperAdmin: true,
            siteAccess: {
                where: { siteId },
                select: { role: true },
            },
        },
    });

    if (!user) return null;
    if (user.isSuperAdmin) return 'SUPERADMIN';
    if (user.siteAccess.length === 0) return null;
    return user.siteAccess[0].role;
}

/**
 * Check if user can edit content on a site (SITE_ADMIN or EDITOR role, or SuperAdmin)
 */
export async function canEditOnSite(userId: string, siteId: string): Promise<boolean> {
    const role = await getUserSiteRole(userId, siteId);
    if (!role) return false;
    return role === 'SUPERADMIN' || role === 'SITE_ADMIN' || role === 'EDITOR';
}

/**
 * Check if user can admin a site (SITE_ADMIN role or SuperAdmin)
 */
export async function canAdminSite(userId: string, siteId: string): Promise<boolean> {
    const role = await getUserSiteRole(userId, siteId);
    if (!role) return false;
    return role === 'SUPERADMIN' || role === 'SITE_ADMIN';
}

/**
 * Get all sites accessible by a user
 */
export async function getAccessibleSites(userId: string): Promise<{ id: string; name: string; slug: string }[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            isSuperAdmin: true,
            siteAccess: {
                include: {
                    site: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            isActive: true,
                        },
                    },
                },
            },
        },
    });

    if (!user) return [];

    // SuperAdmin can access all active sites
    if (user.isSuperAdmin) {
        const allSites = await prisma.site.findMany({
            where: { isActive: true },
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        });
        return allSites;
    }

    // Regular users only see their assigned sites
    return user.siteAccess
        .filter((access) => access.site.isActive)
        .map((access) => ({
            id: access.site.id,
            name: access.site.name,
            slug: access.site.slug,
        }));
}

/**
 * Get default site for a user (first accessible site or default site)
 */
export async function getDefaultSite(userId: string): Promise<{ id: string; slug: string; name: string } | null> {
    const sites = await getAccessibleSites(userId);

    if (sites.length === 0) {
        // Fallback to system default site
        const defaultSite = await prisma.site.findFirst({
            where: { isDefault: true },
            select: { id: true, slug: true, name: true },
        });
        return defaultSite;
    }

    return sites[0];
}
