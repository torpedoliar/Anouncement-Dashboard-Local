# Portal & Situs Publik — Experience Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal SSO menjadi "home screen" (favorit, terakhir dipakai, `Ctrl+K`, animasi buka app) dan situs pengumuman menjadi "Edisi Pagi" (Paper, BARU/sudah dibaca, artikel dengan progress, daftar isi, share), dengan font Newsreader + Libre Franklin.

**Architecture:** Logika yang bisa diuji diletakkan di modul murni (`lib/theme-key.ts`, `lib/portal-home.ts`, `lib/reading-state.ts`) dengan self-check `scripts/test-*.ts` (repo tidak punya test framework). Komponen React hanya merangkai modul itu. Satu tabel baru (`portal_user_app_pins`) untuk favorit; status per-perangkat di `localStorage`. Motion memakai CSS + View Transitions API bawaan browser.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 5 (PostgreSQL), Tailwind 3, `next/font/google`, `@phosphor-icons/react`, NextAuth (portal instance), Zod 4.

**Spec:** `docs/superpowers/specs/2026-10-02-portal-site-experience-rework-design.md`

## Global Constraints

- Tidak ada dependensi npm baru.
- UI copy, komentar, dan pesan commit dalam Bahasa Indonesia.
- Import Prisma: `import prisma from "@/lib/prisma"`. Alias `@/*` = root repo.
- Audit lewat `logAudit()` dari `lib/audit.ts` — non-blocking, jangan dibungkus try/catch.
- Validasi body API dengan Zod di `lib/validation-schemas.ts` + `validateInput`/`formatZodErrors`.
- Semua animasi baru mati di `prefers-reduced-motion: reduce` (blok global `app/globals.css:818` sudah memotong durasi; animasi yang menyembunyikan konten harus diberi `animation: none` eksplisit).
- Setiap elemen interaktif baru punya `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` dan nama aksesibel.
- Warna lewat token (`text-text-1`, `bg-surface-1`, `--site-primary`, …), bukan hex baru. Pengecualian: teks di atas scrim gelap media (pola `ponytail:` yang sudah ada di `ArticleHero`).
- Self-check: `npx tsx scripts/<name>.ts`, cetak `PASS`/`FAIL`, set `process.exitCode = 1` saat gagal (pola `scripts/test-detect-ladder.ts`).
- Setiap task diakhiri: `npx tsc --noEmit -p .` bersih untuk file yang disentuh dan `npx eslint <files>` tanpa error.
- Setelah setiap task yang mengubah kode: `graphify update .` (AST-only). Jangan commit `graphify-out/`.
- Font: Libre Franklin (`--font-sans`), Newsreader (`--font-serif`, axis `opsz`), JetBrains Mono (`--font-mono`).
- Tema: kunci `theme:site` (default `light`), `theme:portal` (default `dark`), `adminTheme` (default OS). Kelas CSS tetap `html.theme-light`.
- `version.json` `schemaVersion` 18 → 19 (satu migrasi di Task 5).

## Review Focus

1. **Pengguna lama yang sudah memilih tema dengan kunci `theme`** — membuka situs tetap Paper (default baru menang), membuka admin tetap mengikuti `adminTheme`. Diuji di `scripts/test-theme-key.ts` (Task 1).
2. **App yang sama muncul di Favorit, Terakhir dipakai, dan grupnya** — klik di mana pun hanya memberi `view-transition-name` ke ikon yang diklik (nama ganda membatalkan transisi). Diuji lewat `markLaunch` di Task 7 (uji manual DevTools) dan `excludeFavorites` di `test-portal-home.ts` (Task 4: Terakhir dipakai tidak mengulang favorit).
3. **Pin untuk app yang user tidak berhak akses / app yang dicabut aksesnya setelah di-pin** — API menolak 403; beranda tidak menampilkan favorit untuk app yang tidak lagi accessible. Diuji di Task 5 (`curl` 403) dan `pickFavorites` di `test-portal-home.ts` (Task 4).
4. **`localStorage` diblokir/penuh/korup (JSON rusak)** — BARU/dibaca/lipat grup/tema diam-diam nonaktif, halaman tetap benar. Diuji di `test-reading-state.ts` (input JSON rusak, non-array) dan `test-theme-key.ts`.
5. **Mengetik `/` di dalam input atau textarea** tidak membuka palette; `Ctrl+K` di dalam input tetap membuka. Diuji di `test-portal-home.ts` (`isPaletteShortcut`).

---

## File Structure

**Baru**
| File | Tanggung jawab |
|---|---|
| `lib/theme-key.ts` | Pilih kunci + default tema dari path; sumber script pra-paint |
| `lib/portal-home.ts` | Fungsi murni beranda portal: salam, ranking palette, favorit, terakhir dipakai, hitungan status, warna ikon, pintasan keyboard |
| `lib/reading-state.ts` | Fungsi murni BARU/dibaca/lastVisit/pengelompokan waktu |
| `lib/clipboard.ts` | `copyText` (dipindah dari `SSOCredentialVault`) |
| `components/portal/AppTile.tsx` | Tile ikon app + titik status + tooltip + bintang |
| `components/portal/PortalHome.tsx` | Beranda portal (sapaan, favorit, terakhir, strip status, grid, palette) |
| `components/portal/CommandPalette.tsx` | Dialog `Ctrl+K` |
| `components/portal/LaunchBridge.tsx` | Layar launch bersama (jembatan) |
| `components/site/EditionStrip.tsx` | Strip edisi + "N baru" |
| `components/site/ReadState.tsx` | `ReadMarker` (badge/redup kartu) + `MarkRead` (catat dibaca) |
| `components/site/ReadingProgress.tsx` | Bar progress + sisa menit |
| `components/site/TableOfContents.tsx` | Daftar isi otomatis |
| `components/site/ShareBar.tsx` | WhatsApp + salin tautan |
| `app/api/portal/apps/[id]/pin/route.ts` | PATCH favorit |
| `prisma/migrations/20261002010000_add_portal_user_app_pins/migration.sql` | Tabel favorit |
| `scripts/test-theme-key.ts`, `scripts/test-portal-home.ts`, `scripts/test-reading-state.ts` | Self-check |

**Diubah:** `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, `components/ThemeToggle.tsx`, `components/admin/AdminTopbar.tsx`, `app/admin/layout.tsx` (komentar), `app/portal/page.tsx`, `components/portal/PortalHeader.tsx`, `components/portal/SSOAutoSubmit.tsx`, `SSOPostSubmit.tsx`, `SSORerouteSubmit.tsx`, `SSORedirectHandoff.tsx`, `SSOCredentialVault.tsx`, `prisma/schema.prisma`, `version.json`, `lib/validation-schemas.ts`, `app/site/[siteSlug]/layout.tsx`, `app/site/[siteSlug]/page.tsx`, `components/site/Masthead.tsx`, `components/site/FrontPage.tsx`, `components/AnnouncementCard.tsx`, `components/Navbar.tsx`, `app/site/[siteSlug]/[articleSlug]/page.tsx`, `components/site/ArticleHero.tsx`, `app/site/page.tsx`, `components/SitePickerCard.tsx`.

**Dihapus:** `components/portal/GroupedAppGrid.tsx`, `components/portal/AppCard.tsx`, CSS `sso-rings-*` / `sso-glow-pulse` / `sso-ring-spin`.

---

# FASE 1 — Fondasi

### Task 1: Tema per permukaan

**Files:**
- Create: `lib/theme-key.ts`, `scripts/test-theme-key.ts`
- Modify: `app/layout.tsx:47-71`, `components/ThemeToggle.tsx`, `components/admin/AdminTopbar.tsx:43-55`, `app/admin/layout.tsx:22-23` (komentar)

**Interfaces:**
- Produces: `themeKeyForPath(pathname: string): { key: string; fallback: "light" | "dark" | "system" }`, `resolveTheme(pathname: string, read: (k: string) => string | null, prefersLight: boolean): "light" | "dark"`, `THEME_PREPAINT_SCRIPT: string`, `persistTheme(pathname: string, theme: "light" | "dark"): void`.

- [ ] **Step 1: Write the failing test**

`scripts/test-theme-key.ts`:
```ts
/**
 * Self-check pemilihan tema per permukaan.
 * Run: npx tsx scripts/test-theme-key.ts
 */
import { themeKeyForPath, resolveTheme, THEME_PREPAINT_SCRIPT } from "../lib/theme-key";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const store = (o: Record<string, string>) => (k: string) => o[k] ?? null;

assertEq(themeKeyForPath("/site/sja-utama"), { key: "theme:site", fallback: "light" }, "situs → theme:site, default light");
assertEq(themeKeyForPath("/site"), { key: "theme:site", fallback: "light" }, "pemilih situs → theme:site");
assertEq(themeKeyForPath("/portal/app/hris"), { key: "theme:portal", fallback: "dark" }, "portal → theme:portal, default dark");
assertEq(themeKeyForPath("/portal-login"), { key: "theme:portal", fallback: "dark" }, "login portal → theme:portal");
assertEq(themeKeyForPath("/admin/announcements"), { key: "adminTheme", fallback: "system" }, "admin → adminTheme, ikut OS");
assertEq(themeKeyForPath("/sitemap.xml"), { key: "adminTheme", fallback: "system" }, "/sitemap bukan /site");

// Review Focus #1: kunci lama `theme` tidak memengaruhi situs/portal.
assertEq(resolveTheme("/site/a", store({ theme: "dark" }), false), "light", "kunci lama theme=dark → situs tetap Paper");
assertEq(resolveTheme("/portal", store({ theme: "light" }), true), "dark", "kunci lama theme=light → portal tetap Night");
assertEq(resolveTheme("/site/a", store({ "theme:site": "dark" }), false), "dark", "pilihan eksplisit situs dihormati");
assertEq(resolveTheme("/admin", store({ adminTheme: "light" }), false), "light", "admin membaca adminTheme");
assertEq(resolveTheme("/admin", store({}), true), "light", "admin tanpa pilihan → OS light");
assertEq(resolveTheme("/admin", store({}), false), "dark", "admin tanpa pilihan → OS dark");
assertEq(resolveTheme("/site/a", store({ "theme:site": "garbage" }), false), "light", "nilai rusak → default");
assertEq(resolveTheme("/site/a", () => { throw new Error("blocked"); }, false), "light", "storage diblokir → default");

// Script pra-paint harus JavaScript valid dan memakai logika yang sama.
let added: string[] = [];
const fakeWindow = {
    location: { pathname: "/site/x" },
    localStorage: { getItem: (k: string) => (k === "theme" ? "dark" : null) },
    matchMedia: () => ({ matches: false }),
    document: { documentElement: { classList: { add: (c: string) => added.push(c) } } },
};
new Function("window", "location", "localStorage", "document", THEME_PREPAINT_SCRIPT)(
    fakeWindow, fakeWindow.location, fakeWindow.localStorage, fakeWindow.document,
);
assertEq(added, ["theme-light"], "script pra-paint: situs + kunci lama dark → theme-light");
added = [];
fakeWindow.location.pathname = "/portal";
new Function("window", "location", "localStorage", "document", THEME_PREPAINT_SCRIPT)(
    fakeWindow, fakeWindow.location, fakeWindow.localStorage, fakeWindow.document,
);
assertEq(added, [], "script pra-paint: portal → gelap (tanpa class)");

console.log(process.exitCode ? "=== ADA FAIL ===" : "=== ALL PASS ===");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-theme-key.ts`
Expected: FAIL — `Cannot find module '../lib/theme-key'`.

- [ ] **Step 3: Write minimal implementation**

`lib/theme-key.ts`:
```ts
/**
 * Tema per permukaan. Situs pengumuman default "Edisi Pagi" (Paper), portal
 * default Night, admin mengikuti OS. Kunci `theme` lama (global) sengaja tidak
 * dibaca lagi untuk situs/portal: default per permukaan harus menang supaya
 * kesan dua edisi konsisten (spec 2026-10-02 §2.2).
 *
 * `pickTheme` diserialisasi ke script pra-paint lewat `toString()`. Badan
 * fungsinya harus mandiri (tanpa rujukan ke import/konstanta luar); anotasi
 * tipe aman karena SWC (Next) dan esbuild (tsx) membuangnya sebelum runtime.
 */
export type ThemeChoice = "light" | "dark";
type ThemeFallback = "light" | "dark" | "system";

function pickTheme(
    pathname: string,
    read: (key: string) => string | null,
    prefersLight: boolean,
): { key: string; fallback: ThemeFallback; theme: ThemeChoice } {
    let key = "adminTheme";
    let fallback: ThemeFallback = "system";
    if (pathname === "/site" || pathname.startsWith("/site/")) {
        key = "theme:site";
        fallback = "light";
    } else if (pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/portal-login")) {
        key = "theme:portal";
        fallback = "dark";
    }
    let saved: string | null = null;
    try {
        saved = read(key);
    } catch {
        saved = null;
    }
    if (saved === "light" || saved === "dark") return { key, fallback, theme: saved };
    const theme: ThemeChoice = fallback === "system" ? (prefersLight ? "light" : "dark") : fallback;
    return { key, fallback, theme };
}

export function themeKeyForPath(pathname: string): { key: string; fallback: "light" | "dark" | "system" } {
    const { key, fallback } = pickTheme(pathname, () => null, false);
    return { key, fallback };
}

export function resolveTheme(pathname: string, read: (key: string) => string | null, prefersLight: boolean): ThemeChoice {
    return pickTheme(pathname, read, prefersLight).theme;
}

export const THEME_PREPAINT_SCRIPT = `
(function () {
  try {
    var pickTheme = ${pickTheme.toString()};
    var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var r = pickTheme(location.pathname, function (k) { return localStorage.getItem(k); }, prefersLight);
    if (r.theme === 'light') document.documentElement.classList.add('theme-light');
  } catch (e) {}
})();
`;

/** Simpan pilihan tema di kunci permukaan aktif. Storage diblokir → abaikan. */
export function persistTheme(pathname: string, theme: ThemeChoice): void {
    try {
        localStorage.setItem(themeKeyForPath(pathname).key, theme);
    } catch {
        // Tema tetap berubah untuk sesi ini.
    }
}
```

Step 4 memverifikasi bahwa hasil `toString()` dapat dieksekusi (test memanggil script lewat `new Function`). Setelah `npm run build`, cek juga `view-source:` halaman situs: script di `<head>` tidak boleh berisi `: string` atau `ThemeFallback`.

`app/layout.tsx`: hapus konstanta `THEME_PREPAINT_SCRIPT` lokal beserta komentar blok di atasnya, ganti dengan:
```ts
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme-key";
```
dan komentar satu baris di atas `<script>`: `{/* Tema per permukaan (lib/theme-key.ts) — diterapkan sebelum paint pertama */}`.

`components/ThemeToggle.tsx` — ganti seluruh isi `toggle` dan efek mount:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sun, Moon } from '@phosphor-icons/react';
import { persistTheme } from '@/lib/theme-key';

export function ThemeToggle() {
  const pathname = usePathname();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Script pra-paint sudah menerapkan tema; cukup salin keadaan DOM.
    const html = document.documentElement;
    setIsLight(html.classList.contains('theme-light'));
    const observer = new MutationObserver(() => {
      setIsLight(html.classList.contains('theme-light'));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = isLight ? 'dark' : 'light';
    document.documentElement.classList.toggle('theme-light', next === 'light');
    persistTheme(pathname, next);
    setIsLight(next === 'light');
  };

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Beralih ke mode gelap" : "Beralih ke mode terang"}
      aria-pressed={!isLight}
      className="p-2 rounded-control hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {isLight ? <Moon className="text-text-2" /> : <Sun className="text-brand-red" />}
    </button>
  );
}
```

`components/admin/AdminTopbar.tsx:43-55` — `handleToggleTheme` berhenti menulis kunci `theme`:
```tsx
    const handleToggleTheme = () => {
        const next = adminTheme === "light" ? "dark" : "light";
        setAdminTheme(next);
        try {
            // Kunci admin saja — situs & portal punya kuncinya sendiri (lib/theme-key.ts).
            localStorage.setItem("adminTheme", next);
        } catch {
            // Storage diblokir: tema tetap berubah untuk sesi ini.
        }
        document.documentElement.classList.toggle("theme-light", next === "light");
    };
```

`app/admin/layout.tsx:22-23` — perbarui komentar: `* Tema terang TIDAK diatur di sini — itu tugas script pra-paint global (lib/theme-key.ts, kunci "adminTheme", fallback prefers-color-scheme).`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-theme-key.ts`
Expected: semua `PASS`, baris terakhir `=== ALL PASS ===`.

- [ ] **Step 5: Typecheck, lint, manual check**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "theme-key|ThemeToggle|AdminTopbar|app/layout"` → kosong.
Run: `npx eslint lib/theme-key.ts components/ThemeToggle.tsx components/admin/AdminTopbar.tsx app/layout.tsx` → tanpa error.
Manual (`npm run dev`): DevTools → Application → hapus semua localStorage, set `theme`=`dark`. Buka `/site/sja-utama` → terang. Buka `/portal` → gelap. Toggle di situs → `theme:site` tertulis; `/portal` tidak berubah.

- [ ] **Step 6: Commit**

```bash
git add lib/theme-key.ts scripts/test-theme-key.ts app/layout.tsx components/ThemeToggle.tsx components/admin/AdminTopbar.tsx app/admin/layout.tsx
git commit -m "feat(tema): tema per permukaan — situs Paper, portal Night, admin ikut OS"
```

---

### Task 2: Font Newsreader + Libre Franklin, Paper diperkaya

**Files:**
- Modify: `app/layout.tsx:1-33,92`, `tailwind.config.ts:79-84`, `app/globals.css:148-178,296,331-339,464-476`, `app/site/[siteSlug]/layout.tsx:66`

**Interfaces:**
- Produces: CSS vars `--font-sans`, `--font-serif`, `--font-mono`; kelas `.site-paper` (grain hanya di situs).

- [ ] **Step 1: Ganti font di `app/layout.tsx`**

Ganti import dan tiga deklarasi font (baris 2-33):
```ts
import { Libre_Franklin, Newsreader, JetBrains_Mono } from "next/font/google";
```
```ts
// UI & body — turunan Franklin Gothic, tradisi tipografi surat kabar.
const sans = Libre_Franklin({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Serif editorial — judul, masthead, isi artikel. Axis opsz: huruf menyesuaikan ukuran.
const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

// Angka / ID / jam / hitungan / timestamp.
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});
```
`<body className=...>` menjadi:
```tsx
className={`${sans.variable} ${serif.variable} ${mono.variable} font-sans antialiased min-h-screen`}
```

- [ ] **Step 2: Tailwind `fontFamily`**

`tailwind.config.ts:79-84`:
```ts
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Heading UI memakai sans yang sama (bobot lebih berat); Sora dihapus.
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
```

- [ ] **Step 3: `globals.css` — rujukan font lama**

- Baris 296: `font-family: var(--font-inter), system-ui, -apple-system, sans-serif;` → `font-family: var(--font-sans), system-ui, -apple-system, sans-serif;`
- Blok heading global (baris ~331-339): ganti komentar `/* Headings — Sora (display) */` menjadi `/* Headings UI — Libre Franklin; judul editorial memakai .font-serif */` dan `font-family: var(--font-sora), ...` → `font-family: var(--font-sans), system-ui, sans-serif;`
- `.prose-santos h1, h2, h3` (baris ~470-475): `font-family: var(--font-serif), Georgia, serif;`
- Tambahkan di `.prose-santos` (baris ~464):
```css
.prose-santos {
  color: var(--text-2);
  /* Isi artikel serif — Newsreader dirancang untuk teks berita panjang. */
  font-family: var(--font-serif), Georgia, serif;
  font-size: 1.125rem;
  /* Panjang baris prosa dibatasi 65–75ch supaya nyaman dibaca. */
  max-width: 68ch;
}
```
- `.prose-santos p` `line-height: 1.8` → `line-height: 1.7`.

Verifikasi tidak ada rujukan tersisa:
Run: `grep -rn "font-inter\|font-sora" app components` → kosong.

- [ ] **Step 4: Paper diperkaya**

Ganti blok `html.theme-light` (baris 148-178) nilai permukaannya:
```css
html.theme-light {
  /* Edisi Pagi: kertas hangat. Kontras dicek 2026-10-02:
     text-1 di surface-0 15.6:1, text-3 di surface-0 5.0:1, text-3 di surface-2 4.6:1. */
  --surface-0: #F5F2EA;
  --surface-1: #FFFDF8;
  --surface-2: #EDE9DF;
  --surface-3: #E2DCCF;
  --border: #DDD6C8;
  --text-1: #1C1917;
  --text-2: #57534E;
  --text-3: #6B675F;
  --accent: var(--site-primary, var(--brand-red));

  --surface-0-rgb: 245 242 234;
  --surface-1-rgb: 255 253 248;
  --surface-2-rgb: 237 233 223;
  --surface-3-rgb: 226 220 207;
  --border-rgb: 221 214 200;
  --text-1-rgb: 28 25 23;
  --text-2-rgb: 87 83 78;
  --text-3-rgb: 107 103 95;
  --shadow-1: 0 1px 2px rgba(28, 25, 23, 0.08);
  --shadow-2: 0 4px 12px -2px rgba(28, 25, 23, 0.10);
  --shadow-3: 0 12px 32px -8px rgba(28, 25, 23, 0.14);
}

/* Grain kertas — hanya situs pengumuman, hanya edisi Paper. Statis (tanpa
   animasi), pointer-events none, tidak memengaruhi kontras teks. */
html.theme-light .site-paper {
  position: relative;
  isolation: isolate;
}
html.theme-light .site-paper::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.35;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .4 0 0 0 0 .32 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

`app/site/[siteSlug]/layout.tsx:66` — wrapper `div` menjadi kelas, bukan inline style:
```tsx
            <div className="site-paper flex min-h-screen flex-col">
```
dan `<main id="main-content" className="flex-1 scroll-mt-20">`.

- [ ] **Step 5: Verifikasi**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "app/layout|tailwind|siteSlug\]/layout"` → kosong.
Run: `npm run build` → sukses (next/font mengunduh font saat build; butuh internet).
Manual: `/site/sja-utama` — judul serif Newsreader, UI Libre Franklin, latar kertas bertekstur halus. `/admin` — font baru, tanpa grain. DevTools Rendering → emulate `prefers-reduced-motion: reduce` → tidak ada perbedaan (grain statis).

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx tailwind.config.ts app/globals.css "app/site/[siteSlug]/layout.tsx"
git commit -m "feat(tipografi): Newsreader + Libre Franklin, edisi Paper dengan grain kertas"
```

---

### Task 3: Pembersihan inline style + focus-visible situs

**Files:**
- Modify: `components/site/ArticleHero.tsx`, `app/site/page.tsx`, `components/SitePickerCard.tsx`, `app/site/[siteSlug]/[articleSlug]/page.tsx`, `app/site/[siteSlug]/page.tsx:164`, `components/site/Masthead.tsx`, `components/Navbar.tsx`, `components/AnnouncementCard.tsx:163`, `components/site/CategoryStrip.tsx`

**Interfaces:** tidak ada (refactor visual, perilaku sama).

Aturan: pindahkan nilai statis ke kelas Tailwind/token. Yang **tetap** inline: nilai dari data (`category.color`, `site.primaryColor`, `backgroundImage: url(imagePath)`), custom property `--i`, dan animasi `cine-*` yang memakai delay per-elemen.

- [ ] **Step 1: Hitung baseline**

Run: `grep -c 'style={{' components/site/ArticleHero.tsx app/site/page.tsx components/SitePickerCard.tsx "app/site/[siteSlug]/[articleSlug]/page.tsx"`
Expected: `21`, `12`, `10`, `10`.

- [ ] **Step 2: `ArticleHero.tsx`**

Ganti seluruh `return (...)` dengan versi kelas. Hapus fungsi lokal `calculateReadingTime` dan `extractYoutubeId` — pakai `readingTimeLabel` dan `extractYoutubeId` dari `@/lib/utils`. Hapus prop & tampilan `viewCount` (critique: angka view tidak berguna untuk pembaca internal) — prop dibiarkan opsional supaya pemanggil tidak rusak, tapi tidak dirender.

```tsx
"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarBlank, User, Clock, SpeakerHigh, SpeakerSlash, ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { extractYoutubeId, readingTimeLabel } from "@/lib/utils";

interface ArticleHeroProps {
    id: string;
    title: string;
    category: { name: string; slug: string; color: string };
    author?: { name: string } | null;
    createdAt: Date | string;
    wordCount: number;
    /** @deprecated tidak lagi ditampilkan (critique 2026-08-17). */
    viewCount?: number;
    imagePath?: string | null;
    videoPath?: string | null;
    youtubeUrl?: string | null;
    siteSlug: string;
    backHref?: string;
    backLabel?: string;
}

// ponytail: teks & kontrol hero memakai putih tetap (bukan token tema) — selalu di
// atas scrim gelap media, di kedua tema; token tema akan jadi gelap saat theme-light.
export default function ArticleHero({
    id: storyId,
    title,
    category,
    author,
    createdAt,
    wordCount,
    imagePath,
    videoPath,
    youtubeUrl,
    siteSlug,
    backHref,
    backLabel,
}: ArticleHeroProps) {
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
    const hasVideo = !!videoPath;
    const hasYoutube = !!youtubeId && !hasVideo;
    const hasImage = !!imagePath && !hasVideo && !hasYoutube;

    return (
        <div className="relative flex h-[min(55vh,420px)] w-full items-end overflow-hidden bg-surface-2">
            {/* 1. Media — view-transition-name sama dengan media kartu (transisi kartu → artikel) */}
            <div className="absolute inset-0 z-0" style={{ viewTransitionName: `story-${storyId}` }}>
                {hasVideo && (
                    <>
                        <video
                            ref={videoRef}
                            src={videoPath!}
                            autoPlay
                            muted={isMuted}
                            loop
                            playsInline
                            preload="metadata"
                            poster={imagePath || undefined}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                        <button
                            type="button"
                            onClick={toggleMute}
                            aria-label={isMuted ? "Aktifkan suara video" : "Bisukan suara video"}
                            className="absolute bottom-[30px] right-[30px] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            {isMuted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}
                        </button>
                    </>
                )}

                {hasYoutube && (
                    <iframe
                        title={`Video: ${title}`}
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&rel=0&modestbranding=1`}
                        className="pointer-events-none absolute inset-0 h-full w-full border-0 object-cover"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                )}

                {hasImage && (
                    <div
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${imagePath})` }}
                    />
                )}
            </div>

            {/* 2. Scrim keterbacaan — hitam tetap, bukan warna tema */}
            <div className="absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.1)_40%,rgba(0,0,0,0.95)_100%)]" />

            {/* 3. Konten */}
            <div className="relative z-20 mx-auto w-full max-w-[1000px] px-6 pb-16">
                {backHref && backLabel && (
                    <Link
                        href={backHref}
                        className="mb-3 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-white/90 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span className="leading-snug">{backLabel}</span>
                    </Link>
                )}

                <div>
                    <Link
                        href={`/site/${siteSlug}?category=${category.slug}`}
                        className="mb-3.5 inline-block rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase leading-none tracking-[0.06em] shadow-[0_1px_8px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        style={{ backgroundColor: category.color, color: "var(--site-text-on-primary, #fff)" }}
                    >
                        {category.name}
                    </Link>
                </div>

                <h1 className="mb-6 font-serif text-[clamp(32px,5vw,56px)] font-bold leading-[1.1] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)]">
                    {title}
                </h1>

                <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-white/85">
                    {author && (
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                                <User size={14} aria-hidden="true" />
                            </div>
                            <span>{author.name}</span>
                        </div>
                    )}
                    <span className="flex items-center gap-1.5">
                        <CalendarBlank size={16} className="opacity-70" aria-hidden="true" />
                        {format(new Date(createdAt), "dd MMMM yyyy", { locale: id })}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock size={16} className="opacity-70" aria-hidden="true" />
                        {readingTimeLabel(wordCount)}
                    </span>
                </div>
            </div>
        </div>
    );
}
```

Pemanggil di `app/site/[siteSlug]/[articleSlug]/page.tsx` menambah prop `id={announcement.id}` dan menghapus `viewCount={announcement.viewCount}`.

- [ ] **Step 3: Halaman artikel `app/site/[siteSlug]/[articleSlug]/page.tsx`**

Ganti blok inline:
- Wrapper: `<div className="min-h-screen bg-surface-0 text-text-1">`
- `<article style=...>` → `<article className="mx-auto max-w-[800px] px-6 pb-12 pt-8">`
- Kotak sindikasi → `<div className="mt-12 rounded-card bg-surface-1 px-5 py-4 text-[13px] text-text-3">`; link di dalamnya → `className="ml-2 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"` (warna dari `--accent` = `--site-primary`, setara `site.primaryColor`).
- Komentar → `<div className="mx-auto max-w-[800px] px-6 pb-16">`
- Artikel terkait → `<div data-cine className="mx-auto max-w-[1200px] border-t border-border px-6 pb-20 pt-12">`, `<h2 className="mb-6 text-2xl font-bold">`, grid `className="cine-stagger grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]"`.
- Footer artikel lokal (`© ... All rights reserved.` dengan `color: "#666"`) **dihapus** — layout situs sudah merender `<Footer>`; ini footer ganda.

- [ ] **Step 4: `app/site/page.tsx` dan `SitePickerCard.tsx`**

`app/site/page.tsx` — tambah `className="site-paper"` pada wrapper paling luar dan ganti seluruh inline style:
- Wrapper: `<div className="site-paper min-h-screen bg-surface-0 text-text-1">`
- Masthead merah: `<div className="border-b border-black/10 bg-[linear-gradient(135deg,var(--brand-red-dark)_0%,var(--brand-red)_55%,var(--brand-red-light)_100%)] px-6 pb-8 pt-9 text-center">`
- Logo box: `<div className="relative mx-auto mb-4 h-[88px] w-[88px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.18)]">` dengan `<Image ... fill className="object-contain" />`
- Fallback logo: `<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.16)]">` (ikon `color="#C41920"` tetap — di atas putih tetap).
- `<h1 className="mb-2.5 font-serif text-[clamp(24px,4vw,38px)] font-bold leading-[1.15] text-white [text-wrap:balance]">`
- `<p className="mx-auto max-w-[560px] text-[15px] leading-relaxed text-white/90">`
- Grid wrapper `<div className="mx-auto max-w-[1200px] px-6 pb-20 pt-8">`, grid `className="cine-stagger grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(350px,100%),1fr))]"`, item tetap `style={{ "--i": i } as React.CSSProperties}`.
- Empty state `<div className="px-5 py-16 text-center">`.
- Footer `<div className="border-t border-border p-6 text-center text-[13px] text-text-3">`.

`SitePickerCard.tsx` — ganti `return` dengan:
```tsx
    return (
        <Link
            href={`/site/${site.slug}`}
            className="site-picker-card relative block overflow-hidden rounded-sheet bg-surface-1 p-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
            {/* Garis aksen warna situs */}
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: site.primaryColor }} />

            <div
                className="mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[14px] text-2xl font-bold text-white"
                style={{ backgroundColor: site.primaryColor }}
            >
                {(site.logo || site.logoPath) ? (
                    <Image
                        width={56}
                        height={56}
                        src={site.logo || site.logoPath || ""}
                        alt={site.name}
                        className="h-full w-full object-contain"
                    />
                ) : (
                    site.name.charAt(0).toUpperCase()
                )}
            </div>

            <h2 className="mb-2 font-serif text-xl font-bold text-text-1">{site.name}</h2>

            {site.description && (
                <p className="mb-5 line-clamp-2 text-sm leading-normal text-text-2">{site.description}</p>
            )}

            <div className="mb-5 flex gap-4 text-[13px] text-text-3">
                <span className="flex items-center gap-1.5"><FileText size={14} aria-hidden="true" />{articleCount} artikel</span>
                <span className="flex items-center gap-1.5"><Tag size={14} aria-hidden="true" />{categoryCount} kategori</span>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: site.primaryColor }}>
                Kunjungi Site
                <ArrowRight size={16} aria-hidden="true" />
            </div>
        </Link>
    );
```
(Gradien aksen, glow logo dibuang — critique: empat dekorasi bertumpuk.)

- [ ] **Step 5: Halaman depan, Masthead, kartu, strip, navbar**

- `app/site/[siteSlug]/page.tsx:164` wrapper → `<div className="min-h-screen bg-surface-0 pt-20 text-text-1">`.
- `Masthead.tsx`: `style={{ animation: ... }}` → kelas `animate-[cine-fade-in_var(--motion-standard)_var(--motion-ease)_both]`; h1 → `className="mt-3 font-serif text-[clamp(2.25rem,6vw,4rem)] font-bold leading-[1.05] tracking-[-0.015em] text-text-1 animate-[cine-rise_var(--motion-slow)_var(--motion-ease)_120ms_both]"`; tagline → `animate-[cine-fade-in_var(--motion-standard)_var(--motion-ease)_300ms_both]`.
- `AnnouncementCard.tsx:163` `<Link ... style={{ display: 'block', textDecoration: 'none', ...style }}>` → `<Link href={href} className="block rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" style={style}>`; `<article style={{ transitionTimingFunction: ... }}>` → tambahkan kelas `ease-[var(--motion-ease)]` dan hapus `style`.
- `CategoryStrip.tsx` Link: tambahkan `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`.
- `Navbar.tsx`: link desktop, link mobile, logo Link, tombol menu → tambahkan kelas focus-visible yang sama; tombol menu tambah `type="button"`.

- [ ] **Step 6: Verifikasi**

Run: `grep -c 'style={{' components/site/ArticleHero.tsx app/site/page.tsx components/SitePickerCard.tsx "app/site/[siteSlug]/[articleSlug]/page.tsx"`
Expected: ≤ 3, ≤ 1, ≤ 3, 0 (hanya nilai dari data / `--i`).
Run: `npx tsc --noEmit -p . 2>&1 | grep -E "site/|SitePicker|ArticleHero|AnnouncementCard|Navbar|CategoryStrip|Masthead"` → kosong.
Run: `npx eslint components/site components/SitePickerCard.tsx components/AnnouncementCard.tsx components/Navbar.tsx app/site` → tanpa error.
Manual: `/site`, `/site/sja-utama`, satu artikel — tampilan sama seperti sebelum (selain font/footer ganda hilang/view count hilang). Tekan Tab dari atas halaman: setiap link punya outline terlihat.

- [ ] **Step 7: Commit**

```bash
git add components/site components/SitePickerCard.tsx components/AnnouncementCard.tsx components/Navbar.tsx app/site
git commit -m "refactor(site): inline style ke token, focus-visible di permukaan publik, hapus footer ganda"
```

---

# FASE 2 — Portal

### Task 4: Modul murni beranda portal

**Files:**
- Create: `lib/portal-home.ts`, `scripts/test-portal-home.ts`

**Interfaces:**
- Produces:
```ts
export type HealthBucket = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN";
export interface HomeApp {
    id: string; slug: string; name: string;
    description?: string | null; logoPath?: string | null; category?: string | null;
    groupName: string;
    credentialCount: number;
    healthStatus?: string | null; healthLatencyMs?: number | null; healthError?: string | null;
    lastUsedAt?: string | null; // ISO
}
export function greetingFor(hour: number): "Selamat pagi" | "Selamat siang" | "Selamat sore" | "Selamat malam";
export function healthBucket(status: string | null | undefined): HealthBucket;
export function countHealth(apps: HomeApp[]): Record<HealthBucket, number>;
export function pickFavorites(apps: HomeApp[], pinnedIds: Set<string>): HomeApp[];
export function pickRecent(apps: HomeApp[], exclude: Set<string>, limit?: number): HomeApp[];
export function rankApps(query: string, apps: HomeApp[]): HomeApp[];
export function iconColor(name: string): string;
export function isPaletteShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; targetTag?: string; targetEditable?: boolean }): boolean;
```

- [ ] **Step 1: Write the failing test**

`scripts/test-portal-home.ts`:
```ts
/**
 * Self-check modul murni beranda portal.
 * Run: npx tsx scripts/test-portal-home.ts
 */
import {
    greetingFor, healthBucket, countHealth, pickFavorites, pickRecent,
    rankApps, iconColor, isPaletteShortcut, type HomeApp,
} from "../lib/portal-home";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

const app = (id: string, name: string, extra: Partial<HomeApp> = {}): HomeApp => ({
    id, slug: id, name, groupName: "Umum", credentialCount: 1, ...extra,
});

// Salam
assertEq(greetingFor(5), "Selamat malam", "05:00 → malam");
assertEq(greetingFor(6), "Selamat pagi", "06:00 → pagi");
assertEq(greetingFor(11), "Selamat siang", "11:00 → siang");
assertEq(greetingFor(15), "Selamat sore", "15:00 → sore");
assertEq(greetingFor(18), "Selamat malam", "18:00 → malam");

// Status
assertEq(healthBucket("ONLINE"), "ONLINE", "ONLINE");
assertEq(healthBucket(null), "UNKNOWN", "null → UNKNOWN");
assertEq(healthBucket("WEIRD"), "UNKNOWN", "nilai asing → UNKNOWN");
assertEq(
    countHealth([app("a", "A", { healthStatus: "ONLINE" }), app("b", "B", { healthStatus: "OFFLINE" }), app("c", "C")]),
    { ONLINE: 1, DEGRADED: 0, OFFLINE: 1, UNKNOWN: 1 },
    "hitung status",
);

// Favorit — Review Focus #3: pin untuk app yang tak lagi accessible tidak tampil
const apps = [
    app("hris", "HRIS", { lastUsedAt: "2026-10-02T08:00:00Z" }),
    app("k2", "K2 Workflow", { lastUsedAt: "2026-10-01T08:00:00Z", category: "Workflow" }),
    app("ebs", "Oracle EBS", { lastUsedAt: "2026-09-30T08:00:00Z", groupName: "Keuangan" }),
    app("mail", "Webmail"),
    app("hris", "HRIS", { groupName: "SDM", lastUsedAt: "2026-10-02T08:00:00Z" }), // app sama di grup lain
];
assertEq(pickFavorites(apps, new Set(["k2", "dicabut"])).map((a) => a.id), ["k2"], "favorit hanya app yang tampil, tanpa duplikat");
assertEq(pickFavorites(apps, new Set(["hris"])).map((a) => a.id), ["hris"], "app di dua grup → satu favorit");

// Terakhir dipakai — urut terbaru, tanpa favorit, tanpa yang belum pernah dipakai, dedup
assertEq(pickRecent(apps, new Set()).map((a) => a.id), ["hris", "k2", "ebs"], "recent urut terbaru, dedup, tanpa null");
assertEq(pickRecent(apps, new Set(["hris"])).map((a) => a.id), ["k2", "ebs"], "recent tidak mengulang favorit");
assertEq(pickRecent(apps, new Set(), 2).map((a) => a.id), ["hris", "k2"], "batas jumlah");

// Ranking palette
assertEq(rankApps("", apps).length, 0, "query kosong → kosong (UI menampilkan favorit+recent)");
assertEq(rankApps("k2", apps).map((a) => a.id), ["k2"], "cocok nama");
assertEq(rankApps("work", apps).map((a) => a.id), ["k2"], "awal kata di tengah nama");
assertEq(rankApps("keu", apps).map((a) => a.id), ["ebs"], "cocok nama grup");
assertEq(rankApps("ORACLE", apps).map((a) => a.id), ["ebs"], "tidak peka huruf besar");
assertEq(rankApps("ma", [app("x", "Gmail"), app("y", "Mattermost")]).map((a) => a.id), ["y", "x"], "awal nama di atas tengah");
assertEq(rankApps("hris", apps).length, 1, "hasil palette dedup per id");
assertEq(rankApps("zzz", apps).length, 0, "tanpa hasil");

// Warna ikon deterministik
assertEq(iconColor("HRIS"), iconColor("HRIS"), "warna stabil");
assertEq(/^#[0-9a-f]{6}$/i.test(iconColor("")), true, "nama kosong tetap warna valid");

// Pintasan — Review Focus #5
assertEq(isPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false }), true, "Ctrl+K");
assertEq(isPaletteShortcut({ key: "K", ctrlKey: false, metaKey: true }), true, "Cmd+K");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "BODY" }), true, "/ di halaman");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "INPUT" }), false, "/ di input → tidak");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "TEXTAREA" }), false, "/ di textarea → tidak");
assertEq(isPaletteShortcut({ key: "/", ctrlKey: false, metaKey: false, targetTag: "DIV", targetEditable: true }), false, "/ di contenteditable → tidak");
assertEq(isPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false, targetTag: "INPUT" }), true, "Ctrl+K di input tetap buka");
assertEq(isPaletteShortcut({ key: "k", ctrlKey: false, metaKey: false }), false, "k biasa → tidak");

console.log(process.exitCode ? "=== ADA FAIL ===" : "=== ALL PASS ===");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-portal-home.ts`
Expected: FAIL — `Cannot find module '../lib/portal-home'`.

- [ ] **Step 3: Write minimal implementation**

`lib/portal-home.ts`:
```ts
/**
 * Logika murni beranda portal (tanpa React/DB) — diuji scripts/test-portal-home.ts.
 * Satu app bisa muncul di beberapa grup, jadi semua pemilih di sini dedup per id.
 */

export type HealthBucket = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN";

export interface HomeApp {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    logoPath?: string | null;
    category?: string | null;
    groupName: string;
    credentialCount: number;
    healthStatus?: string | null;
    healthLatencyMs?: number | null;
    healthError?: string | null;
    /** ISO string — max(lastUsedAt) kredensial user untuk app ini. */
    lastUsedAt?: string | null;
}

export function greetingFor(hour: number): "Selamat pagi" | "Selamat siang" | "Selamat sore" | "Selamat malam" {
    if (hour >= 6 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
}

export function healthBucket(status: string | null | undefined): HealthBucket {
    return status === "ONLINE" || status === "DEGRADED" || status === "OFFLINE" ? status : "UNKNOWN";
}

function dedup(apps: HomeApp[]): HomeApp[] {
    const seen = new Set<string>();
    return apps.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

export function countHealth(apps: HomeApp[]): Record<HealthBucket, number> {
    const counts: Record<HealthBucket, number> = { ONLINE: 0, DEGRADED: 0, OFFLINE: 0, UNKNOWN: 0 };
    for (const a of dedup(apps)) counts[healthBucket(a.healthStatus)]++;
    return counts;
}

/** Favorit = app yang tampil DAN di-pin. Pin untuk app yang tak lagi accessible diabaikan. */
export function pickFavorites(apps: HomeApp[], pinnedIds: Set<string>): HomeApp[] {
    return dedup(apps).filter((a) => pinnedIds.has(a.id));
}

export function pickRecent(apps: HomeApp[], exclude: Set<string>, limit = 4): HomeApp[] {
    return dedup(apps)
        .filter((a) => a.lastUsedAt && !exclude.has(a.id))
        .sort((x, y) => (y.lastUsedAt! > x.lastUsedAt! ? 1 : y.lastUsedAt! < x.lastUsedAt! ? -1 : 0))
        .slice(0, limit);
}

/**
 * Skor: awal nama 100 > awal kata di nama 60 > substring nama 30 > kategori/grup 10.
 * Query kosong → [] (pemanggil menampilkan favorit + terakhir dipakai).
 */
export function rankApps(query: string, apps: HomeApp[]): HomeApp[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const score = (a: HomeApp): number => {
        const name = a.name.toLowerCase();
        if (name.startsWith(q)) return 100;
        if (name.split(/[\s\-_/.]+/).some((w) => w.startsWith(q))) return 60;
        if (name.includes(q)) return 30;
        if (`${a.category ?? ""} ${a.groupName}`.toLowerCase().includes(q)) return 10;
        return 0;
    };
    return dedup(apps)
        .map((a) => ({ a, s: score(a) }))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name))
        .map((x) => x.a);
}

// Palet ikon tanpa logo — semua lolos AA untuk huruf putih (≥ 4.5:1).
const ICON_COLORS = ["#1d4ed8", "#6d28d9", "#b45309", "#0e7490", "#047857", "#be185d", "#4338ca", "#475569", "#9333ea", "#c2410c"];

export function iconColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return ICON_COLORS[h % ICON_COLORS.length];
}

export function isPaletteShortcut(e: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    targetTag?: string;
    targetEditable?: boolean;
}): boolean {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return true;
    if (e.key !== "/" || e.ctrlKey || e.metaKey) return false;
    const tag = (e.targetTag ?? "").toUpperCase();
    return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !e.targetEditable;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-portal-home.ts`
Expected: `=== ALL PASS ===`.

- [ ] **Step 5: Kontras palet ikon**

Untuk tiap warna di `ICON_COLORS`, cek kontras `#FFFFFF` di atasnya ≥ 4.5 (gunakan alat kontras apa pun; contoh `#1d4ed8` = 6.7:1). Ganti warna yang gagal dengan versi lebih gelap.

- [ ] **Step 6: Commit**

```bash
git add lib/portal-home.ts scripts/test-portal-home.ts
git commit -m "feat(portal): modul murni beranda — salam, favorit, terakhir dipakai, ranking palette"
```

---

### Task 5: Favorit — tabel, API pin

**Files:**
- Modify: `prisma/schema.prisma` (model `PortalUser` ~baris 606-611, `PortalApp` ~baris 748-752, model baru setelah `PortalUserAppVisibility`), `version.json`, `lib/validation-schemas.ts`
- Create: `prisma/migrations/20261002010000_add_portal_user_app_pins/migration.sql`, `app/api/portal/apps/[id]/pin/route.ts`

**Interfaces:**
- Produces: model `PortalUserAppPin { portalUserId, appId, createdAt }`; `PATCH /api/portal/apps/:id/pin` body `{ pinned: boolean }` → `200 { pinned: boolean }` | `400` | `401` | `403`; `PinAppSchema` di `lib/validation-schemas.ts`.

- [ ] **Step 1: Schema**

Tambah relasi di `PortalUser` (di bawah `visibility PortalUserAppVisibility[]`):
```prisma
  pins          PortalUserAppPin[]
```
Tambah di `PortalApp` (di bawah `visibility PortalUserAppVisibility[]`):
```prisma
  pins          PortalUserAppPin[]
```
Model baru setelah blok `PortalUserAppVisibility`:
```prisma
// Favorit beranda portal. Tabel terpisah dari visibility: saveVisibility()
// menghapus semua baris visibility saat onboarding/reset, dan baris app
// visible=true punya arti "tampilkan walau grup disembunyikan".
model PortalUserAppPin {
  portalUserId String
  appId        String
  createdAt    DateTime @default(now())

  portalUser   PortalUser @relation(fields: [portalUserId], references: [id], onDelete: Cascade)
  app          PortalApp  @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@id([portalUserId, appId])
  @@map("portal_user_app_pins")
}
```

- [ ] **Step 2: Migration SQL (manual, pola repo)**

`prisma/migrations/20261002010000_add_portal_user_app_pins/migration.sql`:
```sql
-- Favorit beranda portal (spec 2026-10-02 §3.3).
CREATE TABLE "portal_user_app_pins" (
    "portalUserId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_user_app_pins_pkey" PRIMARY KEY ("portalUserId","appId")
);

ALTER TABLE "portal_user_app_pins" ADD CONSTRAINT "portal_user_app_pins_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_user_app_pins" ADD CONSTRAINT "portal_user_app_pins_appId_fkey" FOREIGN KEY ("appId") REFERENCES "portal_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
`version.json`: `"schemaVersion": "18"` → `"schemaVersion": "19"`.

- [ ] **Step 3: Generate + verifikasi migrasi cocok dengan schema**

Run: `npm run prisma:generate` → sukses.
Run (DB dev harus jalan: `docker compose up -d db`): `npx prisma migrate dev --name add_portal_user_app_pins --create-only`
Expected: Prisma melaporkan **tidak ada perubahan baru** ("Already in sync" / tidak membuat folder baru) setelah `npx prisma migrate deploy`. Bila Prisma membuat folder migrasi baru, bandingkan isinya dengan SQL di Step 2, perbaiki SQL manual, hapus folder buatan Prisma.
Run: `npx prisma migrate deploy` → menerapkan `20261002010000_add_portal_user_app_pins`.

- [ ] **Step 4: Zod schema**

`lib/validation-schemas.ts`, setelah `PatchVisibilitySchema`:
```ts
export const PinAppSchema = z.object({
    pinned: z.boolean(),
});
```

- [ ] **Step 5: Route**

`app/api/portal/apps/[id]/pin/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { canAccessPortalApp } from "@/lib/portal-access";
import { PinAppSchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/prisma";

// PATCH /api/portal/apps/:id/pin — tandai/lepas favorit beranda. Body { pinned }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const userId = session.user.id;
        const { id: appId } = await params;

        const body = await request.json().catch(() => null);
        const validation = validateInput(PinAppSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 },
            );
        }
        const { pinned } = validation.data;

        // Hanya app yang user berhak akses — termasuk saat melepas pin? Tidak:
        // melepas pin app yang aksesnya sudah dicabut harus tetap bisa.
        if (pinned && !(await canAccessPortalApp(userId, appId))) {
            return NextResponse.json({ error: "App tidak dapat diakses" }, { status: 403 });
        }

        if (pinned) {
            await prisma.portalUserAppPin.upsert({
                where: { portalUserId_appId: { portalUserId: userId, appId } },
                update: {},
                create: { portalUserId: userId, appId },
            });
        } else {
            await prisma.portalUserAppPin.deleteMany({ where: { portalUserId: userId, appId } });
        }

        logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "PORTAL",
            action: pinned ? "PORTAL_APP_PIN" : "PORTAL_APP_UNPIN",
            entityType: "PORTAL_APP",
            entityId: appId,
            request,
        });

        return NextResponse.json({ pinned });
    } catch (err) {
        console.error("PATCH /api/portal/apps/[id]/pin:", err);
        return NextResponse.json({ error: "Gagal menyimpan favorit" }, { status: 500 });
    }
}
```
Catatan: `logAudit` di repo mengembalikan Promise yang tidak pernah reject; route lain memakai `await logAudit(...)` — ikuti pola itu bila lint mengeluh soal floating promise: `await logAudit({...});`.

- [ ] **Step 6: Verifikasi**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "pin/route|validation-schemas"` → kosong.
Manual (dev server, login portal di browser, salin cookie `portal-auth.session-token`):
```bash
curl -s -X PATCH http://localhost:3000/api/portal/apps/<APP_ID_PUBLIK>/pin -H "content-type: application/json" -H "cookie: portal-auth.session-token=<TOKEN>" -d '{"pinned":true}'   # → {"pinned":true}
curl -s -X PATCH http://localhost:3000/api/portal/apps/<APP_ID_PUBLIK>/pin -H "content-type: application/json" -H "cookie: portal-auth.session-token=<TOKEN>" -d '{"pinned":"ya"}'  # → 400
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH http://localhost:3000/api/portal/apps/<APP_ID_RESTRICTED_TANPA_AKSES>/pin -H "content-type: application/json" -H "cookie: portal-auth.session-token=<TOKEN>" -d '{"pinned":true}'  # → 403
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH http://localhost:3000/api/portal/apps/x/pin -d '{"pinned":true}'  # → 401
```
Cek `/admin/audit-trail` → baris `PORTAL_APP_PIN`.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261002010000_add_portal_user_app_pins version.json lib/validation-schemas.ts "app/api/portal/apps/[id]/pin/route.ts"
git commit -m "feat(portal): favorit aplikasi — tabel portal_user_app_pins + PATCH /api/portal/apps/:id/pin"
```

---

### Task 6: Beranda home screen + AppTile + Command Palette

**Files:**
- Create: `components/portal/AppTile.tsx`, `components/portal/PortalHome.tsx`, `components/portal/CommandPalette.tsx`
- Modify: `app/portal/page.tsx`, `components/portal/PortalHeader.tsx`, `app/globals.css` (blok baru `/* Portal home */`)
- Delete: `components/portal/GroupedAppGrid.tsx`, `components/portal/AppCard.tsx`

**Interfaces:**
- Consumes: `HomeApp`, `greetingFor`, `healthBucket`, `countHealth`, `pickFavorites`, `pickRecent`, `rankApps`, `iconColor`, `isPaletteShortcut` (Task 4); `PATCH /api/portal/apps/:id/pin` (Task 5); `useToast` dari `@/contexts/ToastContext`.
- Produces:
  - `AppTile` props `{ app: HomeApp; pinned: boolean; onTogglePin(app: HomeApp): void; size?: "lg" | "md" }`, merender `<a href="/portal/app/{slug}" data-app-tile data-slug={slug}>`.
  - `PortalHome` props `{ userName: string; groups: { id: string; name: string; apps: HomeApp[] }[]; pinnedIds: string[]; openPalette?: boolean }`.
  - `CommandPalette` props `{ open: boolean; onClose(): void; apps: HomeApp[]; suggestions: HomeApp[] }`.
  - Fungsi `markLaunch(el: HTMLElement): void` diekspor dari `AppTile.tsx` (dipakai Task 7).

- [ ] **Step 1: Server page `app/portal/page.tsx`**

Ganti dari `// Batch query credential untuk hindari N+1` sampai akhir `return` dengan:
```tsx
    // Batch query credential + lastUsedAt + pin untuk hindari N+1.
    const visibleIds = visibleApps.map((a) => a.id);
    const [credRows, pinRows] = visibleIds.length
        ? await Promise.all([
              prisma.portalUserAppCredential.groupBy({
                  by: ["appId"],
                  where: { portalUserId: userId, appId: { in: visibleIds } },
                  _count: { _all: true },
                  _max: { lastUsedAt: true },
              }),
              prisma.portalUserAppPin.findMany({
                  where: { portalUserId: userId, appId: { in: visibleIds } },
                  select: { appId: true },
                  orderBy: { createdAt: "asc" },
              }),
          ])
        : [[], []];
    const credByApp = new Map(credRows.map((r) => [r.appId, r]));

    const appById = new Map(visibleApps.map((a) => [a.id, a]));
    const homeGroups = groups
        .map((g) => ({
            id: g.id,
            name: g.name,
            apps: g.apps
                .filter((a) => appById.has(a.id))
                .map((a) => {
                    const full = appById.get(a.id)!;
                    const cred = credByApp.get(a.id);
                    return {
                        id: a.id,
                        slug: a.slug,
                        name: a.name,
                        description: a.description,
                        logoPath: a.logoPath,
                        category: a.category,
                        groupName: g.name,
                        credentialCount: cred?._count._all ?? 0,
                        // Jangan paksa "ONLINE": app yang belum dicek tetap UNKNOWN.
                        healthStatus: full.healthStatus ?? null,
                        healthLatencyMs: full.healthLatencyMs ?? null,
                        healthError: full.healthError ?? null,
                        lastUsedAt: cred?._max.lastUsedAt?.toISOString() ?? null,
                    };
                }),
        }))
        .filter((g) => g.apps.length > 0);

    return (
        <>
            {ssoError && (
                <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-8">
                    <SsoErrorBanner error={ssoError} appSlug={ssoErrorApp} />
                </div>
            )}
            {homeGroups.length === 0 ? (
                <div className="mx-auto max-w-[1200px] p-8">
                    {/* empty state lama dipertahankan apa adanya */}
                    <div className="mx-auto max-w-[400px] rounded-sheet border border-border bg-surface-1 p-10 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet bg-surface-2">
                            <SquaresFour size={24} className="text-text-2" aria-hidden="true" />
                        </div>
                        <h2 className="mt-6 font-display text-xl font-semibold text-text-1">Belum ada aplikasi</h2>
                        <p className="mt-2 text-sm text-text-2">
                            Tidak ada aplikasi yang dapat ditampilkan saat ini. Atur visibilitas lewat Pengaturan.
                        </p>
                        <Link
                            href="/portal/settings"
                            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            Buka Pengaturan
                        </Link>
                    </div>
                </div>
            ) : (
                <PortalHome
                    userName={session!.user!.name ?? ""}
                    groups={homeGroups}
                    pinnedIds={pinRows.map((p) => p.appId)}
                    openPalette={cari === "1"}
                />
            )}
        </>
    );
```
Ubah `searchParams` type menjadi `Promise<{ error?: string; app?: string; cari?: string }>` dan destructure `const { error: ssoError, app: ssoErrorApp, cari } = await searchParams;`. Import: hapus `GroupedAppGrid, { GridGroup }`, tambah `import PortalHome from "@/components/portal/PortalHome";`.

- [ ] **Step 2: `AppTile.tsx`**

```tsx
"use client";

import Image from "next/image";
import { Star } from "@phosphor-icons/react";
import { healthBucket, iconColor, type HomeApp } from "@/lib/portal-home";

const STATUS_LABEL = {
    ONLINE: "Normal",
    DEGRADED: "Lambat",
    OFFLINE: "Gangguan",
    UNKNOWN: "Belum dicek",
} as const;

const STATUS_DOT = {
    ONLINE: "bg-success",
    DEGRADED: "bg-warning portal-breathe",
    OFFLINE: "bg-danger portal-breathe",
    UNKNOWN: "bg-text-3",
} as const;

/**
 * Pasang view-transition-name HANYA pada ikon yang diklik. App yang sama bisa
 * tampil di Favorit, Terakhir dipakai, dan beberapa grup; nama ganda membatalkan
 * transisi lintas halaman.
 */
export function markLaunch(el: HTMLElement) {
    const slug = el.dataset.slug;
    const icon = el.querySelector<HTMLElement>("[data-app-icon]");
    if (slug && icon) icon.style.viewTransitionName = `app-${slug}`;
}

export default function AppTile({
    app,
    pinned,
    onTogglePin,
    size = "lg",
}: {
    app: HomeApp;
    pinned: boolean;
    onTogglePin: (app: HomeApp) => void;
    size?: "lg" | "md";
}) {
    const bucket = healthBucket(app.healthStatus);
    const tipId = `tip-${app.id}-${size}`;
    const iconSize = size === "lg" ? 56 : 44;
    const statusText = `${STATUS_LABEL[bucket]}${app.healthLatencyMs && bucket !== "OFFLINE" ? ` · ${app.healthLatencyMs}ms` : ""}`;

    return (
        <div className="group/tile relative">
            {/* <a> biasa (bukan next/link): View Transitions lintas dokumen butuh navigasi penuh. */}
            <a
                href={`/portal/app/${app.slug}`}
                data-app-tile
                data-slug={app.slug}
                aria-describedby={tipId}
                onClick={(e) => markLaunch(e.currentTarget)}
                className="flex flex-col items-center gap-2 rounded-sheet px-2 py-3 text-center transition-[background-color,transform] duration-150 ease-[var(--motion-ease)] hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
                <span className="relative">
                    <span
                        data-app-icon
                        className="flex items-center justify-center overflow-hidden rounded-[14px] text-lg font-bold text-white shadow-lvl-1"
                        style={{ width: iconSize, height: iconSize, backgroundColor: app.logoPath ? undefined : iconColor(app.name) }}
                    >
                        {app.logoPath ? (
                            <Image src={app.logoPath} alt="" width={iconSize} height={iconSize} className="h-full w-full object-cover" />
                        ) : (
                            app.name.charAt(0).toUpperCase()
                        )}
                    </span>
                    <span
                        aria-hidden="true"
                        className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-0 ${STATUS_DOT[bucket]}`}
                    />
                </span>
                <span className="line-clamp-2 text-[12.5px] font-medium leading-tight text-text-1">{app.name}</span>
            </a>

            {/* Bintang — muncul saat hover/fokus di dalam tile, selalu terlihat bila sudah di-pin */}
            <button
                type="button"
                onClick={() => onTogglePin(app)}
                aria-pressed={pinned}
                aria-label={pinned ? `Hapus ${app.name} dari favorit` : `Jadikan ${app.name} favorit`}
                className={`absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-1/90 text-text-2 shadow-lvl-1 transition-opacity duration-150 hover:text-warning focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    pinned ? "text-warning opacity-100" : "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
                }`}
            >
                <Star size={14} weight={pinned ? "fill" : "regular"} aria-hidden="true" />
            </button>

            {/* Tooltip — hover & fokus keyboard; teks status untuk pembaca layar juga */}
            <div
                id={tipId}
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-tooltip mt-1 w-56 -translate-x-1/2 rounded-card border border-border bg-surface-1 p-3 text-left text-xs text-text-2 opacity-0 shadow-lvl-2 transition-opacity duration-150 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
            >
                <p className="font-semibold text-text-1">{app.name}</p>
                <p className="mt-0.5">Status: {statusText}</p>
                {bucket === "OFFLINE" && (
                    <p className="mt-1 text-danger">Server tidak merespons{app.healthError ? ` (${app.healthError})` : ""}.</p>
                )}
                {app.description && <p className="mt-1 line-clamp-3">{app.description}</p>}
                <p className="mt-1 text-text-3">
                    {app.credentialCount > 0 ? `${app.credentialCount} akun tersimpan` : "Belum ada akun tersimpan"}
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: `CommandPalette.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { iconColor, rankApps, type HomeApp } from "@/lib/portal-home";

/** Dialog <dialog> native: fokus terkunci & Esc bawaan browser. */
export default function CommandPalette({
    open,
    onClose,
    apps,
    suggestions,
}: {
    open: boolean;
    onClose: () => void;
    apps: HomeApp[];
    suggestions: HomeApp[];
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            setQuery("");
            setActive(0);
            d.showModal();
        } else if (!open && d.open) {
            d.close();
        }
    }, [open]);

    const results = query.trim() ? rankApps(query, apps).slice(0, 8) : suggestions;

    const go = (app: HomeApp) => {
        window.location.href = `/portal/app/${app.slug}`;
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active]);
        }
    };

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            onClick={(e) => e.target === ref.current && onClose()}
            aria-label="Cari aplikasi"
            className="portal-palette m-0 mx-auto mt-[12vh] w-[min(560px,calc(100vw-32px))] rounded-sheet border border-border bg-surface-1 p-0 text-text-1 shadow-lvl-3 backdrop:bg-black/50"
        >
            <div className="flex items-center gap-3 border-b border-border px-4">
                <MagnifyingGlass size={18} className="shrink-0 text-text-3" aria-hidden="true" />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Ketik nama aplikasi…"
                    aria-label="Nama aplikasi"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="palette-list"
                    aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
                    className="h-14 w-full bg-transparent text-base outline-none placeholder:text-text-3"
                />
                <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-3">Esc</kbd>
            </div>
            <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
                {!query.trim() && results.length > 0 && (
                    <li role="presentation" className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-3">
                        Favorit &amp; terakhir dipakai
                    </li>
                )}
                {results.map((app, i) => (
                    <li
                        key={app.id}
                        id={`palette-${app.id}`}
                        role="option"
                        aria-selected={i === active}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(app)}
                        className={`flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 ${i === active ? "bg-surface-2" : ""}`}
                    >
                        <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-sm font-bold text-white"
                            style={{ backgroundColor: iconColor(app.name) }}
                            aria-hidden="true"
                        >
                            {app.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{app.name}</span>
                            <span className="block truncate text-xs text-text-3">{app.groupName}</span>
                        </span>
                        {i === active && <span className="text-xs text-text-3">Enter ↵</span>}
                    </li>
                ))}
                {query.trim() && results.length === 0 && (
                    <li role="presentation" className="px-3 py-6 text-center text-sm text-text-3">
                        Tidak ada aplikasi bernama &ldquo;{query}&rdquo;.
                    </li>
                )}
            </ul>
        </dialog>
    );
}
```

- [ ] **Step 4: `PortalHome.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import AppTile from "@/components/portal/AppTile";
import CommandPalette from "@/components/portal/CommandPalette";
import { useToast } from "@/contexts/ToastContext";
import { getRelativeTime } from "@/lib/utils";
import {
    countHealth, greetingFor, healthBucket, isPaletteShortcut, pickFavorites, pickRecent,
    type HealthBucket, type HomeApp,
} from "@/lib/portal-home";

interface HomeGroup {
    id: string;
    name: string;
    apps: HomeApp[];
}

const COLLAPSE_AFTER = 12;
const STATUS_ORDER: { bucket: HealthBucket; label: string; dot: string }[] = [
    { bucket: "ONLINE", label: "normal", dot: "bg-success" },
    { bucket: "DEGRADED", label: "lambat", dot: "bg-warning" },
    { bucket: "OFFLINE", label: "gangguan", dot: "bg-danger" },
    { bucket: "UNKNOWN", label: "belum dicek", dot: "bg-text-3" },
];

function readCollapsed(groupId: string): boolean {
    try {
        return localStorage.getItem(`portal:collapsed:${groupId}`) === "1";
    } catch {
        return false;
    }
}

function writeCollapsed(groupId: string, collapsed: boolean) {
    try {
        if (collapsed) localStorage.setItem(`portal:collapsed:${groupId}`, "1");
        else localStorage.removeItem(`portal:collapsed:${groupId}`);
    } catch {
        // Storage diblokir: status lipat hanya untuk sesi ini.
    }
}

/** Panah kiri/kanan/atas/bawah memindah fokus antar tile dalam satu grid. */
function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!keys.includes(e.key)) return;
    const tiles = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>("[data-app-tile]"));
    const i = tiles.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.round(e.currentTarget.clientWidth / tiles[0].getBoundingClientRect().width));
    const delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -cols : cols;
    const next = tiles[i + delta];
    if (next) {
        e.preventDefault();
        next.focus();
    }
}

export default function PortalHome({
    userName,
    groups,
    pinnedIds,
    openPalette = false,
}: {
    userName: string;
    groups: HomeGroup[];
    pinnedIds: string[];
    openPalette?: boolean;
}) {
    const { error: toastError } = useToast();
    const [pinned, setPinned] = useState(() => new Set(pinnedIds));
    const [filter, setFilter] = useState<HealthBucket | null>(null);
    const [paletteOpen, setPaletteOpen] = useState(openPalette);
    // Salam netral saat SSR; diganti salam sesuai jam perangkat setelah mount.
    const [greeting, setGreeting] = useState("Halo");
    const [today, setToday] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const firstName = userName.split(" ")[0] || userName;

    const allApps = useMemo(() => groups.flatMap((g) => g.apps), [groups]);
    const favorites = pickFavorites(allApps, pinned);
    const recent = pickRecent(allApps, pinned);
    const health = countHealth(allApps);
    const suggestions = [...favorites, ...pickRecent(allApps, pinned, 6)].slice(0, 8);

    useEffect(() => {
        const now = new Date();
        setGreeting(greetingFor(now.getHours()));
        setToday(new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now));
        setCollapsed(Object.fromEntries(groups.map((g) => [g.id, g.apps.length > COLLAPSE_AFTER && readCollapsed(g.id)])));
        if (openPalette) window.history.replaceState(null, "", "/portal");
    }, [groups, openPalette]);

    const paletteOpenRef = useRef(paletteOpen);
    paletteOpenRef.current = paletteOpen;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (!paletteOpenRef.current && isPaletteShortcut({
                key: e.key,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                targetTag: t?.tagName,
                targetEditable: t?.isContentEditable,
            })) {
                e.preventDefault();
                setPaletteOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const togglePin = async (app: HomeApp) => {
        const next = !pinned.has(app.id);
        const apply = (on: boolean) =>
            setPinned((prev) => {
                const s = new Set(prev);
                if (on) s.add(app.id);
                else s.delete(app.id);
                return s;
            });
        apply(next); // optimistik
        try {
            const res = await fetch(`/api/portal/apps/${app.id}/pin`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ pinned: next }),
            });
            if (!res.ok) throw new Error(String(res.status));
        } catch {
            apply(!next);
            toastError(null, "Gagal menyimpan favorit");
        }
    };

    const show = (app: HomeApp) => !filter || healthBucket(app.healthStatus) === filter;

    return (
        <div className="relative">
            <div aria-hidden="true" className="portal-mesh pointer-events-none absolute inset-x-0 top-0 h-[320px]" />
            <div className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-8 sm:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="font-display text-title font-semibold text-text-1">
                            {greeting}, {firstName}
                        </h1>
                        <p className="mt-1 min-h-[1.25rem] text-small text-text-2">{today}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        className="inline-flex h-10 min-w-[240px] items-center gap-2 rounded-control border border-border bg-surface-1 px-3 text-sm text-text-3 transition-colors duration-150 hover:border-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <MagnifyingGlass size={16} aria-hidden="true" />
                        Cari aplikasi…
                        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-2">Ctrl K</kbd>
                    </button>
                </div>

                {favorites.length > 0 && (
                    <section aria-labelledby="fav-h" className="mt-8">
                        <h2 id="fav-h" className="portal-label">Favorit</h2>
                        <div onKeyDown={onGridKeyDown} className="portal-grid mt-2">
                            {favorites.map((app) => (
                                <AppTile key={app.id} app={app} pinned onTogglePin={togglePin} />
                            ))}
                        </div>
                    </section>
                )}

                {recent.length > 0 && (
                    <section aria-labelledby="recent-h" className="mt-8">
                        <h2 id="recent-h" className="portal-label">Terakhir dipakai</h2>
                        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                            {recent.map((app) => (
                                <div key={app.id} className="flex items-center gap-3 rounded-sheet border border-border bg-surface-1 pr-3">
                                    <div className="w-[76px] shrink-0">
                                        <AppTile app={app} pinned={pinned.has(app.id)} onTogglePin={togglePin} size="md" />
                                    </div>
                                    <span className="text-xs text-text-3">{getRelativeTime(app.lastUsedAt!)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="portal-label m-0">Semua aplikasi</h2>
                    <div role="group" aria-label="Filter status aplikasi" className="flex flex-wrap gap-1.5">
                        {STATUS_ORDER.filter((s) => health[s.bucket] > 0).map((s) => (
                            <button
                                key={s.bucket}
                                type="button"
                                aria-pressed={filter === s.bucket}
                                onClick={() => setFilter((f) => (f === s.bucket ? null : s.bucket))}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                                    filter === s.bucket ? "border-accent/40 bg-accent-subtle text-text-1" : "border-border bg-surface-1 text-text-2 hover:text-text-1"
                                }`}
                            >
                                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                                {health[s.bucket]} {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {groups.map((g) => {
                    const apps = g.apps.filter(show);
                    if (apps.length === 0) return null;
                    const collapsible = g.apps.length > COLLAPSE_AFTER;
                    const grid = (
                        <div onKeyDown={onGridKeyDown} className="portal-grid mt-2">
                            {apps.map((app) => (
                                <AppTile key={app.id} app={app} pinned={pinned.has(app.id)} onTogglePin={togglePin} />
                            ))}
                        </div>
                    );
                    return (
                        <section key={g.id} aria-label={g.name} className="mt-6">
                            {collapsible ? (
                                <details
                                    open={!collapsed[g.id]}
                                    onToggle={(e) => {
                                        const isCollapsed = !(e.currentTarget as HTMLDetailsElement).open;
                                        writeCollapsed(g.id, isCollapsed);
                                    }}
                                >
                                    <summary className="portal-label cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                                        {g.name} <span className="font-normal normal-case tracking-normal text-text-3">({apps.length})</span>
                                    </summary>
                                    {grid}
                                </details>
                            ) : (
                                <>
                                    <h3 className="portal-label">{g.name}</h3>
                                    {grid}
                                </>
                            )}
                        </section>
                    );
                })}
            </div>

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} apps={allApps} suggestions={suggestions} />
        </div>
    );
}
```

- [ ] **Step 5: CSS portal di `app/globals.css`**

Tambahkan sebelum blok `@media (prefers-reduced-motion: reduce)` (baris ~818):
```css
/* ==========================================================================
   Portal home (spec 2026-10-02 §3)
   ========================================================================== */
.portal-label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-3);
}

.portal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}
@media (min-width: 640px) { .portal-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .portal-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }

/* Titik status bermasalah bernapas pelan; status normal statis. */
@keyframes portal-breathe {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.85); }
}
.portal-breathe { animation: portal-breathe 2.4s ease-in-out infinite; }

/* Gradien brand di belakang sapaan — bergeser sangat pelan. */
@keyframes portal-mesh-drift {
  from { background-position: 0% 0%, 100% 0%; }
  to { background-position: 12% 6%, 88% 10%; }
}
.portal-mesh {
  background:
    radial-gradient(600px 260px at 15% 0%, rgb(var(--accent-rgb) / 0.16), transparent 60%),
    radial-gradient(520px 260px at 90% 10%, rgb(var(--color-info-rgb) / 0.10), transparent 60%);
  background-size: 120% 120%, 120% 120%;
  animation: portal-mesh-drift var(--motion-ambient) ease-in-out infinite alternate;
}

.portal-palette[open] { animation: modalScale var(--motion-fast) var(--motion-ease); }
```
Di dalam blok `@media (prefers-reduced-motion: reduce)` yang ada, tambahkan:
```css
  .portal-breathe,
  .portal-mesh { animation: none !important; }
```

- [ ] **Step 6: Header — tombol cari**

`components/portal/PortalHeader.tsx`: di `<div className="flex items-center gap-3">` sebelum `<ThemeToggle />` tambahkan (hanya di luar beranda; beranda punya tombol besar sendiri):
```tsx
                    {pathname !== "/portal" && (
                        <a
                            href="/portal?cari=1"
                            aria-label="Cari aplikasi"
                            className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm text-text-2 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <MagnifyingGlass size={16} aria-hidden="true" />
                            <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
                        </a>
                    )}
```
Tambah `MagnifyingGlass` ke import phosphor. Link logo `PORTAL SSO` diberi kelas focus-visible.

- [ ] **Step 7: Hapus komponen lama**

Run: `git rm components/portal/GroupedAppGrid.tsx components/portal/AppCard.tsx`
Run: `grep -rn "GroupedAppGrid\|portal/AppCard" app components lib` → kosong.

- [ ] **Step 8: Verifikasi**

Run: `npx tsx scripts/test-portal-home.ts` → ALL PASS.
Run: `npx tsc --noEmit -p . 2>&1 | grep -E "portal"` → kosong.
Run: `npx eslint components/portal app/portal` → tanpa error.
Manual (dev, login portal):
1. Beranda: sapaan sesuai jam, tanggal, tidak ada flash hydration error di console.
2. Bintang pada tile → muncul di Favorit; reload → tetap. Matikan jaringan (DevTools offline) → klik bintang → kembali + toast "Gagal menyimpan favorit".
3. Terakhir dipakai berisi app yang pernah dibuka, tidak mengulang favorit.
4. Klik chip "1 gangguan" → grid hanya app offline; klik lagi → semua.
5. `Ctrl+K` → palette; ketik "hr" → HRIS teratas; ↓/↑/Enter membuka. Esc menutup. Klik backdrop menutup.
6. Fokus di input lain (mis. buka `/portal/credentials`, klik field) → ketik `/` tidak membuka apa pun; tombol cari di header → beranda dengan palette terbuka, URL jadi `/portal`.
7. Tab ke grid → panah memindah fokus antar tile; tooltip muncul saat fokus.
8. Grup > 12 app → bisa dilipat, reload → tetap terlipat.
9. Reduced motion → mesh & titik status diam.

- [ ] **Step 9: Commit**

```bash
git add components/portal app/portal app/globals.css
git commit -m "feat(portal): beranda home screen — favorit, terakhir dipakai, filter status, Ctrl+K"
```

---

### Task 7: Animasi buka aplikasi — zoom + jembatan

**Files:**
- Create: `components/portal/LaunchBridge.tsx`, `lib/clipboard.ts`
- Modify: `components/portal/SSOAutoSubmit.tsx`, `SSOPostSubmit.tsx`, `SSORerouteSubmit.tsx`, `SSORedirectHandoff.tsx`, `SSOCredentialVault.tsx:19-44` (pindah `copyText`), `app/globals.css` (hapus `sso-*`, tambah `@view-transition` + bridge)

**Interfaces:**
- Consumes: `iconColor` (Task 4); `markLaunch` sudah memberi `view-transition-name: app-{slug}` pada ikon tile (Task 6).
- Produces:
```ts
export type BridgeStepState = "pending" | "active" | "done" | "error";
export interface BridgeStep { label: string; state: BridgeStepState }
export default function LaunchBridge(props: {
    app: { name: string; slug: string; logoPath?: string | null };
    title: string;            // "Membuka HRIS"
    subtitle?: string;        // "Masuk sebagai andi"
    steps: BridgeStep[];
    notice?: React.ReactNode; // kotak peringatan (gagal/lambat)
    actions?: React.ReactNode;// tombol fallback
}): JSX.Element;
export async function copyText(text: string): Promise<boolean>; // lib/clipboard.ts
```

- [ ] **Step 1: `lib/clipboard.ts`**

Pindahkan fungsi `copyText` dari `components/portal/SSOCredentialVault.tsx:19-44` (beserta komentar `ponytail:` di atasnya) ke `lib/clipboard.ts` dengan `export`. Di `SSOCredentialVault.tsx` hapus fungsi lokal dan tambah `import { copyText } from "@/lib/clipboard";`.

- [ ] **Step 2: `LaunchBridge.tsx`**

```tsx
"use client";

import Image from "next/image";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { iconColor } from "@/lib/portal-home";

export type BridgeStepState = "pending" | "active" | "done" | "error";
export interface BridgeStep {
    label: string;
    state: BridgeStepState;
}

/**
 * Layar launch bersama untuk semua mode SSO: logo portal → garis → ikon app.
 * Ikon app memakai view-transition-name yang sama dengan tile yang diklik di
 * beranda, jadi browser yang mendukung menerbangkan ikon ke sini (zoom).
 * Tahapan hanya yang benar-benar diketahui klien — tidak ada jeda buatan.
 */
export default function LaunchBridge({
    app,
    title,
    subtitle,
    steps,
    notice,
    actions,
}: {
    app: { name: string; slug: string; logoPath?: string | null };
    title: string;
    subtitle?: string;
    steps: BridgeStep[];
    notice?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    const failed = steps.some((s) => s.state === "error");
    const done = steps.length > 0 && steps.every((s) => s.state === "done");
    const current = steps.find((s) => s.state === "active" || s.state === "error");

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-0 px-5 py-10">
            <div className="w-full max-w-[440px] text-center">
                <div className="flex items-center justify-center" aria-hidden="true">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-brand text-lg font-bold text-white">S</span>
                    <span className={`launch-wire mx-1 ${failed ? "is-error" : done ? "is-done" : ""}`}>
                        <span className="launch-pulse" />
                    </span>
                    <span
                        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[16px] text-xl font-bold text-white shadow-lvl-2"
                        style={{
                            viewTransitionName: `app-${app.slug}`,
                            backgroundColor: app.logoPath ? undefined : iconColor(app.name),
                        }}
                    >
                        {app.logoPath ? (
                            <Image src={app.logoPath} alt="" width={56} height={56} className="h-full w-full object-cover" />
                        ) : (
                            app.name.charAt(0).toUpperCase()
                        )}
                    </span>
                </div>

                <h1 className="mt-8 font-serif text-2xl font-semibold text-text-1">{title}</h1>
                {subtitle && <p className="mt-1.5 text-sm text-text-2">{subtitle}</p>}

                <ol className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs" aria-label="Tahapan">
                    {steps.map((s) => (
                        <li
                            key={s.label}
                            className={`flex items-center gap-1.5 ${
                                s.state === "done" ? "text-success" : s.state === "error" ? "text-danger" : s.state === "active" ? "text-text-1" : "text-text-3"
                            }`}
                        >
                            {s.state === "done" ? (
                                <CheckCircle size={14} weight="fill" aria-hidden="true" />
                            ) : s.state === "error" ? (
                                <WarningCircle size={14} weight="fill" aria-hidden="true" />
                            ) : (
                                <span aria-hidden="true" className={`h-2 w-2 rounded-full border-[1.5px] border-current ${s.state === "active" ? "launch-step-active" : ""}`} />
                            )}
                            {s.label}
                        </li>
                    ))}
                </ol>

                <p role="status" aria-live="polite" className="sr-only">
                    {current ? `${current.label}${current.state === "error" ? " gagal" : ""}` : done ? "Selesai, mengalihkan" : ""}
                </p>

                {notice && <div className="mt-6 rounded-card border border-warning/30 bg-surface-2 p-4 text-left text-sm text-text-2">{notice}</div>}
                {actions && <div className="mt-4 flex flex-col gap-2">{actions}</div>}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: CSS — view transition + jembatan, hapus `sso-*`**

Hapus dari `app/globals.css` seluruh blok `IMPRESSIVE LOADING ANIMATIONS (TASK-23)` bagian `@keyframes sso-glow-pulse`, `@keyframes sso-ring-spin`, `.sso-rings-container`, `.sso-ring`, `.sso-ring-outer`, `.sso-ring-middle`, `.sso-ring-inner` (biarkan `shimmer-*` di bawahnya). Lalu tambahkan di blok `Portal home`:
```css
/* Navigasi dokumen penuh (tile → launch, kartu → artikel) dianimasikan browser
   yang mendukung View Transitions; lainnya berpindah biasa. */
@view-transition { navigation: auto; }
::view-transition-group(*) {
  animation-duration: var(--motion-slow);
  animation-timing-function: var(--motion-ease);
}

.launch-wire {
  position: relative;
  width: min(180px, 30vw);
  height: 2px;
  background: var(--surface-3);
  overflow: hidden;
}
.launch-wire::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--brand-red), var(--accent));
  transform-origin: left;
  animation: launch-fill 1.6s var(--motion-ease) infinite;
}
.launch-wire.is-done::after { animation: none; transform: scaleX(1); background: var(--color-success); }
.launch-wire.is-error::after { animation: none; transform: scaleX(1); background: var(--color-danger); }
.launch-pulse {
  position: absolute;
  top: -3px;
  left: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 10px #fff;
  animation: launch-travel 1.6s var(--motion-ease) infinite;
}
.launch-wire.is-done .launch-pulse,
.launch-wire.is-error .launch-pulse { display: none; }
@keyframes launch-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes launch-travel { from { left: 0; opacity: 1; } 90% { opacity: 1; } to { left: calc(100% - 8px); opacity: 0; } }
.launch-step-active { animation: portal-breathe 1.2s ease-in-out infinite; }
```
Di blok reduced-motion tambahkan:
```css
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
  .launch-wire::after { animation: none !important; transform: scaleX(1); }
  .launch-pulse,
  .launch-step-active { animation: none !important; }
```

- [ ] **Step 4: `SSOAutoSubmit.tsx` (FORM)**

Ganti JSX kartu (seluruh `<div className="flex min-h-[calc(100vh-3.5rem)] ...">` sampai sebelum `<form>`) dengan `LaunchBridge`. Struktur akhir `return`:
```tsx
    return (
        <>
            <LaunchBridge
                app={{ name: app.name, slug: app.slug, logoPath: app.logoPath }}
                title={`Membuka ${app.name}`}
                subtitle={`Masuk sebagai ${cred.username}`}
                steps={[
                    { label: "Menyiapkan", state: status === "preparing" ? "active" : "done" },
                    { label: `Mengirim login ke ${app.name}`, state: failed ? "error" : status === "submitting" ? "active" : "pending" },
                ]}
                notice={failed ? <>Tidak bisa membuka {app.name} otomatis. Coba buka manual, atau hubungi admin bila berulang.</> : undefined}
                actions={failed ? (
                    <>
                        <button
                            type="submit"
                            form="sso-form"
                            className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            Coba lagi
                        </button>
                        <Link href="/portal" className="inline-flex h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-text-1 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                            Kembali ke Portal
                        </Link>
                    </>
                ) : undefined}
            />
            {/* form tersembunyi — TIDAK berubah */}
            <form ...>...</form>
        </>
    );
```
Props `SSOAutoSubmit` butuh `slug`: tambah `slug: string` ke `app` di interface, dan di `app/portal/app/[appSlug]/page.tsx:364-372` tambahkan `slug: app.slug,` ke objek `app` yang diteruskan. Hapus import `Image`, `CheckCircle` yang tak lagi dipakai; tambah `import LaunchBridge from "@/components/portal/LaunchBridge";`.

- [ ] **Step 5: `SSOPostSubmit.tsx` (POST)**

Pola sama. `steps`:
```tsx
                steps={[
                    { label: "Menyiapkan", state: status === "preparing" ? "active" : "done" },
                    { label: `Portal masuk ke ${app.name}`, state: failed ? "error" : status === "submitting" ? "active" : "pending" },
                ]}
```
`title` `Membuka ${app.name}`, `subtitle` `Masuk sebagai ${cred.username}`. `notice`/`actions` saat `failed` sama seperti Step 4 tetapi `form="sso-post-form"`. Form tersembunyi tidak berubah.

- [ ] **Step 6: `SSORerouteSubmit.tsx` (REROUTE)**

`steps` seperti POST. Komponen ini tidak punya `failed`, hanya `slow` (30 dtk): tahap kedua tetap `active` (bukan error), `notice={slow ? <>{app.name} lambat merespons. Buka manual bila tidak ingin menunggu.</> : undefined}`, `actions` saat `slow` dengan `form="sso-reroute-form"` dan label tombol `Buka {app.name}`.

- [ ] **Step 7: `SSORedirectHandoff.tsx` (REDIRECT)**

`title={`Mengalihkan ke ${app.name}`}`, `subtitle="Aplikasi ini diautentikasi otomatis oleh jaringan perusahaan."`, `steps`:
```tsx
                steps={[
                    { label: "Menyiapkan", state: status === "preparing" ? "active" : "done" },
                    { label: `Mengalihkan ke ${app.name}`, state: failed ? "error" : status === "submitting" ? "active" : "pending" },
                ]}
```
`notice`/`actions` saat `failed` dengan `form="sso-redirect-form"`.

- [ ] **Step 8: Verifikasi**

Run: `grep -rn "sso-ring\|sso-glow" app components` → kosong.
Run: `npx tsc --noEmit -p . 2>&1 | grep -E "portal|clipboard"` → kosong.
Run: `npx eslint components/portal lib/clipboard.ts` → tanpa error.
Run semua self-check portal: `for f in test-portal-home test-portal-restricted test-detect-verify-v2 test-cookie-domain; do npx tsx scripts/$f.ts | tail -1; done` → semua lulus.
Manual (Chrome ≥ 126, dev):
1. Klik tile HRIS di beranda → ikon terbang ke kanan jembatan (zoom), lalu langkah berjalan, lalu pindah ke aplikasi.
2. DevTools Elements saat di beranda, klik app yang ada di Favorit DAN grupnya → sebelum navigasi, hanya satu elemen punya `view-transition-name` (Review Focus #2).
3. Firefox → navigasi biasa tanpa error di console.
4. Masing-masing mode: buat/pilih satu app FORM, POST, REROUTE, REDIRECT, VAULT. VAULT tetap layar vault lama. Untuk FORM ubah `loginUrl` ke host mati → setelah 3 dtk tahap kedua merah + "Coba lagi".
5. Reduced motion → tidak ada zoom, garis penuh statis.
6. `/portal/credentials` tombol salin di vault tetap bekerja (copyText pindah).

- [ ] **Step 9: Commit**

```bash
git add components/portal lib/clipboard.ts app/globals.css "app/portal/app/[appSlug]/page.tsx"
git commit -m "feat(portal): layar buka aplikasi — zoom view transition + jembatan bertahap di semua mode SSO"
```

---

# FASE 3 — Situs publik

### Task 8: Modul murni status baca

**Files:**
- Create: `lib/reading-state.ts`, `scripts/test-reading-state.ts`

**Interfaces:**
- Produces:
```ts
export const READ_LIMIT = 200;
export function parseReadList(raw: string | null): string[];
export function pushRead(list: string[], id: string, limit?: number): string[];
export function isNew(createdAtIso: string, lastVisitIso: string | null, read: string[], id: string): boolean;
export function countNew(items: { id: string; createdAt: string }[], lastVisitIso: string | null, read: string[]): number;
export function editionLabel(hour: number): "Edisi Pagi" | "Edisi Malam";
export type TimeBucket = "today" | "week" | "older";
export function timeBucket(createdAtIso: string, nowIso: string, timeZone?: string): TimeBucket;
export const TIME_BUCKET_LABEL: Record<TimeBucket, string>;
export function readKey(siteSlug: string): string;     // "site:{slug}:read"
export function lastVisitKey(siteSlug: string): string; // "site:{slug}:lastVisit"
```

- [ ] **Step 1: Write the failing test**

`scripts/test-reading-state.ts`:
```ts
/**
 * Self-check status baca situs publik (localStorage per perangkat).
 * Run: npx tsx scripts/test-reading-state.ts
 */
import {
    parseReadList, pushRead, isNew, countNew, editionLabel, timeBucket, readKey, lastVisitKey, READ_LIMIT,
} from "../lib/reading-state";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

// Review Focus #4: storage korup
assertEq(parseReadList(null), [], "null → []");
assertEq(parseReadList("{rusak"), [], "JSON rusak → []");
assertEq(parseReadList('{"a":1}'), [], "bukan array → []");
assertEq(parseReadList('["a",2,null,"b"]'), ["a", "b"], "elemen non-string dibuang");

assertEq(pushRead(["a", "b"], "c"), ["a", "b", "c"], "tambah di akhir");
assertEq(pushRead(["a", "b"], "a"), ["b", "a"], "dibaca ulang → pindah ke akhir, tanpa duplikat");
const full = Array.from({ length: READ_LIMIT }, (_, i) => `id${i}`);
const pushed = pushRead(full, "baru");
assertEq([pushed.length, pushed[0], pushed[pushed.length - 1]], [READ_LIMIT, "id1", "baru"], "FIFO di batas");

const lastVisit = "2026-10-01T00:00:00.000Z";
assertEq(isNew("2026-10-02T01:00:00.000Z", lastVisit, [], "x"), true, "lebih baru dari kunjungan → baru");
assertEq(isNew("2026-09-30T01:00:00.000Z", lastVisit, [], "x"), false, "lebih lama → bukan baru");
assertEq(isNew("2026-10-02T01:00:00.000Z", lastVisit, ["x"], "x"), false, "sudah dibaca → bukan baru");
assertEq(isNew("2026-10-02T01:00:00.000Z", null, [], "x"), false, "kunjungan pertama → tidak ada badge");
assertEq(isNew("bukan-tanggal", lastVisit, [], "x"), false, "tanggal rusak → bukan baru");
assertEq(
    countNew([{ id: "a", createdAt: "2026-10-02T00:00:00Z" }, { id: "b", createdAt: "2026-10-02T00:00:00Z" }, { id: "c", createdAt: "2026-09-01T00:00:00Z" }], lastVisit, ["b"]),
    1,
    "hitung baru",
);

assertEq(editionLabel(6), "Edisi Pagi", "06 → pagi");
assertEq(editionLabel(17), "Edisi Pagi", "17 → pagi");
assertEq(editionLabel(18), "Edisi Malam", "18 → malam");
assertEq(editionLabel(3), "Edisi Malam", "03 → malam");

// Pengelompokan waktu, zona Asia/Jakarta (UTC+7)
const now = "2026-10-02T03:00:00.000Z"; // 10:00 WIB, Kamis
assertEq(timeBucket("2026-10-01T18:00:00.000Z", now), "today", "01:00 WIB hari ini");
assertEq(timeBucket("2026-10-01T16:00:00.000Z", now), "week", "23:00 WIB kemarin → minggu ini");
assertEq(timeBucket("2026-09-26T03:00:00.000Z", now), "week", "6 hari lalu → minggu ini");
assertEq(timeBucket("2026-09-24T03:00:00.000Z", now), "older", "8 hari lalu → sebelumnya");

assertEq(readKey("sja-utama"), "site:sja-utama:read", "kunci dibaca");
assertEq(lastVisitKey("sja-utama"), "site:sja-utama:lastVisit", "kunci kunjungan");

console.log(process.exitCode ? "=== ADA FAIL ===" : "=== ALL PASS ===");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-reading-state.ts`
Expected: FAIL — `Cannot find module '../lib/reading-state'`.

- [ ] **Step 3: Write minimal implementation**

`lib/reading-state.ts`:
```ts
/**
 * Status baca per perangkat untuk situs publik (tanpa akun). Logika murni —
 * pembacaan/penulisan localStorage dilakukan komponen dalam try/catch.
 */

export const READ_LIMIT = 200;

export const readKey = (siteSlug: string) => `site:${siteSlug}:read`;
export const lastVisitKey = (siteSlug: string) => `site:${siteSlug}:lastVisit`;

export function parseReadList(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const v: unknown = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
        return [];
    }
}

export function pushRead(list: string[], id: string, limit = READ_LIMIT): string[] {
    const next = list.filter((x) => x !== id);
    next.push(id);
    return next.length > limit ? next.slice(next.length - limit) : next;
}

export function isNew(createdAtIso: string, lastVisitIso: string | null, read: string[], id: string): boolean {
    if (!lastVisitIso || read.includes(id)) return false;
    const created = Date.parse(createdAtIso);
    const last = Date.parse(lastVisitIso);
    return Number.isFinite(created) && Number.isFinite(last) && created > last;
}

export function countNew(items: { id: string; createdAt: string }[], lastVisitIso: string | null, read: string[]): number {
    return items.filter((i) => isNew(i.createdAt, lastVisitIso, read, i.id)).length;
}

export function editionLabel(hour: number): "Edisi Pagi" | "Edisi Malam" {
    return hour >= 6 && hour < 18 ? "Edisi Pagi" : "Edisi Malam";
}

export type TimeBucket = "today" | "week" | "older";
export const TIME_BUCKET_LABEL: Record<TimeBucket, string> = {
    today: "Hari ini",
    week: "Minggu ini",
    older: "Sebelumnya",
};

/** Tanggal kalender (YYYY-MM-DD) di zona waktu tertentu. */
function dayKey(iso: string, timeZone: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function timeBucket(createdAtIso: string, nowIso: string, timeZone = "Asia/Jakarta"): TimeBucket {
    if (dayKey(createdAtIso, timeZone) === dayKey(nowIso, timeZone)) return "today";
    const days = (Date.parse(nowIso) - Date.parse(createdAtIso)) / 86_400_000;
    return days < 7 ? "week" : "older";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-reading-state.ts`
Expected: `=== ALL PASS ===`.

- [ ] **Step 5: Commit**

```bash
git add lib/reading-state.ts scripts/test-reading-state.ts
git commit -m "feat(site): modul murni status baca — BARU, dibaca, edisi, pengelompokan waktu"
```

---

### Task 9: Halaman depan Edisi Pagi

**Files:**
- Create: `components/site/EditionStrip.tsx`, `components/site/ReadState.tsx`
- Modify: `app/site/[siteSlug]/page.tsx`, `components/site/Masthead.tsx`, `components/site/FrontPage.tsx`, `components/AnnouncementCard.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: semua ekspor `lib/reading-state.ts` (Task 8).
- Produces:
  - `EditionStrip` props `{ siteSlug: string; items: { id: string; createdAt: string }[] }`.
  - `ReadMarker` props `{ siteSlug: string; id: string; createdAt: string }` — merender badge "BARU" atau nol; menandai kartu induk (`closest("[data-story-card]")`) dengan `data-read="true"`.
  - `MarkRead` props `{ siteSlug: string; id: string }` — menulis id ke daftar dibaca saat mount (dipakai Task 10).
  - `AnnouncementCard` prop baru opsional `id` dipakai untuk `view-transition-name: story-{id}` dan `ReadMarker`; prop baru `siteSlug` sudah ada.

- [ ] **Step 1: `ReadState.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { isNew, lastVisitKey, parseReadList, pushRead, readKey } from "@/lib/reading-state";

function safeGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * Badge BARU / tanda sudah dibaca untuk satu kartu. Tanpa storage → tidak
 * merender apa pun (tampilan default). lastVisit yang dibandingkan adalah nilai
 * SEBELUM kunjungan ini — EditionStrip baru menulis nilai baru saat pagehide.
 */
export function ReadMarker({ siteSlug, id, createdAt }: { siteSlug: string; id: string; createdAt: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [fresh, setFresh] = useState(false);

    useEffect(() => {
        const read = parseReadList(safeGet(readKey(siteSlug)));
        const card = ref.current?.closest<HTMLElement>("[data-story-card]");
        if (read.includes(id) && card) card.dataset.read = "true";
        setFresh(isNew(createdAt, safeGet(lastVisitKey(siteSlug)), read, id));
    }, [siteSlug, id, createdAt]);

    return (
        <span ref={ref} className="contents">
            {fresh && (
                <span className="ml-2 inline-block rounded-[2px] bg-[var(--site-primary-dark)] px-1.5 py-0.5 align-[2px] font-sans text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--site-text-on-primary)]">
                    Baru
                </span>
            )}
        </span>
    );
}

/** Catat artikel sebagai dibaca saat dibuka. */
export function MarkRead({ siteSlug, id }: { siteSlug: string; id: string }) {
    useEffect(() => {
        try {
            const key = readKey(siteSlug);
            localStorage.setItem(key, JSON.stringify(pushRead(parseReadList(localStorage.getItem(key)), id)));
        } catch {
            // Storage diblokir: status dibaca tidak dicatat.
        }
    }, [siteSlug, id]);
    return null;
}
```
Badge memakai `--site-primary-dark` (kontras putih ≥ 4.5 untuk merah brand: `#C41920` = 6.0:1; merah `#ED1C24` hanya 4.4:1 — jangan dipakai untuk teks kecil).

- [ ] **Step 2: `EditionStrip.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { countNew, editionLabel, lastVisitKey, parseReadList, readKey } from "@/lib/reading-state";

/**
 * Strip edisi di atas masthead: tanggal · edisi · "N baru sejak kunjungan terakhir".
 * lastVisit diperbarui saat pagehide supaya badge BARU tetap tampil selama
 * kunjungan berjalan.
 */
export default function EditionStrip({ siteSlug, items }: { siteSlug: string; items: { id: string; createdAt: string }[] }) {
    const [state, setState] = useState<{ date: string; edition: string; fresh: number } | null>(null);

    useEffect(() => {
        const now = new Date();
        let fresh = 0;
        try {
            fresh = countNew(items, localStorage.getItem(lastVisitKey(siteSlug)), parseReadList(localStorage.getItem(readKey(siteSlug))));
        } catch {
            fresh = 0;
        }
        setState({
            date: new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now),
            edition: editionLabel(now.getHours()),
            fresh,
        });

        const save = () => {
            try {
                localStorage.setItem(lastVisitKey(siteSlug), new Date().toISOString());
            } catch {
                // abaikan
            }
        };
        window.addEventListener("pagehide", save);
        return () => window.removeEventListener("pagehide", save);
    }, [siteSlug, items]);

    return (
        <div className="border-b border-border">
            <div className="mx-auto flex min-h-9 max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-3">
                <span>{state?.date ?? " "}</span>
                <span>{state?.edition}</span>
                <span aria-live="polite">
                    {state && state.fresh > 0 ? `${state.fresh} baru sejak kunjungan terakhir` : ""}
                </span>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Masthead — tanggal pindah ke strip, garis ganda**

`components/site/Masthead.tsx`: hapus baris tanggal (`edition` + `<p>` pertama — sekarang di `EditionStrip`). Ubah `<header className="masthead">` menjadi `<header className="masthead border-b-[3px] border-double border-border">` dan `pt-10` → `pt-8`. Komentar header komponen diperbarui: "Tanggal & edisi kini di EditionStrip (klien, jam perangkat)."

- [ ] **Step 4: Halaman depan — strip, pembatas waktu, ReadMarker**

`app/site/[siteSlug]/page.tsx`:
- Import: `import EditionStrip from "@/components/site/EditionStrip";` dan `import { timeBucket, TIME_BUCKET_LABEL, type TimeBucket } from "@/lib/reading-state";`.
- Tepat setelah `<div className="min-h-screen bg-surface-0 pt-20 text-text-1">` dan sebelum `<Masthead>`:
```tsx
            <EditionStrip
                siteSlug={siteSlug}
                items={[...frontStories, ...announcements].map((a) => ({ id: a.id, createdAt: a.createdAt.toISOString() }))}
            />
```
- Ganti blok grid kronologis (`{chronologicalFeed.length > 0 && ( <div className="cine-stagger grid ...` sampai penutupnya) dengan pengelompokan:
```tsx
                        {chronologicalFeed.length > 0 && (() => {
                            const nowIso = new Date().toISOString();
                            const buckets: TimeBucket[] = ["today", "week", "older"];
                            let index = 0;
                            return buckets.map((bucket) => {
                                const items = chronologicalFeed.filter((a) => timeBucket(a.createdAt.toISOString(), nowIso) === bucket);
                                if (items.length === 0) return null;
                                return (
                                    <section key={bucket} aria-label={TIME_BUCKET_LABEL[bucket]} className="mb-10">
                                        <h2 className="edition-divider mb-6">{TIME_BUCKET_LABEL[bucket]}</h2>
                                        <div className="cine-stagger grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(350px,100%),1fr))]">
                                            {items.map((announcement) => {
                                                const i = index++;
                                                const featured = isFrontPage && i === 0;
                                                return (
                                                    <AnnouncementCard
                                                        key={announcement.id}
                                                        style={{ "--i": Math.min(i, 11), gridColumn: featured ? "1 / -1" : undefined } as React.CSSProperties}
                                                        id={announcement.id}
                                                        title={announcement.title}
                                                        excerpt={announcement.excerpt || undefined}
                                                        slug={announcement.slug}
                                                        siteSlug={siteSlug}
                                                        imagePath={announcement.imagePath || undefined}
                                                        videoPath={announcement.videoPath}
                                                        videoType={announcement.videoType}
                                                        youtubeUrl={announcement.youtubeUrl}
                                                        category={announcement.category}
                                                        createdAt={announcement.createdAt}
                                                        wordCount={announcement.wordCount}
                                                        featured={featured}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            });
                        })()}
```
- `globals.css` tambahkan (blok baru `/* Situs — Edisi Pagi */` di dekat `.prose-santos`):
```css
.edition-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}
.edition-divider::before,
.edition-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* Kartu yang sudah dibaca: judul diredupkan (diset ReadMarker di klien). */
[data-story-card][data-read="true"] h3 { color: var(--text-3); }
```

- [ ] **Step 5: `AnnouncementCard` — ReadMarker, view transition, `<a>` biasa**

Di `components/AnnouncementCard.tsx`:
- Import `import { ReadMarker } from "@/components/site/ReadState";`.
- Destructure `id` dari props (sudah ada di interface, belum dipakai).
- Ganti `<Link href={href} ...>` pembungkus menjadi `<a href={href} ...>` (navigasi dokumen penuh untuk View Transitions; halaman artikel `force-dynamic` sehingga prefetch tak berarti) dan penutupnya `</a>`. `import Link` dihapus bila tak dipakai lagi. Tambah `data-story-card` pada `<article>`.
- `mediaBlock` wrapper `<div className={...}>` tambah `style={{ viewTransitionName: \`story-${id}\` }}` — tetapi nama harus unik per halaman: kartu yang sama tidak muncul dua kali di feed (FrontPage dan feed sudah dideduplikasi lewat `frontIds`), jadi aman.
- Setelah `{title}` di dalam `<h3>`, tambahkan `{siteSlug && <ReadMarker siteSlug={siteSlug} id={id} createdAt={new Date(createdAt).toISOString()} />}`.

Catatan: `AnnouncementCard` juga dipakai di "Artikel Terkait" pada halaman artikel. Pada halaman artikel hero sudah memakai `story-{id-artikel}`; kartu terkait ber-id lain → tidak bentrok.

- [ ] **Step 6: FrontPage — progress rotasi, Ken Burns, ReadMarker**

`components/site/FrontPage.tsx`:
- Import `ReadMarker`.
- `stories` sudah membawa `createdAt` (Date | string) dan `id`.
- Di media lead, setelah elemen media dan di dalam `<div className="relative aspect-[16/9] ...">`, tambahkan bar:
```tsx
                            {count > 1 && (
                                <span
                                    key={`${lead.id}-${userPaused || hovered ? "p" : "r"}`}
                                    aria-hidden="true"
                                    className={`front-progress ${userPaused || hovered ? "is-paused" : ""}`}
                                    style={{ animationDuration: `${ROTATE_MS}ms` }}
                                />
                            )}
```
- `<Image>` lead: tambah kelas `front-kenburns` (Ken Burns hanya pada gambar, bukan video/iframe).
- `<h2>` judul lead: tambahkan `style={{ animation: "cine-rise var(--motion-slow) var(--motion-ease) 120ms both" }}` dan `<ReadMarker siteSlug={siteSlug} id={lead.id} createdAt={new Date(lead.createdAt).toISOString()} />` setelah `{lead.title}`.
- Judul story sekunder `<h3>` tambah `ReadMarker` serupa. `Link` lead & sekunder diganti `<a>` biasa (View Transitions lintas dokumen butuh navigasi penuh) dengan atribut `data-story-card`; hapus `import Link` bila tak terpakai. Media lead diberi `style={{ viewTransitionName: \`story-${lead.id}\` }}` — lead tidak pernah muncul juga di feed (`frontIds`), jadi nama unik.
- CSS (blok Situs):
```css
.front-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  background: var(--accent);
  transform-origin: left;
  animation-name: front-progress;
  animation-timing-function: linear;
  animation-fill-mode: both;
}
.front-progress.is-paused { animation-play-state: paused; }
@keyframes front-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.front-kenburns { animation: front-kenburns 5s ease-out both; }
@keyframes front-kenburns { from { transform: scale(1); } to { transform: scale(1.06); } }
```
Di blok reduced-motion: `.front-progress, .front-kenburns { animation: none !important; }` dan `.front-progress { display: none; }` (rotasi otomatis sudah mati di reduced-motion — `FrontPage` mengecek `matchMedia`).

Catatan perilaku: saat hover/jeda, `key` berganti sehingga bar me-remount dengan kelas `is-paused` di posisi 0 — sesuai karena timer rotasi juga direset oleh `setInterval` baru saat resume.

- [ ] **Step 7: Verifikasi**

Run: `npx tsx scripts/test-reading-state.ts` → ALL PASS.
Run: `npx tsc --noEmit -p . 2>&1 | grep -E "site/|AnnouncementCard|FrontPage|Masthead|EditionStrip|ReadState"` → kosong.
Run: `npx eslint components/site components/AnnouncementCard.tsx app/site` → tanpa error.
Manual:
1. Kunjungan pertama (localStorage bersih): strip tanggal + Edisi Pagi/Malam, tanpa "N baru", tanpa badge.
2. Tutup tab, di admin publish satu pengumuman baru, buka lagi → "1 baru sejak kunjungan terakhir" + badge BARU pada kartunya.
3. Buka artikel itu (Task 10 menulis status dibaca; sebelum Task 10, set manual `site:<slug>:read` = `["<id>"]`) → kembali → badge hilang, judul redup.
4. Feed terbagi "Hari ini / Minggu ini / Sebelumnya"; pembatas tampil hanya untuk kelompok yang berisi.
5. Garis progress merah di bawah media lead mengisi 5 dtk; hover → berhenti; jeda → berhenti.
6. DevTools → Application → blokir storage (atau `localStorage.setItem = () => { throw 1 }` di console) → halaman tetap benar tanpa badge.

- [ ] **Step 8: Commit**

```bash
git add components/site components/AnnouncementCard.tsx "app/site/[siteSlug]/page.tsx" app/globals.css
git commit -m "feat(site): Edisi Pagi — strip edisi, badge BARU, sudah dibaca, feed per waktu, progress rotasi"
```

---

### Task 10: Halaman artikel — progress, daftar isi, share, OG, navbar auto-hide

**Files:**
- Create: `components/site/ReadingProgress.tsx`, `components/site/TableOfContents.tsx`, `components/site/ShareBar.tsx`
- Modify: `app/site/[siteSlug]/[articleSlug]/page.tsx`, `components/Navbar.tsx`, `components/site/ArticleContent.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `MarkRead` (Task 9), `copyText` (`lib/clipboard.ts`, Task 7), `readingTimeLabel` (`lib/utils`).
- Produces: `ReadingProgress` props `{ targetId: string; wordCount: number }`; `TableOfContents` props `{ containerSelector: string }`; `ShareBar` props `{ title: string; url: string }`; `generateMetadata` di halaman artikel.

- [ ] **Step 1: `ReadingProgress.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

/** Bar progress baca + "sisa N menit" dari wordCount × sisa proporsi konten. */
export default function ReadingProgress({ targetId, wordCount }: { targetId: string; wordCount: number }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const el = document.getElementById(targetId);
        if (!el) return;
        let frame = 0;
        const update = () => {
            frame = 0;
            const rect = el.getBoundingClientRect();
            const total = rect.height - window.innerHeight;
            const p = total <= 0 ? (rect.top <= 0 ? 1 : 0) : Math.min(1, Math.max(0, -rect.top / total));
            setProgress(p);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [targetId]);

    const minutesLeft = Math.ceil((wordCount * (1 - progress)) / 200);

    return (
        <>
            <div aria-hidden="true" className="fixed inset-x-0 top-0 z-tooltip h-0.5 origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
            {progress > 0.02 && progress < 0.98 && minutesLeft > 0 && (
                <div className="pointer-events-none fixed bottom-4 right-4 z-dropdown rounded-full border border-border bg-surface-1/95 px-3 py-1 font-mono text-[11px] text-text-2 shadow-lvl-1">
                    sisa {minutesLeft} menit
                </div>
            )}
        </>
    );
}
```

- [ ] **Step 2: `TableOfContents.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ListBullets } from "@phosphor-icons/react";
import { slugify } from "@/lib/utils";

interface Heading { id: string; text: string; level: 2 | 3 }

/** Daftar isi dari h2/h3 di konten artikel. Tampil hanya bila ≥ 3 heading. */
export default function TableOfContents({ containerSelector }: { containerSelector: string }) {
    const [headings, setHeadings] = useState<Heading[]>([]);
    const [active, setActive] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const root = document.querySelector(containerSelector);
        if (!root) return;
        const used = new Set<string>();
        const found: Heading[] = [];
        root.querySelectorAll<HTMLHeadingElement>("h2, h3").forEach((h) => {
            const text = h.textContent?.trim() ?? "";
            if (!text) return;
            if (!h.id) {
                let id = slugify(text) || "bagian";
                for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`;
                h.id = id;
            }
            used.add(h.id);
            h.style.scrollMarginTop = "96px";
            found.push({ id: h.id, text, level: h.tagName === "H2" ? 2 : 3 });
        });
        setHeadings(found);

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: "-80px 0px -70% 0px" },
        );
        found.forEach((h) => {
            const el = document.getElementById(h.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [containerSelector]);

    if (headings.length < 3) return null;

    const list = (onPick?: () => void) => (
        <ol className="space-y-1.5 text-sm">
            {headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                    <a
                        href={`#${h.id}`}
                        onClick={onPick}
                        aria-current={active === h.id ? "location" : undefined}
                        className={`block rounded-[2px] border-l-2 py-0.5 pl-3 leading-snug transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                            active === h.id ? "border-accent text-text-1" : "border-transparent text-text-3 hover:text-text-1"
                        }`}
                    >
                        {h.text}
                    </a>
                </li>
            ))}
        </ol>
    );

    return (
        <>
            {/* Desktop: kolom melayang di kiri konten */}
            <nav aria-label="Daftar isi" className="fixed left-[max(16px,calc(50%-400px-240px))] top-32 hidden w-52 xl:block">
                <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-3">Daftar isi</p>
                {list()}
            </nav>

            {/* Ponsel & tablet: tombol membuka dialog */}
            <button
                type="button"
                onClick={() => dialogRef.current?.showModal()}
                className="fixed bottom-4 left-4 z-dropdown inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2 text-sm font-semibold text-text-1 shadow-lvl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:hidden"
            >
                <ListBullets size={16} aria-hidden="true" />
                Daftar isi
            </button>
            <dialog
                ref={dialogRef}
                aria-label="Daftar isi"
                onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
                className="m-0 mt-auto w-full max-w-none rounded-t-sheet border border-border bg-surface-1 p-6 text-text-1 backdrop:bg-black/50"
            >
                <p className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-3">Daftar isi</p>
                {list(() => dialogRef.current?.close())}
            </dialog>
        </>
    );
}
```

- [ ] **Step 3: `ShareBar.tsx`**

```tsx
"use client";

import { useState } from "react";
import { LinkSimple, WhatsappLogo, Check } from "@phosphor-icons/react";
import { copyText } from "@/lib/clipboard";

export default function ShareBar({ title, url }: { title: string; url: string }) {
    const [copied, setCopied] = useState(false);
    const absolute = () => new URL(url, window.location.origin).toString();

    const btn = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border px-4 text-sm font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

    return (
        <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6">
            <span className="mr-2 text-sm text-text-3">Bagikan</span>
            <a
                href={`https://wa.me/?text=${encodeURIComponent(title)}`}
                onClick={(e) => {
                    e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${title} ${absolute()}`)}`;
                }}
                target="_blank"
                rel="noopener noreferrer"
                className={btn}
            >
                <WhatsappLogo size={18} aria-hidden="true" />
                WhatsApp
            </a>
            <button
                type="button"
                onClick={async () => {
                    if (await copyText(absolute())) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }
                }}
                className={btn}
            >
                {copied ? <Check size={18} aria-hidden="true" /> : <LinkSimple size={18} aria-hidden="true" />}
                {copied ? "Tersalin" : "Salin tautan"}
            </button>
            <span role="status" aria-live="polite" className="sr-only">{copied ? "Tautan tersalin" : ""}</span>
        </div>
    );
}
```

- [ ] **Step 4: Halaman artikel — rangkai + `generateMetadata`**

`app/site/[siteSlug]/[articleSlug]/page.tsx`:
- Import:
```ts
import type { Metadata } from "next";
import { cache } from "react";
import ReadingProgress from "@/components/site/ReadingProgress";
import TableOfContents from "@/components/site/TableOfContents";
import ShareBar from "@/components/site/ShareBar";
import { MarkRead } from "@/components/site/ReadState";
import { extractYoutubeId } from "@/lib/utils";
```
- `getArticleData` saat ini menaikkan `viewCount` di dalamnya — `generateMetadata` tidak boleh menghitung view ganda. Pisahkan: buat `const getArticle = cache(async (siteSlug: string, articleSlug: string) => { ...semua query KECUALI update viewCount... })`, dan di `ArticlePage` panggil `getArticle` lalu jalankan `await prisma.announcement.update({ where: { id: announcement.id }, data: { viewCount: { increment: 1 } } })` di sana.
- Tambah:
```ts
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { siteSlug, articleSlug } = await params;
    const data = await getArticle(siteSlug, articleSlug);
    if (!data) return {};
    const { site, announcement, canonicalUrl } = data;
    const ytId = announcement.youtubeUrl ? extractYoutubeId(announcement.youtubeUrl) : null;
    const image = announcement.imagePath ?? (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined);
    const description = announcement.excerpt ?? undefined;
    return {
        title: `${announcement.title} | ${site.name}`,
        description,
        alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
        openGraph: {
            type: "article",
            title: announcement.title,
            description,
            siteName: site.name,
            publishedTime: announcement.createdAt.toISOString(),
            images: image ? [{ url: image }] : undefined,
        },
    };
}
```
- Hapus `{canonicalUrl && <link rel="canonical" ... />}` di JSX (sudah lewat `alternates`).
- Untuk URL gambar relatif (`/uploads/...`) agar OG valid, tambahkan `metadataBase` di `app/layout.tsx` `metadata`: `metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),`.
- JSX: tepat setelah wrapper pembuka tambahkan:
```tsx
            <ReadingProgress targetId="article-body" wordCount={announcement.wordCount} />
            <MarkRead siteSlug={siteSlug} id={announcement.id} />
```
- `<article ...>` beri `id="article-body"`; setelah `<ArticleContent ... />` tambahkan `<TableOfContents containerSelector="#article-body .prose-santos" />` dan `<ShareBar title={announcement.title} url={`/site/${siteSlug}/${announcement.slug}`} />` (sebelum kotak sindikasi).

- [ ] **Step 5: Navbar auto-hide**

`components/Navbar.tsx` — ganti efek scroll:
```tsx
    const [isScrolled, setIsScrolled] = useState(false);
    const [hidden, setHidden] = useState(false);
    const navRef = useRef<HTMLElement>(null);

    useEffect(() => {
        let lastY = window.scrollY;
        const handleScroll = () => {
            const y = window.scrollY;
            setIsScrolled(y > 50);
            // Sembunyi saat turun melewati 80px, muncul saat naik. Tidak pernah
            // sembunyi selama fokus keyboard ada di dalam navbar atau menu terbuka.
            const focusInside = navRef.current?.contains(document.activeElement) ?? false;
            if (y > 80 && y > lastY + 4 && !focusInside) setHidden(true);
            else if (y < lastY - 4 || y <= 80) setHidden(false);
            lastY = y;
        };
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);
```
Import `useRef`. Pada `<nav>`: `ref={navRef}`, `onFocus={() => setHidden(false)}`, dan tambahkan ke className `transition-[transform,background-color] duration-300 ${hidden && !isMobileMenuOpen ? "-translate-y-full" : "translate-y-0"}` (ganti `transition-colors duration-300` yang ada).

- [ ] **Step 6: Verifikasi**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "articleSlug|Navbar|ReadingProgress|TableOfContents|ShareBar|app/layout"` → kosong.
Run: `npx eslint components/site components/Navbar.tsx "app/site/[siteSlug]/[articleSlug]" app/layout.tsx` → tanpa error.
Run: `npm run build` → sukses.
Manual:
1. Buka artikel panjang (≥ 3 h2): bar merah di atas mengisi saat scroll; "sisa N menit" turun; daftar isi di desktop (≥ 1280px) menyorot bagian aktif; di ponsel tombol "Daftar isi" membuka dialog, klik item → lompat & dialog tertutup, heading tidak tertutup navbar.
2. Artikel pendek (< 3 heading): tidak ada daftar isi.
3. Scroll turun → navbar sembunyi; naik → muncul. Tab ke navbar saat tersembunyi → muncul.
4. "Salin tautan" di HTTP internal (IP) → "Tersalin"; tempel → URL absolut.
5. `curl -s http://localhost:3000/site/<slug>/<artikel> | grep -o '<meta property="og:[a-z:]*" content="[^"]*"'` → `og:title`, `og:description`, `og:image` (URL absolut), `og:type=article`.
6. View count naik tepat 1 per kunjungan (cek kolom `viewCount` sebelum/sesudah satu reload).
7. Kembali ke halaman depan → artikel tadi redup, tanpa BARU.

- [ ] **Step 7: Commit**

```bash
git add components/site components/Navbar.tsx "app/site/[siteSlug]/[articleSlug]/page.tsx" app/layout.tsx app/globals.css
git commit -m "feat(site): artikel — progress baca, daftar isi, bagikan WA, metadata OG, navbar auto-hide"
```

---

### Task 11: Verifikasi akhir

**Files:** tidak ada perubahan kode kecuali perbaikan temuan.

- [ ] **Step 1: Semua self-check**

Run:
```bash
for f in scripts/test-*.ts; do printf "%-40s " "$f"; npx tsx "$f" > /tmp/o.txt 2>&1; echo "exit=$? fail=$(grep -cE '^FAIL|THROWN' /tmp/o.txt)"; done
```
Expected: `fail=0` untuk semua skrip yang tidak butuh DB/jaringan eksternal. Skrip yang butuh DB (mis. `test-session-revocation.ts`) dijalankan dengan DB dev hidup.

- [ ] **Step 2: Build penuh**

Run: `npm run lint && npx tsc --noEmit -p . && npm run build`
Expected: tanpa error.

- [ ] **Step 3: Uji manual lintas browser**

Chromium + Firefox, tema terang & gelap, reduced-motion on & off, lebar 375px & 1440px:
`/site`, `/site/<slug>` (filter kategori, halaman 2), satu artikel, `/portal` (favorit, Ctrl+K, filter status), launch tiap mode SSO, `/portal/credentials`, `/admin` (font baru, tema admin tidak terpengaruh toggle situs).

- [ ] **Step 4: Critique ulang**

Jalankan `/impeccable critique` untuk `app/site` dan `components/site`; bandingkan skor dengan 21/40 (`.impeccable/critique/2026-08-17T03-48-03Z__app-site.md`). Catat temuan P0/P1 baru sebagai issue, jangan perbaiki di luar cakupan plan.

- [ ] **Step 5: Update graph & commit perbaikan**

Run: `graphify update .`
Bila ada perbaikan dari Step 1-3: commit dengan pesan `fix(...)` yang spesifik.
