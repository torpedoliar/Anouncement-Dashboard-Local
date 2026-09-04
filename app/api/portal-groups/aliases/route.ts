import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// GET /api/portal-groups/aliases - Daftar alias nama departemen (SuperAdmin only)
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const aliases = await prisma.portalNameAlias.findMany({
            where: { tipe: "DEPARTMENT" },
            orderBy: { rawName: "asc" },
        });
        return NextResponse.json({ data: aliases });
    } catch (error) {
        console.error("Error fetching name aliases:", error);
        return NextResponse.json({ error: "Gagal memuat alias" }, { status: 500 });
    }
}

// POST /api/portal-groups/aliases - Tambah alias { rawName, canonical } (SuperAdmin only)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const rawName = typeof body.rawName === "string" ? body.rawName.trim() : "";
        const canonical = typeof body.canonical === "string" ? body.canonical.trim() : "";
        if (!rawName || !canonical) {
            return NextResponse.json({ error: "rawName dan canonical wajib diisi" }, { status: 400 });
        }

        const duplicate = await prisma.portalNameAlias.findUnique({
            where: { tipe_rawName: { tipe: "DEPARTMENT", rawName } },
        });
        if (duplicate) {
            return NextResponse.json(
                { error: `Alias "${rawName}" sudah ada → "${duplicate.canonical}"` },
                { status: 409 }
            );
        }

        const alias = await prisma.portalNameAlias.create({
            data: { tipe: "DEPARTMENT", rawName, canonical },
        });
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id ?? undefined,
            category: "PORTAL",
            action: "PORTAL_NAME_ALIAS_CREATE",
            entityType: "PortalNameAlias",
            entityId: alias.id,
            metadata: { rawName, canonical },
        }).catch(() => {});

        return NextResponse.json({ data: alias }, { status: 201 });
    } catch (error) {
        console.error("Error creating name alias:", error);
        return NextResponse.json({ error: "Gagal menambah alias" }, { status: 500 });
    }
}

// DELETE /api/portal-groups/aliases?id=... (SuperAdmin only)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const id = new URL(request.url).searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Parameter id wajib" }, { status: 400 });
        }

        const deleted = await prisma.portalNameAlias.delete({ where: { id } });
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id ?? undefined,
            category: "PORTAL",
            action: "PORTAL_NAME_ALIAS_DELETE",
            entityType: "PortalNameAlias",
            entityId: id,
            metadata: { rawName: deleted.rawName, canonical: deleted.canonical },
        }).catch(() => {});

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error deleting name alias:", error);
        return NextResponse.json({ error: "Gagal menghapus alias" }, { status: 500 });
    }
}
