import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { validatePagination, getPaginationMeta } from "@/lib/pagination-utils";

// GET /api/users - List users (SuperAdmin only — exposes all accounts/roles).
// Mendukung ?page=&limit=&q= — tanpa parameter perilaku lama (array polos)
// tetap dikembalikan agar pemanggil lama tidak putus.
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q")?.trim() || null;
        const wantsPagination = searchParams.has("page") || searchParams.has("limit") || !!q;

        const where = q
            ? {
                OR: [
                    { name: { contains: q, mode: "insensitive" as const } },
                    { email: { contains: q, mode: "insensitive" as const } },
                ],
            }
            : undefined;

        if (!wantsPagination) {
            // Perilaku lama: seluruh user sebagai array polos.
            const users = await prisma.user.findMany({
                select: USER_SELECT,
                orderBy: { createdAt: "desc" },
            });
            return NextResponse.json(users.map(formatUser));
        }

        const { limit, skip } = validatePagination(searchParams.get("page"), searchParams.get("limit"));
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: USER_SELECT,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        return NextResponse.json({
            data: users.map(formatUser),
            pagination: getPaginationMeta(
                Math.max(1, parseInt(String(searchParams.get("page"))) || 1),
                limit,
                total
            ),
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
}

const USER_SELECT = {
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
} as const;

function formatUser(user: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    siteAccess: any[];
} & Record<string, unknown>) {
    return {
        ...user,
        siteIds: user.siteAccess.map((sa) => sa.siteId),
    };
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
        if (currentUser?.role !== "ADMIN" && !currentUser?.isSuperAdmin) {
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
