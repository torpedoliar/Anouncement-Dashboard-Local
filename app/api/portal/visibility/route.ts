import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { saveVisibility, filterAccessibleAppIds } from "@/lib/portal-access";
import { SaveVisibilitySchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
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

        // Guard restricted: appId yang di-hide/show harus app yang user berhak akses.
        const candidateAppIds = [...appIdsOff, ...appIdsOn];
        if (candidateAppIds.length > 0) {
            const allowed = await filterAccessibleAppIds(userId, candidateAppIds);
            const denied = candidateAppIds.filter((id) => !allowed.has(id));
            if (denied.length > 0) {
                return NextResponse.json({ error: "App tidak dapat diakses" }, { status: 403 });
            }
        }

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