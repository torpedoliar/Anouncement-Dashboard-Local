/**
 * Harness regresi untuk reconcile group portal (tiket #2).
 *
 *   npx tsx scripts/test-group-sync.ts            — semua fixture
 *   npx tsx scripts/test-group-sync.ts <nama>     — satu fixture
 *
 * Fixture: scripts/group-sync-fixtures/expected.json
 * (input users/groups/aliases/memberships → operasi yang diharapkan).
 * Exit code 1 bila ada yang gagal.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reconcileGroups } from "../lib/portal-group-sync";

interface FixtureUser {
    id: string;
    departemen: string | null;
    eligible: boolean;
    isActive: boolean;
}
interface FixtureGroup {
    name: string;
    kind: "MANUAL" | "DEPARTMENT";
}
interface FixtureMembership {
    user: string;
    group: string;
}
interface ExpectOp {
    user: string;
    group: string;
    op: "add" | "remove";
}
interface Expected {
    users: FixtureUser[];
    groups: FixtureGroup[];
    aliases?: Record<string, string>;
    memberships?: FixtureMembership[];
    expect: {
        createGroups?: { name: string }[];
        membershipOps?: ExpectOp[];
        newDepartments?: string[];
        missingDepartments?: string[];
    };
}

const dir = join(__dirname, "group-sync-fixtures");
const fixtures = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as Record<string, Expected>;
delete (fixtures as Record<string, unknown>).$schema;
delete (fixtures as Record<string, unknown>).note;

const only = process.argv[2];
const names = Object.keys(fixtures).filter((n) => !only || n === only);

let pass = 0;
let fail = 0;

for (const name of names) {
    const fx = fixtures[name];
    const result = reconcileGroups({
        users: fx.users.map((u) => ({ ...u })),
        groups: fx.groups.map((g) => ({ ...g })),
        memberships: (fx.memberships ?? []).map((m) => ({ ...m })),
        aliases: { ...(fx.aliases ?? {}) },
    });

    const problems: string[] = [];
    const gotOps = result.membershipOps.map(
        (o) => `${o.op}:${o.user}->${o.group}`
    );
    const wantOps = (fx.expect.membershipOps ?? []).map(
        (o) => `${o.op}:${o.user}->${o.group}`
    );
    if (JSON.stringify(gotOps) !== JSON.stringify(wantOps)) {
        problems.push(`membershipOps:\n    harap: ${JSON.stringify(wantOps)}\n    dapat: ${JSON.stringify(gotOps)}`);
    }

    const gotCreate = result.createGroups.map((g) => g.name);
    const wantCreate = (fx.expect.createGroups ?? []).map((g) => g.name);
    if (JSON.stringify(gotCreate) !== JSON.stringify(wantCreate)) {
        problems.push(`createGroups: harap ${JSON.stringify(wantCreate)}, dapat ${JSON.stringify(gotCreate)}`);
    }

    const gotNew = result.newDepartments;
    const wantNew = fx.expect.newDepartments ?? [];
    if (JSON.stringify(gotNew) !== JSON.stringify(wantNew)) {
        problems.push(`newDepartments: harap ${JSON.stringify(wantNew)}, dapat ${JSON.stringify(gotNew)}`);
    }

    const gotMissing = result.missingDepartments;
    const wantMissing = fx.expect.missingDepartments ?? [];
    if (JSON.stringify(gotMissing) !== JSON.stringify(wantMissing)) {
        problems.push(`missingDepartments: harap ${JSON.stringify(wantMissing)}, dapat ${JSON.stringify(gotMissing)}`);
    }

    if (problems.length) {
        fail++;
        console.log(`FAIL ${name}`);
        for (const p of problems) console.log(`     ${p}`);
    } else {
        pass++;
        console.log(`PASS ${name}`);
    }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
