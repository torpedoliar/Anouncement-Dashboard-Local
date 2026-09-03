# Plan A — Memori Deteksi (registry produk + recall) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deteksi memakai ingatan sebelum ladder: recall koreksi/profile/registry, dan produk baru didaftarkan sebagai data (bukan `if` baru).

**Architecture:** Modul murni `portal-product-registry.ts` (data + matcher) dan `portal-memory-recall.ts` (DB read dengan query-interface injeksi agar bisa self-check tanpa DB) dipanggil dari `detect-fields` sebelum `detectWithLadder`. Auto-register fingerprint generik di `verify-login` saat outcome CREDENTIAL_ACCEPTED.

**Tech Stack:** TypeScript, Prisma, parse5 tidak perlu (matcher regex pada HTML mentah), `npx tsx scripts/*.ts` untuk self-check.

## Global Constraints

- Probe tetap pasif: recall hanya membaca DB dan mencocokkan string; tidak ada request baru ke target.
- Tidak ada kredensial di memori: hanya nama field, method, mode, action path, kontrak API (tanpa nilai/query).
- Tambah produk = tambah satu entri data di `PRODUCT_REGISTRY`; dilarang menambah cabang `if` produk di classifier.
- Tiap task diakhiri commit pesan Indonesia; tiap perubahan `schema.prisma` diikuti migrasi SQL manual + `npx prisma generate` + bump `schemaVersion` di `version.json`.

---

### Task 1: Registry produk + fingerprint matcher

**Files:**
- Create: `lib/portal-product-registry.ts`
- Create: `scripts/test-product-registry.ts`

**Interfaces:**
- Consumes: nothing (modul murni).
- Produces: `fingerprintLoginProduct(html: string, pageUrl: string): { product: string; version: string | null; markers: string[] } | null` — dipakai Task 2 dan Task 3.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/test-product-registry.ts
import { fingerprintLoginProduct } from "../lib/portal-product-registry";

let failed = 0;
function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

const unifi = `<html><head><title>UniFi OS</title></head><body><div ui-view></div><script src="/angular/app.js"></script></body></html>`;
check(fingerprintLoginProduct(unifi, "https://192.168.1.1/")?.product === "unifi-os", "registry: UniFi dikenali");
const mantis = `<html><body><form action="login_password_page.php"><input name="username"></form></body></html>`;
check(fingerprintLoginProduct(mantis, "https://bugs.example.com/login_page.php")?.product === "mantisbt", "registry: MantisBT dikenali");
const hris = `<html><head><meta name="generator" content="HRIS Portal v2"></head><body><form action="/login"><input name="nik"></form></body></html>`;
check(fingerprintLoginProduct(hris, "https://nikhris.example.com/login")?.product === "hris-internal", "registry: HRIS internal dikenali");
check(fingerprintLoginProduct("<html><body><h1>halo</h1></body></html>", "https://x.example/") === null, "registry: halaman asing -> null");
console.log(failed === 0 ? "Semua lolos." : `${failed} gagal.`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-product-registry.ts`
Expected: FAIL (Cannot find module '../lib/portal-product-registry')

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/portal-product-registry.ts
export interface ProductFingerprint {
    product: string;
    version: string | null;
    markers: string[];
}

interface ProductEntry {
    product: string;
    /** Semua marker dalam satu grup harus cocok; antar grup cukup satu grup. */
    titleRe?: RegExp;
    generatorRe?: RegExp; // meta generator, mis. aplikasi internal
    htmlRe?: RegExp[];
    urlRe?: RegExp;
    versionRe?: RegExp;
}

const PRODUCT_REGISTRY: ProductEntry[] = [
    {
        product: "unifi-os",
        titleRe: /<title[^>]*>\s*UniFi OS\s*<\/title>/i,
        htmlRe: [/<(ng-view|ui-view)[\s/>]/i, /\/angular\//i],
        versionRe: /UniFi OS\s+([\d.]+)/i,
    },
    {
        product: "mantisbt",
        htmlRe: [/login_password_page\.php/i, /name=["']username["']/i],
    },
    {
        product: "oracle-ebs",
        htmlRe: [/AppsLocalLogin/i, /AuthenticateUser/i],
        urlRe: /OA_HTML|AppsLocalLogin/i,
    },
    {
        product: "hris-internal",
        generatorRe: /<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*HRIS[^"']*["']/i,
        urlRe: /hris|nikhris/i,
    },
];

export function fingerprintLoginProduct(html: string, pageUrl: string): ProductFingerprint | null {
    for (const entry of PRODUCT_REGISTRY) {
        if (entry.titleRe && !entry.titleRe.test(html)) continue;
        if (entry.generatorRe && !entry.generatorRe.test(html)) continue;
        if (entry.urlRe && !entry.urlRe.test(pageUrl)) continue;
        if (entry.htmlRe && !entry.htmlRe.some((re) => re.test(html))) continue;
        const markers = [
            entry.titleRe?.source,
            entry.generatorRe?.source,
            ...(entry.htmlRe ?? []).map((re) => re.source),
            entry.urlRe?.source,
        ].filter((m): m is string => Boolean(m));
        const version = entry.versionRe ? (html.match(entry.versionRe)?.[1] ?? null) : null;
        return { product: entry.product, version, markers };
    }
    return null;
}

// Catatan: "generic" bukan produk registry — ia hanya lahir dari auto-register
// fingerprint (Task 3) untuk aplikasi tak dikenal yang lolos Uji Login.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-product-registry.ts`
Expected: 4 PASS, "Semua lolos."

- [ ] **Step 5: Commit**

```bash
git add lib/portal-product-registry.ts scripts/test-product-registry.ts
git commit -m "feat(portal): registry produk + fingerprint matcher login"
```

---

### Task 2: Recall memori (koreksi + profile + registry)

**Files:**
- Create: `lib/portal-memory-recall.ts`
- Create: `scripts/test-memory-recall.ts`

**Interfaces:**
- Consumes: `fingerprintLoginProduct` dari Task 1; tipe `LearnedSuggestion` dari `lib/portal-detection-feedback.ts`; tipe `PortalLoginProfile` dari `@prisma/client`.
- Produces: `recallLoginMemory(input: { loginUrl: string; html: string }, db?: MemoryDb): Promise<MemoryRecall | null>` dengan `MemoryRecall = { source: "CORRECTION" | "PROFILE" | "REGISTRY"; label: string; product: string | null; config: { usernameField: string | null; passwordField: string | null; httpMethod: string | null; ssoMode: string | null } }` — dipakai Task 3.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/test-memory-recall.ts
import { recallLoginMemory, type MemoryDb } from "../lib/portal-memory-recall";

let failed = 0;
function check(ok: boolean, label: string) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${label}`);
    if (!ok) failed++;
}

// DB palsu: ada koreksi di origin ini.
const db: MemoryDb = {
    async latestCorrection() {
        return { usernameField: "nik", passwordField: "katasandi", httpMethod: "POST", ssoMode: "FORM", correctedAt: new Date("2026-09-01") };
    },
    async latestProfile() {
        return null;
    },
};

const hit = await recallLoginMemory({ loginUrl: "https://hris.example.com/login", html: "<html></html>" }, db);
check(hit?.source === "CORRECTION", "recall: koreksi menang atas semuanya");
check(hit?.config.usernameField === "nik", "recall: config dari koreksi");

const emptyDb: MemoryDb = {
    async latestCorrection() { return null; },
    async latestProfile() { return null; },
};
const unifiHtml = `<html><head><title>UniFi OS</title></head><body></body></html>`;
const reg = await recallLoginMemory({ loginUrl: "https://192.168.1.20/", html: unifiHtml }, emptyDb);
check(reg?.source === "REGISTRY", "recall: produk dikenal tanpa DB -> REGISTRY");
check(reg?.product === "unifi-os", "recall: label produk benar");

const miss = await recallLoginMemory({ loginUrl: "https://asing.example/", html: "<html><body>halo</body></html>" }, emptyDb);
check(miss === null, "recall: asing tanpa data -> null");
console.log(failed === 0 ? "Semua lolos." : `${failed} gagal.`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-memory-recall.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/portal-memory-recall.ts
import prisma from "@/lib/prisma";
import { fingerprintLoginProduct } from "@/lib/portal-product-registry";
import { getLearnedSuggestion, type CorrectedLoginConfig } from "@/lib/portal-detection-feedback";

export interface MemoryDb {
    latestCorrection(loginUrl: string): Promise<(CorrectedLoginConfig & { correctedAt: Date }) | null>;
    latestProfile(origin: string): Promise<CorrectedLoginConfig | null>;
    // Opsional agar mock test Task 2 tanpa method ini tidak crash; diisi
    // implementasi nyata di Task 3 (fingerprint generik).
    latestFingerprint?(origin: string): Promise<CorrectedLoginConfig | null>;
}

const realDb: MemoryDb = {
    async latestCorrection(loginUrl: string) {
        const s = await getLearnedSuggestion(loginUrl);
        return s ? { ...s, correctedAt: s.correctedAt } : null;
    },
    async latestProfile(origin: string) {
        const row = await prisma.portalLoginProfile.findFirst({
            where: { origin },
            orderBy: { updatedAt: "desc" },
            select: { usernameField: true, passwordField: true, httpMethod: true },
        });
        return row ? { ...row, ssoMode: null } : null;
    },
    async latestFingerprint() {
        return null;
    },
};

export interface MemoryRecall {
    source: "CORRECTION" | "FINGERPRINT" | "PROFILE" | "REGISTRY";
    label: string;
    product: string | null;
    config: CorrectedLoginConfig;
}

function originOf(url: string): string | null {
    try {
        return new URL(url).origin.toLowerCase();
    } catch {
        return null;
    }
}

/** Recall berurutan: koreksi admin > fingerprint generik > profile > registry. */
export async function recallLoginMemory(
    input: { loginUrl: string; html: string },
    db: MemoryDb = realDb,
): Promise<MemoryRecall | null> {
    const product = fingerprintLoginProduct(input.html, input.loginUrl);

    const correction = await db.latestCorrection(input.loginUrl).catch(() => null);
    if (correction) {
        return {
            source: "CORRECTION",
            label: `MEMORY: koreksi admin ${correction.correctedAt.toISOString().slice(0, 10)}`,
            product: product?.product ?? null,
            config: correction,
        };
    }

    const origin = originOf(input.loginUrl);
    if (origin && db.latestFingerprint) {
        const fp = await db.latestFingerprint(origin).catch(() => null);
        if (fp && (fp.usernameField || fp.passwordField)) {
            return { source: "FINGERPRINT", label: "MEMORY: fingerprint generik terverifikasi", product: product?.product ?? "generic", config: fp };
        }
    }

    if (origin) {
        const profile = await db.latestProfile(origin).catch(() => null);
        if (profile && (profile.usernameField || profile.passwordField)) {
            return { source: "PROFILE", label: "MEMORY: profile sukses sebelumnya", product: product?.product ?? null, config: profile };
        }
    }

    if (product) {
        return { source: "REGISTRY", label: `REGISTRY: ${product.product}${product.version ? ` v${product.version}` : ""}`, product: product.product, config: { usernameField: null, passwordField: null, httpMethod: null, ssoMode: null } };
    }
    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-memory-recall.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-memory-recall.ts scripts/test-memory-recall.ts
git commit -m "feat(portal): recall memori deteksi (koreksi > profile > registry)"
```

---

### Task 3: Auto-register fingerprint generik + wiring detect-fields

**Files:**
- Modify: `prisma/schema.prisma` (tambah model `PortalProductFingerprint`), `prisma/migrations/20260903020000_add_portal_product_fingerprint/migration.sql` (create), `version.json` (schemaVersion + 1)
- Modify: `lib/portal-memory-recall.ts` (recall baca fingerprint generik sebagai sumber `GENERIC`)
- Modify: `app/api/portal-apps/verify-login/route.ts` (daftar fingerprint saat outcome CREDENTIAL_ACCEPTED dan produk tak dikenal)
- Modify: `app/api/portal-apps/detect-fields/route.ts` (recall sebelum ladder; sertakan blok `memory` di respons)

**Interfaces:**
- Consumes: `recallLoginMemory` (Task 2), `fingerprintLoginProduct` (Task 1).
- Produces: respons `detect-fields` berisi `memory: { source; label; config } | null`; tidak ada konsumen lain.

- [ ] **Step 1: Schema + migrasi**

Tambah ke `prisma/schema.prisma` setelah model `PortalDetectionFeedback`:

```prisma
// Fingerprint struktur form generik yang terbukti lolos Uji Login.
// Produk tak dikenal yang sukses diverifikasi otomatis terdaftar di sini
// sehingga aplikasi mirip berikutnya langsung dikenali (tanpa coding).
model PortalProductFingerprint {
  id          String   @id @default(cuid())
  origin      String
  product     String   // nama produk registry, atau "generic"
  formHash    String   // sha256 nama field terurut + method (tanpa nilai)
  config      Json     // CorrectedLoginConfig (tanpa kredensial)
  createdBy   String?
  createdAt   DateTime @default(now())

  @@index([origin])
  @@index([product, formHash])
  @@map("portal_product_fingerprint")
}
```

Tulis `prisma/migrations/20260903020000_add_portal_product_fingerprint/migration.sql`:

```sql
CREATE TABLE "portal_product_fingerprint" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "formHash" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_product_fingerprint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portal_product_fingerprint_origin_idx" ON "portal_product_fingerprint"("origin");
CREATE INDEX "portal_product_fingerprint_product_formHash_idx" ON "portal_product_fingerprint"("product", "formHash");
```

Run: `npx prisma generate`. Bump `schemaVersion` di `version.json` (+1).

- [ ] **Step 2: Recall baca fingerprint generik**

Ganti stub `latestFingerprint` di `realDb` (`lib/portal-memory-recall.ts`) dengan query nyata ke `prisma.portalProductFingerprint` (row terbaru di origin, config berisi usernameField/passwordField): Urutan recall menjadi koreksi > fingerprint generik (bila formHash cocok) > profile > registry. `formHash` dihitung dari nama field terurut + method memakai `node:crypto` sha256 — tambah fungsi `formSignatureHash(fields: string[], method: string): string` di file yang sama. Perbarui `scripts/test-memory-recall.ts` dengan kasus GENERIC, run hingga PASS.

- [ ] **Step 3: Auto-register di verify-login**

Di `app/api/portal-apps/verify-login/route.ts`, pada cabang outcome `CREDENTIAL_ACCEPTED`: bila `fingerprintLoginProduct(page.html, finalUrl)` null (produk tak dikenal) dan konfigurasi final memakai usernameField+passwordField, insert satu row `portalProductFingerprint` (origin, product `"generic"`, formHash dari nama field + method, config tanpa nilai, createdBy session user). Bungkus try/catch agar tidak menggagalkan verifikasi.

- [ ] **Step 4: Wiring detect-fields**

Di `app/api/portal-apps/detect-fields/route.ts` sebelum `detectWithLadder`: panggil `recallLoginMemory({ loginUrl: parsed.href, html: "" })`? HTML belum ada sebelum fetch — recall tahap 1 hanya koreksi (tanpa html). Setelah ladder (HTML tersedia), panggil lagi dengan html untuk registry check bila recall tahap 1 null. Sertakan `memory` di kedua respons (200 dan 422). Bila recall CORRECTION cocok penuh, lewati LLM (hemat biaya).

- [ ] **Step 5: Verifikasi + commit**

Run: `npx tsc --noEmit`, `npx tsx scripts/test-memory-recall.ts`, `npx tsx scripts/test-product-registry.ts`, `npm run build`.
Expected: semua hijau.

```bash
git add prisma/schema.prisma prisma/migrations/20260903020000_add_portal_product_fingerprint version.json lib/portal-memory-recall.ts scripts/test-memory-recall.ts app/api/portal-apps/verify-login/route.ts app/api/portal-apps/detect-fields/route.ts
git commit -m "feat(portal): auto-register fingerprint generik + wiring recall di detect-fields"
```
