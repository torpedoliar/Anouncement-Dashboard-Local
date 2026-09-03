/**
 * Self-check untuk bagian murni lib/portal-llm-analyze.ts (tanpa DB/LLM).
 * Run: npx tsx scripts/test-llm-analyze.ts
 *
 * Yang dijaga: DOM pruning tidak membocorkan nilai input/token ke prompt, dan
 * parser jawaban LLM tahan format aneh (markdown fence, teks tambahan).
 */
import { __llmTestables } from "../lib/portal-llm-analyze";

const { pruneDom, safeJsonObject, stripUrlSecrets, extractChatContent, chatCompletionsUrl, assertSafePrompt, buildAnalysisPrompt } = __llmTestables;
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

// Ekstraksi content dari berbagai bentuk respons provider.
check(
    extractChatContent('{"choices":[{"message":{"content":"{\\"ok\\":true}"}}]}') === '{"ok":true}',
    "extract: JSON chat completions standar"
);
check(
    extractChatContent('{"message":{"role":"assistant","content":"halo"},"done":true}') === "halo",
    "extract: objek tunggal gaya Ollama native"
);
check(
    extractChatContent('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n') === "Hello",
    "extract: SSE stream (delta dirangkai)"
);
check(
    extractChatContent('{"message":{"content":"Hel"},"done":false}\n{"message":{"content":"lo"},"done":true}') === "Hello",
    "extract: NDJSON stream (Ollama native)"
);
check(extractChatContent("<html>404 not found</html>") === null, "extract: HTML error page -> null");
check(
    extractChatContent('{"choices":[{"finish_reason":"length","message":{"content":"","reasoning_content":"The user wants"}}]}') === "The user wants",
    "extract: reasoning model content kosong -> fallback reasoning_content"
);

// Normalisasi endpoint.
check(chatCompletionsUrl("https://api.openai.com/v1") === "https://api.openai.com/v1/chat/completions", "endpoint: base /v1 dilengkapi");
check(chatCompletionsUrl("https://api.openai.com/v1/chat/completions") === "https://api.openai.com/v1/chat/completions", "endpoint: URL lengkap tidak dobel");
check(chatCompletionsUrl("http://ollama:11434/v1/") === "http://ollama:11434/v1/chat/completions", "endpoint: trailing slash dibersihkan");

// Guard privasi: payload bersih lolos, pola sensitif dibatalkan.
let threw = false;
try { assertSafePrompt('URL halaman: https://x.example/login\ninput type=text name=nik'); } catch { threw = true; }
check(!threw, "guard: payload bersih lolos");

const leaks: Array<[string, string]> = [
    ["value=", 'input type=text name=nik value="12345"'],
    ["email", "hubungi budi.santoso@example.com untuk akses"],
    ["nik-digit", "karyawan 12345678 sudah terdaftar"],
    ["token", "token: ThT4PqRmEPhKr6+/D1h7Zu0Q3MK3oYo/o8BNIwWU1e0isb1IOc2eIMUgpnhwwx4VSE2hkZ7qohiykRjITA/S3g=="],
];
for (const [label, payload] of leaks) {
    let blocked = false;
    try { assertSafePrompt(payload); } catch { blocked = true; }
    check(blocked, `guard: pola ${label} dibatalkan`);
}

// Normalisasi reasoning (spec Seksi 4 poin 2): JSON di dalam teks penalaran
// tetap bisa diparsing menjadi objek analisis.
const reasoningText = 'Saya analisis dulu. {"usernameField":"nik","passwordField":"katasandi","multiStep":false} Selesai.';
check(safeJsonObject(reasoningText)?.passwordField === "katasandi", "reasoning: JSON di dalam teks penalaran terekstrak");

// Evidence yang membawa NIK palsu harus menggagalkan guard (jalur prompt utuh).
const dirtyPrompt = buildAnalysisPrompt({
    url: "https://hris.example.com/login",
    layer: "HTTP",
    heuristicNote: "tidak ada form",
    evidence: "koreksi sebelumnya untuk NIK 12345678",
    domSummary: "input type=text name=nik",
});
let dirtyBlocked = false;
try { assertSafePrompt(dirtyPrompt); } catch { dirtyBlocked = true; }
check(dirtyBlocked, "guard: evidence ber-NIK membatalkan seluruh prompt");

console.log(failed === 0 ? "\nSemua lolos." : `\n${failed} gagal.`);
if (failed > 0) process.exit(1);
