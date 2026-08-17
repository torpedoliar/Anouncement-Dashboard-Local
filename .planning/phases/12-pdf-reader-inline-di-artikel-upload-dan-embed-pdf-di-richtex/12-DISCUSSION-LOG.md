# Phase 12: pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex
**Areas discussed:** Editor upload & sisip PDF (toolbar, label, multi), Viewer inline + toolbar, Daftar lampiran di bawah artikel, Sanitasi & serving aman

---

## Editor upload & sisip PDF (toolbar, label, multi)

| Option | Description | Selected |
|--------|-------------|----------|
| Satu tombol FilePdf + dropdown dua pilihan | Dropdown kecil di ikon FilePdf: pilih Upload PDF atau Sisipkan via URL. Konsisten dengan Image/Youtube. | ✓ |
| Dua tombol terpisah | Dua tombol terpisah di toolbar: FilePdf (upload) + LinkPdf (URL). | |
| Fokus upload saja | Cukup upload dulu; URL eksternal fase berikut. | |

**User's choice:** Satu tombol FilePdf + dropdown dua pilihan
**Notes:** Menjaga toolbar tetap klir; konsisten affordance Image/Youtube.

---

## Saat upload PDF berlangsung — kapan blok div[data-pdf] muncul?

| Option | Description | Selected |
|--------|-------------|----------|
| Blok optimistik | Tampilkan blok placeholder dulu dengan nama file, upload background, ganti src saat sukses; gagal -> blok merah + pesan. | ✓ |
| Blok hanya setelah upload sukses | Dialog upload muncul -> blok hanya dibuat bila upload 201. | |

**User's choice:** Blok optimistik
**Notes:** Memenuhi R2 acceptance: blok muncul, drag/hapus bisa, optimistic UX.

---

## Judul/filename pada blok Pdf — diisi bagaimana?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto dari filename / URL basename | Otomatis isi dari nama file upload (basename) atau basename URL eksternal, tanpa dialog tambahan. | ✓ |
| Dialog judul opsional | Dialog kecil Judul/Lampiran (opsional) muncul saat upload/URL. | |

**User's choice:** Auto dari filename / URL basename
**Notes:** Ringkas, memenuhi data-filename di R2 tanpa friction.

---

## Jumlah PDF per artikel — perlu batas hard di editor?

| Option | Description | Selected |
|--------|-------------|----------|
| Tanpa batas hard | Biarkan editor sisipkan sebanyak yang diinginkan; viewer render semua dan lampiran didedup. | ✓ |
| Batas 5 blok di editor | Tombol upload disable setelah 5 blok Pdf di konten. | |

**User's choice:** Tanpa batas hard
**Notes:** Wajar 1-5 per SPEC; dedup di viewer/lampiran menangani kelebihan — konten adalah array, tidak di-hard-block.

---

## Viewer inline + toolbar

| Option | Description | Selected |
|--------|-------------|----------|
| <object> primer + <iframe> fallback | Pakai <object type='application/pdf' data={src}> lalu <iframe> sebagai fallback; tinggi 600/480, radius 8, lebar 100%. | ✓ |
| <iframe> saja | Langsung <iframe src={src}> sebagai viewer default. | |

**User's choice:** <object> primer + <iframe> fallback
**Notes:** Native viewer, tanpa pdfjs-dist.

---

## Toolbar viewer berisi apa?

| Option | Description | Selected |
|--------|-------------|----------|
| Download + Fullscreen di header overlay | Bar kecil di atas viewer: Download (anchor download) + Fullscreen (requestFullscreen; fallback buka src di tab baru hanya bila API tidak tersedia). | ✓ |
| Hanya Download | Hanya Download anchor di atas, tanpa Fullscreen. | |

**User's choice:** Download + Fullscreen di header overlay
**Notes:** Keyboard reachable; fallback fullscreen hanya bila API unavailable.

---

## Ukuran viewer di halaman artikel?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 600/480 | Tinggi fixed 600px desktop / 480px mobile, lebar 100%, border radius 8px di viewer. Konsisten dengan SPEC. | |
| Dinamis (responsive tinggi) | Tinggi dinamis tergantung konten / rasio viewer (mis. 50vh). Lebih fleksibel di mobile pendek. | ✓ |

**User's choice:** Dinamis (responsive tinggi)
**Notes:** Berbeda dari SPEC fixed 600/480. Planner harus guard AC tinggi — perlakukan sebagai assumption/override yang harus diverifikasi; acceptable bila responsive tetap lolos AC viewer terlihat inline tanpa klik.

---

## Bila PDF tidak bisa di-iframe (CORS/X-Frame block)?

| Option | Description | Selected |
|--------|-------------|----------|
| Paragraf + link Download di viewer | Di dalam viewer: paragraf + <a href download> 'Unduh PDF' — tanpa auto window.open/redirect. | ✓ |
| Fallback hanya di lampiran bawah | Hanya link fallback di daftar lampiran di bawah, tanpa fallback inline di viewer. | |

**User's choice:** Paragraf + link Download di viewer
**Notes:** Menutup kasus X-Frame/CORS block inline; lampiran bawah tetap ada sebagai source sekunder.

---

## Daftar lampiran di bawah konten — bentuknya?

| Option | Description | Selected |
|--------|-------------|----------|
| Blok Lampiran list + Download | Di bawah konten, di atas syndication/comments: heading 'Lampiran', daftar nama file + tombol Download (href sama persis data-src). Dedup urut kemunculan. | ✓ |
| Tanpa blok lampiran | Tidak ada blok lampiran — cukup viewer inline saja. | |
| Embed duplikat di lampiran | Lampiran ikut menampilkan toolbar viewer kedua (embed PDF lagi di bawah), bukan hanya link. | |

**User's choice:** Blok Lampiran list + Download
**Notes:** Bukan embed duplikat — hemat fetch, 1 sumber; memenuhi R5.

---

## Label & visibilitas lampiran?

| Option | Description | Selected |
|--------|-------------|----------|
| Nama = data-filename atau basename src, dedup | Nama dari data-filename kalau ada, fallback basename data-src. List dedup; artikel tanpa PDF -> tidak render bagian lampiran sama sekali. | ✓ |
| Selalu tampilkan heading lampiran | Selalu tampilkan judul 'Lampiran' walau tanpa PDF (kosong). | |

**User's choice:** Nama = data-filename atau basename src, dedup
**Notes:** Dedup & invisible bila tanpa PDF memenuhi AC lampiran section.

---

## Penyesuaian sanitizeHTML — seberapa longgar?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal div[data-pdf] + dua attr | Perluas ALLOWED_TAGS/ATTR minimal hanya untuk div[data-pdf] + data-src + data-filename; ALLOW_DATA_ATTR tetap false atau FORBID_ATTR on*. | ✓ |
| ALLOW_DATA_ATTR true global | Aktifkan ALLOW_DATA_ATTR true secara global — paling longgar. | |

**User's choice:** Minimal div[data-pdf] + dua attr
**Notes:** JANGAN whitelist object/embed global (XSS surface) — constraint dari SPEC.

---

## Serving PDF di /api/uploads/[...path] + guard?

| Option | Description | Selected |
|--------|-------------|----------|
| MIME + guard + ikut artikel | Tambah 'pdf: application/pdf' di MIME_TYPES; path resolve+guard (.. / \0 ditolak); akses ikut isPublished artikel (publik bila published). | ✓ |
| Layan via /api/media saja | PDF dilayani lewat /api/media langsung (bypass /api/uploads). | |

**User's choice:** MIME + guard + ikut artikel
**Notes:** Tanpa auth terpisah fase ini — ikut aturan isPublished artikel.

---

## Claude's Discretion

- Detail styling viewer/lampiran (radius 8, warna toolbar, responsive query).
- Urutan render lampiran exact dedup (Set vs array).
- Dialog URL eksternal validasi detail (https? + .pdf ext exact).

## Deferred Ideas

None — discussion stayed within phase scope (in-scope/out-of-scope sudah terkunci di SPEC).

---
*Phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex*
*Discussion gathered: 2026-08-17*
