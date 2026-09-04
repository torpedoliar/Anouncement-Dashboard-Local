import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reconcileAndApply } from "@/lib/portal-group-sync";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

/**
 * Tiket #4: tombol "Rapikan" — jalankan reconcile departemen → group secara
 * manual dengan logika yang SAMA seperti sync otomatis.
 *   GET  ?dryRun=1 → preview (tidak menulis apa pun)
 *   POST           → apply
 * SuperAdmin only (sejajar /api/portal-groups).
 */

function summarize(plan: Awaited<ReturnType<typeof reconcileAndApply>>["plan"]) {
    return {
        groupsToCreate: plan.createGroups.map((g) => g.name),
        membershipOps: plan.membershipOps,
        membersAdded: plan.membershipOps.filter((o) => o.op === "add").length,
        membersRemoved: plan.membershipOps.filter((o) => o.op === "remove").length,
        newDepartments: plan.newDepartments,
        missingDepartments: plan.missingDepartments,
        removedInactive: plan.removedInactive,
    };
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        if (searchParams.get("dryRun") !== "1") {
            return NextResponse.json({ error: "Gunakan ?dryRun=1 untuk preview" }, { status: 400 });
        }

        // Dry-run: plan saja, tanpa apply.
        const [users, groups, memberships, aliases] = await Promise.all([
            prisma.portalUser.findMany({
                select: { id: true, departemen: true, eligible: true, isActive: true },
            }),
            prisma.portalGroup.findMany({ select: { id: true, name: true, kind: true } }),
            prisma.portalUserGroup.findMany({ select: { portalUserId: true, groupId: true } }),
            prisma.portalNameAlias.findMany({ where: { tipe: "DEPARTMENT" } }),
        ]);
        const { reconcileGroups } = await import("@/lib/portal-group-sync");
        const idToName = new Map(groups.map((g) => [g.id, g.name]));
        const plan = reconcileGroups({
            users,
            groups: groups.map((g) => ({ name: g.name, kind: g.kind })),
            memberships: memberships
                .map((m) => ({ user: m.portalUserId, group: idToName.get(m.groupId) ?? "" }))
                .filter((m) => m.group),
            aliases: Object.fromEntries(aliases.map((a) => [a.rawName, a.canonical])),
        });

        return NextResponse.json({ dryRun: true, summary: summarize(plan) });
    } catch (error) {
        console.error("Error dry-run group reconcile:", error);
        return NextResponse.json({ error: "Gagal membuat preview reconcile" }, { status: 500 });
    }
}

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const { plan, applied } = await reconcileAndApply(session.user.id ?? "admin");
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: session.user.id ?? undefined,
            category: "PORTAL",
            action: "PORTAL_GROUP_SYNC_MANUAL",
            entityType: "PortalGroup",
            entityId: "reconcile",
            metadata: { ...summarize(plan), applied },
        }).catch(() => {});

        return NextResponse.json({ applied, summary: summarize(plan) });
    } catch (error) {
        console.error("Error applying group reconcile:", error);
        return NextResponse.json({ error: "Gagal menerapkan reconcile group" }, { status: 500 });
    }
}
