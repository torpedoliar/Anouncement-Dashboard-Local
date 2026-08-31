import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";
import { logAudit } from "@/lib/audit";

// ============================================================================
// Delete-all portal users (TASK-41A) — bulk destructive, password-gated.
//   POST /api/admin/portal-users/delete-all  body: { adminPassword }
//   → { deletedCount }
//
// Auth: SuperAdmin ONLY (guard ganda: sesi + verifikasi password admin via
// bcrypt terhadap passwordHash CMS User). Hanya role PORTAL_USER yang dihapus —
// PORTAL_ADMIN tidak disentuh. Relasi (appAccess/credentials/sessions/groups/
// visibility) ikut karena onDelete: Cascade; AuditLog.portalUser SetNull —
// jejak audit TETAP UTUH untuk investigasi (BOUNDARIES TASK-41).
// ============================================================================

// Minimal panjang body adminPassword — guard input murah sebelum bcrypt (murah).
const MIN_ADMIN_PASSWORD_LEN = 1;

export async function POST(request: NextRequest) {
    try {
        // Guard 1: SuperAdmin session (pola existing route portal-users).
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const adminPassword = typeof body?.adminPassword === "string" ? body.adminPassword : "";
        if (adminPassword.length < MIN_ADMIN_PASSWORD_LEN) {
            return NextResponse.json({ error: "Password admin wajib diisi" }, { status: 400 });
        }

        // Guard 2: verifikasi password admin (bcrypt, pattern lib/portal-auth.ts).
        // SUPERVISI god: sesi bisa hijack — password memaksa kehadiran admin yang
        // benar-benar ada di keyboard. Hanya guard superAdmin gagal memenuhi itu.
        const admin = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, passwordHash: true },
        });
        if (!admin) {
            return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 401 });
        }
        const passwordOk = await compare(adminPassword, admin.passwordHash);
        if (!passwordOk) {
            await logAudit({
                actorType: "ADMIN_USER",
                actorId: session.user.id,
                category: "SECURITY",
                action: "PORTAL_USERS_PURGE_DENIED",
                entityType: "PORTAL_USER",
                entityId: "delete-all",
                outcome: "FAILURE",
                errorMessage: "Verifikasi password admin gagal",
                request,
            }).catch(() => {});
            return NextResponse.json({ error: "Password admin salah" }, { status: 401 });
        }

        // Hanya PORTAL_USER — PORTAL_ADMIN tidak boleh terhapus (kontrak TASK-41).
        const deleted = await prisma.portalUser.deleteMany({
            where: { role: "PORTAL_USER" },
        });

        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id,
            category: "USER_MGMT",
            action: "PORTAL_USERS_PURGED",
            entityType: "PORTAL_USER",
            entityId: "delete-all",
            severity: "WARNING",
            metadata: {
                deletedCount: deleted.count,
                // role PORTAL_ADMIN di-skip oleh filter where (tidak ikut dihitung).
            },
            request,
        });

        return NextResponse.json({ deletedCount: deleted.count });
    } catch (error) {
        console.error("Error deleting all portal users:", error);
        return NextResponse.json({ error: "Failed to delete portal users" }, { status: 500 });
    }
}
