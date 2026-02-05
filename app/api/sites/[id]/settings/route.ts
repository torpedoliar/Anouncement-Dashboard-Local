/**
 * Site Settings API Route
 * GET - Get site settings
 * PUT - Update site settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAdminSite } from '@/lib/site-access';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/sites/[id]/settings
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const site = await prisma.site.findUnique({
            where: { id },
            include: { settings: true }
        });

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        const settings = site.settings;

        if (!settings) {
            // Create default settings if they don't exist
            const newSettings = await prisma.siteSettings.create({
                data: { siteId: id },
            });
            return NextResponse.json({
                ...newSettings,
                logoPath: site.logoPath,
                primaryColor: site.primaryColor,
                siteName: site.name, // Also return site name
            });
        }

        return NextResponse.json({
            ...settings,
            logoPath: site.logoPath,
            primaryColor: site.primaryColor,
            siteName: site.name,
        });
    } catch (error) {
        console.error('Error fetching site settings:', error);
        return NextResponse.json({ error: 'Failed to fetch site settings' }, { status: 500 });
    }
}

// PUT /api/sites/[id]/settings
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
        const {
            siteName, // From site
            logoPath, // From site
            primaryColor, // From site
            heroTitle,
            heroSubtitle,
            heroImage,
            heroVideoPath,
            heroVideoType,
            heroYoutubeUrl,
            aboutText,
            instagramUrl,
            facebookUrl,
            twitterUrl,
            linkedinUrl,
            youtubeUrl,
            commentAutoApprove,
            commentRequireEmail,
        } = body;

        // Transaction to update both Site and SiteSettings
        const result = await prisma.$transaction(async (tx) => {
            // Update Site Fields
            await tx.site.update({
                where: { id },
                data: {
                    name: siteName,
                    logoPath: logoPath,
                    primaryColor: primaryColor,
                }
            });

            // Update Site Settings
            const settings = await tx.siteSettings.upsert({
                where: { siteId: id },
                create: {
                    siteId: id,
                    heroTitle,
                    heroSubtitle,
                    heroImage,
                    heroVideoPath,
                    heroVideoType,
                    heroYoutubeUrl,
                    aboutText,
                    instagramUrl,
                    facebookUrl,
                    twitterUrl,
                    linkedinUrl,
                    youtubeUrl,
                    commentAutoApprove,
                    commentRequireEmail,
                },
                update: {
                    heroTitle,
                    heroSubtitle,
                    heroImage,
                    heroVideoPath,
                    heroVideoType,
                    heroYoutubeUrl,
                    aboutText,
                    instagramUrl,
                    facebookUrl,
                    twitterUrl,
                    linkedinUrl,
                    youtubeUrl,
                    commentAutoApprove,
                    commentRequireEmail,
                },
            });

            return {
                ...settings,
                siteName,
                logoPath,
                primaryColor
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error updating site settings:', error);
        return NextResponse.json({ error: 'Failed to update site settings' }, { status: 500 });
    }
}
