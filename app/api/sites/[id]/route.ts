/**
 * Single Site API Route
 * GET - Get site details
 * PUT - Update site
 * DELETE - Delete site (SuperAdmin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAdminSite } from '@/lib/site-access';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/sites/[id] - Get site details
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const site = await prisma.site.findUnique({
            where: { id },
            include: {
                settings: true,
                _count: {
                    select: {
                        announcementSites: true,
                        categories: true,
                        userAccess: true,
                        newsletters: true,
                    },
                },
            },
        });

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        return NextResponse.json(site);
    } catch (error) {
        console.error('Error fetching site:', error);
        return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 });
    }
}

// PUT /api/sites/[id] - Update site
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user can admin this site
        const canAdmin = await canAdminSite(session.user.id, id);
        if (!canAdmin) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const body = await request.json();
        const { name, slug, description, primaryColor, logoPath, faviconPath, isActive, isDefault } = body;

        // If changing slug, check it doesn't already exist
        if (slug) {
            const existingSite = await prisma.site.findFirst({
                where: {
                    slug,
                    NOT: { id },
                },
            });

            if (existingSite) {
                return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
            }
        }

        // If setting as default, unset other defaults
        if (isDefault === true) {
            await prisma.site.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }

        const site = await prisma.site.update({
            where: { id },
            data: {
                name,
                slug,
                description,
                primaryColor,
                logoPath,
                faviconPath,
                isActive,
                isDefault,
            },
            include: {
                settings: true,
            },
        });

        return NextResponse.json(site);
    } catch (error) {
        console.error('Error updating site:', error);
        return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
    }
}

// DELETE /api/sites/[id] - Delete site (SuperAdmin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only SuperAdmin can delete sites
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperAdmin: true },
        });

        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: 'Only SuperAdmin can delete sites' }, { status: 403 });
        }

        // Check if this is the only/default site
        const site = await prisma.site.findUnique({
            where: { id },
            select: { isDefault: true },
        });

        if (site?.isDefault) {
            return NextResponse.json({ error: 'Cannot delete the default site' }, { status: 400 });
        }

        // Check site count
        const siteCount = await prisma.site.count();
        if (siteCount <= 1) {
            return NextResponse.json({ error: 'Cannot delete the last site' }, { status: 400 });
        }

        // Delete site (cascades to related data)
        await prisma.site.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting site:', error);
        return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
    }
}
