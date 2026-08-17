# Phase 12: PDF Reader Inline di Artikel — Specification

**Created:** 2026-08-17
**Ambiguity score:** 0.13 (gate: ≤ 0.20)
**Requirements:** 7 locked

## Goal

Editor dapat upload atau paste URL PDF, embed beberapa PDF di dalam body artikel lewat RichTextEditor (sebagai blok inline) plus daftar lampiran di bawah artikel; pembaca membuka PDF inline di halaman artikel tanpa download/tab baru wajib, dengan toolbar (download + fullscreen) sebagai syarat sukses.

## Background

RichTextEditor (`components/admin/RichTextEditor.tsx`) hari ini punya extension TipTap untuk `CustomImage`, `YouTube` (iframe), dan `Video` (upload MP4) — belum ada PDF. Upload media ada dua jalur: `/api/upload` (image-only) dan `/api/media` (image+video, whitelist `IMAGE_TYPES`/`VIDEO_TYPES`, folder `images`/`videos`). `sanitizeHTML` di `lib/validation-schemas.ts` whitelist `ALLOWED_TAGS` tanpa `object` dan `ALLOW_DATA_ATTR: false` — placeholder `data-*` akan ter-strip jika dipakai mentah. Render publik ada di `app/site/[siteSlug]/[articleSlug]/page.tsx` (server, `dangerouslySetInnerHTML` terhadap `announcement.content` yang sudah di-sanitize on-write) dan `components/admin/AnnouncementPreview.tsx`. Belum ada viewer PDF inline; user harus download/buka tab baru.

## Requirements

1. **Upload PDF**: Editor dapat upload file PDF dari perangkat, tervalidasi sebagai PDF, ukuran dibatasi.
   - Current: `/api/media` hanya terima image (jpeg/png/gif/webp) + video mp4; belum ada cabang PDF.
   - Target: `/api/media` terima `application/pdf` dan ekstensi `.pdf`; limit 50 MB; disimpan di folder `documents/` (atau `pdfs/`) di `public/uploads`, tercatat di `MediaLibrary` dengan `mimeType: application/pdf` dan `siteId` per pemanggil (null = shared). Response JSON kembalikan `url` yang bisa di-embed.
   - Acceptance: upload `a.pdf` (application/pdf, < 50 MB) → 201 + `url: /api/uploads/documents/....pdf` + row MediaLibrary; upload `.exe`/mimetype salah → 400; upload >50 MB → 400; file dapat di-GET via `/api/uploads/[...path]` dengan `Content-Type: application/pdf`.

2. **Embed PDF inline di editor (TipTap block)**: Editor dapat menyisipkan PDF di dalam body artikel sebagai blok yang bisa dipindahkan/dihapus, mendukung banyak PDF per artikel.
   - Current: toolbar punya tombol Image / VideoCamera / YoutubeLogo / Media Library; extension `Video`/`YouTube` sebagai block atom draggable. Tidak ada blok PDF.
   - Target: extension TipTap `Pdf` (atom, draggable, group block) dengan attr `src` (wajib, string URL), `title`/`filename` opsional; `parseHTML: div[data-pdf]`; `renderHTML` emit `<div data-pdf data-src="...">` (placeholder aman untuk sanitizer). Toolbar tambah tombol FilePdf; input hidden `accept="application/pdf"`; handler `handlePdfUpload` validasi tipe+size client, POST `/api/media`, lalu `insertContent {type:'pdf', attrs:{src}}`. Blok terpilih tampil toolbar mini (hapus). Multiple block didukung tanpa batas hard (wajar 1–5).
   - Acceptance: di `AnnouncementForm`, klik tombol PDF → pilih `sample.pdf` → blok PDF muncul inline di editor (preview placeholder + nama file); bisa drag/reorder; hapus; simpan artikel → `announcement.content` mengandung `data-pdf` markup dan lolos `sanitizeHTML`.

3. **Embed PDF via URL eksternal**: Editor dapat embed PDF dengan menempel URL (mis. `https://example.com/doc.pdf`) tanpa upload.
   - Current: tidak ada; YouTube embed via dialog URL, image/video via upload atau Media Library.
   - Target: dialog/button "Sisipkan PDF via URL" (atau reuse dialog Embed): input URL, validasi format URL dan ekstensi `.pdf` (atau setidaknya `https?://`); on confirm → `insertContent {type:'pdf', attrs:{src: url}}}` (tidak di-upload, tidak buat row MediaLibrary). Sanitizer tidak strip `data-src` URL absolut.
   - Acceptance: paste `https://cdn.example.com/a.pdf` → blok PDF inline muncul dengan link sumber; simpan → content simpan URL absolut; viewer inline tetap render (atau fallback link jika CORS/X-Frame blok).

4. **Viewer inline di halaman artikel (tanpa tab baru)**: Pembaca melihat PDF langsung di halaman artikel; tidak wajib download atau buka tab baru.
   - Current: halaman publik `app/site/[siteSlug]/[articleSlug]/page.tsx` render `announcement.content` via `dangerouslySetInnerHTML` tanpa hydrasi khusus. PDF belum ada.
   - Target: `components/site/PdfInline.tsx` ("use client") render `<object data={src} type="application/pdf">` atau `<iframe src={src}>` dengan tinggi 600px (desktop) / 480px (mobile), `width:100%`, border radius 8px; fallback: paragraf + link `<a href download>` jika object gagal. Hydrator `components/site/ArticleContent.tsx` ("use client") terima `html: string`, render `dangerouslySetInnerHTML`, lalu `useEffect` query `[data-pdf]` dan mount `PdfInline` via `createRoot` per placeholder (hindari melonggarkan `sanitizeHTML` untuk tag `object` global). Objek PDF berbagi sumber yang sama (satu `src`) — lampiran di bawah tidak duplikasi fetch beda URL (idempotent, satu PDF satu URL).
   - Acceptance: buka `/site/<site>/<artikel-yang-punya-pdf-inline>` sebagai anonim → PDF terlihat inline (native browser viewer) tanpa klik; `curl` `/api/uploads/documents/...pdf` → `Content-Type: application/pdf`; tidak ada auto `window.open` / redirect.

5. **Daftar lampiran PDF di bawah artikel (source konsisten)**: Di bawah konten utama ada daftar lampiran yang merujuk ke PDF yang sama dengan blok inline (satu sumber, hemat fetch).
   - Current: tidak ada daftar lampiran; setelah konten hanya syndication notice + comments.
   - Target: `ArticleContent` / `ArticlePage` derive daftar unik `src` dari `[data-pdf]` (urut kemunculan, dedup); render seksi "Lampiran" (judul + list) di bawah konten, di atas syndication notice: tiap item tampil filename (dari `data-filename`/`data-src` basename) + tombol Download. List ini bukan render `<object>` kedua — hanya link/meta ke sumber yang sama sehingga tidak gandakan fetch viewer (konsistensi 1 sumber).
   - Acceptance: artikel dengan 2 PDF inline → seksi Lampiran tampil 2 baris (nama file + Download), link `href` sama persis dengan `data-src` blok inline; artikel tanpa PDF → seksi Lampiran tidak dirender.

6. **Toolbar viewer (download + fullscreen)**: Viewer inline punya toolbar minimal dengan Download dan Fullscreen.
   - Current: viewer belum ada.
   - Target: `PdfInline` header/overlay dengan tombol Download (`<a download href={src}>`) dan Fullscreen (requestFullscreen pada container; fallback buka `src` di tab baru hanya jika fullscreen API tidak tersedia — tetap satu klik eksplisit, bukan auto). Tombol terlihat baik night maupun light; keyboard reachable.
   - Acceptance: pada viewer inline, tombol Download mengunduh file yang sama tanpa navigasi halaman artikel hilang; Fullscreen membesarkan container viewer (atau fallback tab baru hanya jika API missing — diverifikasi di browser tanpa fullscreen support); keduanya ada di setiap instance viewer.

7. **Sanitasi + serving yang aman untuk PDF**: Konten PDF tidak membuka celah XSS; file PDF dilayani dengan MIME dan path aman; akses ikut aturan artikel (publik).
   - Current: `sanitizeHTML` whitelist tanpa `object`, `ALLOW_DATA_ATTR: false`; `/api/uploads/[...path]` whitelist MIME tanpa `pdf`; akses artikel via `isPublished + siteId` (publik, sama untuk konten).
   - Target: `sanitizeHTML` perluas `ALLOWED_TAGS`/`ALLOWED_ATTR` minimal untuk `div[data-pdf]` (`data-pdf`, `data-src`, `data-filename`); `ALLOW_DATA_ATTR` tetap false atau true dengan `FORBID_ATTR: ['on*']` — jangan longgarkan ke `object` generik. `/api/uploads/[...path]` tambah `pdf: application/pdf` di `MIME_TYPES`; path tetap resolve+guard (`..`/`\0` ditolak). Akses PDF inline ikut akses artikel: jika artikel `isPublished` publik, PDF publik via URL yang sama (tanpa auth tambahan); jika nanti artikel ber-auth, PDF ikut (tidak perlu auth terpisah di fase ini).
   - Acceptance: inject `<img onerror=alert(1)>` / `<object data="javascript:alert(1)">` di editor → setelah save & render, payload ter-strip/tidak dieksekusi; GET `/api/uploads/../../etc/passwd` → 400; GET `/api/uploads/documents/valid.pdf` → 200 + `Content-Type: application/pdf` + `Accept-Ranges: bytes`; PDF yang di-embed di artikel draft/unpublished tidak dapat dibuka via direct URL tanpa melewati guard artikel (viewer tidak dirender sebelum publish).

## Boundaries

**In scope:**
- Whitelist PDF di `/api/media` (50 MB, folder `documents/`) + MIME `application/pdf` di `/api/uploads/[...path]`
- TipTap extension `Pdf` (blok inline, drag, hapus, multi), tombol toolbar FilePdf, handler upload + dialog URL eksternal
- Hydrator `ArticleContent` + `PdfInline` (native `<object>`/`<iframe>`, tinggi 600/480, fallback download), seksi Lampiran dedup di bawah konten
- Toolbar viewer: Download (anchor download) + Fullscreen (requestFullscreen)
- Penyesuaian `sanitizeHTML` minimal untuk `div[data-pdf]` dan atribut `data-src`/`data-filename`
- Preview admin (`AnnouncementPreview`) yang tidak strip placeholder PDF

**Out of scope:**
- Thumbnail/preview mini PDF di list/grid artikel — fase ini hanya inline di detail artikel (thumbnail tetap image/video)
- Pencarian teks di dalam PDF / indexing PDF — bukan tanggung jawab fase ini
- Anotasi / comment di atas PDF — fase terpisah
- Pencetakan gabungan / export PDF artikel — bukan scope viewer inline
- Perubahan schema DB / tabel baru — PDF disimpan sebagai URL di `announcement.content` + optional row `MediaLibrary` untuk upload
- Pagination PDF di toolbar kustom (page nav, zoom custom) — pakai viewer bawaan browser; zoom custom adalah iterasi berikutnya jika terbukti kurang
- Pick PDF lama dari Media Library tab khusus — cukup upload baru + URL eksternal; pick lama bisa iterasi berikutnya

## Constraints

- Maks 50 MB per PDF — divalidasi di `/api/media` (400 jika melebihi); upload dir `public/uploads/documents` via `writeFile`/`mkdir` yang sudah ada.
- Tanpa dependensi baru (tanpa `pdfjs-dist`/`react-pdf`/`cheerio`): viewer pakai `<object>`/`<iframe>` native; parsing sanitasi tetap `isomorphic-dompurify` + DOMPurify.
- `app/api/media` perlu validasi ganda: `file.type === 'application/pdf'` dan `ext === 'pdf'` (jangan trust MIME saja); nama file di-sanitize (UUID) seperti image/video.
- `sanitizeHTML` jangan whitelist `object`/`embed` global — hanya `div[data-pdf]` agar tidak longgar XSS surface.
- `X-Frame-Options: SAMEORIGIN` di `middleware.ts` sudah ada — `/api/uploads/...` se-origin tetap dapat di-iframe; jangan ubah header.
- Artikel tetap server component (`dynamic = force-dynamic`); hydrator PDF adalah island client kecil, bukan full page client.

## Acceptance Criteria

- [ ] Upload `sample.pdf` (<50 MB, application/pdf) via toolbar PDF berhasil: 201, file di `public/uploads/documents/`, row `MediaLibrary(mimeType=application/pdf)`, URL ` /api/uploads/documents/*.pdf` dapat di-GET dengan `Content-Type: application/pdf`.
- [ ] Upload PDF ber-MIME salah / ekstensi bukan `.pdf` ditolak 400; upload >50 MB ditolak 400 dengan pesan.
- [ ] Di editor, blok PDF inline muncul (placeholder + nama file), dapat drag/reorder, hapus, dan multi (2–3 PDF) tanpa error; save → `announcement.content` mengandung `div data-pdf data-src` dan tidak ter-strip.
- [ ] Embed via URL eksternal `https://.../*.pdf` berhasil: blok inline muncul, simpan tidak buat `MediaLibrary` baru, viewer inline render (atau fallback link jika X-Frame/CORS blok — tetap tanpa auto tab).
- [ ] Buka artikel published dengan PDF inline sebagai anonim di `/site/<slug>/<artikel>` → PDF terlihat inline tanpa klik, tinggi 600px desktop / 480px mobile, tanpa membuka tab baru; download tidak wajib sebelum melihat.
- [ ] Di halaman artikel, seksi Lampiran muncul di bawah konten (di atas syndication/comments): daftar dedup nama file + tombol Download, `href` identik dengan `data-src` inline — tidak gandakan fetch viewer berbeda.
- [ ] Artikel tanpa PDF tidak menampilkan seksi Lampiran maupun viewer.
- [ ] Toolbar viewer punya tombol Download (anchor `download`, tetap di halaman yang sama) dan Fullscreen (requestFullscreen; fallback tab baru hanya jika API tidak tersedia — satu klik eksplisit).
- [ ] Inject XSS via konten PDF (`<img onerror>`, `<object data="javascript:...">`) ter-strip/tidak dieksekusi setelah save & render.
- [ ] `npx tsc --noEmit` dan `eslint` scoped pada file yang diubah lolos; route publik lama (`app/[slug]/page.tsx` redirect canonical) tetap bekerja.

## Edge Coverage

**Coverage:** 3/7 applicable edges resolved · 1 unresolved · 3 dismissed

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| File type validation | R1 | ✅ covered | AC: MIME salah / ekstensi bukan .pdf → 400 |
| Size limit | R1 | ✅ covered | AC: >50 MB → 400 |
| Sanitization / XSS | R7 | ✅ covered | AC: inject `<object data="javascript:...">` ter-strip |
| Fetch / serving | R4 | 🧪 backstop | Held-out test: GET `/api/uploads/documents/*.pdf` → 200 + `application/pdf` (plan-phase must_haves) |
| Multi-PDF deduplication | R5 | ⛔ dismissed | Kunci bukan duplikasi fetch viewer (viewer sudah satu instance), tapi konsistensi href — tidak perlu phantom edge ganda |
| External URL CORS/X-Frame | R3 | ⛔ dismissed | Native viewer fallback link sudah didefinisikan — tidak perlu edge terpisah |
| Unpublished article PDF access | R7 | ⛔ dismissed | Akses ikut `isPublished` artikel; guard sudah ada di `getArticleData` |
| Viewer auto-open vs inline | R4 | ⚠ UNRESOLVED | Perilaku inline tanpa klik sudah di AC, tapi edge "browser tanpa PDF plugin" butuh agreement fallback — planner treat as assumption |

## Prohibitions (must-NOT)

**Coverage:** 2/3 applicable prohibitions resolved · 1 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT embed PDF via `<object>`/`<embed>` yang diloloskan mentah oleh `sanitizeHTML` global (surface XSS) | R7 | resolved | verification: test — grep negatif `ALLOWED_TAGS` tidak mengandung `object`/`embed` |
| MUST NOT auto-open PDF di tab/popup baru tanpa klik eksplisit user | R4 | resolved | verification: judgment — code review: tidak ada `window.open`/`target=_blank` tanpa handler click |
| MUST NOT simpan PDF sebagai blob/field baru di DB selain URL di content + MediaLibrary row untuk upload | R7 | ⚠ UNRESOLVED | planner treat as assumption — butuh confirm tidak ada migration |

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Outcome spesifik: inline tanpa download/tab baru |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | In/out scope eksplisit |
| Constraint Clarity | 0.80  | 0.65 | ✓      | 50 MB, no new deps, sanitizer minimal |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 10 pass/fail checkboxes |
| **Ambiguity**      | 0.13  | ≤0.20| ✓      | Gate passed |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective    | Question summary         | Decision locked                    |
|-------|----------------|-------------------------|------------------------------------|
| 1     | Researcher     | Penempatan PDF?         | Keduanya: inline block di body + lampiran di bawah artikel |
| 1     | Researcher     | Sumber file?            | Upload baru + URL eksternal (boleh absolut) |
| 1     | Researcher     | Jumlah PDF per artikel? | Bisa beberapa (1–5, multi block) |
| 2     | Simplifier     | Versi minimal yang sukses? | Toolbar lengkap wajib: download + fullscreen, bukan viewer saja |
| 2     | Simplifier     | Batas ukuran?           | 50 MB |
| 3     | Boundary Keeper| Yang eksplisit TIDAK?   | Skip thumbnail/search/annotasi, skip perubahan schema, tanpa tab baru, skip cetak gabungan |
| 3     | Boundary Keeper| Deliverable selesai?    | Viewer + lampiran jadi & terlihat |
| 4     | Failure Analyst| Sumber inline vs lampiran — duplikat? | 1 sumber konsisten (href = data-src), tidak gandakan fetch |
| 4     | Failure Analyst| Akses PDF publik vs login? | Ikut aturan artikel (isPublished/siteId); PDF publik jika artikel publik |

---
*Phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex*
*Spec created: 2026-08-17*
*Next step: /gsd-discuss-phase 12 — implementation decisions (how to build what's specified above)*
