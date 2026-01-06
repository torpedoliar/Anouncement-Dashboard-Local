//
// Email Settings API
// Path: /api/email/settings
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resetTransporter, testConnection } from "@/lib/email";

// GET /api/email/settings - Get email settings (admin only)
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as { role: string }).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let settings = await prisma.emailSettings.findFirst();

        if (!settings) {
            // Create default settings if not exist
            settings = await prisma.emailSettings.create({
                data: {},
            });
        }

        // Don't expose password
        return NextResponse.json({
            ...settings,
            smtpPass: settings.smtpPass ? "********" : null,
        });
    } catch (error) {
        console.error("Error fetching email settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

// PUT /api/email/settings - Update email settings (admin only)
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as { role: string }).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            fromName,
            fromEmail,
            replyToEmail,
            autoSendNewArticle,
        } = body;

        // Build update data, only updating provided fields
        const updateData: Record<string, unknown> = {};
        if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
        if (smtpPort !== undefined) updateData.smtpPort = parseInt(smtpPort);
        if (smtpSecure !== undefined) updateData.smtpSecure = smtpSecure;
        if (smtpUser !== undefined) updateData.smtpUser = smtpUser || null;
        // Only update password if it's provided and not masked
        if (smtpPass !== undefined && smtpPass !== "********") {
            updateData.smtpPass = smtpPass || null;
        }
        if (fromName !== undefined) updateData.fromName = fromName;
        if (fromEmail !== undefined) updateData.fromEmail = fromEmail;
        if (replyToEmail !== undefined) updateData.replyToEmail = replyToEmail || null;
        if (autoSendNewArticle !== undefined) updateData.autoSendNewArticle = autoSendNewArticle;

        const settings = await prisma.emailSettings.upsert({
            where: { id: 1 },
            update: updateData,
            create: updateData as never,
        });

        // Reset transporter so it gets recreated with new settings
        resetTransporter();

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "UPDATE",
                entityType: "EMAIL_SETTINGS",
                entityId: "1",
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify({ fields: Object.keys(updateData) }),
            },
        });

        return NextResponse.json({
            ...settings,
            smtpPass: settings.smtpPass ? "********" : null,
        });
    } catch (error) {
        console.error("Error updating email settings:", error);
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        );
    }
}

// POST /api/email/settings - Test SMTP connection
export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as { role: string }).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Reset transporter to use latest settings
        resetTransporter();

        const result = await testConnection();

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error testing connection:", error);
        return NextResponse.json(
            { success: false, error: "Connection test failed" },
            { status: 500 }
        );
    }
}
