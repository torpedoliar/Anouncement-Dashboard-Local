import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";
import { PortalUserCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

// GET /api/portal-users - List portal users (SuperAdmin only)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip } = validatePagination(pageParam, limitParam);

        const search = searchParams.get("search");
        const isActive = searchParams.get("isActive");
        const role = searchParams.get("role");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (isActive !== null && isActive !== undefined && isActive !== "") where.isActive = isActive === "true";
        if (role) where.role = role;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }

        const [users, total] = await Promise.all([
            prisma.portalUser.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true, email: true, name: true, avatar: true,
                    role: true, isActive: true, createdAt: true, updatedAt: true,
                    appAccess: { select: { appId: true, role: true } },
                    groups: { select: { id: true, groupId: true, group: { select: { id: true, name: true } } } },
                },
            }),
            prisma.portalUser.count({ where }),
        ]);

        return NextResponse.json({
            data: users,
            pagination: {
                page: Math.floor(skip / limit) + 1,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching portal users:", error);
        return NextResponse.json({ error: "Failed to fetch portal users" }, { status: 500 });
    }
}

// POST /api/portal-users - Create portal user (SuperAdmin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json();
        const validation = validateInput(PortalUserCreateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const { email, password, name, role, isActive, appIds } = validation.data;

        // Check email uniqueness
        const existing = await prisma.portalUser.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: "Email already registered" }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.portalUser.create({
                data: { email, passwordHash, name, role, isActive },
            });

            if (appIds && appIds.length > 0) {
                for (const appId of appIds) {
                    await tx.portalUserAppAccess.create({
                        data: { portalUserId: newUser.id, appId },
                    });
                }
            }

            return newUser;
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: "PORTAL_USER_CREATED",
            entityType: "PORTAL_USER",
            entityId: user.id,
            changes: { email, name, role, appIds },
            request,
        });

        // Audit each access grant
        if (appIds && appIds.length > 0) {
            for (const appId of appIds) {
                await logAudit({
                    actorType: "ADMIN_USER",
                    actorId: session.user.id,
                    category: "USER_MGMT",
                    action: "ACCESS_GRANTED",
                    entityType: "PORTAL_USER_APP_ACCESS",
                    entityId: `${user.id}:${appId}`,
                    changes: { portalUserId: user.id, appId },
                    request,
                });
            }
        }

        return NextResponse.json({ id: user.id, email, name, role, isActive, appIds }, { status: 201 });
    } catch (error) {
        console.error("Error creating portal user:", error);
        return NextResponse.json({ error: "Failed to create portal user" }, { status: 500 });
    }
}
