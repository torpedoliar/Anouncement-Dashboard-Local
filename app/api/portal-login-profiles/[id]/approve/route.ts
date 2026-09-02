import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { approveLoginProfile, LoginProfileApprovalError } from "@/lib/portal-login-profile";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/portal-login-profiles/[id]/approve
// Persetujuan profile adalah perubahan konfigurasi keamanan, jadi SuperAdmin-only.
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin || !session.user.id) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json().catch(() => null);
        const fingerprint = body?.fingerprint;
        if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(fingerprint)) {
            return NextResponse.json({ error: "Fingerprint profile tidak valid" }, { status: 400 });
        }

        const profile = await approveLoginProfile({
            profileId: id,
            fingerprint,
            approvedById: session.user.id,
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "PORTAL",
            action: "PORTAL_LOGIN_PROFILE_APPROVED",
            entityType: "PORTAL_LOGIN_PROFILE",
            entityId: profile.id,
            changes: {
                origin: profile.origin,
                entryPath: profile.entryPath,
                fingerprint: profile.currentFingerprint,
                layer: profile.detectionLayer,
            },
            request,
        });

        return NextResponse.json({ profile });
    } catch (error) {
        if (error instanceof LoginProfileApprovalError) {
            const status = error.message === "Profil deteksi tidak ditemukan." ? 404 : 409;
            return NextResponse.json({ error: error.message }, { status });
        }
        console.error("POST /api/portal-login-profiles/[id]/approve:", error);
        return NextResponse.json({ error: "Gagal menyetujui profile deteksi" }, { status: 500 });
    }
}
