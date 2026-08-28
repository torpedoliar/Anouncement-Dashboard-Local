import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encryptCredential, decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";

// ============================================================================
// HRIS Gateway Config API (TASK-29)
//   GET  /api/admin/hris/config  → baca config; apiKey di-mask (tidak pernah plaintext)
//   POST /api/admin/hris/config  → simpan baseUrl + apiKey (apiKey dienkripsi AES-256-GCM)
// Auth: SuperAdmin only.
// ============================================================================

type HrisConfigPublic = {
    id: number;
    baseUrl: string;
    apiKeyMasked: string | null;
    enabled: boolean;
    lastSyncAt: Date | null;
    lastPingAt: Date | null;
    pingError: string | null;
    updatedAt: Date;
};

/** Mask apiKey: tampilkan hanya 4 karakter terakhir; selebihnya asterisk. */
function maskApiKey(apiKey: string): string {
    if (apiKey.length <= 4) return "****";
    return `****${apiKey.slice(-4)}`;
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const cfg = await prisma.hrisGatewayConfig.findFirst();
        if (!cfg) {
            return NextResponse.json({ configured: false });
        }

        // API key tidak pernah dikirim plaintext — hanya masked (kalau sudah ada)
        let apiKeyMasked: string | null = null;
        if (cfg.apiKeyEncrypted) {
            try {
                const cred = decryptCredential(cfg.apiKeyEncrypted);
                apiKeyMasked = maskApiKey(cred.password);
            } catch {
                apiKeyMasked = "****";
            }
        }

        const result: HrisConfigPublic = {
            id: cfg.id,
            baseUrl: cfg.baseUrl,
            apiKeyMasked,
            enabled: cfg.enabled,
            lastSyncAt: cfg.lastSyncAt,
            lastPingAt: cfg.lastPingAt,
            pingError: cfg.pingError,
            updatedAt: cfg.updatedAt,
        };
        return NextResponse.json({ configured: true, config: result });
    } catch (error) {
        console.error("Error fetching HRIS config:", error);
        return NextResponse.json({ error: "Failed to fetch HRIS config" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
        const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
        const enabled = Boolean(body?.enabled);

        if (!baseUrl || !apiKey) {
            return NextResponse.json({ error: "baseUrl dan apiKey wajib diisi" }, { status: 400 });
        }

        // Validasi baseUrl http(s) minimal (hindari SSRF ke metadata / file scheme)
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(baseUrl);
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
                throw new Error("proto");
            }
        } catch {
            return NextResponse.json({ error: "baseUrl harus URL http/https yang valid" }, { status: 400 });
        }

        // Enkripsi apiKey via portal-crypto (AES-256-GCM credential blob)
        const apiKeyEncrypted = encryptCredential({
            username: "hris-admin",
            password: apiKey,
        });

        const cfg = await prisma.hrisGatewayConfig.upsert({
            where: { id: 1 },
            update: {
                baseUrl,
                apiKeyEncrypted,
                enabled,
            },
            create: {
                id: 1,
                baseUrl,
                apiKeyEncrypted,
                enabled,
            },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "CONFIG",
            action: "HRIS_CONFIG_UPDATE",
            entityType: "HRIS",
            entityId: "config",
            changes: { baseUrl, enabled },
            request,
        });

        return NextResponse.json({
            message: "Konfigurasi HRIS gateway disimpan",
            config: {
                id: cfg.id,
                baseUrl: cfg.baseUrl,
                enabled: cfg.enabled,
                lastSyncAt: cfg.lastSyncAt,
                lastPingAt: cfg.lastPingAt,
                pingError: cfg.pingError,
                updatedAt: cfg.updatedAt,
            },
        });
    } catch (error) {
        console.error("Error saving HRIS config:", error);
        return NextResponse.json({ error: "Failed to save HRIS config" }, { status: 500 });
    }
}