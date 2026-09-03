/**
 * Self-check untuk bagian murni lib/portal-llm-analyze.ts (tanpa DB/LLM).
 * Run: npx tsx scripts/test-llm-analyze.ts
 *
 * Yang dijaga: DOM pruning tidak membocorkan nilai input/token ke prompt, dan
 * parser jawaban LLM tahan format aneh (markdown fence, teks tambahan).
 */
import { __llmTestables } from "../lib/portal-llm-analyze";

const { pruneDom, safeJsonObject, stripUrlSecrets } = __llmTestables;
let failed = 0;

function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

const html = `<!DOCTYPE html><html><head><title>Login HRIS</title></head><body>
<form action="/auth/login" method="post">
  <input type="hidden" name="_token" value="SECRET-TOKEN-123">
  <input type="text" name="nik" id="nik" placeholder="Nomor Induk Karyawan" value="12345">
  <input type="password" name="password" value="jangan-bocor">
  <button type="submit">Masuk</button>
</form></body></html>`;

const pruned = pruneDom(html);
check(pruned.summary.includes("name=nik"), "prune: field nik masuk ringkasan");
check(pruned.summary.includes("name=password"), "prune: field password masuk ringkasan");
check(pruned.summary.includes("name=_token"), "prune: nama hidden token masuk (nama saja)");
check(!pruned.summary.includes("SECRET-TOKEN-123"), "prune: nilai token TIDAK bocor");
check(!pruned.summary.includes("jangan-bocor"), "prune: nilai password TIDAK bocor");
check(!pruned.summary.includes("12345"), "prune: nilai field teks TIDAK bocor");
check(pruned.summary.includes("/auth/login"), "prune: action form masuk ringkasan");
check(pruned.fieldKeys.has("nik") && pruned.fieldKeys.has("password"), "prune: fieldKeys berisi nama field nyata");
check(pruned.formActions.has("/auth/login"), "prune: formActions berisi action nyata");

check(safeJsonObject('{"usernameField":"nik"}') !== null, "parse: JSON polos");
check(safeJsonObject('Berikut jawabannya:\n```json\n{"usernameField":"nik","multiStep":false}\n```') !== null, "parse: JSON dalam markdown fence");
check(safeJsonObject("bukan json sama sekali") === null, "parse: teks non-JSON -> null");
// Array yang membungkus objek tetap diekstrak objeknya (verifikasi field terjadi
// di tahap berikutnya; parser sengaja toleran format).
check(safeJsonObject('[{"a":1}]') !== null, "parse: objek di dalam array tetap diekstrak");

// Query/fragment URL (token WS-Fed, OAuth code di hash) tidak boleh keluar ke LLM.
const stripped = stripUrlSecrets("https://idp.example.com/adfs/ls?wa=wsignin1.0&SAMLRequest=SECRET&x=1#/code=abc");
check(!stripped.includes("SECRET") && !stripped.includes("abc"), "url: query/fragment dibuang");
check(stripped === "https://idp.example.com/adfs/ls", "url: origin+path dipertahankan");
check(stripUrlSecrets("bukan-url?token=x") === "bukan-url", "url: non-URL fallback aman");

console.log(failed === 0 ? "\nSemua lolos." : `\n${failed} gagal.`);
if (failed > 0) process.exit(1);
