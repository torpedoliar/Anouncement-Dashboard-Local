import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";
import { PortalAppCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";
import { computeLoginFingerprint } from "@/lib/portal-fingerprint";

// GET /api/portal-apps - List portal apps (Admin & SuperAdmin)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip } = validatePagination(pageParam, limitParam);

        const category = searchParams.get("category");
        const isActive = searchParams.get("isActive");
        const search = searchParams.get("search");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (category) where.category = category;
        if (isActive !== null && isActive !== undefined && isActive !== "") where.isActive = isActive === "true";
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const [apps, total, failed] = await Promise.all([
            prisma.portalApp.findMany({
                where,
                orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
                skip,
                take: limit,
            }),
            prisma.portalApp.count({ where }),
            // Kegagalan SSO 24 jam terakhir — data sudah terisi oleh logAudit saat SSO launch.
            prisma.auditLog.groupBy({
                by: ["appId"],
                where: {
                    action: "SSO_LAUNCH",
                    outcome: "FAILURE",
                    createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
                },
                _count: { _all: true },
            }),
        ]);

        const failCount = new Map(failed.map((r) => [r.appId, r._count._all]));
        const data = apps.map((a) => ({ ...a, ssoFailure24h: failCount.get(a.id) ?? 0 }));

        return NextResponse.json({
            data,
            pagination: {
                page: Math.floor(skip / limit) + 1,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching portal apps:", error);
        return NextResponse.json({ error: "Failed to fetch portal apps" }, { status: 500 });
    }
}

// POST /api/portal-apps - Create portal app (SuperAdmin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json();
        const validation = validateInput(PortalAppCreateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const data = validation.data;

        // Fingerprint dihitung dari apa yang benar-benar tersimpan, bukan dari nilai
        // token yang berubah tiap akses — bandingan drift di health check memakai formula ini.
        const extraNames = Object.keys((data.extraFields as Record<string, string> | null | undefined) ?? {});
        const fingerprint = computeLoginFingerprint({
            loginUrl: data.loginUrl ?? data.url,
            usernameField: data.usernameField ?? "username",
            passwordField: data.passwordField ?? "password",
            extraFieldNames: extraNames,
        });

        const payload = {
            ...data,
            // Prisma Json tidak menerima null polos — ubah ke undefined (field dilewati).
            detectionSignals: data.detectionSignals ?? undefined,
            detectedFingerprint: fingerprint,
            // detectedAt hanya diisi bila admin baru saja menjalankan deteksi.
            detectedAt: data.detectionLayer ? new Date() : undefined,
            loginFormChanged: false,
        };

        // Check slug uniqueness
        const existing = await prisma.portalApp.findUnique({ where: { slug: data.slug } });
        if (existing) {
            return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
        }

        const app = await prisma.portalApp.create({ data: payload });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_APP_CREATED",
            entityType: "PORTAL_APP",
            entityId: app.id,
            changes: { name: app.name, slug: app.slug },
            request,
        });

        return NextResponse.json(app, { status: 201 });
    } catch (error) {
        console.error("Error creating portal app:", error);
        return NextResponse.json({ error: "Failed to create portal app" }, { status: 500 });
    }
}
