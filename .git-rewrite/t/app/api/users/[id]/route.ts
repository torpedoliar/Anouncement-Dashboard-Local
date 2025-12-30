import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/users/[id] - Get single user
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json(
            { error: "Failed to fetch user" },
            { status: 500 }
        );
    }
}

// PUT /api/users/[id] - Update user
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Only ADMIN can update users
        const currentUser = await prisma.user.findUnique({
            where: { id: (session.user as { id: string }).id },
        });
        if (currentUser?.role !== "ADMIN") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { email, name, role, password } = body;

        const existingUser = await prisma.user.findUnique({
            where: { id },
        });
        if (!existingUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Check if new email already exists
        if (email && email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email },
            });
            if (emailExists) {
                return NextResponse.json(
                    { error: "Email already registered" },
                    { status: 400 }
                );
            }
        }

        // Build update data
        const updateData: {
            email?: string;
            name?: string;
            role?: "ADMIN" | "EDITOR";
            passwordHash?: string;
        } = {};

        if (email) updateData.email = email;
        if (name) updateData.name = name;
        if (role) updateData.role = role;
        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                updatedAt: true,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "UPDATE",
                entityType: "USER",
                entityId: id,
                userId: (session.user as { id: string }).id,
                changes: JSON.stringify({ email, name, role, passwordChanged: !!password }),
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json(
            { error: "Failed to update user" },
            { status: 500 }
        );
    }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const currentUserId = (session.user as { id: string }).id;

        // Only ADMIN can delete users
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
        });
        if (currentUser?.role !== "ADMIN") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        // Cannot delete self
        if (id === currentUserId) {
            return NextResponse.json(
                { error: "Cannot delete your own account" },
                { status: 400 }
            );
        }

        const userToDelete = await prisma.user.findUnique({
            where: { id },
            select: { name: true, email: true },
        });

        if (!userToDelete) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Delete user's activity logs first (to avoid foreign key constraint)
        await prisma.activityLog.deleteMany({
            where: { userId: id },
        });

        await prisma.user.delete({
            where: { id },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: "DELETE",
                entityType: "USER",
                entityId: id,
                userId: currentUserId,
                changes: JSON.stringify({ name: userToDelete.name, email: userToDelete.email }),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        );
    }
}
