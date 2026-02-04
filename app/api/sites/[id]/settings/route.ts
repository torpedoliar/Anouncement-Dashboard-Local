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

        const settings = await prisma.siteSettings.findUnique({
            where: { siteId: id },
        });

        if (!settings) {
            // Create default settings if they don't exist
            const newSettings = await prisma.siteSettings.create({
                data: { siteId: id },
            });
            return NextResponse.json(newSettings);
        }

        return NextResponse.json(settings);
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

        const settings = await prisma.siteSettings.upsert({
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

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error updating site settings:', error);
        return NextResponse.json({ error: 'Failed to update site settings' }, { status: 500 });
    }
}
