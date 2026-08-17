# Phase 12: pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

## Phase Boundary

Editor dapat upload atau paste URL PDF, embed beberapa PDF di dalam body artikel lewat RichTextEditor (sebagai blok inline) plus daftar lampiran di bawah artikel; pembaca membuka PDF inline di halaman artikel tanpa download/tab baru wajib, dengan toolbar (download + fullscreen) sebagai syarat sukses. Batas 50 MB per PDF; akses ikut artikel (publik bila isPublished).

## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `12-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `12-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Whitelist PDF di `/api/media` (50 MB, folder `documents/`) + MIME `application/pdf` di `/api/uploads/[...path]`
- TipTap extension `Pdf` (blok inline, drag, hapus, multi), tombol toolbar FilePdf, handler upload + dialog URL eksternal
- Hydrator `ArticleContent` + `PdfInline` (native `<object>`/`<iframe>`, tinggi dinamis/responsive — user pilihan, fallback download), seksi Lampiran dedup di bawah konten
- Toolbar viewer: Download (anchor download) + Fullscreen (requestFullscreen)
- Penyesuaian `sanitizeHTML` minimal untuk `div[data-pdf]` dan atribut `data-src`/`data-filename`
- Preview admin (`AnnouncementPreview`) yang tidak strip placeholder PDF

**Out of scope (from SPEC.md):**
- Thumbnail/preview mini PDF di list/grid artikel
- Pencarian teks di dalam PDF / indexing PDF
- Anotasi / comment di atas PDF
- Pencetakan gabungan / export PDF artikel
- Perubahan schema DB / tabel baru — PDF sebagai URL di `announcement.content` + optional row `MediaLibrary` untuk upload
- Pagination PDF di toolbar kustom (page nav, zoom custom)
- Pick PDF lama dari Media Library tab khusus

## Implementation Decisions

### Editor upload & sisip PDF (toolbar, label, multi)
- **D-01:** Satu tombol FilePdf di toolbar RichTextEditor dengan dropdown dua pilihan: Upload PDF vs Sisipkan via URL.
- **D-02:** Blok optimistik — pada upload, placeholder `div[data-pdf]` muncul dulu dengan nama file (auto data-filename), src diganti saat POST 201; gagal -> blok merah + pesan.
- **D-03:** Judul/filename auto dari basename upload atau basename URL eksternal (tanpa dialog judul opsional).
- **D-04:** Tanpa batas hard jumlah PDF per artikel di editor (wajar 1-5, dedup di viewer/lampiran menangani kelebihan).

### Viewer inline + toolbar
- **D-05:** Viewer primer `<object type="application/pdf" data={src}>` dengan `<iframe>` sebagai fallback di dalam object.
- **D-06:** Toolbar header/overlay di viewer: Download (`<a download href={src}>`) + Fullscreen (requestFullscreen pada container; fallback buka src di tab baru hanya bila API unavailable — satu klik eksplisit, tidak auto). Keyboard reachable.
- **D-07:** Tinggi viewer dinamis/responsive (user pilih) — berbeda dari SPEC fixed 600/480. Planner/researcher harus guard acceptance criteria tinggi (AC: 600 desktop / 480 mobile) — perlakukan sebagai assumption/override yang harus diverifikasi.
- **D-08:** Fallback bila PDF tidak bisa di-iframe (CORS/X-Frame block): paragraf + link `<a href download>` di dalam viewer (tidak auto tab).

### Daftar lampiran di bawah artikel
- **D-09:** Seksi Lampiran di bawah konten (di atas syndication/comments): list dedup (urut kemunculan) nama file + tombol Download; href identik dengan data-src inline — bukan embed object kedua (hemat fetch, 1 sumber).
- **D-10:** Label lampiran = data-filename bila ada, fallback basename data-src. Artikel tanpa PDF -> seksi lampiran tidak dirender sama sekali.

### Sanitasi & serving aman
- **D-11:** `sanitizeHTML` perluas minimal hanya untuk `div[data-pdf]` + `data-src` + `data-filename`; ALLOW_DATA_ATTR tetap false atau FORBID_ATTR on*; jangan whitelist object/embed global.
- **D-12:** `/api/uploads/[...path]` tambah MIME `pdf: application/pdf`; path resolve+guard (.. / \0 ditolak); akses PDF ikut isPublished artikel (publik bila published; tanpa auth terpisah fase ini).

### Claude's Discretion
- Detail styling viewer/lampiran (radius 8, warna toolbar, responsive query) — ikuti token surface/text/border yang ada.
- Urutan render lampiran exact dedup (Set vs array) — pilih yang paling simpel yang lolos AC dedup.
- Dialog URL eksternal (validasi https? + .pdf ext) — ikuti AC R3 (https://.../*.pdf tanpa row MediaLibrary).

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PDF-inline locked spec
- `.planning/phases/12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex/12-SPEC.md` — Locked 7 requirements, boundaries, constraints (50MB, no new deps, sanitizer minimal, no object/embed global, hydrator island, X-Frame SAMEORIGIN), 10 acceptance criteria, edge/prohibition coverage, interview log. MUST read — ground truth.

### Project + roadmap
- `.planning/PROJECT.md` — Core value (CMS keep working), portal SSO + audit monetized as stable, Approach A rework context. Constraints: Next.js 15, Prisma 5, Tailwind v3, no new deps.
- `.planning/REQUIREMENTS.md` — Requirement clusters (PORT-*, UIUX-*). Phase 12 maps to PDF-inline capability (derive).
- `.planning/STATE.md` — Blockers (PRE-1 build fails on empty NEXTAUTH_URL; dev cannot render), has_context/has_research gating; roadmap evolution notes Phase 12 added.
- `.planning/ROADMAP.md` — Phase 12 Depends on: Phase 11; Plans 0; canonical refs expansion point.

### Codebase integration points (discovered in scout)
- `components/admin/RichTextEditor.tsx` — TipTap CustomImage/YouTube/Video extensions; add Pdf atom draggable div[data-pdf].
- `components/admin/AnnouncementForm.tsx` — Uses RichTextEditor (content prop).
- `components/admin/AnnouncementPreview.tsx` — sanitizeHTML preview; must allow div[data-pdf].
- `app/api/media/route.ts` — IMAGE_TYPES/VIDEO_TYPES whitelist up to 100MB, folders images/videos; add PDF branch.
- `app/api/uploads/[...path]/route.ts` — MIME_TYPES whitelist, path guard.
- `lib/validation-schemas.ts` — sanitizeHTML (DOMPurify, ALLOWED_TAGS without object, ALLOW_DATA_ATTR: false).
- `app/site/[siteSlug]/[articleSlug]/page.tsx` — Public render via dangerouslySetInnerHTML (sanitized on-write); hydrator injection point.
- `middleware.ts` — X-Frame-Options SAMEORIGIN (se-origin iframe ok).

## Existing Code Insights

### Reusable Assets
- RichTextEditor custom-image technique (atom draggable) — clone untuk Pdf extension (src, title/filename attrs; parseHTML div[data-pdf]; renderHTML div[data-pdf] data-src/data-filename).
- MediaLibrary model (mimeType siteId) — optional row untuk upload PDF (application/pdf).
- sanitizeHTML auto-redact SENSITIVE_KEYS pattern — jangan store secret di changes/metadata.
- ArticleContent client island pattern (useEffect + createRoot mount per [data-pdf]) — hydrator.

### Established Patterns
- Tailwind token-native (bg-surface-*, text-text-*, border-border, bg-accent) — viewer/lampiran harus token-native.
- Non-blocking audit (logAudit never throws) — Fase 12 tidak butuh audit tambahan (tanpa mutasi table baru).
- Validation via Zod + DOMPurify sanitizer on-write — PDF URL/src harus lolos transform sanitizeHTML.

### Integration Points
- AnnouncementForm -> RichTextEditor (new FilePdf button + dialog URL).
- article page -> ArticleContent hydrator -> PdfInline mounts (native viewer).
- /api/media (upload) -> /api/uploads (serve) -> html content -> hydrated inline.

## Specific Ideas

- Single FilePdf button + dropdown keeps toolbar klir — konsisten dengan tombol Image/Youtube yang ada.
- Optimistic block menjaga UX drag/reorder sebelum upload settle — selaras dengan AC blok muncul + bisa dihapus.
- D-07 tinggi dinamis override SPEC fixed — tandai sebagai assumption di planner; verifier harus cek tinggi rendered (AC: 600 desktop / 480 mobile atau responsif yang lolos).

## Deferred Ideas

None — discussion stayed within phase scope (in-scope/out-of-scope sudah terkunci di SPEC; tidak ada competing variant baru).

---
*Phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex*
*Context gathered: 2026-08-17*
