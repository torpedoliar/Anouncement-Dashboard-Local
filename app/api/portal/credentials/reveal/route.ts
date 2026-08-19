import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";

// POST /api/portal/credentials/reveal - Decrypt and reveal password after re-authenticating with portal password
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json().catch(() => null);
        const { credentialId, portalPassword } = body || {};

        if (!credentialId || typeof credentialId !== "string") {
            return NextResponse.json({ error: "credentialId diperlukan" }, { status: 400 });
        }

        if (!portalPassword || typeof portalPassword !== "string") {
            return NextResponse.json({ error: "Password login portal diperlukan untuk verifikasi" }, { status: 400 });
        }

        // 1. Fetch user to verify their portal password
        const user = await prisma.portalUser.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true, isActive: true },
        });

        if (!user || !user.isActive) {
            return NextResponse.json({ error: "Pengguna tidak valid atau tidak aktif" }, { status: 401 });
        }

        const isPasswordValid = await compare(portalPassword, user.passwordHash);
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Password login portal tidak sesuai" }, { status: 403 });
        }

        // 2. Fetch the target credential belonging to this user
        const credential = await prisma.portalUserAppCredential.findFirst({
            where: { id: credentialId, portalUserId: userId },
            include: { app: { select: { id: true, name: true } } },
        });

        if (!credential) {
            return NextResponse.json({ error: "Kredensial tidak ditemukan" }, { status: 404 });
        }

        // 3. Decrypt credential blob
        const decrypted = decryptCredential(credential.credentialBlob);

        // 4. Log security audit event
        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "SECURITY",
            action: "CREDENTIAL_REVEALED",
            entityType: "PORTAL_CREDENTIAL",
            entityId: credential.id,
            changes: { appId: credential.appId, label: credential.label, appName: credential.app.name },
            request,
        }).catch((err) => console.error("Audit log error:", err));

        return NextResponse.json({
            success: true,
            username: decrypted.username,
            password: decrypted.password,
            label: credential.label,
        });
    } catch (error) {
        console.error("Error revealing credential:", error);
        return NextResponse.json({ error: "Gagal mendekripsi kredensial" }, { status: 500 });
    }
}
