/**
 * Site Context Utilities
 * Provides site-related context management for multi-site functionality
 */

import { cookies } from 'next/headers';

const SITE_COOKIE_NAME = 'current_site_id';
const SITE_SLUG_COOKIE_NAME = 'current_site_slug';

export interface SiteContext {
    siteId: string;
    siteSlug: string;
    siteName: string;
}

/**
 * Get current site ID from cookie
 */
export async function getCurrentSiteId(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(SITE_COOKIE_NAME)?.value || null;
}

/**
 * Get current site slug from cookie
 */
export async function getCurrentSiteSlug(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(SITE_SLUG_COOKIE_NAME)?.value || null;
}

/**
 * Set current site context in cookies
 */
export async function setCurrentSite(siteId: string, siteSlug: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(SITE_COOKIE_NAME, siteId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    cookieStore.set(SITE_SLUG_COOKIE_NAME, siteSlug, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
    });
}

/**
 * Clear site context from cookies
 */
export async function clearCurrentSite(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SITE_COOKIE_NAME);
    cookieStore.delete(SITE_SLUG_COOKIE_NAME);
}

/**
 * Extract site slug from pathname
 * Expected format: /site/[siteSlug]/...
 */
export function extractSiteSlugFromPath(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'site' && segments[1]) {
        return segments[1];
    }
    return null;
}

/**
 * Generate site URL for a given path within a site
 */
export function getSiteUrl(siteSlug: string, path: string = ''): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `/site/${siteSlug}${cleanPath ? `/${cleanPath}` : ''}`;
}

/**
 * Generate admin URL with site context
 */
export function getAdminUrl(path: string = ''): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `/admin${cleanPath ? `/${cleanPath}` : ''}`;
}
