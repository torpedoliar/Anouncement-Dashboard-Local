import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/settings - Get site settings
export async function GET() {
    try {
        let settings = await prisma.settings.findFirst();

        // If no settings exist, create default settings
        if (!settings) {
            settings = await prisma.settings.create({
                data: {
                    id: 1,
                    siteName: "PT Santos Jaya Abadi",
                    heroTitle: "BERITA & PENGUMUMAN",
                    heroSubtitle: "Informasi terbaru dari perusahaan",
                    primaryColor: "#dc2626",
                },
            });
        }

        const response = NextResponse.json(settings);
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return response;
    } catch (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

// PUT /api/settings - Update site settings
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            siteName,
            heroTitle,
            heroSubtitle,
            heroImage,
            logoPath,
            primaryColor,
            aboutText,
            instagramUrl,
            facebookUrl,
            twitterUrl,
            linkedinUrl,
            youtubeUrl,
        } = body;

        // First check if settings exist
        const existingSettings = await prisma.settings.findFirst();

        let settings;
        if (existingSettings) {
            // Update existing settings
            settings = await prisma.settings.update({
                where: { id: existingSettings.id },
                data: {
                    siteName: siteName || "PT Santos Jaya Abadi",
                    heroTitle: heroTitle || "BERITA & PENGUMUMAN",
                    heroSubtitle: heroSubtitle || "Informasi terbaru dari perusahaan",
                    heroImage: heroImage ?? null,
                    logoPath: logoPath ?? null,
                    primaryColor: primaryColor || "#dc2626",
                    aboutText: aboutText || "Didirikan tahun 1979, PT. Santos Jaya Abadi adalah salah satu perusahaan roasting kopi terbesar di Asia Tenggara dengan merek ikonik Kapal Api.",
                    instagramUrl: instagramUrl ?? null,
                    facebookUrl: facebookUrl ?? null,
                    twitterUrl: twitterUrl ?? null,
                    linkedinUrl: linkedinUrl ?? null,
                    youtubeUrl: youtubeUrl ?? null,
                },
            });
        } else {
            // Create new settings
            settings = await prisma.settings.create({
                data: {
                    id: 1,
                    siteName: siteName || "PT Santos Jaya Abadi",
                    heroTitle: heroTitle || "BERITA & PENGUMUMAN",
                    heroSubtitle: heroSubtitle || "Informasi terbaru dari perusahaan",
                    heroImage: heroImage ?? null,
                    logoPath: logoPath ?? null,
                    primaryColor: primaryColor || "#dc2626",
                    aboutText: aboutText || "Didirikan tahun 1979, PT. Santos Jaya Abadi adalah salah satu perusahaan roasting kopi terbesar di Asia Tenggara dengan merek ikonik Kapal Api.",
                    instagramUrl: instagramUrl ?? null,
                    facebookUrl: facebookUrl ?? null,
                    twitterUrl: twitterUrl ?? null,
                    linkedinUrl: linkedinUrl ?? null,
                    youtubeUrl: youtubeUrl ?? null,
                },
            });
        }

        // Log activity
        try {
            await prisma.activityLog.create({
                data: {
                    action: "UPDATE",
                    entityType: "SETTINGS",
                    entityId: String(settings.id),
                    userId: (session.user as { id: string }).id,
                    changes: JSON.stringify(body),
                },
            });
        } catch (logError) {
            console.error("Failed to log activity:", logError);
            // Don't fail the request if logging fails
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error updating settings:", error);
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        );
    }
}
