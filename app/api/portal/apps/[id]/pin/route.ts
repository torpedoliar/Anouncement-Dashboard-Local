import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalApp } from "@/lib/portal-access";
import { PinAppSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

// PATCH /api/portal/apps/:id/pin — tandai/lepas favorit beranda. Body { pinned }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const userId = session.user.id;
        const { id: appId } = await params;

        const body = await request.json().catch(() => null);
        const validation = validateInput(PinAppSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 },
            );
        }
        const { pinned } = validation.data;

        // Hanya app yang user berhak akses — termasuk saat melepas pin? Tidak:
        // melepas pin app yang aksesnya sudah dicabut harus tetap bisa.
        if (pinned && !(await canAccessPortalApp(userId, appId))) {
            return NextResponse.json({ error: "App tidak dapat diakses" }, { status: 403 });
        }

        if (pinned) {
            await prisma.portalUserAppPin.upsert({
                where: { portalUserId_appId: { portalUserId: userId, appId } },
                update: {},
                create: { portalUserId: userId, appId },
            });
        } else {
            await prisma.portalUserAppPin.deleteMany({ where: { portalUserId: userId, appId } });
        }

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "PORTAL",
            action: pinned ? "PORTAL_APP_PIN" : "PORTAL_APP_UNPIN",
            entityType: "PORTAL_APP",
            entityId: appId,
            request,
        });

        return NextResponse.json({ pinned });
    } catch (err) {
        console.error("PATCH /api/portal/apps/[id]/pin:", err);
        return NextResponse.json({ error: "Gagal menyimpan favorit" }, { status: 500 });
    }
}
