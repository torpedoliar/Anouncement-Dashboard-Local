import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

// GET /api/users - List all users (SuperAdmin only — exposes all accounts/roles)
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                isSuperAdmin: true,
                createdAt: true,
                updatedAt: true,
                siteAccess: {
                    select: { siteId: true }
                }
            },
            orderBy: { createdAt: "desc" },
        });

        // Flatten siteAccess to array of ids
        const formattedUsers = users.map((user) => ({
            ...user,
            siteIds: user.siteAccess.map((sa) => sa.siteId)
        }));

        return NextResponse.json(formattedUsers);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only ADMIN can create users
        const currentUser = await prisma.user.findUnique({
            where: { id: (session.user as { id: string }).id },
        });
        if (currentUser?.role !== "ADMIN") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { email, password, name, role, isSuperAdmin, siteIds } = body;

        if (!email || !password || !name) {
            return NextResponse.json(
                { error: "Email, password, and name are required" },
                { status: 400 }
            );
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return NextResponse.json(
                { error: "Email already registered" },
                { status: 400 }
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    name,
                    role: role || "EDITOR",
                    isSuperAdmin: isSuperAdmin || false,
                },
            });

            if (siteIds && Array.isArray(siteIds) && siteIds.length > 0) {
                for (const siteId of siteIds) {
                    await tx.userSiteAccess.create({
                        data: {
                            userId: newUser.id,
                            siteId,
                        }
                    });
                }
            }
            return newUser;
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "CREATE",
                entityType: "USER",
                entityId: user.id,
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify({ email, name, role: role || "EDITOR", siteIds }),
            },
        });

        // Audit trail
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: "CREATE",
            entityType: "USER",
            entityId: user.id,
            changes: { email, name, role: role || "EDITOR", siteIds },
            request,
        });

        return NextResponse.json({ ...user, siteIds }, { status: 201 });
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 }
        );
    }
}
