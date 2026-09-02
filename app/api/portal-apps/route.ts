import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/pagination-utils";
import { PortalAppCreateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";
import { computeLoginFingerprint } from "@/lib/portal-fingerprint";
import {
    LoginProfileBindingError,
    loginProfileSummarySelect,
    resolveApprovedProfileBinding,
    sanitizePortalAppDiscoverySignals,
    serializeLoginProfile,
} from "@/lib/portal-login-profile";

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
                include: { loginProfile: { select: loginProfileSummarySelect } },
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

        const failCount = new Map(failed.map((row) => [row.appId, row._count._all]));
        const data = apps.map(({ loginProfile, ...app }) => ({
            ...app,
            loginProfile: loginProfile ? serializeLoginProfile(loginProfile) : null,
            ssoFailure24h: failCount.get(app.id) ?? 0,
        }));

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
                { status: 400 },
            );
        }

        const data = validation.data;
        const { loginProfileId, loginProfileFingerprint, ...portalData } = data;
        let profileBinding;
        try {
            profileBinding = await resolveApprovedProfileBinding({
                profileId: loginProfileId,
                fingerprint: loginProfileFingerprint,
                loginUrl: data.loginUrl ?? data.url,
                ssoMode: data.ssoMode,
                httpMethod: data.httpMethod,
                usernameField: data.usernameField,
                passwordField: data.passwordField,
            });
        } catch (error) {
            if (error instanceof LoginProfileBindingError) {
                return NextResponse.json({ error: error.message }, { status: 409 });
            }
            throw error;
        }

        // Fingerprint legacy monitoring memakai builder snapshot yang sama dengan
        // profile. Ia tetap tidak mengandung nilai token atau query URL.
        const extraNames = Object.keys((data.extraFields as Record<string, string> | null | undefined) ?? {});
        const configuredLoginUrl = data.loginUrl ?? data.url;
        const fingerprint = computeLoginFingerprint({
            loginUrl: configuredLoginUrl,
            recommendedMode: data.ssoMode,
            httpMethod: data.httpMethod,
            usernameField: data.usernameField ?? "username",
            passwordField: data.passwordField ?? "password",
            extraFieldNames: extraNames,
        });
        const safeDetectionSignals = data.detectionSignals === null || data.detectionSignals === undefined
            ? undefined
            : sanitizePortalAppDiscoverySignals(data.detectionSignals);

        const payload = {
            ...portalData,
            detectionSignals: safeDetectionSignals,
            detectedFingerprint: fingerprint,
            // detectedAt hanya diisi bila admin baru saja menjalankan deteksi.
            detectedAt: data.detectionLayer ? new Date() : undefined,
            loginFormChanged: false,
            loginProfileId: profileBinding?.loginProfileId ?? null,
            loginProfileFingerprint: profileBinding?.loginProfileFingerprint ?? null,
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
            changes: { name: app.name, slug: app.slug, loginProfileId: app.loginProfileId },
            request,
        });

        return NextResponse.json(app, { status: 201 });
    } catch (error) {
        console.error("Error creating portal app:", error);
        return NextResponse.json({ error: "Failed to create portal app" }, { status: 500 });
    }
}
