/**
 * Harness regresi untuk detektor login portal.
 *
 *   npx tsx scripts/test-login-detect.ts           — semua fixture
 *   npx tsx scripts/test-login-detect.ts github    — satu fixture
 *
 * Fixture HTML ada di scripts/login-detect-fixtures/raw/<nama>.html,
 * ekspektasi di scripts/login-detect-fixtures/expected.json.
 * Exit code 1 bila ada yang gagal.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectLoginFields } from "../lib/portal-login-detect";

interface Expected {
    url: string;
    layer: "HTTP" | "BROWSER";
    usernameField: string | null;
    passwordField: string | null;
    actionContains?: string;
    multiStep?: boolean;
    note?: string;
}

const dir = join(__dirname, "login-detect-fixtures");
const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as Record<string, Expected>;
delete (expected as Record<string, unknown>).$schema;

const only = process.argv[2];
const names = Object.keys(expected).filter((n) => !only || n === only);

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const name of names) {
    const file = join(dir, "raw", `${name}.html`);
    let html: string;
    try {
        html = readFileSync(file, "utf8");
    } catch {
        console.log(`SKIP ${name}: fixture raw/${name}.html tidak ada`);
        continue;
    }
    const exp = expected[name];
    const result = detectLoginFields(html, { pageUrl: exp.url, layer: exp.layer });
    const problems: string[] = [];

    const gotUser = result.usernameField ?? null;
    const gotPass = result.passwordField ?? null;
    if (gotPass !== exp.passwordField) {
        problems.push(`passwordField: harap ${JSON.stringify(exp.passwordField)}, dapat ${JSON.stringify(gotPass)}`);
    }
    if (exp.passwordField !== null && gotUser !== exp.usernameField) {
        problems.push(`usernameField: harap ${JSON.stringify(exp.usernameField)}, dapat ${JSON.stringify(gotUser)}`);
    }
    if (exp.actionContains && !(result.formAction ?? "").includes(exp.actionContains)) {
        problems.push(`formAction: harap mengandung ${JSON.stringify(exp.actionContains)}, dapat ${JSON.stringify(result.formAction)}`);
    }
    if (exp.multiStep !== undefined) {
        const gotMulti = (result as { multiStep?: boolean }).multiStep ?? false;
        if (gotMulti !== exp.multiStep) {
            problems.push(`multiStep: harap ${exp.multiStep}, dapat ${gotMulti}`);
        }
    }

    if (problems.length === 0) {
        pass++;
        console.log(`PASS ${name}`);
    } else {
        fail++;
        failures.push(name);
        console.log(`FAIL ${name}`);
        for (const p of problems) console.log(`     - ${p}`);
        if (exp.note) console.log(`     note: ${exp.note}`);
    }
}

console.log(`\n${pass} lolos, ${fail} gagal dari ${pass + fail} fixture.`);
if (fail > 0) {
    console.log(`Gagal: ${failures.join(", ")}`);
    process.exit(1);
}
