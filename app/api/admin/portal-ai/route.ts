import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";

// ============================================================================
// Portal AI Settings API — konfigurasi LLM opsional untuk deep analysis login.
//   GET /api/admin/portal-ai   → baca config; apiKey di-mask (tidak pernah plaintext)
//   PUT /api/admin/portal-ai   → simpan baseUrl/model/apiKey/enabled
// Auth: SuperAdmin only. Provider OpenAI-compatible (endpoint /chat/completions).
// ============================================================================

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const cfg = await prisma.portalAiSettings.findFirst();
        if (!cfg) {
            return NextResponse.json({ configured: false });
        }

        return NextResponse.json({
            configured: true,
            config: {
                baseUrl: cfg.baseUrl,
                model: cfg.model,
                apiKeyMasked: cfg.apiKeyEncrypted ? "****" : null,
                enabled: cfg.enabled,
                lastUsedAt: cfg.lastUsedAt,
                lastError: cfg.lastError,
                updatedAt: cfg.updatedAt,
            },
        });
    } catch (error) {
        console.error("GET /api/admin/portal-ai:", error);
        return NextResponse.json({ error: "Gagal membaca konfigurasi AI" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
        const model = typeof body?.model === "string" ? body.model.trim() : "";
        const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
        const enabled = Boolean(body?.enabled);

        if (enabled && (!baseUrl || !model)) {
            return NextResponse.json({ error: "baseUrl dan model wajib diisi bila AI aktif" }, { status: 400 });
        }

        if (baseUrl) {
            try {
                const parsed = new URL(baseUrl);
                if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("proto");
            } catch {
                return NextResponse.json({ error: "baseUrl harus URL http/https yang valid" }, { status: 400 });
            }
        }

        // apiKey kosong = pertahankan key lama (kecuali admin eksplisit minta hapus).
        const existing = await prisma.portalAiSettings.findFirst();
        let apiKeyEncrypted = existing?.apiKeyEncrypted ?? null;
        if (apiKey) {
            apiKeyEncrypted = encrypt(apiKey);
        } else if (body?.clearApiKey === true) {
            apiKeyEncrypted = null;
        }

        const cfg = await prisma.portalAiSettings.upsert({
            where: { id: 1 },
            update: { baseUrl: baseUrl || null, model: model || null, apiKeyEncrypted, enabled },
            create: { id: 1, baseUrl: baseUrl || null, model: model || null, apiKeyEncrypted, enabled },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "CONFIG",
            action: "PORTAL_AI_SETTINGS_UPDATE",
            entityType: "PORTAL",
            entityId: "ai-settings",
            changes: { baseUrl, model, enabled, apiKeyChanged: Boolean(apiKey) },
            request,
        });

        return NextResponse.json({
            message: "Konfigurasi AI portal disimpan",
            config: {
                baseUrl: cfg.baseUrl,
                model: cfg.model,
                apiKeyMasked: cfg.apiKeyEncrypted ? "****" : null,
                enabled: cfg.enabled,
                lastUsedAt: cfg.lastUsedAt,
                lastError: cfg.lastError,
                updatedAt: cfg.updatedAt,
            },
        });
    } catch (error) {
        console.error("PUT /api/admin/portal-ai:", error);
        return NextResponse.json({ error: "Gagal menyimpan konfigurasi AI" }, { status: 500 });
    }
}
