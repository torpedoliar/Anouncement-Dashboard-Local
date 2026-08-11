import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { saveVisibility, saveVisibilityPartial } from "@/lib/portal-access";
import { SaveVisibilitySchema, PatchVisibilitySchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

// POST /api/portal/visibility — onboarding/reset preferensi user.
// Body: { groupIdsOff: string[], appIdsOff: string[], appIdsOn: string[], skip?: boolean }
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const userId = session.user.id;

        const body = await request.json();
        const validation = validateInput(SaveVisibilitySchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const { groupIdsOff, appIdsOff, appIdsOn, skip } = validation.data;
        await saveVisibility(userId, { groupIdsOff, appIdsOff, appIdsOn, skip });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "CONFIG",
            action: "VISIBILITY_SAVE",
            entityType: "PORTAL_USER",
            entityId: userId,
            metadata: { groupIdsOff: groupIdsOff.length, appIdsOff: appIdsOff.length, appIdsOn: appIdsOn.length, skip: !!skip },
        }).catch(() => {});

        return NextResponse.json({ message: "ok" });
    } catch (err) {
        console.error("POST /api/portal/visibility:", err);
        return NextResponse.json({ error: "Failed to save visibility" }, { status: 500 });
    }
}

// PATCH /api/portal/visibility — ubah satu row (groupId ATAU appId).
// Body: { groupId?: string, appId?: string, visible: boolean }
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const userId = session.user.id;

        const body = await request.json();
        const validation = validateInput(PatchVisibilitySchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const { groupId, appId, visible } = validation.data;
        await saveVisibilityPartial(userId, { groupId, appId, visible });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "CONFIG",
            action: "VISIBILITY_UPDATE",
            entityType: "PORTAL_USER",
            entityId: userId,
            metadata: { groupId, appId, visible },
        }).catch(() => {});

        return NextResponse.json({ message: "ok" });
    } catch (err) {
        console.error("PATCH /api/portal/visibility:", err);
        return NextResponse.json({ error: "Failed to update visibility" }, { status: 500 });
    }
}