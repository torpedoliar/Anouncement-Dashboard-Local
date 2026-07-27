# Design-Quality Fix Plan — Impeccable Critique Remediation

> Status: PLAN (belum diimplementasi)
> Berdasarkan: Impeccable critique snapshot `.impeccable/critique/2026-07-23T02-54-34Z__app.md`
> Skor critique: **18/40 (Fair)** · P0: 1 · P1: 4 · Minor: 13
> Target: naikkan skor critique ke ≥32/40 (Good) dan detector `detect.mjs` → 0 findings
> Prefiks fase: `DQ-` (Design Quality) — terpisah dari fase fitur 1–6 di master plan.

## 1. Tujuan dokumen ini

Critique Impeccable menemukan masalah desain lintas-tiga-surface (public site,
admin dashboard, portal). Dokumen ini menjawab **bagaimana cara memperbaikinya**:
urutan, dependensi, tugas ter-trackable, definisi selesai (DoD), risiko, dan
strategi verifikasi. Fokus pada masalah yang ditemukan, bukan fitur baru.

## 2. Inventaris temuan (dengan jumlah exact)

Sumber: `search_codebase` + `detect.mjs` + inspeksi source.

| Kategori | Jumlah | Lokasi kunci |
|----------|--------|--------------|
| `alert()` native | ~50 di code (~15 file) | portal-login, portal/credentials (3×), AnnouncementsList (2×), MediaPickerModal (2×), RichTextEditor (5×), SiteSelector, UpdateBanner (2×), +lainnya |
| `confirm()` native | 15 di 14 file | revisions:76, categories:471, comments:88, media:81, portal-apps:138, portal-groups:133, portal-sessions:76, portal-users:185+245, sessions:57, settings:150, sites/[id]:106, users:113, portal/credentials:93, BulkActionBar:21 |
| `outline: 'none'` inline | ~20 di 8 file | admin-login (2×), categories:147, settings, sites/[id]/settings (6×), AnnouncementForm:154, RichTextEditor (3×), SearchBar:96 |
| `prefers-reduced-motion` | **0** | hilang sama sekali (6+ keyframes di globals.css:79-280) |
| `text-wrap: balance/pretty` | **0** | hilang sama sekali |
| Inline `#dc2626` | 175× | tersebar di app/ + components/ |
| Inline `#ef4444` | 51× | tersebar di app/ + components/ |
| Brand red berbeda | 3 sistem | tailwind `#ED1C24` (config:14), css var `#dc2626` (globals:11), theme `#FF4D54` (SiteThemeProvider:35) |
| Double font load | 2× | `@import` globals.css:1 + `next/font` layout.tsx:7-18 |
| Eyebrow uppercase (0.2em) | 33+ | setiap header section di semua surface |
| Side-stripe `borderLeft:4px` | 2+ | admin/page.tsx:129, AnalyticsDashboard.tsx:422 |
| Sidebar item flat | 18 | AdminSidebar.tsx:77-98 (SuperAdmin) |
| Live clock re-render | 1s | AdminSidebar.tsx:64-70 |
| Detector findings | 7 warnings | 4 overused-font, 2 side-tab, 1 layout-transition |

## 3. Prinsip eksekusi

1. **Fase berurutan** — DQ-0 (fondasi) adalah gate; fase lain butuh token + primitif yang disatukan dulu.
2. **Buildable per fase** — setelah tiap fase, `npm run build` + `npm run lint` harus sukses.
3. **Non-destructive** — tidak mengubah schema DB atau API contract; murni UI/CSS/UX.
4. **Token-authority first** — sebelum menghapus inline color, token pengganti harus ada (DQ-0).
5. **Primitif sebelum migrasi** — `ConfirmDialog` + toast harus ada sebelum `alert()`/`confirm()` dihapus (DQ-0 → DQ-2).
6. **Verifikasi sebelum lanjut** — tiap fase punya DoD. DoD tidak terpenuhi = jangan lanjut.
7. **Tanpa dependency baru** — gunakan `react-icons` (sudah ada), `next/font` (sudah ada), Tailwind (sudah ada).

## 4. Dependency graph antar fase

```
DQ-0 (Fondasi: satu token red + ConfirmDialog + reduced-motion + ESLint rule)
   │
   ├─► DQ-1 (A11y P0: focus ring + contrast + keyboard)    [butuh: reduced-motion dari DQ-0]
   │
   ├─► DQ-2 (Primitif feedback: ganti alert/confirm)        [butuh: ConfirmDialog dari DQ-0]
   │      └─► DQ-5 (UX copy + login error)                  [butuh: toast dari DQ-2]
   │
   ├─► DQ-3 (Token authority: migrasi inline color/style)   [butuh: token dari DQ-0]
   │
   ├─► DQ-4 (Strip dekorasi AI-slop)                         [butuh: token dari DQ-0]
   │      └─► DQ-5 (UX copy + login error)                  [bisa paralel]
   │
   └─► DQ-6 (Minor + perf)                                  [butuh: DQ-3 untuk style migration]
            └─► DQ-7 (Verifikasi)                            [butuh: semua fase]
```

- **DQ-0** adalah gate — semua fase lain butuh fondasi.
- **DQ-1, DQ-2, DQ-3, DQ-4** bisa paralel setelah DQ-0 (tim berbeda, file berbeda).
- **DQ-5** butuh DQ-2 (toast) dan DQ-4 (dekorasi dibersihkan dulu).
- **DQ-6** butuh DQ-3 (inline style sudah dimigrasi).
- **DQ-7** terakhir — verifikasi semua.

## 5. Milestones

| Milestone | Fase | Kriteria utama |
|-----------|------|----------------|
| MQ-0 | DQ-0 | Satu token red; `ConfirmDialog` ter-build; reduced-motion aktif; ESLint rule ada |
| MQ-1 | DQ-1 | Focus ring visible semua input; kontras AA terpenuhi; keyboard-operable |
| MQ-2 | DQ-2 | 0 `alert()` / 0 `confirm()` di codebase; login error plain-language |
| MQ-3 | DQ-3 | 0 inline `#dc2626` / `#ef4444`; font load tunggal; style utility-based |
| MQ-4 | DQ-4 | 0 eyebrow-on-every-section; 0 side-stripe; nav sentence-case |
| MQ-5 | DQ-5 | Sidebar dikelompokkan; 0 live clock; copy Bahasa konsisten |
| MQ-6 | DQ-6 | Skeleton bukan spinner; N+1 diperbaiki; text-wrap aktif |
| MQ-7 | DQ-7 | `detect.mjs` → 0 findings; critique ≥32/40; smoke test lulus |

## 6. Estimasi effort (indikatif)

| Fase | Estimasi | Kompleksitas | Catatan |
|------|----------|--------------|---------|
| DQ-0 | 0.5–1 hari | Rendah | Token CSS + 1 komponen + 1 media query + 1 ESLint rule |
| DQ-1 | 1–1.5 hari | Sedang | ~20 lokasi outline:none + contrast + div→button + aria-label |
| DQ-2 | 1.5–2 hari | Sedang | ~65 penggantian alert/confirm + modal Esc/focus-trap |
| DQ-3 | 2–3 hari | Sedang–tinggi | 226 inline hex + double font + inline style→utility (terbesar) |
| DQ-4 | 1.5–2 hari | Sedang | 33+ eyebrow + side-stripe + hero-metric + nav case + glass |
| DQ-5 | 1–1.5 hari | Rendah–sedang | Sidebar grouping + copy unification + empty states |
| DQ-6 | 1 hari | Rendah | Skeletons + N+1 + text-wrap + route drift + misc |
| DQ-7 | 0.5 hari | Rendah | Re-run tools + smoke test |
| **Total** | **~9–12 hari** | | Satu developer; paralel DQ-1/2/3/4 hemat ~3 hari |

> DQ-3 adalah fase terbesar (migrasi 226 inline hex + ratusan inline style). Bisa di-batch per-surface (public → admin → portal).

---

## Fase DQ-0 — Fondasi: Token, Primitif, Reduced-Motion, Enforcement

> **Gate untuk semua fase lain.** Bangun dulu "tujuan" sebelum "migrasi".

### 0.1 Satukan brand red ke satu token CSS variable

- [ ] Di `app/globals.css` `:root`, ganti `--santos-red: #dc2626` → `--santos-red: #ED1C24` (sumber kebenaran = tailwind `santos.red`).
- [ ] Tambah token semantik: `--brand-red`, `--brand-red-dark`, `--brand-red-light`, `--brand-red-alpha` (diturunkan dari `--santos-red`).
- [ ] Di `components/SiteThemeProvider.tsx:33-35`, samakan default ke `#ED1C24` / `#C41920` / `#FF3B42` (hapus `#FF4D54`).
- [ ] Pastikan `SiteThemeProvider` override `--brand-red` dengan `--site-primary` saat site punya custom color (sudah emit `--site-primary` di :104-111).
- [ ] Tambah utility class: `.text-brand`, `.bg-brand`, `.border-brand` (semua `var(--brand-red)`).

**DoD:** `grep "#dc2626" app/globals.css` → 0 (kecuali comment). `SiteThemeProvider` default == tailwind `santos.red`. Build sukses.

### 0.2 Hapus double font load

- [ ] Hapus baris 1 `app/globals.css`: `@import url('https://fonts.googleapis.com/...Inter...Montserrat...')`.
- [ ] Ganti `font-family: 'Inter'` (globals:30) → `font-family: var(--font-inter), system-ui, sans-serif`.
- [ ] Ganti `font-family: 'Montserrat'` (globals:42, 168) → `font-family: var(--font-montserrat), system-ui, sans-serif`.
- [ ] Verifikasi `next/font` (`layout.tsx:7-18`) tetap emit `--font-inter` + `--font-montserrat` (sudah benar, jangan sentuh).

**DoD:** `grep "@import url.*googleapis" app/globals.css` → 0. Font via `next/font` self-hosted saja. Build sukses.

### 0.3 Buat komponen `ConfirmDialog`

- [ ] Buat `components/ui/ConfirmDialog.tsx` — modal berbasis `<dialog>` native/portal, props: `{ open, title, message, confirmLabel, cancelLabel, variant: 'danger'|'default', onConfirm, onCancel }`.
- [ ] Dukung Esc-to-close + backdrop-click-close + focus-trap (fokus ke confirm saat buka, return ke trigger saat tutup).
- [ ] Gaya dark + `var(--brand-red)` untuk variant danger.
- [ ] (Opsional) Hook `useConfirm()` untuk API imperatif: `const ok = await confirm({ title, message, variant });`.

**DoD:** `ConfirmDialog` ter-render, Esc/backdrop tutup, fokus ter-trap. Build + lint sukses.

### 0.4 Tambah `prefers-reduced-motion` global

- [ ] Di `app/globals.css` (akhir file), tambah:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

**DoD:** `grep "prefers-reduced-motion" app/globals.css` → ≥1. Build sukses.

### 0.5 ESLint `no-restricted-globals` (warning dulu)

- [ ] Di `eslint.config.mjs`, tambah config object: `{ rules: { "no-restricted-globals": ["warn", "alert", "confirm"] } }`.
- [ ] Jalankan `npm run lint` — catat jumlah warning (baseline untuk DQ-2).

**DoD:** `npm run lint` menampilkan warning untuk setiap `alert`/`confirm`. Build sukses.

---

## Fase DQ-1 — A11y P0: Focus Ring, Kontras, Keyboard

> **P0 — safety-critical.** Ship setelah DQ-0.

### 1.1 Hapus semua inline `outline: 'none'`

- [ ] `app/(auth)/admin-login/page.tsx:223, 265` — hapus `outline: 'none'`, andalkan `:focus-visible` global (globals.css:224-227).
- [ ] `app/admin/categories/page.tsx:147` — hapus.
- [ ] `app/admin/settings/page.tsx` — cari & hapus semua `outline: 'none'`.
- [ ] `app/admin/sites/[id]/settings/page.tsx:268, 304, 388, 409, 431, 467` — hapus (6 lokasi).
- [ ] `components/admin/AnnouncementForm.tsx:154` — hapus.
- [ ] `components/admin/RichTextEditor.tsx:198, 801, 874` — ganti `outline: none` dengan `:focus` ring visible (jangan hapus fokus editor).
- [ ] `components/SearchBar.tsx:96` — hapus, andalkan focus-visible.
- [ ] Audit: `grep -rn "outline:.*none" app/ components/` → 0 (kecuali RichTextEditor yang dapat ring pengganti).

**DoD:** Tab through login + admin forms → focus ring visible di setiap input. `grep` → 0 raw `outline:'none'`.

### 1.2 Perbaiki kontras teks sekunder

- [ ] Definisikan token: `--text-muted: #a1a1aa;` (≈8:1 di #0a0a0a) di globals.css `:root`.
- [ ] Ganti semua `color: '#525252'` → `color: 'var(--text-muted)'` atau `#a1a1aa`:
  - `app/admin/page.tsx:289` (meta), `:307` (empty state).
  - `components/admin/AdminSidebar.tsx:309` (user email).
  - `components/HeroSection.tsx` (inactive carousel dots — naikkan ke `#737373` minimum, ideal `#a1a1aa`).
  - Cari semua `#525252` di app/ + components/ → ganti.
- [ ] Verifikasi `#A0A0A0` (light.secondary) + `#6B7280` (light.tertiary) di tailwind config — pastikan ≥4.5:1 di surface light.

**DoD:** Lighthouse a11y contrast → 0 failure. `#525252` tidak lagi digunakan untuk teks.

### 1.3 Keyboard-operable: div→button + aria-label

- [ ] `components/admin/BulkActionBar.tsx:165-167` — `<div onClick aria-label>` → `<button onClick aria-label>` (tambah type, hapus cursor inline).
- [ ] `app/admin/page.tsx:293-301` — icon-only edit `<Link>` → tambah `aria-label="Edit pengumuman"`.
- [ ] Cari semua `onClick` di non-`<button>`/non-`<a>` element di app/ + components/ → konversi ke `<button>` atau tambah `role="button" tabIndex={0} onKeyDown`.
- [ ] `components/CategoryFilter.tsx:48-51` — `onMouseOver`/`onMouseOut` DOM mutation → ganti dengan CSS `:hover` (keyboard-accessible).

**DoD:** Tab-only navigation menjangkau semua kontrol interaktif. Tidak ada `onClick`-only div.

### 1.4 Reduced-motion di komponen (autoplay + animasi)

- [ ] `components/HeroSection.tsx:64` — autoplay 6000ms: tambah `pause-on-hover` + cek `matchMedia('(prefers-reduced-motion: reduce)')` → stop autoplay.
- [ ] `components/FullscreenHero.tsx` — sama, pause-on-hover + reduced-motion guard.
- [ ] `components/admin/AdminMainContent.tsx:29` — `transition: margin-left` → ganti dengan `transform: translateX` (non-layout) atau biarkan reduced-motion override (DQ-0.4).

**DoD:** Prefers-reduced-motion ON → autoplay berhenti, transisi instan.

### 1.5 Label ikon-only + struktur semantik

- [ ] Icon-only buttons (edit, delete, download, dll) di seluruh admin → tambah `aria-label`.
- [ ] Pastikan heading hierarchy benar (satu h1 per page, h2/h3 berurutan) — audit `app/admin/*.tsx` + `app/site/**/*.tsx`.
- [ ] `app/layout.tsx:38` — `className="dark"` inert (tailwind.config.ts tidak punya `darkMode` config): hapus class ATAU tambah `darkMode: 'class'` + audit dampak.

**DoD:** Tidak ada icon-only button tanpa accessible name. Heading hierarchy valid (axe DevTools lulus).

---

## Fase DQ-2 — Primitif Feedback: Ganti alert()/confirm()

> **P1.** Ship setelah DQ-0 (butuh `ConfirmDialog` + `useToast`).

### 2.1 Ganti semua `alert()` → `showToast()`

`useToast()` sudah ada (`contexts/ToastContext.tsx:25`), sudah ter-wire global di `app/layout.tsx:44`. API: `showToast(message, type)` type: `success|error|warning|info`.

- [ ] `app/portal-login/page.tsx` — ganti `alert()` validation → `showToast(msg, 'warning')`.
- [ ] `app/portal/credentials/page.tsx:83, 86, 103` — ganti → `showToast(err.error, 'error')` / `showToast('Terjadi kesalahan', 'error')`.
- [ ] `components/admin/AnnouncementsList.tsx:64, 68` → `showToast('Gagal menghapus pengumuman', 'error')`.
- [ ] `components/admin/MediaPickerModal.tsx:183, 187` → `showToast('Gagal download media', 'error')`.
- [ ] `components/admin/RichTextEditor.tsx:233, 248, 254, 281, 309` (5×) → `showToast(message, 'error'|'warning')`.
- [ ] `components/admin/SiteSelector.tsx:100` → `showToast('Gagal mengganti site. Coba lagi.', 'error')`.
- [ ] `components/admin/UpdateBanner.tsx:106, 121` → `showToast('Backup gagal', 'error')`.
- [ ] Cari sisa `alert(` di app/ + components/ (`grep -rn '\balert(' app/ components/`) → ganti semua.

**DoD:** `grep -rn '\balert\s*(' app/ components/` → 0. `npm run lint` → 0 `no-restricted-globals` warning untuk alert.

### 2.2 Ganti semua `confirm()` → `ConfirmDialog` / `useConfirm()`

15 lokasi (dari inventaris). Pattern: `if (!confirm(msg)) return;` → `const ok = await confirm({ title, message, variant: 'danger' }); if (!ok) return;`.

- [ ] `app/admin/announcements/[id]/revisions/page.tsx:76` — restore revision.
- [ ] `app/admin/categories/page.tsx:471` — delete category.
- [ ] `app/admin/comments/page.tsx:88` — delete comment.
- [ ] `app/admin/media/page.tsx:81` — delete file.
- [ ] `app/admin/portal-apps/page.tsx:138` — delete app.
- [ ] `app/admin/portal-groups/page.tsx:133` — delete group.
- [ ] `app/admin/portal-sessions/page.tsx:76` — revoke session.
- [ ] `app/admin/portal-users/page.tsx:185, 245` — delete user + revoke access (2 lokasi).
- [ ] `app/admin/sessions/page.tsx:57` — revoke session.
- [ ] `app/admin/settings/page.tsx:150` — restore backup (high-stakes → `variant: 'danger'` + explicit warning copy).
- [ ] `app/admin/sites/[id]/page.tsx:106` — delete site (destructive → danger variant).
- [ ] `app/admin/users/page.tsx:113` — delete user.
- [ ] `app/portal/credentials/page.tsx:93` — delete credential.
- [ ] `components/admin/BulkActionBar.tsx:21` — bulk delete (danger, tunjukkan count).

**DoD:** `grep -rn '\bconfirm\s*(' app/ components/` → 0. Semua destructive action pakai `ConfirmDialog`.

### 2.3 Fix login error raw string

- [ ] `app/(auth)/admin-login/page.tsx:28-29` — `setError(result.error)` → map `result.error === 'CredentialsSignin'` ke `"Email atau password salah. Coba lagi."`. Tambah link "Lupa password?" jika ada route reset.
- [ ] `app/portal-login/page.tsx` — cek apakah juga expose raw error string → fix sama.

**DoD:** Login gagal → pesan Bahasa plain-language, bukan `"CredentialsSignin"`.

### 2.4 Modal Esc + backdrop-close + focus-trap

- [ ] `components/admin/AnnouncementsList.tsx:406-476` (custom delete modal) → tambah Esc handler + backdrop click + focus-trap (atau migrasi ke `ConfirmDialog` dari DQ-0.3).
- [ ] `app/admin/users/page.tsx` modal → sama.
- [ ] `app/admin/portal-users/page.tsx` modals → sama.
- [ ] `components/admin/MediaPickerModal.tsx` → Esc + backdrop + focus-trap.
- [ ] Audit semua modal di app/ + components/ → pastikan Esc/backdrop/focus-trap.

**DoD:** Semua modal: Esc tutup, backdrop-click tutup, fokus ter-trap, return ke trigger.

### 2.5 Naikkan ESLint rule ke error

- [ ] Setelah 2.1 + 2.2 selesai, ubah `eslint.config.mjs`: `"no-restricted-globals": ["error", "alert", "confirm"]`.
- [ ] `npm run lint` → 0 error.

**DoD:** `npm run lint` → 0 error `no-restricted-globals`. Regresi `alert()`/`confirm()` di-blocked oleh linter.

---

## Fase DQ-3 — Token Authority: Migrasi Inline Color + Style

> **P1 (fase terbesar).** Ship setelah DQ-0 (butuh token). Bisa di-batch per-surface.

### 3.1 Migrasi 175× `#dc2626` + 51× `#ef4444` → token

- [ ] Ganti semua inline `color: '#dc2626'` / `backgroundColor: '#dc2626'` / `borderColor: '#dc2626'` → `var(--brand-red)` (atau utility `.text-brand`/`.bg-brand`/`.border-brand` dari DQ-0.1).
- [ ] Ganti semua inline `#ef4444` → `var(--brand-red-light)`.
- [ ] Ganti `rgba(220, 38, 38, ...)` → `var(--brand-red-alpha)` atau `color-mix(in oklch, var(--brand-red) 10%, transparent)`.
- [ ] Batch per-surface: public site (`app/page.tsx`, `app/[slug]`, `app/site/*`, `components/Navbar.tsx`, `HeroSection.tsx`, `AnnouncementCard.tsx`, `Footer.tsx`, dll) → admin (`app/admin/*`, `components/admin/*`) → portal (`app/portal/*`, `components/portal/*`).
- [ ] Verifikasi: `grep -rn '#dc2626\|#ef4444' app/ components/` → 0.

**DoD:** `grep -rn '#dc2626\|#ef4444' app/ components/` → 0. Brand red 100% via token. `SiteThemeProvider` override bekerja (ganti site → accent ikut).

### 3.2 Migrasi inline `style={{}}` → Tailwind utility / token

Inline style tidak responsive (tidak bisa breakpoint) dan bypass theming. Prioritas: file dengan inline style terbanyak.

- [ ] `app/admin/page.tsx` — konversi inline style block ke utility class (container, flex, grid, spacing).
- [ ] `components/admin/AdminSidebar.tsx` — konversi (nav, user profile, logout).
- [ ] `app/(auth)/admin-login/page.tsx` — konversi (split layout, form).
- [ ] `app/admin/sites/[id]/settings/page.tsx` — konversi (form fields, 6× outline:none sudah di-DQ-1).
- [ ] `app/admin/settings/page.tsx`, `app/admin/users/page.tsx`, `app/admin/categories/page.tsx` — konversi.
- [ ] Public: `app/page.tsx`, `components/HeroSection.tsx`, `components/AnnouncementCard.tsx` — konversi.
- [ ] Portal: `app/portal/page.tsx`, `components/portal/AppCard.tsx`, `CorruptCredential.tsx` — konversi.
- [ ] Pertahankan inline style HANYA untuk value dinamis (e.g. `style={{ animationDelay: \`${index * 0.1}s\` }}`).

**DoD:** Inline style hanya untuk nilai dinamis. Layout/spacing/color via utility class. Responsive breakpoint bekerja.

### 3.3 Standarisasi border-radius button

- [ ] Pilih satu radius button: **8px** (rekomendasi) atau **6px**. Definisikan token `--radius-button`.
- [ ] Ganti semua `borderRadius: 0/4/6/8/12px` di button → token/utilitas konsisten.
- [ ] Card radius: standar **12px** (`--radius-card`). Input radius: **8px** (`--radius-input`).

**DoD:** Button radius konsisten di semua surface. Tidak ada variasi 0/4/6/8/12px acak.

### 3.4 Sinkronisasi stat color dengan token semantik

- [ ] `app/admin/page.tsx:60-65` stat card colors (`#dc2626`, `#22c55e`, `#eab308`, `#3b82f6`) → definisikan token semantik: `--stat-total`, `--stat-published`, `--stat-draft`, `--stat-views`. Pakai token.
- [ ] `AnalyticsDashboard.tsx`, `SiteHealthCard.tsx` → pakai token semantik stat yang sama.

**DoD:** Stat colors via token, bisa di-override per-theme. Tidak ada hex acak di stat cards.

---

## Fase DQ-4 — Strip Dekorasi AI-Slop

> **P1.** Ship setelah DQ-0 (butuh token untuk pengganti side-stripe).

### 4.1 Hapus eyebrow-on-every-section (33+)

- [ ] Cari semua `letterSpacing: '0.2em'` + `textTransform: 'uppercase'` + `fontSize: '11px'` block → hapus eyebrow `<p>` di atas heading.
- [ ] Pertahankan eyebrow HANYA jika satu named kicker adalah deliberate system voice (mis. satu "BERITA" di hero). Sisanya hapus.
- [ ] Files kunci: `app/admin/page.tsx:79-87` ("OVERVIEW"), `app/page.tsx:120-127` ("AKTIVITAS PERUSAHAAN"), `app/admin/announcements/new/page.tsx`, `app/admin/announcements/[id]/edit/page.tsx`, `app/admin/portal-apps/page.tsx`, `app/admin/announcements/[id]/revisions/page.tsx`, `app/admin/audit-trail/page.tsx`, + semua admin page headers.
- [ ] Verifikasi: `grep -rn "letterSpacing: '0.2em'" app/ components/` → ≤1 (deliberate system kicker).

**DoD:** Eyebrow hanya pada ≤1 deliberate location. Heading langsung jadi top of section.

### 4.2 Hapus side-stripe `borderLeft: 4px`

- [ ] `app/admin/page.tsx:129` — `borderLeft: 4px solid ${stat.color}` → hapus, ganti dengan full `border: 1px solid var(--border-color)` atau background tint leading icon.
- [ ] `components/admin/AnalyticsDashboard.tsx:422` — `borderLeft: 4px solid ${color}` → sama.
- [ ] Cari semua `borderLeft: 4px` / `borderLeft: '4px'` di app/ + components/ → hapus/ganti.

**DoD:** `grep -rn "borderLeft.*4px" app/ components/` → 0. Detector `side-tab` → 0.

### 4.3 Vary hero-metric stat presentation

- [ ] `app/admin/page.tsx:60-65, 129` stat cards → variasi: satu "featured" stat (larger) + secondary stats, bukan 4 card identik.
- [ ] `AnalyticsDashboard.tsx:422` SummaryCard → bedakan dari admin dashboard (konteks berbeda, layout berbeda).
- [ ] `SiteHealthCard.tsx:216` → hindari template big-number+small-label identik.

**DoD:** Tidak ada 4+ card identik icon+number+label di satu view. Stat presentation bervariasi.

### 4.4 Sentence-case nav labels

- [ ] `components/admin/AdminSidebar.tsx:77-98` — `"DASHBOARD"` → `"Dashboard"`, `"PENGUMUMAN"` → `"Pengumuman"`, `"PORTAL APPS"` → `"Portal Apps"`, dll. (18 label).
- [ ] `components/admin/AdminSidebar.tsx:338` — `"KELUAR"` → `"Keluar"`.
- [ ] Badge labels: `admin/page.tsx:255` `category.name.toUpperCase()` → pertahankan TOUPPER hanya untuk category tag (kecil, deliberate), bukan nav.

**DoD:** Nav labels sentence-case. Tidak ada ALL-CAPS nav.

### 4.5 Hapus dekorasi gradient + glass

- [ ] `app/(auth)/admin-login/page.tsx:51` — `linear-gradient(135deg, #1a0000 0%, #000 50%, #0a0a0a 100%)` → ganti solid `#0a0a0a` atau subtle `var(--bg-secondary)`. Hanya jika gradient menambah informasi (tidak), hapus.
- [ ] `app/site/[siteSlug]/search/page.tsx:81` + `app/site/[siteSlug]/[articleSlug]/page.tsx:114` — `backdropFilter: blur(10px)` nav → ganti dengan solid `var(--bg-primary)` + border. Glass hanya jika purposeful.
- [ ] Cari `backdropFilter` / `backdrop-filter` di app/ + components/ → evaluasi, hapus dekoratif.

**DoD:** Tidak ada decorative gradient/glass. Detector `glassmorphism` → 0 (jika rule ada).

### 4.6 Fix layout-transition detector finding

- [ ] `components/admin/AdminMainContent.tsx:29` — `transition: 'margin-left 0.3s'` → ganti animasi sidebar dengan `transform: translateX` (non-layout property) atau `grid-template-columns` transition.

**DoD:** Detector `layout-transition` → 0. Sidebar animasi non-layout.

---

## Fase DQ-5 — IA + UX Copy

> **P1.** Ship setelah DQ-2 (toast) + DQ-4 (dekorasi dibersihkan).

### 5.1 Kelompokkan 18 sidebar item → 3–4 section collapsible

- [ ] `components/admin/AdminSidebar.tsx:77-98` — restruktur `navItems` menjadi grouped:
  - **Konten**: Dashboard, Pengumuman, Kategori, Media, Komentar.
  - **Portal** (SuperAdmin): Portal Apps, Portal Groups, Portal Users, Portal Sesi.
  - **Sistem** (SuperAdmin): Sites, Pengguna, Global Analytics, Audit Trail, Email, Newsletter, Settings, Analytics, Sesi.
- [ ] Render sebagai collapsible `<section>` dengan header (icon + label), bukan flat list 18 item.
- [ ] Active section auto-expand. Simpan expand state di localStorage.
- [ ] Target: ≤6 item visible per section, ≤4 section.

**DoD:** Sidebar ≤4 section, masing-masing collapsible. Tidak ada flat 18-item list.

### 5.2 Hapus live clock

- [ ] `components/admin/AdminSidebar.tsx:64-70` — hapus `setInterval` 1s + `currentTime` state + render clock. Clock di OS sudah ada; tidak ada nilai di app.

**DoD:** Tidak ada 1s re-render. `AdminSidebar` tidak punya interval timer.

### 5.3 Unifikasi copy Bahasa/English

- [ ] `app/admin/comments/page.tsx:282, 296` — "Reject" → "Tolak", "Spam" → pertahankan (istilah teknis) atau "Sampah".
- [ ] `app/admin/media/page.tsx:518` — "Copy URL" → "Salin URL".
- [ ] `app/admin/sites/page.tsx:316, 338, 355` — "Settings" → "Pengaturan", "View" → "Lihat", "No Sites Yet" → "Belum ada site".
- [ ] `app/admin/announcements/[id]/revisions/page.tsx:275` — "Restore" → "Pulihkan".
- [ ] `app/admin/sites/[id]/page.tsx:106`, `app/admin/users/page.tsx:113` — "Are you sure..." → Bahasa (sudah di-DQ-2.2, pastikan copy Bahasa).
- [ ] `components/admin/UpdateBanner.tsx` — "Downloading...", "Backup Dulu", "View" → Bahasa konsisten.
- [ ] Audit: `grep -rn "Are you sure\|Settings\|View\|Restore\|Reject\|Copy URL\|Downloading" app/ components/` → ganti ke Bahasa.

**DoD:** Tidak ada English UI string di surface Bahasa (kecuali istilah teknis: "Newsletter", "Spam").

### 5.4 Rewrite empty states untuk teach

- [ ] `app/admin/page.tsx:306-314` — "Belum ada pengumuman." → tambah guidance + CTA + ikon.
- [ ] `app/page.tsx:191-211` (public empty) — sudah ada link, pertahankan + tambah ikon.
- [ ] Audit semua empty state di admin → pastikan teach + CTA, bukan hanya "tidak ada".

**DoD:** Empty state selalu punya: (1) apa yang kosong, (2) kenapa, (3) apa yang harus dilakukan (CTA).

### 5.5 Fix pagination no-ellipsis

- [ ] `app/admin/comments/page.tsx:323-337` — pagination render all pages → tambah ellipsis (1, 2, ..., n-1, n). Gunakan komponen `Pagination.tsx` yang sudah ada jika mendukung.

**DoD:** Pagination >7 pages → tampilkan ellipsis, bukan 20+ button.

### 5.6 Fix route-name drift

- [ ] `app/admin/audit-logs/page.tsx:4` — redirect ke `/admin/audit-trail` (sidebar link ke sana juga). Rename route `/admin/audit-logs` → `/admin/audit-trail` (atau hapus redirect + update semua link).

**DoD:** Satu nama route konsisten. Tidak ada redirect drift.

---

## Fase DQ-6 — Minor + Perf

> Ship setelah DQ-3 (inline style dimigrasi).

### 6.1 Skeleton bukan spinner

- [ ] `components/admin/AnalyticsDashboard.tsx:84-95` — ganti `FiLoader` spinner → skeleton card (gunakan `components/SkeletonCard.tsx` yang sudah ada).
- [ ] `components/admin/SiteHealthCard.tsx:73` — "Loading health metrics..." → skeleton.
- [ ] `app/admin/sites/page.tsx:115` — spinner → skeleton.

**DoD:** Loading state = skeleton, bukan spinner di tengah konten.

### 6.2 Fix N+1 health fetch

- [ ] `app/admin/sites/page.tsx:67-69` — sequential `for` loop fetch health per site → buat API batch `/api/admin/sites/health` atau `Promise.all` di server component.
- [ ] `app/admin/global-analytics/page.tsx:55-79` — `Promise.all` N+1 client requests → konsolidasi ke 1 batch API call.

**DoD:** Tidak ada N+1 fetch di sites health / global analytics.

### 6.3 De-duplicate GitHub version ping

- [ ] `components/admin/UpdateBanner.tsx:58` + `app/admin/settings/page.tsx:78` — kedua fetch `version.json` client-side. Ekstrak ke satu hook `useVersionCheck()` atau lib function, panggil sekali, cache.

**DoD:** Satu fetch version check, tidak duplikat.

### 6.4 Tambah `text-wrap: balance/pretty`

- [ ] `app/globals.css` — tambah: `h1, h2, h3 { text-wrap: balance; }` + `.prose-santos p { text-wrap: pretty; }`.

**DoD:** `grep "text-wrap" app/globals.css` → ≥2. Headings balanced, prose pretty.

### 6.5 Fix view-count await inconsistency

- [ ] `app/site/[siteSlug]/[articleSlug]/page.tsx:51-54` — `await` view-count (blocks render) → ubah ke non-blocking seperti `app/[slug]/page.tsx:56-61`.

**DoD:** View-count increment non-blocking di semua article page. TTFB tidak terdegradasi.

### 6.6 Fix inert `className="dark"`

- [ ] `app/layout.tsx:38` — `className="dark"` tapi `tailwind.config.ts` tidak punya `darkMode`. Hapus class (app dark-only) ATAU tambah `darkMode: 'class'` jika rencana light mode.

**DoD:** Tidak ada inert `dark` class, atau darkMode config konsisten.

### 6.7 Hapus duplikat `@keyframes spin`

- [ ] `components/admin/MediaPickerModal.tsx:727-732` — hapus re-deklarasi `@keyframes spin` (sudah ada di `globals.css:259`).

**DoD:** Satu deklarasi `@keyframes spin` di globals.css.

### 6.8 Fix `CategoryFilter` duplikat export

- [ ] `components/CategoryFilter.tsx:17-31` vs `67-108` — dua export (`CategoryFilter` dead `onClick` + `CategoryFilterClient`). Hapus `CategoryFilter` dead, pertahankan `CategoryFilterClient`, samakan active styling.

**DoD:** Satu export `CategoryFilterClient`. Tidak ada dead code.

### 6.9 Fix button voice (uppercase submit)

- [ ] `app/admin/portal-users/page.tsx:787`, `app/admin/users/page.tsx:498` — "MENYIMPAN..."/"SIMPAN" → sentence case "Menyimpan..."/"Simpan".

**DoD:** Submit button sentence-case di semua form.

### 6.10 Pindahkan `runScheduler()` dari render path

- [ ] `app/admin/page.tsx:51` — `await runScheduler()` di server component render → pindahkan ke API route cron / `unstable_after()` (Next.js 15) agar tidak block dashboard render.

**DoD:** `runScheduler()` tidak di render path. Dashboard TTFB tidak terpengaruh scheduler.

---

## Fase DQ-7 — Verifikasi

> **Fase terakhir.** Jalankan setelah semua fase selesai.

### 7.1 Re-run detector

- [ ] `node <skill-base>/scripts/detect.mjs --json app components` → target **0 findings** (dari 7 warning).
- [ ] Catat sisa finding (jika ada) → tambah ke backlog.

**DoD:** `detect.mjs` exit 0 (atau 0 findings).

### 7.2 Re-run critique

- [ ] `$impeccable critique all frontend` → target skor **≥32/40** (dari 18/40), P0: 0, P1: ≤1.
- [ ] Bandingkan trend: `node <skill-base>/scripts/critique-storage.mjs trend app 5`.

**DoD:** Skor critique naik ≥14 poin. P0: 0.

### 7.3 Smoke test manual (3 surface)

- [ ] **Public**: homepage hero, category filter, article page, search, pagination, newsletter subscribe.
- [ ] **Admin**: login (error message plain-language), dashboard stats, create/edit announcement (autosave), bulk action (ConfirmDialog), media picker, settings, delete confirm (ConfirmDialog + Esc).
- [ ] **Portal**: portal-login, app grid, credential save/delete (ConfirmDialog), CorruptCredential/NoCredential states, SSO launch.
- [ ] **A11y**: Tab through login + admin forms (focus ring visible), keyboard-only delete flow, prefers-reduced-motion ON (autoplay stop).

**DoD:** Semua 3 surface lulus smoke test. Tidak ada regression.

### 7.4 Lighthouse + axe

- [ ] Lighthouse a11y audit di homepage + admin dashboard → target ≥90.
- [ ] axe DevTools scan → 0 critical/serious issue.

**DoD:** Lighthouse a11y ≥90. axe 0 critical.

### 7.5 Build + lint final

- [ ] `npm run build` → sukses, 0 error.
- [ ] `npm run lint` → 0 error (termasuk `no-restricted-globals`).

**DoD:** Build + lint sukses tanpa error.

---

## 8. Yang TIDAK boleh rusak (regression guards)

| Area | Risk | Guard |
|------|------|-------|
| `SiteThemeProvider` per-site color | Token migration bisa break custom site color | Test: ganti site → accent ikut. Verifikasi `--site-primary` override `--brand-red`. |
| BulkActionBar bulk delete | ConfirmDialog migration bisa break flow | Test: select 3 → delete → ConfirmDialog → confirm → 3 deleted. |
| AnnouncementForm autosave | Outline/inline-style migration bisa break editor | Test: edit announcement → autosave indicator muncul. |
| RichTextEditor (Tiptap) | Outline:none removal bisa break editor focus | DQ-1.1: ganti dengan visible focus ring, jangan hapus focus. Test: type in editor. |
| Login flow | Error mapping bisa break redirect | Test: wrong password → Bahasa error, tidak crash. Correct → redirect /admin. |
| Portal SSO auto-submit | Credential changes di DQ-3 bisa break launch | Test: app with credential → SSO submit works. |
| ToastContext | Sudah global; jangan re-wrap | Verifikasi `app/layout.tsx:44` tidak double-wrap. |
| DB / API | Fase ini murni UI — jangan sentuh prisma/API | Non-destructive principle. Tidak ada perubahan schema/route API. |

---

## 9. Risk register

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Token migration miss inline hex | Brand inconsistency tetap | `grep` verification per fase (DoD). Batch per-surface. |
| ConfirmDialog focus-trap bug | Keyboard user ter-trap | Test Esc + Tab cycle. Gunakan `<dialog>` native jika memungkinkan. |
| Inline style→utility break responsive | Layout rusak di mobile | Test setiap page di 375px / 768px / 1280px. |
| Eyebrow removal ubah visual rhythm | Page terasa "flat" | Pertahankan 1 deliberate kicker. Heading weight/size naik untuk kompensasi hierarchy. |
| Sidebar grouping sembunyikan fitur | User tidak nemu menu | Active section auto-expand + search/breadcrumb. Test dengan user. |
| Reduced-motion break animasi penting | State feedback hilang | Crossfade alternative, bukan hapus total. Test prefers-reduced-motion ON. |
| ESLint error block CI | Build gagal saat migrasi | DQ-0.5: warning dulu → DQ-2.5: error setelah semua diganti. |

---

## 10. Urutan eksekusi rekomendasi

```
DQ-0 (gate) ──► DQ-1 (P0 a11y) ──► DQ-2 (feedback) ──► DQ-5 (copy)
            └──► DQ-3 (token)  ──► DQ-6 (minor)
            └──► DQ-4 (dekorasi) ─► DQ-5 (copy)
                                    └──► DQ-7 (verifikasi)
```

- **Sprint 1 (DQ-0 + DQ-1):** fondasi + P0 a11y. ~2 hari. Ship: fokus ring + kontras + reduced-motion.
- **Sprint 2 (DQ-2 + DQ-4):** feedback primitive + strip dekorasi. ~3.5 hari. Ship: 0 alert/confirm, 0 eyebrow/side-stripe.
- **Sprint 3 (DQ-3 + DQ-6):** token authority + minor/perf. ~3–4 hari. Ship: 0 inline hex, skeleton, N+1 fix.
- **Sprint 4 (DQ-5 + DQ-7):** IA + copy + verifikasi. ~2 hari. Ship: sidebar grouped, copy unified, critique ≥32/40.

> Setelah selesai: re-run `$impeccable critique all frontend` untuk konfirmasi skor naik. Snapshot tersimpan di `.impeccable/critique/` untuk trend tracking.

