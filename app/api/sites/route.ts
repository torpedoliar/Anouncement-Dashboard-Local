/**
 * Sites API Route
 * GET - List all sites (filtered by user access)
 * POST - Create new site (SuperAdmin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getAccessibleSites } from '@/lib/site-access';

// GET /api/sites - List sites
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const includeInactive = searchParams.get('includeInactive') === 'true';

        // Check if user is SuperAdmin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperAdmin: true },
        });

        if (user?.isSuperAdmin) {
            // SuperAdmin sees all sites
            const sites = await prisma.site.findMany({
                where: includeInactive ? {} : { isActive: true },
                include: {
                    settings: true,
                    _count: {
                        select: {
                            announcementSites: true,
                            categories: true,
                            userAccess: true,
                        },
                    },
                },
                orderBy: { name: 'asc' },
            });
            return NextResponse.json(sites);
        }

        // Regular users only see their accessible sites
        const accessibleSites = await getAccessibleSites(session.user.id);
        const siteIds = accessibleSites.map((s) => s.id);

        const sites = await prisma.site.findMany({
            where: {
                id: { in: siteIds },
                isActive: true,
            },
            include: {
                settings: true,
                _count: {
                    select: {
                        announcementSites: true,
                        categories: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(sites);
    } catch (error) {
        console.error('Error fetching sites:', error);
        return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
    }
}

// POST /api/sites - Create new site (SuperAdmin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is SuperAdmin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperAdmin: true },
        });

        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: 'Only SuperAdmin can create sites' }, { status: 403 });
        }

        const body = await request.json();
        const { name, slug, description, primaryColor, cloneFromSiteId } = body;

        if (!name || !slug) {
            return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
        }

        // Check if slug already exists
        const existingSite = await prisma.site.findUnique({
            where: { slug },
        });

        if (existingSite) {
            return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
        }

        // Create site with settings in a transaction
        const site = await prisma.$transaction(async (tx) => {
            // Create the site
            const newSite = await tx.site.create({
                data: {
                    name,
                    slug,
                    description: description || null,
                    primaryColor: primaryColor || '#ED1C24',
                },
            });

            // Clone settings from another site if specified
            if (cloneFromSiteId) {
                const sourceSite = await tx.siteSettings.findUnique({
                    where: { siteId: cloneFromSiteId },
                });

                if (sourceSite) {
                    await tx.siteSettings.create({
                        data: {
                            siteId: newSite.id,
                            heroTitle: sourceSite.heroTitle,
                            heroSubtitle: sourceSite.heroSubtitle,
                            heroImage: sourceSite.heroImage,
                            aboutText: sourceSite.aboutText,
                            instagramUrl: sourceSite.instagramUrl,
                            facebookUrl: sourceSite.facebookUrl,
                            twitterUrl: sourceSite.twitterUrl,
                            linkedinUrl: sourceSite.linkedinUrl,
                            youtubeUrl: sourceSite.youtubeUrl,
                            commentAutoApprove: sourceSite.commentAutoApprove,
                            commentRequireEmail: sourceSite.commentRequireEmail,
                        },
                    });
                } else {
                    // Create default settings
                    await tx.siteSettings.create({
                        data: { siteId: newSite.id },
                    });
                }

                // Clone categories if cloning
                const sourceCategories = await tx.category.findMany({
                    where: { siteId: cloneFromSiteId },
                });

                for (const cat of sourceCategories) {
                    await tx.category.create({
                        data: {
                            name: cat.name,
                            slug: cat.slug,
                            color: cat.color,
                            order: cat.order,
                            siteId: newSite.id,
                        },
                    });
                }
            } else {
                // Create default settings
                await tx.siteSettings.create({
                    data: { siteId: newSite.id },
                });
            }

            return newSite;
        });

        return NextResponse.json(site, { status: 201 });
    } catch (error) {
        console.error('Error creating site:', error);
        return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
    }
}
