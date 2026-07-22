import prisma from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { AuditActor, AuditOutcome, AuditCategory, LogSeverity, Prisma } from "@prisma/client";

export interface AuditParams {
    actorType: AuditActor;
    actorId?: string | null;
    category: AuditCategory;
    action: string;
    entityType: string;
    entityId?: string | null;
    outcome?: AuditOutcome;
    errorMessage?: string | null;
    changes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    severity?: LogSeverity;
    siteId?: string | null;
    appId?: string | null;
    request?: NextRequest;
}

// Field yang otomatis di-redaksi dari changes/metadata
const SENSITIVE_KEYS = [
    "password",
    "passwordHash",
    "credentialBlob",
    "token",
    "secret",
    "sessionToken",
    "resetToken",
    "smtpPass",
];

function redact(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (
            SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))
        ) {
            result[key] = "[REDACTED]";
        } else if (value && typeof value === "object" && !Array.isArray(value)) {
            result[key] = redact(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }
    return result;
}

function extractIp(request?: NextRequest): string | null {
    if (!request) return null;
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null
    );
}

function extractUserAgent(request?: NextRequest): string | null {
    if (!request) return null;
    return request.headers.get("user-agent") || null;
}

/**
 * Centralized audit logging. Non-blocking — never throws.
 * Audit should never fail the main transaction.
 */
export async function logAudit(params: AuditParams): Promise<void> {
    try {
        const changes = params.changes
            ? JSON.stringify(redact(params.changes))
            : null;
        const metadata: Prisma.InputJsonValue | undefined = params.metadata
            ? redact(params.metadata) as Prisma.InputJsonValue
            : undefined;

        // Denormalisasi actor (email/name) agar log tetap terbaca walau user dihapus
        let actorEmail: string | null = null;
        let actorName: string | null = null;

        if (params.actorId && params.actorType === "ADMIN_USER") {
            const u = await prisma.user.findUnique({
                where: { id: params.actorId },
                select: { email: true, name: true },
            });
            actorEmail = u?.email ?? null;
            actorName = u?.name ?? null;
        } else if (params.actorId && params.actorType === "PORTAL_USER") {
            const u = await prisma.portalUser.findUnique({
                where: { id: params.actorId },
                select: { email: true, name: true },
            });
            actorEmail = u?.email ?? null;
            actorName = u?.name ?? null;
        }

        await prisma.auditLog.create({
            data: {
                actorType: params.actorType,
                actorId: params.actorId ?? null,
                actorEmail,
                actorName,
                category: params.category,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId ?? null,
                outcome: params.outcome ?? "SUCCESS",
                errorMessage: params.errorMessage ?? null,
                changes,
                metadata,
                ipAddress: extractIp(params.request),
                userAgent: extractUserAgent(params.request),
                severity: params.severity ?? "INFO",
                siteId: params.siteId ?? null,
                appId: params.appId ?? null,
                portalUserId:
                    params.actorType === "PORTAL_USER" ? params.actorId : null,
            },
        });
    } catch (error) {
        // Audit TIDAK PERNAH menggagalkan transaksi utama
        console.error("[Audit] Failed to write audit log:", error);
    }
}
