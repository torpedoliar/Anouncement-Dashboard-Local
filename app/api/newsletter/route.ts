//
// Newsletter API - Subscribe, Unsubscribe
// Path: /api/newsletter
//

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendTemplatedEmail } from "@/lib/email";

// GET /api/newsletter - List subscribers (admin only)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as { role: string }).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const activeOnly = url.searchParams.get("active") === "true";

        const where = activeOnly ? { isActive: true } : {};

        const [subscribers, total] = await Promise.all([
            prisma.newsletterSubscriber.findMany({
                where,
                orderBy: { subscribedAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
            }),
            prisma.newsletterSubscriber.count({ where }),
        ]);

        return NextResponse.json({
            data: subscribers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching subscribers:", error);
        return NextResponse.json(
            { error: "Failed to fetch subscribers" },
            { status: 500 }
        );
    }
}

// POST /api/newsletter - Subscribe (public)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, name, source } = body;

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: "Invalid email format" },
                { status: 400 }
            );
        }

        // Check if already subscribed
        const existing = await prisma.newsletterSubscriber.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existing) {
            if (existing.isActive) {
                return NextResponse.json(
                    { message: "Already subscribed" },
                    { status: 200 }
                );
            }

            // Reactivate subscription
            await prisma.newsletterSubscriber.update({
                where: { id: existing.id },
                data: {
                    isActive: true,
                    name: name || existing.name,
                    subscribedAt: new Date(),
                    unsubscribedAt: null,
                },
            });

            return NextResponse.json({
                message: "Subscription reactivated successfully",
            });
        }

        // Create new subscriber
        const subscriber = await prisma.newsletterSubscriber.create({
            data: {
                email: email.toLowerCase(),
                name,
                source: source || "website",
            },
        });

        // Get settings for email
        const settings = await prisma.settings.findFirst();

        // Send welcome email
        await sendTemplatedEmail("welcome", email, {
            subscriberName: name || "Subscriber",
            siteName: settings?.siteName || "Santos Jaya Abadi",
            year: new Date().getFullYear(),
        });

        return NextResponse.json({
            message: "Subscribed successfully",
            id: subscriber.id,
        });
    } catch (error) {
        console.error("Error subscribing:", error);
        return NextResponse.json(
            { error: "Failed to subscribe" },
            { status: 500 }
        );
    }
}

// DELETE /api/newsletter - Unsubscribe
export async function DELETE(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const email = url.searchParams.get("email");

        if (!token && !email) {
            return NextResponse.json(
                { error: "Token or email is required" },
                { status: 400 }
            );
        }

        const where = token
            ? { unsubscribeToken: token }
            : { email: email!.toLowerCase() };

        const subscriber = await prisma.newsletterSubscriber.findFirst({ where });

        if (!subscriber) {
            return NextResponse.json(
                { error: "Subscriber not found" },
                { status: 404 }
            );
        }

        // Update to inactive
        await prisma.newsletterSubscriber.update({
            where: { id: subscriber.id },
            data: {
                isActive: false,
                unsubscribedAt: new Date(),
            },
        });

        // Get settings for email
        const settings = await prisma.settings.findFirst();

        // Send confirmation email
        await sendTemplatedEmail("unsubscribe-confirm", subscriber.email, {
            siteName: settings?.siteName || "Santos Jaya Abadi",
        });

        return NextResponse.json({
            message: "Unsubscribed successfully",
        });
    } catch (error) {
        console.error("Error unsubscribing:", error);
        return NextResponse.json(
            { error: "Failed to unsubscribe" },
            { status: 500 }
        );
    }
}
