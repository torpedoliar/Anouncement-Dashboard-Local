# Handoff — Phase 12 PDF Reader Inline di Artikel

**Created:** 2026-08-17
**Phase:** 12 — `12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex`
**Status:** SPEC locked (7 requirements), belum discuss/plan/execute
**Entry points:**
- SPEC: `.planning/phases/12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex/12-SPEC.md`
- ROADMAP: `.planning/ROADMAP.md` Phase 12
- STATE: `.planning/STATE.md` (roadmap evolution)

---

## Apa yang diminta user

Saat membuat artikel, editor bisa sisipkan PDF di dalam body artikel (RichTextEditor) dan juga tampil sebagai daftar lampiran di bawah artikel. Pembaca membuka PDF inline di halaman artikel tanpa wajib download atau buka tab baru. Viewer harus punya toolbar minimal: Download + Fullscreen.

Putusan interview:
- Penempatan: **keduanya** — inline block di body + lampiran dedup di bawah konten (satu sumber konsisten: `href` lampiran = `data-src` inline).
- Sumber: **upload baru + URL eksternal** (`https://.../*.pdf` langsung embed tanpa upload ulang).
- Multi: **bisa beberapa PDF per artikel** (1–5 wajar).
- Sukses = **toolbar lengkap wajib** (bukan viewer saja).
- Batas: **50 MB** per PDF.
- Akses PDF **ikut artikel** (publik jika `isPublished`, tidak ada auth terpisah di fase ini).

---

## Apa yang sudah selesai

| Item | Status |
|---|---|
| Phase 11 — Portal & Auth Surfaces (P4 rework) | SHIPPED (4 plans, 15 commits) — SDD verified |
| Phase 12 — SPEC (7 requirements, ambiguity 0.13, gate passed) | ✅ commit `8f36770` |
| Fix thumbnail video di grid site-scoped (YouTube `hqdefault.jpg` + MP4 `<video>`) | ✅ commit `24af9a3`, push `main` |
| Fix hero 16:9 rotate | ✅ commit `2d473ac` |
| Graphify audit pre-check untuk PDF (sanitizer/mime/upload) | ✅ dilakukan di chat 2026-08-17 |

Fase 12 belum masuk `discuss-phase` / `plan-phase` / `execute`. Tidak ada perubahan kode untuk PDF yang di-commit.

---

## Konteks codebase untuk agent selanjutnya

### Stack & runtime
- **Next.js 15 / React 19 / Tailwind v3 / TypeScript** — jangan ubah versi Tailwind/postcss.
- `npm run build` gagal pre-existing (empty `NEXTAUTH_URL`) — gate: `npx tsc --noEmit` + `eslint` scoped. `npm run dev` tidak bisa render (Postgres lokal mati). Lihat `STATE.md` Blockers PRE-1.
- Icons baru: `@phosphor-icons/react` (bukan `react-icons/fi`). Tokens: `bg-surface-*`, `text-text-*`, `border-border`, `bg-accent`.
- Commit message & UI string: **Bahasa Indonesia**.

### File kunci untuk fase 12

| Peran | File |
|---|---|
| Editor | `components/admin/RichTextEditor.tsx` — TipTap (CustomImage, YouTube, Video). Tambah extension `Pdf` atom draggable `div[data-pdf]`. |
| Form artikel | `components/admin/AnnouncementForm.tsx` — pakai RichTextEditor |
| Preview admin | `components/admin/AnnouncementPreview.tsx` — sanitize preview via DOMPurify, perlu loloskan `div[data-pdf]` |
| Upload media | `app/api/media/route.ts` — whitelist `IMAGE_TYPES`/`VIDEO_TYPES`, size 10/100MB, folder `images`/`videos`. Tambah cabang PDF. |
| Serve file | `app/api/uploads/[...path]/route.ts` — `MIME_TYPES` whitelist, path guard `..`/`\0` |
| Upload image-only | `app/api/upload/route.ts` — tidak perlu untuk PDF (reuse `/api/media`) |
| Sanitasi | `lib/validation-schemas.ts` — `sanitizeHTML` (DOMPurify, `ALLOWED_TAGS` tanpa `object`, `ALLOW_DATA_ATTR: false`) |
| Render publik | `app/site/[siteSlug]/[articleSlug]/page.tsx` — server, `dangerouslySetInnerHTML` atas `announcement.content` (sudah sanitized on-write) |
| Render legacy | `app/[slug]/page.tsx` — redirect canonical, juga render content (jaga agar tidak break) |
| Middleware header | `middleware.ts` — `X-Frame-Options: SAMEORIGIN` (se-origin iframe tetap bisa) |

### Putusan arsitektur yang sudah dikunci di SPEC (jangan diulang tanya)

- **Jangan whitelist `object`/`embed` global di sanitizer** — hanya `div[data-pdf]` + `data-src`/`data-filename` (XSS surface). Viewer `<object>`/`<iframe>` di-inject oleh hydrator client, bukan lewat HTML yang di-sanitize.
- **Tanpa dependensi baru** (`pdfjs-dist`/`react-pdf` dilarang) — pakai native `<object type="application/pdf">` / `<iframe>`.
- **Tanpa migration / tabel baru** — PDF = URL di `announcement.content` + optional row `MediaLibrary(mimeType=application/pdf)` untuk upload.
- **Hydrator = island client kecil**: `components/site/ArticleContent.tsx` ("use client", terima `html`, `dangerouslySetInnerHTML` + `useEffect` query `[data-pdf]` mount `PdfInline` via `createRoot`) + `components/site/PdfInline.tsx` (height 600 desktop / 480 mobile). Bukan full page client.
- **Lampiran bukan `<object>` kedua** — hanya list link dedup (hemat fetch).
- **Out of scope**: thumbnail PDF, search/index PDF, anotasi, cetak gabungan, pagination/zoom custom, pick PDF lama dari Media Library tab.

### Acceptance yang harus dicek agent selanjutnya

Lihat `.planning/phases/12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex/12-SPEC.md` § Acceptance Criteria (10 checklist), plus Edge Coverage & Prohibitions. Ringkas: upload valid 201 + MIME `application/pdf`, upload salah/oversize 400, blok inline multi & `data-pdf` lolos sanitizer, URL eksternal tanpa row MediaLibrary, viewer inline 600/480 tanpa auto tab, lampiran dedup `href === data-src`, toolbar Download+Fullscreen, XSS ter-strip, `tsc`+`eslint` scoped lolos.

---

## Cara melanjutkan

```bash
cd "E:/Vibe/Dashboard SJA/announcement-dashboard"

# Lanjut GSD (berurutan)
# 1. Discuss — kunci keputusan implementasi (how), baca SPEC otomatis
/gsd-discuss-phase 12

# 2. Plan — breakdown jadi plans (gsd-planner)
#    Hasil audit graphify sudah ada di chat 2026-08-17, bisa reuse:
/gsd-plan-phase 12

# 3. Execute — implementasi per plan
/gsd-execute-phase 12

# 4. Verify — cek acceptance + tsc/eslint + manual E2E
/gsd-verify-work 12
```

Jika ingin update ROADMAP/STATE atau tambah fase lagi: `/gsd-phase` (atau `add/insert/remove/edit`).

---

## Hal yang sengaja tidak dikerjakan sekarang

- Implementasi upload PDF / extension TipTap / hydrator — menunggu `discuss-phase` + `plan-phase` agar tidak premature.
- Perubahan apapun di luar list "In scope" SPEC (thumbnail, search, annotasi, cetak, pagination/zoom custom, Media Library tab PDF).
- Fix `NEXTAUTH_URL` build failure pre-existing — jangan di-fix (sesuai STATE.md).

---

## Aturan yang tetap berlaku

- Gates verifikasi: `npx tsc --noEmit` + `npx eslint <files>`; `npm run build`/`dev` tidak jadi gate (PRE-1).
- Tailwind v3, `postcss.config.mjs` jangan diutak-atik.
- Commit hanya file yang disentuh task; pesan commit Bahasa Indonesia; satu commit per plan.
- `logAudit()` non-blocking untuk mutasi yang sudah ada — tidak perlu untuk fase 12 kecuali menambah mutasi baru yang butuh audit.

---

## State saat handoff ditulis

- Branch `main` di `24af9a3` → `8f36770` (SPEC phase 12), push sudah.
- Working tree ada modifikasi yang belum di-commit: `CLAUDE.md`, `graphify-out/*` (abaikan — bukan bagian fase 12).
- Milestone `v3.0` masih aktif; Phase 11 status `planning` (sudah EXECUTED+reviewed tapi STATE belum di-bump — lihat Blockers PRE-4). Phase 12 adalah fase integer baru setelah Phase 11.

---

## Prompt siap pakai untuk agent lain (copy-paste)

> Lanjutkan Phase 12 PDF Reader Inline di Artikel dari SPEC yang sudah terkunci di `.planning/phases/12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex/12-SPEC.md` (7 requirements, in/out scope, constraints, dan 10 acceptance checklist ada di sana). Jalankan `/gsd-discuss-phase 12` lalu `/gsd-plan-phase 12` lalu eksekusi. Patuhi putusan: tanpa `pdfjs-dist`, tanpa migration/tabel baru, jangan whitelist `object`/`embed` global (hanya `div[data-pdf]`), hydrator = island client `ArticleContent`+`PdfInline` (native `<object>` 600/480). Upload PDF max 50 MB di `app/api/media` (folder `documents/`) + MIME `application/pdf` di `app/api/uploads/[...path]`. Gates: `npx tsc --noEmit` + `eslint` scoped; jangan fix `NEXTAUTH_URL` pre-existing. Commit Bahasa Indonesia, satu plan satu commit.
