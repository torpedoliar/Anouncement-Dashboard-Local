/**
 * Self-check health check Browserless (tanpa container nyata).
 * Run: npx tsx scripts/test-browser-health.ts
 */
import { checkBrowserHealth } from "../lib/portal-browser-health";

let failed = 0;
function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

async function main() {
    const empty = await checkBrowserHealth("", 500);
    check(empty.ok === false && typeof empty.reason === "string" && empty.reason.length > 0, "health: endpoint kosong -> alasan jelas");

    const dead = await checkBrowserHealth("http://127.0.0.1:9", 500);
    check(dead.ok === false && typeof dead.reason === "string" && dead.reason.length > 0, "health: port mati -> alasan jelas");
    console.log(failed === 0 ? "Semua lolos." : `${failed} gagal.`);
    if (failed > 0) process.exit(1);
}

void main();
