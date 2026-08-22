# Portal SSO Detection Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah deteksi login portal dari tebak-sekali-berdasarkan-HTML-statis menjadi berlapis (HTTP → browser → uji login) yang menyimpan bukti, membuktikan konfigurasi benar, dan menangkap kegagalan senyap.

**Architecture:** Deteksi berhenti di lapis pertama yang berhasil. Lapis 1 (`fetchLoginPage` + `detectLoginFields`, sudah ada) menangani aplikasi klasik. Lapis 2 merender dengan Chromium di container terpisah bila lapis 1 tidak menemukan form — hanya untuk SPA, dan mati secara degradasi bila layanan tidak tersedia. Lapis 3 (`relayLogin`, sudah ada) menguji login sungguhan dengan kredensial sekali pakai. Hasil deteksi disimpan sebagai evidence di `PortalApp`; health check yang sudah ada menghitung ulang fingerprint untuk mendeteksi perubahan struktur form. Semua keputusan mode lewat `classifySsoMode` yang sudah ada.

**Tech Stack:** Next.js 15 App Router, Prisma 5 / PostgreSQL, TypeScript, parse5, browserless/chrome (container terpisah), self-check via `npx tsx scripts/*.ts` (tanpa framework test — pola repo).

**Spec:** `docs/superpowers/specs/2026-08-22-portal-sso-detection-ladder.md` — rencana ini berargumen dari spec; eksekutor membaca keduanya.

## Global Constraints

- UI strings dan commit messages dalam **Bahasa Indonesia** (konvensi repo).
- Seluruh mutasi lewat `lib/site-access.ts` / `lib/audit.ts` (`logAudit`) — jangan menulis ke `audit_logs` langsung.
- Impor memakai alias `@/*` (root repo), bukan `@/src/*`.
- Kredensial uji **tidak pernah** disimpan, tidak dicatat, tidak masuk audit — hanya hasilnya.
- `logAudit` adalah non-blocking dan tidak boleh melempar; jangan bungkus sebagai gate transaksi utama.
- Tidak ada framework test. Self-check = file `scripts/test-*.ts` + `assertEq`, run via `npx tsx`.
- Setelah edit `schema.prisma`, jalankan `npm run prisma:generate`; naikkan `schemaVersion` di `version.json` saat migrasi keluar.
- Setiap task berakhir dengan deliverable yang bisa diverifikasi sendiri + commit.

## Deviasi dari spec (sengaja, dicatat — bukan terlewat)

Keputusan berikut menyimpang dari kalimat spec dengan alasan konkret; jangan dianggap kelupaan.

1. **Render service tidak mengembalikan cookie** — spec menulis `{ html, cookies } | null`. Browserless/chromium (`/content`) tidak mengembalikan cookie, dan deteksi (menemukan form + klasifikasi mode) tidak membutuhkannya. Plan memakai `{ html } | null`; cookie untuk alur POST tetap datang dari `fetchLoginPage` di lapis 1. Bila suatu saat deteksi butuh cookie hasil render, kontraknya bisa diperluas dengan endpoint render sendiri.
2. **Fingerprint memakai `loginUrl` path, bukan `formAction` path** — spec menulis `formAction (path saja)`. `formAction` tidak dipersist di `PortalApp`, sedangkan `loginUrl` tersedia di titik simpan (Task 6) dan di health check (Task 8). Untuk aplikasi normal keduanya identik (form login = loginUrl). Kunci konsistensi: kedua titik memakai input yang sama, jadi perbandingan valid. Bila ingin persis spec, perlu field `formAction` tambahan — di luar cakupan.
3. **"Kegagalan berturut-turut" dibulatkan jadi "≥3 dalam 24 jam"** — spec menulis `berturut-turut ≥ 3`. Menghitung benar-benar berurutan butuh rangkaian per-app yang diurutkan; agregasi jendela 24 jam sudah menangkap aplikasi yang "selalu gagal" tanpa query lebih berat. Ini penjumlahan yang jujur: aplikasi gagal 3× dalam sehari ditandai merah, walau tak harus 3× berturut-turut.
4. **Param `ssoMode` di body `verify-login` tidak dipakai** — spec menulis `POST { url, ssoMode, ... }`. Route menjalankan login sungguhan lewat `relayLogin`; mode bukan input pilihan melainkan hasil inferensi dari halaman. `ssoMode` dibuang agar tidak ada argumen yang hanya menghiasi API. Bila ingin "verifikasi dengan mode tertentu", itu keputusan desain tersendiri.

---

### Task 1: Migrasi — field evidence di PortalApp

**Files:**
- Modify: `prisma/schema.prisma` (model `PortalApp`, sekitar baris 617)
- Create: `prisma/migrations/20260822000000_add_portal_detection_evidence/migration.sql`
- Modify: `version.json`

**Interfaces:**
- Produces: field baru `detectionConfidence`, `detectionSignals`, `detectionLayer`, `detectedAt`, `loginVerifiedAt`, `loginVerifyError`, `detectedFingerprint`, `loginFormChanged` pada `PortalApp`.

- [ ] **Step 1: Tambah field di `prisma/schema.prisma`**

Di dalam model `PortalApp`, setelah blok `// Health & Monitoring`:

```prisma
  // Detection evidence — hasil deteksi berlapis + verifikasi (spec detection-ladder)
  detectionConfidence  Int?          // skor dari detectLoginFields (mis. 2010 utk K2)
  detectionSignals     Json?         // bukti dari classifySsoMode
  detectionLayer       String?       // "HTTP" | "BROWSER" | "MANUAL"
  detectedAt           DateTime?
  loginVerifiedAt      DateTime?
  loginVerifyError     String?
  detectedFingerprint  String?
  loginFormChanged     Boolean       @default(false) // form login berubah sejak config terakhir
```

- [ ] **Step 2: Tulis migrasi SQL**

```sql
-- Create migration.sql untuk field evidence deteksi SSO
ALTER TABLE "portal_apps"
  ADD COLUMN "detectionConfidence" INTEGER,
  ADD COLUMN "detectionSignals" JSONB,
  ADD COLUMN "detectionLayer" TEXT,
  ADD COLUMN "detectedAt" TIMESTAMP(3),
  ADD COLUMN "loginVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "loginVerifyError" TEXT,
  ADD COLUMN "detectedFingerprint" TEXT,
  ADD COLUMN "loginFormChanged" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Generate Prisma client**

Run: `npm run prisma:generate`
Expected: client ter-generate tanpa error.

- [ ] **Step 4: Naikkan schemaVersion**

`version.json`: `"schemaVersion": "12"` → `"schemaVersion": "13"`.

- [ ] **Step 5: Verifikasi tsc + commit**

Run: `npx tsc --noEmit` — expected exit 0.

```bash
git add prisma/schema.prisma prisma/migrations/20260822000000_add_portal_detection_evidence/migration.sql version.json
git commit -m "feat(portal-sso): field evidence deteksi berlapis di PortalApp"
```

---

### Task 2: `lib/portal-fingerprint.ts` + self-check

**Files:**
- Create: `lib/portal-fingerprint.ts`
- Test: `scripts/test-fingerprint.ts`

**Interfaces:**
- Produces: `computeLoginFingerprint(input: { loginUrl: string; usernameField: string; passwordField: string; extraFieldNames: string[] }): string` — SHA-256 hex.

- [ ] **Step 1: Tulis self-check yang GAGAL dulu**

`scripts/test-fingerprint.ts`:

```ts
/**
 * Self-check untuk lib/portal-fingerprint.ts (tanpa DB, tanpa jaringan).
 * Run: npx tsx scripts/test-fingerprint.ts
 */
import { computeLoginFingerprint } from "../lib/portal-fingerprint";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const base = {
    loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login?wct=20260821T100000",
    usernameField: "UserName",
    passwordField: "Password",
    extraFieldNames: ["__RequestVerificationToken", "wa"],
};

const fp = computeLoginFingerprint(base);
assertEq(fp.length, 64, "output SHA-256 hex 64 char");
assertEq(computeLoginFingerprint(base), fp, "deterministik");

// Nilai token & query TIDAK boleh mengubah fingerprint
assertEq(
    computeLoginFingerprint({ ...base, loginUrl: "https://k2prodapp/Identity/STS/Forms/Account/Login?wct=999999" }),
    fp,
    "query berbeda (wct) → fingerprint sama"
);
assertEq(
    computeLoginFingerprint({ ...base, extraFieldNames: ["wa", "__RequestVerificationToken"] }),
    fp,
    "urutan extraFieldNames tidak penting"
);

// Perubahan struktur HARUS mengubah fingerprint
assertEq(
    computeLoginFingerprint({ ...base, usernameField: "user_id" }) !== fp,
    true,
    "nama username berubah → fingerprint berubah"
);
assertEq(
    computeLoginFingerprint({ ...base, passwordField: "pass" }) !== fp,
    true,
    "nama password berubah → fingerprint berubah"
);
assertEq(
    computeLoginFingerprint({ ...base, extraFieldNames: ["__RequestVerificationToken"] }) !== fp,
    true,
    "token hilang → fingerprint berubah"
);
assertEq(
    computeLoginFingerprint({ ...base, loginUrl: "https://k2prodapp/Other/Login" }) !== fp,
    true,
    "path berubah → fingerprint berubah"
);

console.log("=== ALL PASS ===");
```

- [ ] **Step 2: Jalankan — pastikan GAGAL karena modul belum ada**

Run: `npx tsx scripts/test-fingerprint.ts`
Expected: error `Cannot find module '../lib/portal-fingerprint'`.

- [ ] **Step 3: Implementasi minimal**

`lib/portal-fingerprint.ts`:

```ts
import { createHash } from "crypto";

/**
 * Fingerprint struktur form login.
 *
 * Nilai token dan query sengaja TIDAK ikut: nilai token berubah tiap akses
 * (K2: __RequestVerificationToken berbeda setiap request), dan query form action
 * K2 memuat timestamp/GUID sesi. Yang ditangkap hanya struktur yang bila berubah
 * akan merusak SSO: nama field, nama token, dan path endpoint login.
 */
export function computeLoginFingerprint(input: {
    loginUrl: string;
    usernameField: string;
    passwordField: string;
    extraFieldNames: string[];
}): string {
    let path: string;
    try {
        path = new URL(input.loginUrl).pathname;
    } catch {
        path = input.loginUrl;
    }
    const payload = [
        path,
        input.usernameField,
        input.passwordField,
        [...input.extraFieldNames].sort().join(","),
    ].join("|");
    return createHash("sha256").update(payload).digest("hex");
}
```

- [ ] **Step 4: Jalankan self-check — pastikan PASS**

Run: `npx tsx scripts/test-fingerprint.ts`
Expected: `=== ALL PASS ===`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-fingerprint.ts scripts/test-fingerprint.ts
git commit -m "feat(portal-sso): fingerprint struktur form login untuk deteksi drift"
```

---

### Task 3: `lib/portal-browser-render.ts` + self-check

**Files:**
- Create: `lib/portal-browser-render.ts`
- Test: `scripts/test-browser-render.ts`

**Interfaces:**
- Consumes: env `PORTAL_BROWSER_URL`.
- Produces: `interface RenderResult { html: string }`; `renderLoginPage(url: string, timeoutMs?: number): Promise<RenderResult | null>` — null = layanan tidak tersedia / env kosong.

- [ ] **Step 1: Tulis self-check yang GAGAL dulu**

`scripts/test-browser-render.ts` (memakai server HTTP lokal untuk men-stub layanan browser):

```ts
/**
 * Self-check untuk lib/portal-browser-render.ts (tanpa Chromium sungguhan).
 * Run: npx tsx scripts/test-browser-render.ts
 */
import http from "http";
import { AddressInfo } from "net";
import { renderLoginPage } from "../lib/portal-browser-render";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

function startStub(status: number, body: string): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            res.statusCode = status;
            res.setHeader("content-type", "text/html");
            res.end(body);
        });
        server.listen(0, () => {
            const port = (server.address() as AddressInfo).port;
            resolve({ server, port });
        });
    });
}

async function main() {
    // Env kosong → null (layanan tidak dikonfigurasi)
    delete process.env.PORTAL_BROWSER_URL;
    assertEq(await renderLoginPage("https://x/"), null, "env kosong → null");

    // Stub sehat → HTML dirender
    process.env.PORTAL_BROWSER_URL = "http://127.0.0.1:1"; // placeholder, diganti di bawah
    const stub = await startStub(200, `<html><body><form><input name="u"><input type="password" name="p"></form></body></html>`);
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${stub.port}`;
    const ok = await renderLoginPage("https://target.app/login");
    assertEq(ok !== null, true, "stub 200 → hasil non-null");
    assertEq(ok?.html.includes("type=\"password\""), true, "HTML hasil render terbaca");

    // Stub 500 → null
    const errStub = await startStub(500, "boom");
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${errStub.port}`;
    assertEq(await renderLoginPage("https://x/"), null, "stub 500 → null");

    // Layanan mati (port ditutup) → null, bukan exception
    const deadStub = await startStub(200, "");
    const deadPort = (deadStub.server.address() as AddressInfo).port;
    deadStub.server.close();
    process.env.PORTAL_BROWSER_URL = `http://127.0.0.1:${deadPort}`;
    assertEq(await renderLoginPage("https://x/"), null, "layanan mati → null");

    stub.server.close();
    errStub.server.close();
    console.log("=== ALL PASS ===");
}
main().catch((e) => { console.error("THROWN:", e.message); process.exitCode = 1; });
```

- [ ] **Step 2: Jalankan — pastikan GAGAL**

Run: `npx tsx scripts/test-browser-render.ts`
Expected: error `Cannot find module '../lib/portal-browser-render'`.

- [ ] **Step 3: Implementasi minimal**

`lib/portal-browser-render.ts`:

```ts
export interface RenderResult {
    html: string;
}

/**
 * Render halaman login dengan browser sungguhan (container Chromium terpisah).
 *
 * Kontrak: POST JSON {url} ke `${PORTAL_BROWSER_URL}/content`; respons text/html
 * adalah HTML hasil render setelah JavaScript jalan. Env kosong / layanan mati /
 * status non-2xx / timeout → null. Pemanggil wajib memperlakukan null sebagai
 * "lapis browser tidak tersedia" (degradasi jujur), bukan "form tidak ditemukan".
 */
export async function renderLoginPage(url: string, timeoutMs = 10000): Promise<RenderResult | null> {
    const endpoint = process.env.PORTAL_BROWSER_URL?.trim();
    if (!endpoint) return null;

    try {
        const res = await fetch(`${endpoint}/content`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return null;
        const html = await res.text();
        return { html: html.slice(0, 512 * 1024) };
    } catch {
        return null;
    }
}
```

- [ ] **Step 4: Jalankan self-check — pastikan PASS**

Run: `npx tsx scripts/test-browser-render.ts`
Expected: `=== ALL PASS ===`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-browser-render.ts scripts/test-browser-render.ts
git commit -m "feat(portal-sso): klien render browser (Chromium container terpisah)"
```

---

### Task 4: `lib/portal-detect-ladder.ts` + self-check

**Files:**
- Create: `lib/portal-detect-ladder.ts`
- Test: `scripts/test-detect-ladder.ts`

**Interfaces:**
- Consumes: `fetchLoginPage` & `FetchedPage` dari `@/lib/portal-fetch-html`; `detectLoginFields` & `DetectedFields` dari `@/lib/portal-login-detect`; `classifySsoMode`, `ModeEvidence`, `ModeVerdict` dari `@/lib/portal-sso-mode`; `renderLoginPage` dari `@/lib/portal-browser-render`.
- Produces:
  ```ts
  export type DetectionLayer = "HTTP" | "BROWSER";
  export interface LadderResult {
      html: string; finalUrl: string; setCookies: string[]; cookieNames: string[];
      hopChain?: string[]; redirected: boolean; loopDetected: boolean;
      detected: DetectedFields; verdict: ModeVerdict; layer: DetectionLayer;
      layerNotes: string[];
  }
  export async function detectWithLadder(url: string, deps?: LadderDeps): Promise<LadderResult>
  interface LadderDeps { fetchPage?: typeof fetchLoginPage; render?: typeof renderLoginPage }
  ```

- [ ] **Step 1: Tulis self-check yang GAGAL dulu**

`scripts/test-detect-ladder.ts` (DI: fake `fetchPage`/`render` → tidak menyentuh jaringan):

```ts
/**
 * Self-check untuk lib/portal-detect-ladder.ts (tanpa jaringan — memakai fake deps).
 * Run: npx tsx scripts/test-detect-ladder.ts
 */
import { detectWithLadder, type LadderDeps } from "../lib/portal-detect-ladder";
import type { FetchedPage } from "../lib/portal-fetch-html";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

function fakePage(html: string, extra: Partial<FetchedPage> = {}): FetchedPage {
    return {
        html,
        finalUrl: "https://k2prodapp/",
        setCookies: ["a=1"],
        statusCode: 200,
        redirected: false,
        ...extra,
    };
}

async function main() {
    // Lapis 1 berhasil → layer HTTP, render TIDAK dipanggil
    let renderCalls = 0;
    const deps: LadderDeps = {
        fetchPage: async () =>
            fakePage(`<form><input name="UserName" type="text"><input name="Password" type="password"></form>`),
        render: async () => { renderCalls++; return null; },
    };
    const r1 = await detectWithLadder("https://k2prodapp", deps);
    assertEq(r1.layer, "HTTP", "form ditemukan di HTML statis → layer HTTP");
    assertEq(r1.detected.usernameField, "UserName", "username terdeteksi");
    assertEq(r1.detected.passwordField, "Password", "password terdeteksi");
    assertEq(renderCalls, 0, "render TIDAK dipanggil saat lapis 1 berhasil");

    // Lapis 1 gagal + render berhasil → layer BROWSER
    const deps2: LadderDeps = {
        fetchPage: async () => fakePage(`<html><body><div id="root"></div></body></html>`),
        render: async () => ({
            html: `<html><body><form><input name="email"><input name="passwd" type="password"></form></body></html>`,
        }),
    };
    const r2 = await detectWithLadder("https://spa.app", deps2);
    assertEq(r2.layer, "BROWSER", "HTML statis tanpa form + render ada form → layer BROWSER");
    assertEq(r2.detected.passwordField, "passwd", "field dari hasil render");

    // Lapis 1 gagal + render null (layanan mati) → layer HTTP + note degradasi jujur
    const deps3: LadderDeps = {
        fetchPage: async () => fakePage(`<html><body><p>JS only</p></body></html>`),
        render: async () => null,
    };
    const r3 = await detectWithLadder("https://spa.app", deps3);
    assertEq(r3.layer, "HTTP", "layanan render mati → tetap layer HTTP");
    assertEq(r3.detected.passwordField, null, "tanpa render, form SPA tidak ditemukan");
    assertEq(r3.layerNotes.some((n) => /tidak tersedia/i.test(n)), true, "note degradasi jujur ada");

    console.log("=== ALL PASS ===");
}
main().catch((e) => { console.error("THROWN:", e.message); process.exitCode = 1; });
```

- [ ] **Step 2: Jalankan — pastikan GAGAL**

Run: `npx tsx scripts/test-detect-ladder.ts`
Expected: error `Cannot find module '../lib/portal-detect-ladder'`.

- [ ] **Step 3: Implementasi**

`lib/portal-detect-ladder.ts`:

```ts
import { fetchLoginPage, type FetchedPage } from "@/lib/portal-fetch-html";
import { detectLoginFields, type DetectedFields } from "@/lib/portal-login-detect";
import { classifySsoMode, type ModeEvidence, type ModeVerdict } from "@/lib/portal-sso-mode";
import { renderLoginPage } from "@/lib/portal-browser-render";

export type DetectionLayer = "HTTP" | "BROWSER";

export interface LadderResult {
    html: string;
    finalUrl: string;
    setCookies: string[];
    cookieNames: string[];
    hopChain?: string[];
    redirected: boolean;
    loopDetected: boolean;
    detected: DetectedFields;
    verdict: ModeVerdict;
    layer: DetectionLayer;
    /** Catatan proses — kenapa memilih lapis ini; degradasi jujur bila layanan mati. */
    layerNotes: string[];
}

export interface LadderDeps {
    fetchPage?: typeof fetchLoginPage;
    render?: typeof renderLoginPage;
}

/**
 * Deteksi berlapis: berhenti di lapis pertama yang menemukan form login.
 * Lapis 1 = HTTP + parse HTML (aplikasi klasik). Lapis 2 = render Chromium,
 * HANYA bila lapis 1 gagal (SPA / form dirakit JS).
 */
export async function detectWithLadder(url: string, deps: LadderDeps = {}): Promise<LadderResult> {
    const fetchPage = deps.fetchPage ?? fetchLoginPage;
    const render = deps.render ?? renderLoginPage;
    const notes: string[] = [];

    const page: FetchedPage = await fetchPage(url);
    const detected = detectLoginFields(page.html);
    const cookieNames = page.setCookies.map((c) => c.split("=")[0].trim()).filter(Boolean);

    const evidence: Omit<ModeEvidence, "detected"> & { detected: DetectedFields } = {
        html: page.html,
        finalUrl: page.finalUrl,
        hopChain: page.hopChain,
        cookieNames,
        detected,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
    };

    if (!detected.passwordField) {
        const rendered = await render(url);
        if (rendered) {
            const jsDetected = detectLoginFields(rendered.html);
            if (jsDetected.passwordField) {
                notes.push("Form login tidak ada di HTML statis; terdeteksi setelah render JavaScript.");
                return {
                    html: rendered.html,
                    finalUrl: page.finalUrl,
                    setCookies: page.setCookies,
                    cookieNames,
                    hopChain: page.hopChain,
                    redirected: page.redirected,
                    loopDetected: page.loopDetected ?? false,
                    detected: jsDetected,
                    verdict: classifySsoMode({ ...evidence, html: rendered.html, detected: jsDetected }),
                    layer: "BROWSER",
                    layerNotes: notes,
                };
            }
            notes.push("Halaman dirender dengan browser tetapi tidak memuat form login.");
        } else {
            notes.push("Layanan render browser tidak tersedia; deteksi terbatas pada HTML statis.");
        }
    }

    return {
        html: page.html,
        finalUrl: page.finalUrl,
        setCookies: page.setCookies,
        cookieNames,
        hopChain: page.hopChain,
        redirected: page.redirected,
        loopDetected: page.loopDetected ?? false,
        detected,
        verdict: classifySsoMode(evidence),
        layer: "HTTP",
        layerNotes: notes,
    };
}
```

- [ ] **Step 4: Jalankan self-check — pastikan PASS**

Run: `npx tsx scripts/test-detect-ladder.ts`
Expected: `=== ALL PASS ===`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-detect-ladder.ts scripts/test-detect-ladder.ts
git commit -m "feat(portal-sso): deteksi berlapis HTTP -> browser dengan degradasi jujur"
```

---

### Task 5: Sambungkan `detect-fields` ke ladder

**Files:**
- Modify: `app/api/portal-apps/detect-fields/route.ts`

**Interfaces:**
- Consumes: `detectWithLadder` (Task 4).
- Produces: respons API kini menambah `detectionLayer: "HTTP" | "BROWSER"` dan `layerNotes: string[]`.

- [ ] **Step 1: Ganti deteksi inline dengan ladder**

Di `route.ts`, ganti blok yang memanggil `fetchLoginPage` + `detectLoginFields` + `classifySsoMode` dengan satu panggilan ladder. Impor berubah:

```ts
import { detectWithLadder } from "@/lib/portal-detect-ladder";
```

Di dalam `POST`, setelah validasi URL, ganti dari pemanggilan manual menjadi:

```ts
const result = await detectWithLadder(parsed.href);
const warnings = [...(result.detected.warnings ?? []), ...result.verdict.warnings];
```

Cabang `!result.detected.passwordField` tetap mengembalikan 422 dengan `recommendedMode: result.verdict.mode`, `recommendationReason: result.verdict.reason`, dan kini juga `detectionSignals: result.verdict.signals`, `detectionLayer: result.layer`, `layerNotes: result.layerNotes`.

Respons sukses (passwordField ditemukan) kini mengembalikan, di samping yang sudah ada:

```ts
{
    // ...field yang sudah ada (usernameField, passwordField, extraFields, formAction, ...)
    detectionConfidence: result.detected.confidence ?? 0,
    detectionSignals: result.verdict.signals,
    detectionLayer: result.layer,
    layerNotes: result.layerNotes,
}
```

Catatan: `recommendedMode`, `recommendationReason`, `warnings`, `finalUrl`, `redirected`, `loopDetected`, `cookiePaired` tetap sama seperti sekarang (`cookiePaired = result.verdict.mode === "POST"`).

- [ ] **Step 2: Verifikasi tsc + lint**

Run: `npx tsc --noEmit` (exit 0) lalu `npm run lint` (0 error).

- [ ] **Step 3: Commit**

```bash
git add app/api/portal-apps/detect-fields/route.ts
git commit -m "feat(portal-sso): detect-fields memakai deteksi berlapis, ekspos detectionLayer"
```

---

### Task 6: Persist evidence saat create/update aplikasi

**Files:**
- Modify: `lib/validation-schemas.ts` (`PortalAppCreateSchema`)
- Modify: `app/api/portal-apps/route.ts` (POST)
- Modify: `app/api/portal-apps/[id]/route.ts` (PUT)

**Interfaces:**
- Consumes: `computeLoginFingerprint` (Task 2).
- Produces: `PortalApp` menyimpan `detectionConfidence`, `detectionSignals`, `detectionLayer`, `detectedAt` (server-side), `detectedFingerprint` (server-side), dan `loginFormChanged` di-reset `false` pada deteksi baru.

- [ ] **Step 1: Tambah field evidence ke skema**

Di `PortalAppCreateSchema` (`lib/validation-schemas.ts`), setelah `isPublic`:

```ts
    // Bukti deteksi berlapis — dikirim admin setelah tombol Deteksi/Uji.
    // detectedAt & detectedFingerprint dihitung server-side di route.
    detectionConfidence: z.number().int().nullable().optional(),
    detectionSignals: z.array(z.string()).nullable().optional(),
    detectionLayer: z.enum(["HTTP", "BROWSER", "MANUAL"]).nullable().optional(),
```

`PortalAppUpdateSchema` tetap `PortalAppCreateSchema.partial()`.

- [ ] **Step 2: Route create — hitung fingerprint + set detectedAt**

Di `app/api/portal-apps/route.ts`, setelah `const data = validation.data;` (sebelum cek slug), bangun payload:

```ts
const extraNames = Object.keys(
    (data.extraFields as Record<string, string> | null | undefined) ?? {}
);
const fingerprint = computeLoginFingerprint({
    loginUrl: data.loginUrl ?? data.url,
    usernameField: data.usernameField ?? "username",
    passwordField: data.passwordField ?? "password",
    extraFieldNames: extraNames,
});

const payload = {
    ...data,
    detectionSignals: data.detectionSignals ?? undefined,
    detectedFingerprint: fingerprint,
    // detectedAt hanya diisi bila admin baru saja menjalankan deteksi
    detectedAt: data.detectionLayer ? new Date() : undefined,
    loginFormChanged: false,
};
```

Lalu `prisma.portalApp.create({ data: payload })`.

Impor: `import { computeLoginFingerprint } from "@/lib/portal-fingerprint";`.

- [ ] **Step 3: Route update — pola sama**

Di `app/api/portal-apps/[id]/route.ts` (PUT), setelah validasi, bangun `payload` identik, lalu `prisma.portalApp.update({ where: { id }, data: payload })`.

- [ ] **Step 4: Verifikasi tsc + lint**

Run: `npx tsc --noEmit` (exit 0); `npm run lint` (0 error).

- [ ] **Step 5: Commit**

```bash
git add lib/validation-schemas.ts app/api/portal-apps/route.ts app/api/portal-apps/[id]/route.ts
git commit -m "feat(portal-sso): simpan evidence deteksi + fingerprint saat create/update aplikasi"
```

---

### Task 7: Rate limiter verifikasi + `verify-login` route

**Files:**
- Create: `lib/verify-rate-limit.ts`
- Create: `app/api/portal-apps/verify-login/route.ts`
- Modify: `lib/validation-schemas.ts`

**Interfaces:**
- Produces: `checkVerifyLimit(store, key, max, windowMs, now?): { allowed: boolean; remaining: number }`.
- Produces: `verifyLoginSchema` dan endpoint `POST /api/portal-apps/verify-login`.

- [ ] **Step 1: Tulis self-check rate limiter yang GAGAL dulu**

`scripts/test-verify-rate-limit.ts`:

```ts
/**
 * Self-check untuk lib/verify-rate-limit.ts (tanpa DB).
 * Run: npx tsx scripts/test-verify-rate-limit.ts
 */
import { checkVerifyLimit } from "../lib/verify-rate-limit";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const now = 1_000_000;
const store = new Map<string, { count: number; resetAt: number }>();

assertEq(checkVerifyLimit(store, "a", 5, 600_000, now), { allowed: true, remaining: 4 }, "percobaan pertama diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 1), { allowed: true, remaining: 3 }, "percobaan kedua diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 2).allowed, true, "masih diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 3).allowed, true, "diizinkan");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 4), { allowed: false, remaining: 0 }, "percobaan ke-6 ditolak");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 5).allowed, false, "tetap ditolak dalam window");
assertEq(checkVerifyLimit(store, "a", 5, 600_000, now + 600_001), { allowed: true, remaining: 4 }, "window habis → reset");
assertEq(checkVerifyLimit(store, "b", 5, 600_000, now).allowed, true, "key berbeda tidak terpengaruh");

console.log("=== ALL PASS ===");
```

- [ ] **Step 2: Jalankan — pastikan GAGAL**

Run: `npx tsx scripts/test-verify-rate-limit.ts`
Expected: error `Cannot find module '../lib/verify-rate-limit'`.

- [ ] **Step 3: Implementasi rate limiter**

`lib/verify-rate-limit.ts`:

```ts
export interface VerifySlot {
    count: number;
    resetAt: number;
}

/**
 * Rate limit percobaan uji login per admin (in-memory; reset saat server restart).
 * Mencegah endpoint verify-login dipakai sebagai alat menebak password.
 */
export function checkVerifyLimit(
    store: Map<string, VerifySlot>,
    key: string,
    max: number,
    windowMs: number,
    now = Date.now()
): { allowed: boolean; remaining: number } {
    const slot = store.get(key);
    if (!slot || now >= slot.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1 };
    }
    if (slot.count >= max) return { allowed: false, remaining: 0 };
    slot.count++;
    return { allowed: true, remaining: max - slot.count };
}
```

- [ ] **Step 4: Jalankan self-check — pastikan PASS**

Run: `npx tsx scripts/test-verify-rate-limit.ts`
Expected: `=== ALL PASS ===`.

- [ ] **Step 5: Tambah skema + route verify-login**

Di `lib/validation-schemas.ts`:

```ts
export const verifyLoginSchema = z.object({
    url: z.string().url("Invalid URL").max(500),
    appId: z.string().cuid().nullable().optional(), // saat edit: simpan loginVerifiedAt ke app ini
    usernameField: z.string().max(100).default("username"),
    passwordField: z.string().max(100).default("password"),
    testUsername: z.string().max(200),
    testPassword: z.string().max(500),
});
```

`app/api/portal-apps/verify-login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchLoginPage, CookieJar } from "@/lib/portal-fetch-html";
import { detectLoginFields } from "@/lib/portal-login-detect";
import { relayLogin } from "@/lib/portal-sso-relay";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { verifyLoginSchema } from "@/lib/validation-schemas";
import { checkVerifyLimit, type VerifySlot } from "@/lib/verify-rate-limit";

const VERIFY_MAX = 5;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const verifyAttempts = new Map<string, VerifySlot>();

// POST /api/portal-apps/verify-login — SuperAdmin only.
// Kredensial uji TIDAK disimpan & TIDAK dicatat; hanya hasilnya yang masuk audit.
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }
        const adminId = session.user.id;

        const limit = checkVerifyLimit(verifyAttempts, adminId, VERIFY_MAX, VERIFY_WINDOW_MS);
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Terlalu banyak percobaan uji login. Coba lagi beberapa menit." },
                { status: 429 }
            );
        }

        const body = await request.json().catch(() => null);
        const validation = verifyLoginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Validasi gagal" }, { status: 400 });
        }
        const { url, appId, usernameField, passwordField, testUsername, testPassword } = validation.data;

        const page = await fetchLoginPage(url);
        const jar = page.cookieJar ?? new CookieJar();
        const fresh = detectLoginFields(page.html);
        const userField = fresh.usernameField ?? usernameField;
        const passField = fresh.passwordField ?? passwordField;
        const actionUrl = fresh.formAction ? new URL(fresh.formAction, page.finalUrl).href : page.finalUrl;

        const params = new URLSearchParams();
        params.append(userField, testUsername);
        params.append(passField, testPassword);
        for (const [k, v] of Object.entries(fresh.extraFields)) params.append(k, v);

        const outcome = await relayLogin({
            actionUrl,
            body: params.toString(),
            jar,
            referer: page.finalUrl,
            allowInsecureTLS: true,
        });

        // Catat HASIL saja, tanpa nilai kredensial.
        await logAudit({
            actorType: "ADMIN_USER",
            actorId: adminId,
            category: "PORTAL",
            action: "SSO_VERIFY_LOGIN",
            entityType: "PORTAL_APP",
            outcome: outcome.ok ? "SUCCESS" : "FAILURE",
            errorMessage: outcome.failureReason ?? undefined,
            metadata: { url, ssoMode: "verify", handoff: !!outcome.handoff },
            request,
        }).catch(() => {});

        // Persist bukti verifikasi pada aplikasi (khusus alur EDIT; saat CREATE app belum ada).
        if (appId) {
            await prisma.portalApp
                .update({
                    where: { id: appId },
                    data: outcome.ok
                        ? { loginVerifiedAt: new Date(), loginVerifyError: null }
                        : { loginVerifyError: outcome.failureReason ?? "Login ditolak aplikasi." },
                })
                .catch(() => {});
        }

        // Pesan mengikuti 4 baris tabel Lapis 3 di spec, bukan sekadar sukses/gagal.
        return NextResponse.json({
            ok: outcome.ok,
            handoff: !!outcome.handoff,
            message: outcome.ok
                ? outcome.handoff
                    ? "Login berhasil — konfigurasi terbukti (mode POST/federasi)."
                    : "Login berhasil. Bila aplikasi berbeda domain dari portal, pastikan PORTAL_SSO_COOKIE_DOMAIN sesuai atau aplikasi memakai federasi."
                : (outcome.failureReason ?? "Login ditolak aplikasi."),
        });
    } catch (err) {
        console.error("verify-login error:", err);
        return NextResponse.json({ error: "Gagal menjalankan uji login" }, { status: 422 });
    }
}
```

- [ ] **Step 6: tsc + lint + commit**

Run: `npx tsc --noEmit`; `npm run lint`. Expected bersih.

```bash
git add lib/verify-rate-limit.ts scripts/test-verify-rate-limit.ts lib/validation-schemas.ts app/api/portal-apps/verify-login/route.ts
git commit -m "feat(portal-sso): uji login sekali pakai sebelum konfigurasi disimpan"
```

---

### Task 8: Deteksi drift form di health check

**Files:**
- Modify: `lib/portal-health.ts`

**Interfaces:**
- Consumes: `detectLoginFields`, `computeLoginFingerprint`.
- Produces: `PortalApp.loginFormChanged` ter-update; audit `APP_LOGIN_FORM_CHANGED` (severity WARNING) pada transisi false→true.

- [ ] **Step 1: Perluas select**

Di `checkAllPortalAppsHealth`, select tambah `detectedFingerprint: true` dan `loginFormChanged: true` (selain yang sudah ada).

- [ ] **Step 2: Hitung fingerprint live + bandingkan**

Di dalam `checkAppHealth`, di awal blok `try` setelah `const page = await fetchLoginPage(targetUrl);`, sisipkan blok drift (sebelum update status utama):

```ts
// Drift form login: bandingkan struktur form saat ini dengan config tersimpan.
// Perubahan struktur = SSO akan rusak — beri tahu admin sebelum user mengeluh.
if (page.html && app.detectedFingerprint) {
    const live = detectLoginFields(page.html);
    if (live.passwordField) {
        const liveFp = computeLoginFingerprint({
            loginUrl: targetUrl,
            usernameField: live.usernameField ?? "",
            passwordField: live.passwordField ?? "",
            extraFieldNames: Object.keys(live.extraFields),
        });
        const changed = liveFp !== app.detectedFingerprint;
        if (changed !== (app.loginFormChanged ?? false)) {
            await prisma.portalApp.update({
                where: { id: app.id },
                data: { loginFormChanged: changed },
            });
        }
        if (changed && !app.loginFormChanged) {
            await logAudit({
                actorType: "SYSTEM",
                category: "SYSTEM",
                action: "APP_LOGIN_FORM_CHANGED",
                severity: "WARNING",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id,
                changes: { appName: app.name, url: targetUrl },
            }).catch(() => {});
        }
    }
}
```

Impor: `detectLoginFields` dari `@/lib/portal-login-detect`; `computeLoginFingerprint` dari `@/lib/portal-fingerprint`.

Catatan: blok ini harus **setelah** fetchLoginPage sukses. `checkAppHealth` menerima argumen `app` bertipe `{ id; name; url; loginUrl?; healthStatus? }` — perlu tambah `detectedFingerprint?: string | null` dan `loginFormChanged?: boolean | null` pada tipe parameternya.

- [ ] **Step 3: tsc + lint**

Run: `npx tsc --noEmit`; `npm run lint`. Expected bersih.

- [ ] **Step 4: Commit**

```bash
git add lib/portal-health.ts
git commit -m "feat(portal-sso): deteksi drift form login via health check + audit WARNING"
```

---

### Task 9: Admin page — kartu bukti & tombol Uji Login

**Files:**
- Modify: `app/admin/portal-apps/page.tsx`

**Interfaces:**
- Consumes: `detect-fields` (kini mengembalikan `detectionConfidence`, `detectionSignals`, `detectionLayer`, `layerNotes`); `verify-login`.
- Produces: formData membawa `detectionConfidence`, `detectionSignals`, `detectionLayer` saat save; UI "Uji Login".

- [ ] **Step 1: Bawa evidence ke formData saat handleDetect**

Di `handleDetect`, pada cabang sukses, tambahkan tiga field ke state sebelum `setFormData`:

```ts
setFormData((prev) => ({
    ...prev,
    // ...yang sudah ada (loginUrl, usernameField, passwordField, httpMethod, ssoMode, extraFields)
    detectionConfidence: data.detectionConfidence ?? prev.detectionConfidence,
    detectionSignals: data.detectionSignals ?? prev.detectionSignals,
    detectionLayer: data.detectionLayer ?? prev.detectionLayer,
}));
```

Tipe `formData` (interface `FormState` di file yang sama) tambah tiga field opsional tersebut.

- [ ] **Step 2: Kartu bukti di bawah pesan deteksi**

Di bagian hasil deteksi (`detectMsg`), tampilkan ringkasan bukti. Tambahkan blok JSX setelah `setDetectMsg` (bila `detectMsg.type === "ok"`):

```tsx
{detectMsg?.type === "ok" && formData.detectionLayer ? (
    <div className="mt-3 rounded-card border border-border bg-surface-2 p-3 text-sm text-text-2">
        <p className="font-medium text-text-1">Bukti deteksi</p>
        <p>Lapis: {formData.detectionLayer} · Confidence: {formData.detectionConfidence ?? "-"}</p>
        {Array.isArray(formData.detectionSignals) && formData.detectionSignals.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
                {formData.detectionSignals.map((s) => <li key={s}>{s}</li>)}
            </ul>
        )}
    </div>
) : null}
```

- [ ] **Step 3: Form + tombol Uji Login**

Tambahkan di dalam modal (di area aksi bawah, dekat tombol simpan):

```tsx
const [verify, setVerify] = useState<{ username: string; password: string }>({ username: "", password: "" });
const [verifyState, setVerifyState] = useState<"idle" | "running" | "ok" | "fail">("idle");
const [verifyMsg, setVerifyMsg] = useState("");

const handleVerifyLogin = async () => {
    if (!formData.loginUrl) return;
    setVerifyState("running"); setVerifyMsg("");
    try {
        const res = await fetch("/api/portal-apps/verify-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: formData.loginUrl,
                appId: formData.id ?? undefined, // alur edit: hasil disimpan ke app (loginVerifiedAt)
                usernameField: formData.usernameField,
                passwordField: formData.passwordField,
                testUsername: verify.username,
                testPassword: verify.password,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            setVerifyState("fail");
            setVerifyMsg(data.error ?? "Uji login gagal");
            return;
        }
        setVerifyState(data.ok ? "ok" : "fail");
        setVerifyMsg(data.message);
    } catch {
        setVerifyState("fail");
        setVerifyMsg("Terjadi kesalahan jaringan");
    }
};
```

JSX-nya (di modal):

```tsx
<div className="mt-4 rounded-card border border-border bg-surface-2 p-3">
    <p className="text-sm font-medium text-text-1">Uji Login sebelum simpan</p>
    <div className="mt-2 grid gap-2">
        <input
            type="text" placeholder="Username uji"
            value={verify.username}
            onChange={(e) => setVerify({ ...verify, username: e.target.value })}
            className="..." // kelas input yang sama dengan field lain di modal
        />
        <input
            type="password" placeholder="Password uji"
            value={verify.password}
            onChange={(e) => setVerify({ ...verify, password: e.target.value })}
            className="..."
        />
        <button
            type="button" onClick={handleVerifyLogin} disabled={verifyState === "running"}
            className="inline-flex h-9 items-center justify-center rounded-control border border-border px-3 text-sm font-medium text-text-1 hover:bg-surface-3 disabled:opacity-50"
        >
            {verifyState === "running" ? "Menguji..." : "Uji Login"}
        </button>
    </div>
    {verifyMsg && (
        <p className={`mt-2 text-sm ${verifyState === "ok" ? "text-success" : "text-warning"}`}>{verifyMsg}</p>
    )}
</div>
```

- [ ] **Step 4: Pastikan save membawa evidence**

`handleSubmit` memanggil API create/update dengan `formData`. Konfirmasi `detectionConfidence`, `detectionSignals`, `detectionLayer` ikut di-`JSON.stringify`-kan (biasanya `JSON.parse(JSON.stringify(formData))` di handler tersebut). Jika `handleSubmit` menyaring field eksplisit, tambahkan ketiganya ke daftar.

- [ ] **Step 5: tsc + lint + build**

Run: `npx tsc --noEmit`; `npm run lint`; `npm run build`. Expected bersih.

- [ ] **Step 6: Commit**

```bash
git add app/admin/portal-apps/page.tsx
git commit -m "feat(portal-sso): kartu bukti deteksi + tombol uji login di admin portal-apps"
```

---

### Task 10: Admin list — badge drift & pola kegagalan

**Files:**
- Modify: `app/api/portal-apps/route.ts` (GET)
- Modify: `app/admin/portal-apps/page.tsx` (list)

**Interfaces:**
- Produces: GET `/api/portal-apps` menambahkan `ssoFailure24h: number` per app.

- [ ] **Step 1: Agregasi kegagalan SSO di GET**

Di `app/api/portal-apps/route.ts` GET, setelah `findMany`, tambah agregasi audit (data sudah terisi oleh `logAudit` saat SSO launch):

```ts
const since24h = new Date(Date.now() - 24 * 3600 * 1000);
const [apps, total, failed] = await Promise.all([
    prisma.portalApp.findMany({ ... }),
    prisma.portalApp.count({ where }),
    prisma.auditLog.groupBy({
        by: ["appId"],
        where: { action: "SSO_LAUNCH", outcome: "FAILURE", createdAt: { gte: since24h } },
        _count: { _all: true },
    }),
]);
const failCount = new Map(failed.map((r) => [r.appId, r._count._all]));

const data = apps.map((a) => ({
    ...a,
    ssoFailure24h: failCount.get(a.id) ?? 0,
}));

return NextResponse.json({ data, pagination: { ... } });
```

- [ ] **Step 2: Badge di tabel**

Di kolom aksi/status tabel (di sekitar baris yang memakai `app.healthStatus`), tambah:

```tsx
{app.loginFormChanged && (
    <Badge tone="warning">Form berubah</Badge>
)}
{app.ssoFailure24h >= 3 && (
    <Badge tone="danger">Gagal ×{app.ssoFailure24h}/24h</Badge>
)}
```

Sesuaikan tipe `PortalApp` di file tersebut agar memuat `loginFormChanged?: boolean` dan `ssoFailure24h?: number`.

- [ ] **Step 3: tsc + lint + build**

Run: `npx tsc --noEmit`; `npm run lint`; `npm run build`. Expected bersih.

- [ ] **Step 4: Commit**

```bash
git add app/api/portal-apps/route.ts app/admin/portal-apps/page.tsx
git commit -m "feat(portal-sso): badge drift form + pola kegagalan SSO di admin portal-apps"
```

---

### Task 11: Infra — container browser + env

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

**Interfaces:**
- Produces: service `browserless` (Chromium) + env `PORTAL_BROWSER_URL` untuk `web`.

- [ ] **Step 1: Tambah service browserless**

Di `docker-compose.yml`, tambah service baru (di bawah `db`), dan pasang `PORTAL_BROWSER_URL` di service `web`:

```yaml
  browserless:
    image: browserless/chrome:latest
    restart: unless-stopped
    environment:
      - CONNECTION_TIMEOUT=10000
      - MAX_CONCURRENT_SESSIONS=2
    networks:
      - internal
```

Di `environment` service `web`, tambah:

```yaml
      - PORTAL_BROWSER_URL=${PORTAL_BROWSER_URL:-http://browserless:3000}
```

- [ ] **Step 2: `.env.example`**

Tambah baris:

```
# Optional — layanan render Chromium untuk deteksi SPA. Kosongkan untuk menonaktifkan lapis browser.
PORTAL_BROWSER_URL=
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(portal-sso): container browserless + env PORTAL_BROWSER_URL"
```

---

### Task 12: Verifikasi akhir menyeluruh

**Files:** none (read-only verification).

- [ ] **Step 1: Semua self-check**

Run: `npx tsx scripts/test-fingerprint.ts`, `scripts/test-browser-render.ts`, `scripts/test-detect-ladder.ts`, `scripts/test-verify-rate-limit.ts`, `scripts/test-sso-relay.ts`, `scripts/test-sso-mode.ts`, `scripts/test-cookie-domain.ts`, `scripts/test-login-detect.ts`
Expected: masing-masing `=== ALL PASS ===`, exit 0.

- [ ] **Step 2: tsc + lint + build**

Run: `npx tsc --noEmit`; `npm run lint`; `npm run build`. Expected: 0 error, build sukses.

- [ ] **Step 3: Probe hidup (deteksi, bukan login)**

Run (dengan `NODE_TLS_REJECT_UNAUTHORIZED` default — jangan set):

```bash
npx tsx -e "
import { detectWithLadder } from './lib/portal-detect-ladder';
detectWithLadder('https://k2prodapp').then(r => {
  console.log('layer:', r.layer);
  console.log('mode:', r.verdict.mode);
  console.log('user/pass:', r.detected.usernameField, '/', r.detected.passwordField);
  console.log('notes:', r.layerNotes);
}).catch(e => { console.error(e.message); process.exitCode = 1; });
"
```

Expected: `layer: HTTP`, `mode: POST`, `user/pass: UserName / Password`, `notes: []`. Ini membuktikan ladder tidak merusak jalur deteksi K2 yang sudah terbukti.

- [ ] **Step 4: Lapor**

Rangkum: task mana selesai, hasil self-check/build/probe, dan status `loginFormChanged`/`verify` di DB.

---

## Self-Review

**1. Spec coverage:**
- Lapis 1 (HTTP) → Task 4, 5.
- Lapis 2 (browser) → Task 3 (klien), Task 4 (integrasi), Task 11 (infra).
- Lapis 3 (uji login) → Task 7.
- Menyimpan evidence → Task 1 (migrasi), Task 6 (persist), Task 5 (ekspos ke client).
- Fingerprint → Task 2, Task 8 (drift).
- Kegagalan senyap (drift + pola kegagalan) → Task 8, Task 10.
- Rate limit uji login → Task 7.
- Kartu bukti + tombol uji di admin → Task 9.
- Batasan CAPTCHA/OTP → tidak ada task; spec menandai sebagai batasan (tetap VAULT), bukan yang harus dibangun.

**2. Placeholder scan:** tidak ada TBD/TODO; semua langkah punya kode konkret. Satu-satunya bagian deskriptif adalah JSX Task 9 Step 3 yang menunjuk kelas input yang sudah ada di file — eksekutor membaca file tersebut.

**3. Type consistency:**
- `computeLoginFingerprint({ loginUrl, usernameField, passwordField, extraFieldNames })` — dipakai Task 6 & Task 8 dengan bentuk sama.
- `detectWithLadder(url, deps?)` → `LadderResult` — Task 5 & probe Task 12 memakai `layer`, `verdict`, `detected`.
- `renderLoginPage(url, timeoutMs?)` → `Promise<RenderResult | null>` — Task 3 & Task 4.
- `checkVerifyLimit(store, key, max, windowMs, now?)` → `{ allowed, remaining }` — Task 7.
- `FetchedPage` (dari portal-fetch-html) punya `html`, `finalUrl`, `setCookies`, `statusCode`, `redirected`, `hopChain?`, `loopDetected?`, `cookieJar?` — dipakai Task 4 tanpa nama baru.
