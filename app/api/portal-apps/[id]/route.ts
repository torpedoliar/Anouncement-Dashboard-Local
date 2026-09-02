import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PortalAppUpdateSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";
import { computeLoginFingerprint } from "@/lib/portal-fingerprint";
import {
    LoginProfileBindingError,
    loginProfileSummarySelect,
    resolveApprovedProfileBinding,
    sanitizePortalAppDiscoverySignals,
    serializeLoginProfile,
} from "@/lib/portal-login-profile";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/portal-apps/[id] - Get single portal app (SuperAdmin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const app = await prisma.portalApp.findUnique({
            where: { id },
            include: { loginProfile: { select: loginProfileSummarySelect } },
        });
        if (!app) {
            return NextResponse.json({ error: "App not found" }, { status: 404 });
        }

        const { loginProfile, ...portalApp } = app;
        return NextResponse.json({
            ...portalApp,
            loginProfile: loginProfile ? serializeLoginProfile(loginProfile) : null,
        });
    } catch (error) {
        console.error("Error fetching portal app:", error);
        return NextResponse.json({ error: "Failed to fetch portal app" }, { status: 500 });
    }
}

// PUT /api/portal-apps/[id] - Update portal app (SuperAdmin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const validation = validateInput(PortalAppUpdateSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 },
            );
        }

        const existing = await prisma.portalApp.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "App not found" }, { status: 404 });
        }

        // Check slug uniqueness if changed
        if (validation.data.slug && validation.data.slug !== existing.slug) {
            const slugExists = await prisma.portalApp.findUnique({ where: { slug: validation.data.slug } });
            if (slugExists) {
                return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
            }
        }

        const { loginProfileId, loginProfileFingerprint, ...patch } = validation.data;
        // Fingerprint dari hasil GABUNGAN (data lama + patch), agar mencerminkan yang
        // benar-benar tersimpan — bandingan drift di health check memakai formula ini.
        const patchedUrl = patch.url?.trim();
        const mergedLoginUrl = patch.loginUrl !== undefined
            ? patch.loginUrl?.trim() || patchedUrl || existing.url
            : existing.loginUrl?.trim() || patchedUrl || existing.url;
        const merged = {
            loginUrl: mergedLoginUrl,
            usernameField: patch.usernameField ?? existing.usernameField ?? "username",
            passwordField: patch.passwordField ?? existing.passwordField ?? "password",
            ssoMode: patch.ssoMode ?? existing.ssoMode,
            httpMethod: patch.httpMethod ?? existing.httpMethod,
            extraFields: (patch.extraFields as Record<string, string> | null | undefined) ??
                (existing.extraFields as Record<string, string> | null) ??
                {},
        };
        const bindingRequested =
            loginProfileId !== undefined ||
            loginProfileFingerprint !== undefined;
        const appDestinationChanged =
            patch.url !== undefined && patch.url.trim() !== existing.url;
        const loginConfigChanged =
            patch.loginUrl !== undefined ||
            appDestinationChanged ||
            patch.ssoMode !== undefined ||
            patch.httpMethod !== undefined ||
            patch.usernameField !== undefined ||
            patch.passwordField !== undefined ||
            patch.extraFields !== undefined;

        let profileBinding: { loginProfileId: string; loginProfileFingerprint: string } | null | undefined;
        if (appDestinationChanged) {
            // The approved profile covers the login target, not a changed
            // application destination. Require a separate review/bind step.
            profileBinding = null;
        } else if (bindingRequested) {
            try {
                profileBinding = await resolveApprovedProfileBinding({
                    profileId: loginProfileId,
                    fingerprint: loginProfileFingerprint,
                    loginUrl: merged.loginUrl,
                    ssoMode: merged.ssoMode,
                    httpMethod: merged.httpMethod,
                    usernameField: merged.usernameField,
                    passwordField: merged.passwordField,
                });
            } catch (error) {
                if (error instanceof LoginProfileBindingError) {
                    return NextResponse.json({ error: error.message }, { status: 409 });
                }
                throw error;
            }
        } else if (loginConfigChanged && (existing.loginProfileId || existing.loginProfileFingerprint)) {
            // Edit manual pada transport/field melepaskan binding profile lama.
            // Jangan biarkan app tampak "approved" dengan snapshot yang sudah berubah.
            profileBinding = null;
        }

        const safeDetectionSignals = patch.detectionSignals === undefined || patch.detectionSignals === null
            ? undefined
            : sanitizePortalAppDiscoverySignals(patch.detectionSignals);
        const payload = {
            ...patch,
            detectionSignals: safeDetectionSignals,
            detectedFingerprint: computeLoginFingerprint({
                loginUrl: merged.loginUrl,
                recommendedMode: merged.ssoMode,
                httpMethod: merged.httpMethod,
                usernameField: merged.usernameField,
                passwordField: merged.passwordField,
                extraFieldNames: Object.keys(merged.extraFields),
            }),
            detectedAt: patch.detectionLayer ? new Date() : undefined,
            loginFormChanged: false,
            ...(profileBinding === undefined
                ? {}
                : {
                    loginProfileId: profileBinding?.loginProfileId ?? null,
                    loginProfileFingerprint: profileBinding?.loginProfileFingerprint ?? null,
                }),
        };

        const write = await prisma.portalApp.updateMany({
            where: { id, updatedAt: existing.updatedAt },
            data: payload,
        });
        if (write.count !== 1) {
            return NextResponse.json(
                { error: "Aplikasi berubah bersamaan. Muat ulang dan simpan kembali." },
                { status: 409 },
            );
        }
        const app = await prisma.portalApp.findUnique({ where: { id } });
        if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_APP_UPDATED",
            entityType: "PORTAL_APP",
            entityId: id,
            changes: {
                changedFields: Object.keys(patch).sort(),
                profileBindingChanged: profileBinding !== undefined,
                loginProfileId: profileBinding === undefined ? existing.loginProfileId : profileBinding?.loginProfileId ?? null,
            },
            request,
        });

        return NextResponse.json(app);
    } catch (error) {
        console.error("Error updating portal app:", error);
        return NextResponse.json({ error: "Failed to update portal app" }, { status: 500 });
    }
}

// DELETE /api/portal-apps/[id] - Delete portal app (SuperAdmin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const existing = await prisma.portalApp.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "App not found" }, { status: 404 });
        }

        await prisma.portalApp.delete({ where: { id } });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_APP_DELETED",
            entityType: "PORTAL_APP",
            entityId: id,
            changes: { name: existing.name, slug: existing.slug },
            request,
        });

        return NextResponse.json({ message: "App deleted" });
    } catch (error) {
        console.error("Error deleting portal app:", error);
        return NextResponse.json({ error: "Failed to delete portal app" }, { status: 500 });
    }
}
