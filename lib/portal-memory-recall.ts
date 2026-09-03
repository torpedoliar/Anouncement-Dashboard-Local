import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { fingerprintLoginProduct } from "@/lib/portal-product-registry";
import { getLearnedSuggestion, type CorrectedLoginConfig } from "@/lib/portal-detection-feedback";

export interface MemoryDb {
    latestCorrection(loginUrl: string): Promise<(CorrectedLoginConfig & { correctedAt: Date }) | null>;
    latestProfile(origin: string): Promise<CorrectedLoginConfig | null>;
    // Opsional agar mock test tanpa method ini tidak crash; diisi
    // implementasi nyata di Task 3 (fingerprint generik).
    latestFingerprint?(origin: string): Promise<CorrectedLoginConfig | null>;
}

const realDb: MemoryDb = {
    async latestCorrection(loginUrl: string) {
        const s = await getLearnedSuggestion(loginUrl);
        return s ? { ...s, correctedAt: s.correctedAt } : null;
    },
    async latestProfile(origin: string) {
        const row = await prisma.portalLoginProfile.findFirst({
            where: { origin },
            orderBy: { updatedAt: "desc" },
            select: { usernameField: true, passwordField: true, httpMethod: true },
        });
        return row ? { ...row, ssoMode: null } : null;
    },
    async latestFingerprint(origin: string) {
        try {
            const row = await prisma.portalProductFingerprint.findFirst({
                where: { origin },
                orderBy: { createdAt: "desc" },
                select: { config: true },
            });
            if (!row) return null;
            const config = row.config as unknown as CorrectedLoginConfig;
            return config && (config.usernameField || config.passwordField) ? config : null;
        } catch {
            return null;
        }
    },
};

export interface MemoryRecall {
    source: "CORRECTION" | "FINGERPRINT" | "PROFILE" | "REGISTRY";
    label: string;
    product: string | null;
    config: CorrectedLoginConfig;
}

function originOf(url: string): string | null {
    try {
        return new URL(url).origin.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * Tanda struktur form: sha256 dari nama field terurut + method.
 * TIDAK memuat nilai — aman disimpan sebagai kunci fingerprint generik.
 */
export function formSignatureHash(fieldNames: string[], method: string | null): string {
    const normalized = fieldNames.map((n) => n.trim().toLowerCase()).filter(Boolean).sort().join("|");
    return crypto.createHash("sha256").update(`${(method ?? "POST").toUpperCase()}::${normalized}`).digest("hex");
}

/** Recall berurutan: koreksi admin > fingerprint generik > profile > registry. */
export async function recallLoginMemory(
    input: { loginUrl: string; html: string },
    db: MemoryDb = realDb,
): Promise<MemoryRecall | null> {
    const product = fingerprintLoginProduct(input.html, input.loginUrl);

    const correction = await db.latestCorrection(input.loginUrl).catch(() => null);
    if (correction) {
        return {
            source: "CORRECTION",
            label: `MEMORY: koreksi admin ${correction.correctedAt.toISOString().slice(0, 10)}`,
            product: product?.product ?? null,
            config: correction,
        };
    }

    const origin = originOf(input.loginUrl);
    if (origin && db.latestFingerprint) {
        const fp = await db.latestFingerprint(origin).catch(() => null);
        if (fp && (fp.usernameField || fp.passwordField)) {
            return { source: "FINGERPRINT", label: "MEMORY: fingerprint generik terverifikasi", product: product?.product ?? "generic", config: fp };
        }
    }

    if (origin) {
        const profile = await db.latestProfile(origin).catch(() => null);
        if (profile && (profile.usernameField || profile.passwordField)) {
            return { source: "PROFILE", label: "MEMORY: profile sukses sebelumnya", product: product?.product ?? null, config: profile };
        }
    }

    if (product) {
        return { source: "REGISTRY", label: `REGISTRY: ${product.product}${product.version ? ` v${product.version}` : ""}`, product: product.product, config: { usernameField: null, passwordField: null, httpMethod: null, ssoMode: null } };
    }
    return null;
}
