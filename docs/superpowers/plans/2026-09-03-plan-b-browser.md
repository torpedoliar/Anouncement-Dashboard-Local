# Plan B — Browser-first Stabil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browserless hidup terpantau: health check eksplisit dengan alasan spesifik, render-awal paralel untuk kandidat SPA, degradasi jujur bila mati.

**Architecture:** Fungsi murni `portal-browser-health.ts` (`checkBrowserHealth`) + orkestrasi di `portal-detect-ladder.ts` (render paralel via `Promise.allSettled` bila HTML mentah terlihat shell SPA) + flag `browserUnavailable` + alasan di `LadderResult.layerNotes`. Tanpa dependensi baru.

**Tech Stack:** TypeScript, fetch + AbortSignal, `npx tsx scripts/*.ts` self-check.

## Global Constraints

- Timeout health check maksimal 3 detik; tidak boleh memperlambat deteksi bila browser mati (fail-fast).
- Alasan kegagalan spesifik dalam Bahasa Indonesia: container mati / timeout / kontrak tak dikenal.
- Tiap task diakhiri commit pesan Indonesia.

---

### Task 1: Health check browser + alasan spesifik

**Files:**
- Create: `lib/portal-browser-health.ts`
- Create: `scripts/test-browser-health.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `checkBrowserHealth(endpoint?: string, timeoutMs?: number): Promise<{ ok: boolean; reason: string | null }>` — dipakai Task 2. `ok:false` dengan reason salah satu: `"BROWSER_URL kosong"`, `"container mati/tidak terjangkau"`, `"timeout"`, `"kontrak tak dikenal (bukan Browserless /content)"`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/test-browser-health.ts
import { checkBrowserHealth } from "../lib/portal-browser-health";

let failed = 0;
function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

const empty = await checkBrowserHealth("", 500);
check(empty.ok === false && typeof empty.reason === "string" && empty.reason.length > 0, "health: endpoint kosong -> alasan jelas");

const dead = await checkBrowserHealth("http://127.0.0.1:9", 500);
check(dead.ok === false && typeof dead.reason === "string" && dead.reason.length > 0, "health: port mati -> alasan jelas");
console.log(failed === 0 ? "Semua lolos." : `${failed} gagal.`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-browser-health.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/portal-browser-health.ts
export interface BrowserHealth {
    ok: boolean;
    reason: string | null;
}

/**
 * Health check Browserless: GET /json/version dengan timeout pendek.
 * Endpoint /json/version adalah kontrak stabil Browserless v1 dan v2.
 */
export async function checkBrowserHealth(endpoint?: string, timeoutMs = 3000): Promise<BrowserHealth> {
    const base = (endpoint ?? process.env.PORTAL_BROWSER_URL ?? "").trim().replace(/\/+$/, "");
    if (!base) return { ok: false, reason: "BROWSER_URL kosong — lapis browser nonaktif, isi PORTAL_BROWSER_URL" };
    try {
        const res = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(Math.max(300, timeoutMs)) });
        if (!res.ok) return { ok: false, reason: `Browserless menjawab HTTP ${res.status} di /json/version — kontrak tak dikenal` };
        return { ok: true, reason: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        if (/aborted|timeout|Timeout/i.test(message)) {
            return { ok: false, reason: `Browserless timeout (${timeoutMs}ms) — container lambat/overload` };
        }
        return { ok: false, reason: `Browserless tidak terjangkau di ${base} — container mati/belum jalan (${message.slice(0, 80)})` };
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-browser-health.ts`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-browser-health.ts scripts/test-browser-health.ts
git commit -m "feat(portal): health check Browserless dengan alasan spesifik"
```

---

### Task 2: Render-awal paralel + degradasi jujur di ladder

**Files:**
- Modify: `lib/portal-detect-ladder.ts` (lines 53-177: tambah health check di awal, render paralel bila shell SPA, flag browserUnavailable)
- Modify: `scripts/test-detect-ladder.ts` (tambah kasus; JANGAN hapus kasus WIP yang ada)

**Interfaces:**
- Consumes: `checkBrowserHealth` (Task 1), `looksLikeClientRenderedApp` dari `lib/portal-sso-relay.ts`, `LadderDeps` yang sudah ada (tambah field opsional `checkHealth?: typeof checkBrowserHealth`).
- Produces: `LadderResult` bertambah field opsional `browserUnavailable?: boolean`; `layerNotes` berisi alasan spesifik bila browser mati.

- [ ] **Step 1: Write the failing test**

Tambah ke `scripts/test-detect-ladder.ts` (di akhir, tanpa mengubah helper/case lama):

```ts
// Kasus browser mati: alasan spesifik tercatat, hasil HTTP tetap dipakai.
{
    const { detectWithLadder } = await import("../lib/portal-detect-ladder");
    const html = `<html><body><form action="/login"><input name="u"><input type="password" name="p"></form></body></html>`;
    const r = await detectWithLadder("https://x.example/login", {
        fetchPage: (async () => ({
            html, finalUrl: "https://x.example/login", setCookies: [], redirected: false, loopDetected: false,
        })) as never,
        checkHealth: (async () => ({ ok: false, reason: "Browserless tidak terjangkau" })) as never,
        render: (async () => null) as never,
    });
    assertEq(r.browserUnavailable, true, "browser mati -> flag browserUnavailable");
    assertEq(r.detected.passwordField, "p", "browser mati -> hasil HTTP tetap dipakai");
    assertEq(r.layerNotes.some((n: string) => n.includes("Browserless")), true, "browser mati -> alasan spesifik di layerNotes");
}
```

Catatan: sesuaikan dengan bentuk `assertEq` dan struktur `fetchPage` mock yang sudah ada di file (lihat kasus lama untuk shape `FetchedPage`: setCookies, cookieJar, hopChain).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-detect-ladder.ts`
Expected: FAIL (browserUnavailable undefined / checkHealth bukan fungsi yang dikenal deps)

- [ ] **Step 3: Write minimal implementation**

Di `lib/portal-detect-ladder.ts`:

```ts
import { checkBrowserHealth } from "@/lib/portal-browser-health";

// Tambah ke LadderResult:
browserUnavailable?: boolean;

// Tambah ke LadderDeps:
checkHealth?: typeof checkBrowserHealth;
```

Di awal `detectWithLadder` (setelah `const notes`):

```ts
const checkHealth = deps.checkHealth ?? checkBrowserHealth;
const health = await checkHealth();
const browserUp = health.ok;
if (!browserUp) {
    notes.push(`Render browser tidak tersedia: ${health.reason}. Hasil memakai HTML statis; SPA mungkin tidak terdeteksi.`);
}
```

Catatan cakupan (spec Seksi 3 poin 3): snapshot network XHR TIDAK dikerjakan di plan ini — kontrak `/content` Browserless tidak mengekspos network log, dan menambah kontrak browser baru di luar cakupan. DOM snapshot tetap seperti kini.

Render paralel: setelah `detectLoginFields` HTTP dan bila `!detected.passwordField && looksLikeClientRenderedApp(page.html) && browserUp`, jalankan `render(url)` BERSAMAAN dengan probe persiapan lain? Minimal: panggil render segera tanpa menunggu cabang lama — struktur lama sudah memanggil render tepat di titik itu; yang berubah: health check di awal + flag. Untuk "paralel dengan probe": probe OpenAPI di lapis 3 hanya jalan bila render gagal — biarkan. Tambah di semua return: `browserUnavailable: !browserUp`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-detect-ladder.ts`
Expected: semua PASS (lama + baru).

- [ ] **Step 5: Commit**

```bash
git add lib/portal-detect-ladder.ts scripts/test-detect-ladder.ts
git commit -m "feat(portal): health check + degradasi jujur lapis browser di ladder"
```
