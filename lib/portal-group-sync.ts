/**
 * Reconcile group portal — inti sinkronisasi departemen → group (Spec Issue #1,
 * tiket #2). FUNGSI MURNI: tidak menyentuh DB/Prisma. Deterministik & idempotent.
 *
 * Aturan (kesepahaman interview 2026-09-04):
 * - Group DEPARTMENT diisi mengikuti `departemen` user; group MANUAL tak disentuh.
 * - Nama departemen dinormalisasi 3 lapis: trim+kapitalisasi → alias → auto-create.
 * - "All Staff" berisi semua user aktif+eligible (baseline, diperlakukan sync-managed).
 * - User tanpa departemen: skip dari group departemen (tetap dapat All Staff) + dilapor.
 * - User eligible=false / isActive=false: dikeluarkan dari SEMUA group sync-managed.
 *
 * ponytail: normalisasi = trim + kapitalisasi per kata. Cukup utk kasus
 * "beda kapital/spasi"; alias table menangani sisanya (mis. "ACC" → "Accounting").
 */

export const ALL_STAFF_GROUP = "All Staff";

/** Group yang dikelola sync: DEPARTMENT + baseline All Staff (apapun kind-nya). */
export function isSyncManaged(group: { name: string; kind: GroupKind }): boolean {
    return group.kind === "DEPARTMENT" || group.name === ALL_STAFF_GROUP;
}

export type GroupKind = "MANUAL" | "DEPARTMENT";

export interface ReconcileUser {
    id: string;
    departemen: string | null;
    eligible: boolean;
    isActive: boolean;
}
export interface ReconcileGroup {
    name: string;
    kind: GroupKind;
}
export interface ReconcileMembership {
    user: string;
    group: string;
}
export interface ReconcileInput {
    users: ReconcileUser[];
    groups: ReconcileGroup[];
    memberships: ReconcileMembership[];
    /** nama mentah HRIS → nama group canonical */
    aliases: Record<string, string>;
}
export interface ReconcileOp {
    user: string;
    group: string;
    op: "add" | "remove";
}
export interface ReconcileResult {
    /** Group DEPARTMENT yang perlu dibuat (belum ada). */
    createGroups: { name: string }[];
    membershipOps: ReconcileOp[];
    /** Departemen ternormalisasi yang belum punya group (mengikuti createGroups). */
    newDepartments: string[];
    /** User id yang tidak punya departemen (skip dari group departemen). */
    missingDepartments: string[];
    /** User yang dikeluarkan karena non-eligible/non-aktif. */
    removedInactive: string[];
}

/** Normalisasi nama departemen/jabatan: trim + kapitalisasi konsisten. */
export function normalizeName(raw: string): string {
    return raw
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}

/** Departemen mentah → nama group canonical (alias dulu, baru normalisasi). */
function canonicalize(raw: string, aliases: Record<string, string>): string {
    const alias = aliases[raw.trim()];
    if (alias) return alias;
    return normalizeName(raw);
}

export function reconcileGroups(input: ReconcileInput): ReconcileResult {
    const result: ReconcileResult = {
        createGroups: [],
        membershipOps: [],
        newDepartments: [],
        missingDepartments: [],
        removedInactive: [],
    };

    // Index state saat ini.
    const existingNames = new Set(input.groups.map((g) => g.name));
    // user -> set group saat ini
    const current = new Map<string, Set<string>>();
    for (const m of input.memberships) {
        if (!current.has(m.user)) current.set(m.user, new Set());
        current.get(m.user)!.add(m.group);
    }

    // Target keanggotaan per user: departemen group (utk aktif) + All Staff.
    // Urutan user dipertahankan → operasi deterministik.
    const want = new Map<string, Set<string>>();

    for (const u of input.users) {
        const active = u.eligible && u.isActive;
        if (!active) continue; // tidak punya target apa pun → semua sync-managed dihapus

        const targets = new Set<string>([ALL_STAFF_GROUP]);
        if (u.departemen && u.departemen.trim()) {
            const canonical = canonicalize(u.departemen, input.aliases);
            targets.add(canonical);
            if (!existingNames.has(canonical) && !result.newDepartments.includes(canonical)) {
                result.newDepartments.push(canonical);
                result.createGroups.push({ name: canonical });
            }
        } else {
            if (!result.missingDepartments.includes(u.id)) {
                result.missingDepartments.push(u.id);
            }
        }
        want.set(u.id, targets);
    }

    // Operasi per user: bandingkan target vs current, HANYA di group sync-managed.
    const syncManagedNames = new Set(
        input.groups.filter(isSyncManaged).map((g) => g.name)
    );
    // Group target yang mungkin belum ada (akan dibuat) tetap sync-managed.
    for (const name of result.newDepartments) syncManagedNames.add(name);
    // All Staff mungkin belum ada di daftar group — tetap sync-managed.
    syncManagedNames.add(ALL_STAFF_GROUP);

    const allTouched = new Set<string>([...current.keys(), ...want.keys()]);
    const sortedUsers = [...allTouched].sort(); // deterministik
    for (const userId of sortedUsers) {
        const w = want.get(userId) ?? new Set<string>();
        const c = current.get(userId) ?? new Set<string>();
        // remove dulu (urutan stabil saat audit), lalu add.
        for (const g of [...c].sort()) {
            if (!w.has(g) && syncManagedNames.has(g)) {
                result.membershipOps.push({ user: userId, group: g, op: "remove" });
            }
        }
        for (const g of [...w].sort()) {
            if (!c.has(g)) {
                result.membershipOps.push({ user: userId, group: g, op: "add" });
            }
        }
    }

    for (const op of result.membershipOps) {
        if (op.op === "remove" && !result.removedInactive.includes(op.user)) {
            const u = input.users.find((x) => x.id === op.user);
            if (u && !(u.eligible && u.isActive)) result.removedInactive.push(op.user);
        }
    }

    return result;
}
