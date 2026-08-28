import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { provisionJitPortalUser, maskNik } from "@/lib/hris-jit";

// ============================================================================
// Set-password API (TASK-29) — aktivasi akun JIT (passwordHash=NULL)
//   POST /api/portal/set-password  body: { nik, password }
//   → { success: true, redirectTo: "/portal-login" } (kontrak dgn Meredith TASK-30)
//
// Alur:
//   1. NIK belum ada sebagai PortalUser → JIT provision ke HRIS (valid+eligible) → create.
//   2. Kalau user sudah ada dan passwordHash SUDAH terisi → tolak (reset via admin).
//   3. Set password (bcrypt), aktifkan, reset lockout.
// Unauthenticated — akun JIT belum punya session.
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        const nik = typeof body?.nik === "string" ? body.nik.trim() : "";
        const password = typeof body?.password === "string" ? body.password : "";

        if (!nik) {
            return NextResponse.json({ error: "NIK wajib diisi" }, { status: 400 });
        }
        if (!password || password.length < 8) {
            return NextResponse.json({ error: "Kata sandi minimal 8 karakter" }, { status: 400 });
        }

        // JIT: jika NIK valid+eligible di HRIS tapi belum ada PortalUser → auto-create (deliverable #3)
        const provision = await provisionJitPortalUser(nik);
        if (provision.status === "not_found") {
            return NextResponse.json({ error: "NIK tidak ditemukan di HRIS" }, { status: 404 });
        }
        if (provision.status === "not_eligible") {
            return NextResponse.json({ error: "Akun belum terverifikasi di sistem HR. Hubungi admin." }, { status: 403 });
        }
        if (provision.status === "unavailable") {
            return NextResponse.json({ error: "Layanan verifikasi HRIS sedang tidak tersedia. Coba lagi nanti." }, { status: 503 });
        }

        const user = await prisma.portalUser.findUnique({ where: { id: provision.userId } });
        if (!user) {
            return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
        }

        // Sudah punya password → bukan first-set; reset dikelola admin (admin reset-password).
        if (user.passwordHash) {
            return NextResponse.json({ error: "Akun ini sudah memiliki kata sandi" }, { status: 409 });
        }
        if (!user.isActive) {
            return NextResponse.json({ error: "Akun dinonaktifkan. Hubungi administrator." }, { status: 403 });
        }
        if (!user.eligible) {
            return NextResponse.json({ error: "Akun tidak aktif di HRIS. Hubungi administrator." }, { status: 403 });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.portalUser.update({
            where: { id: user.id },
            data: {
                passwordHash,
                failedLoginCount: 0,
                lockedUntil: null,
            },
        });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: user.id,
            category: "AUTH",
            action: "PORTAL_PASSWORD_SET",
            entityType: "PORTAL_USER",
            entityId: user.id,
            changes: { nik: maskNik(nik) },
            severity: "INFO",
            request,
        });

        return NextResponse.json({ success: true, redirectTo: "/portal-login" });
    } catch (error) {
        console.error("Error setting portal password:", error);
        return NextResponse.json({ error: "Gagal mengatur kata sandi" }, { status: 500 });
    }
}