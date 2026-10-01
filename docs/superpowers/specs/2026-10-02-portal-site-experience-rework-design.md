# Portal & Situs Publik — Experience Rework

**Tanggal:** 2026-10-02
**Status:** Disetujui di chat (bagian 1–4); menunggu review spec tertulis
**Melanjutkan:** `2026-08-12-ui-ux-rework-design.md` (token, motion, "One newsroom, many mastheads") dan critique `.impeccable/critique/2026-08-17T03-48-03Z__app-site.md` (skor 21/40)
**Mockup keputusan:** `.superpowers/brainstorm/25545-1790874023/content/` (`portal-layout.html`, `font-pairing-v2.html`, `site-theme.html`, `sso-launch-v2.html`)

---

## 1. Tujuan & batas

### Yang diminta
Rework struktur, UI/UX, motion, dan tema untuk dua permukaan pengguna:
- **Portal SSO** (`/portal`, `/portal/app/[slug]`) — karyawan membuka aplikasi kerja setiap hari.
- **Situs publik** (`/site/[siteSlug]`, `/site/[siteSlug]/[articleSlug]`) — karyawan membaca pengumuman.

### Keputusan yang diambil (dengan mockup)
| Topik | Pilihan |
|---|---|
| Arah portal | C — tampilan home screen + `Ctrl+K` sebagai jalan pintas |
| Tata letak portal | A — sapaan → Terakhir dipakai → strip status → grid ikon per grup |
| Font | Newsreader (serif: judul & isi artikel) + Libre Franklin (sans: UI). JetBrains Mono tetap |
| Tema situs bawaan | Paper ("Edisi Pagi"), toggle tetap tersedia |
| Animasi buka app | Gabungan — zoom ikon dari grid, lalu layar "jembatan" bertahap |

### Asumsi
- Panel admin **tidak** dirombak; ikut berganti font karena token font global.
- Rute, data, dan alur login SSO **tidak berubah**. Hanya tampilan, struktur halaman, interaksi.
- Satu-satunya data baru di DB: **favorit aplikasi** (tabel `portal_user_app_pins`). Status "sudah dibaca" dan "kunjungan terakhir" disimpan di `localStorage` per perangkat.
- Tidak ada dependensi baru. Motion memakai CSS, View Transitions API bawaan browser, dan token `--motion-*` yang ada.
- Semua motion mati di `prefers-reduced-motion: reduce`.

### Kriteria sukses
- Karyawan membuka app favorit dalam 1 klik dari beranda, atau `Ctrl+K` → ketik → Enter.
- Pembaca melihat jumlah pengumuman baru sejak kunjungan terakhir tanpa membuka apa pun.
- Skor critique situs publik naik dari 21/40 (re-run `/impeccable critique` pasca rilis fase 3).
- Tidak ada regresi pada alur SSO: semua self-check `scripts/test-*.ts` yang menyentuh portal tetap lulus.

### Di luar cakupan (YAGNI)
Pencarian instan di situs (pencarian sekarang sudah jalan), breaking ticker, akun pembaca / sinkronisasi "sudah dibaca" antar perangkat, tilt 3D kartu, nomor edisi (tidak ada data sumbernya), drag-to-reorder favorit.

### Fase rilis
Tiap fase dapat dirilis sendiri dan tidak merusak fase lain.
1. **Fondasi** — font, tema per permukaan, Paper diperkaya, pembersihan.
2. **Portal** — beranda home screen, favorit, `Ctrl+K`, animasi launch.
3. **Situs publik** — Edisi Pagi, BARU/sudah dibaca, artikel (progress, TOC, share, transisi).

---

## 2. Fase 1 — Fondasi

### 2.1 Font
- `app/layout.tsx`: ganti `Inter`, `Sora`, `Lora` (next/font/google) dengan:
  - `Libre_Franklin` → variable `--font-sans` (UI, body).
  - `Newsreader` (axis `opsz`) → variable `--font-serif` (judul editorial, isi artikel, masthead).
  - `JetBrains_Mono` → tetap `--font-mono`.
- `tailwind.config.ts` `fontFamily`:
  - `sans: ["var(--font-sans)", "system-ui", "sans-serif"]`
  - `display: ["var(--font-sans)", ...]` — Sora dihapus; heading UI memakai Libre Franklin semibold/bold.
  - `serif: ["var(--font-serif)", "Georgia", "serif"]`
- `.prose-santos` di `globals.css` memakai `font-serif` untuk body artikel; ukuran body 17–18px, line-height 1.7, measure 65ch.
- Admin otomatis ikut berganti font — diterima.

### 2.2 Tema per permukaan
Masalah sekarang: kunci `localStorage` `theme` dipakai bersama oleh situs, portal, dan admin; default mengikuti OS. Tidak mungkin "situs Paper, portal Night" secara default.

Desain:
- Kunci baru: `theme:site`, `theme:portal`. Admin tetap `adminTheme`.
- `THEME_PREPAINT_SCRIPT` (`app/layout.tsx`) memilih kunci dari `location.pathname`:
  - `/site*` → `theme:site`, default **light** (Paper).
  - `/portal*` → `theme:portal`, default **dark** (Night).
  - `/admin*` → `adminTheme` (perilaku lama, default OS).
  - lainnya → perilaku lama.
- Migrasi senyap: bila kunci per-permukaan belum ada tetapi `theme` lama ada, **jangan** dipakai — default per permukaan menang (sengaja: tujuannya kesan dua edisi). Kunci lama dibiarkan untuk admin.
- `ThemeToggle.tsx` dan toggle di `PortalHeader` menulis kunci sesuai permukaan; `AdminTopbar.tsx` berhenti menulis `theme` (hanya `adminTheme`).
- Fungsi pemilih kunci diekstrak ke satu helper murni (`lib/theme-key.ts`: `themeKeyForPath(path) → {key, fallback}`) dan dipakai oleh script pre-paint (diserialisasi) dan kedua toggle. Self-check: `scripts/test-theme-key.ts`.

### 2.3 Paper diperkaya
Blok `html.theme-light` di `globals.css`:
- `--surface-0: #F5F2EA`, `--surface-1: #FFFDF8`, `--border: #DDD6C8` (lebih hangat dari nilai sekarang).
- Grain kertas: pseudo-element di `.site-paper` (kelas di layout situs) berisi SVG `feTurbulence` inline sebagai `background-image`, opacity ≈ 0.35, `mix-blend-mode: multiply`, `pointer-events: none`. Hanya di situs, tidak di admin/portal.
- Setiap pasangan teks/permukaan baru dicek AA (≥ 4.5:1 teks normal) dengan alat kontras; nilai yang gagal disesuaikan sebelum merge.

### 2.4 Pembersihan
- `app/[slug]/page.tsx`: sudah berupa redirect 38 baris (template mati telah dihapus sebelumnya) — tidak ada pekerjaan.
- Pindahkan `style={{}}` inline ke kelas token di: `components/site/ArticleHero.tsx` (21), `app/site/page.tsx` (12), `components/SitePickerCard.tsx` (10), `app/site/[siteSlug]/[articleSlug]/page.tsx` (10). Pengecualian sah: nilai dinamis dari data (warna kategori, `--site-primary` per situs) tetap inline lewat CSS custom property.
- Tambah `focus-visible:outline-*` ke semua elemen interaktif di `components/site/**`, `Navbar.tsx`, `SitePickerCard.tsx`, `AnnouncementCard.tsx`.

---

## 3. Fase 2 — Portal

### 3.1 Struktur `/portal`
Satu kolom, `max-w-[1200px]`:
1. **Sapaan** — "Selamat pagi/siang/sore/malam, {nama depan}" + tanggal lengkap (id-ID). Salam dihitung di klien (jam perangkat) dalam komponen kecil; server merender salam netral ("Halo, {nama}") untuk menghindari mismatch hidrasi, lalu klien menggantinya.
2. **Favorit** — tile aplikasi yang `pinned`. Disembunyikan bila kosong.
3. **Terakhir dipakai** — 4 app dengan `max(lastUsedAt)` terbaru dari `PortalUserAppCredential` milik user, dibatasi ke app yang tampil. Teks relatif ("2 jam lalu"). Disembunyikan bila kosong. App yang sudah ada di Favorit tidak diulang.
4. **Strip status** — "{n} normal · {n} lambat · {n} gangguan · {n} belum dicek" (segmen nol tidak ditampilkan). Klik segmen → filter grid ke status itu; klik lagi → reset. Sumber: `healthStatus` yang sudah dihitung di `app/portal/page.tsx`.
5. **Grid per grup** — judul grup kecil (uppercase, letter-spacing), tile ikon.
   - Grup dengan > 12 app dapat dilipat (`<details>`/`<summary>` native); status lipat disimpan `localStorage` `portal:collapsed:{groupId}`.
   - Kolom responsif: 3 (ponsel) → 4 (sm) → 6 (lg).

### 3.2 `AppTile` (pengganti `AppCard` di beranda)
- Ikon 56px (`logoPath` atau huruf awal di atas warna turunan hash nama — deterministik), nama 1–2 baris di bawah.
- Titik status 8px di sudut ikon: hijau (online), kuning + napas pelan (lambat), merah + napas (gangguan), abu (belum dicek). Animasi hanya untuk status bermasalah (aturan yang sudah ada).
- Tooltip (hover dan fokus keyboard): deskripsi, status + latensi, jumlah akun tersimpan, peringatan offline.
- Tombol bintang muncul saat hover/fokus tile; `aria-pressed` mencerminkan `pinned`.
- Hover: naik 2px + latar `surface-2`, `--motion-fast`.
- `AppCard.tsx` hanya dipakai `GroupedAppGrid` (beranda) — keduanya diganti `AppTile` + grid baru, lalu dihapus.

### 3.3 Favorit (data)
- Prisma: model baru `PortalUserAppPin` (`@@id([portalUserId, appId])`, `createdAt`, cascade ke `PortalUser` dan `PortalApp`), tabel `portal_user_app_pins`.
  - **Kenapa bukan kolom di `PortalUserAppVisibility`** (revisi 2026-10-02 saat menyusun rencana): `saveVisibility()` menghapus SEMUA baris visibility user setiap onboarding/reset, dan `saveVisibilityPartial(visible=true)` menghapus barisnya — favorit akan ikut hilang. Selain itu baris app `visible: true` berarti "tampilkan walau grupnya disembunyikan", jadi membuat baris hanya untuk menyimpan pin akan diam-diam membatalkan grup tersembunyi.
- Migrasi Prisma satu tabel; `version.json` `schemaVersion` 18 → 19.
- `PATCH /api/portal/apps/[id]/pin` body `{ pinned: boolean }`:
  - Sesi portal wajib (`portalAuthOptions`), 401 bila tidak.
  - `canAccessPortalApp(userId, appId)` wajib, 403 bila tidak.
  - Validasi body dengan Zod (`lib/validation-schemas.ts`).
  - `logAudit` action `PORTAL_APP_PIN` / `PORTAL_APP_UNPIN`, category `PORTAL`.
- UI optimistik; rollback + toast bila request gagal.

### 3.4 Command palette `Ctrl+K` / `/`
- `<dialog>` native (fokus terkunci, Esc menutup bawaan browser). Pemicu: `Ctrl+K`/`Cmd+K` di mana saja; `/` bila fokus bukan di input. Tombol pencarian terlihat di `PortalHeader` dengan label kbd.
- Data: daftar app yang sudah dirender di beranda (diteruskan sebagai props), tidak ada fetch tambahan. Palette hanya aktif di beranda `/portal`; tombol pencarian di `PortalHeader` pada halaman lain menavigasi ke `/portal?cari=1` yang membuka palette saat mount. (Palette global di semua halaman portal ditunda sampai ada kebutuhan — butuh endpoint daftar app baru.)
- Pencarian: fungsi murni `rankApps(query, apps)` di `lib/portal-home.ts` — skor substring (awal kata > tengah) atas nama, kategori, nama grup; tanpa library. Query kosong → Favorit + Terakhir dipakai. Self-check: `scripts/test-portal-home.ts`.
- Keyboard: ↑/↓ memindah, Enter membuka, `aria-activedescendant` pada listbox.
- Grid beranda: semua tile tetap bisa di-Tab; tombol panah memindah fokus antar tile dalam satu grid, Enter membuka.

### 3.5 Animasi buka aplikasi (zoom → jembatan)
**Zoom (lintas halaman):**
- `globals.css`: `@view-transition { navigation: auto; }`. Ini hanya berlaku untuk navigasi dokumen penuh, jadi tile app dan kartu artikel memakai `<a href>` biasa (bukan `next/link`). Halaman launch dan artikel sama-sama `force-dynamic`, jadi prefetch yang hilang tidak berarti.
- `view-transition-name` dipasang **saat klik** pada elemen yang diklik saja — app yang sama bisa tampil di Favorit, Terakhir dipakai, dan beberapa grup sekaligus, dan nama ganda membatalkan transisi.
- `AppTile` memberi `view-transition-name: app-{slug}` pada ikon. Halaman launch memberi nama yang sama pada ikon kanan jembatan → browser menganimasikan perpindahan.
- Browser tanpa dukungan: navigasi biasa, tanpa efek. Tidak ada polyfill.
- `prefers-reduced-motion`: `::view-transition-group(*) { animation: none; }`.

**Jembatan (`components/portal/LaunchBridge.tsx`):**
- Logo portal → garis koneksi (mengisi kiri ke kanan) → ikon app; judul "Membuka {app}", baris "Masuk sebagai {username}".
- Props: `steps: { label; state: "pending" | "active" | "done" | "error" }[]`, `onRetry`, `manualHref`.
- Dipakai oleh `SSOAutoSubmit`, `SSOPostSubmit`, `SSORerouteSubmit`, `SSORedirectHandoff` — menggantikan `sso-rings-container`. Tahapan jujur per mode:
  - Revisi 2026-10-02: komponen launch hanya mengirim form ke server (tidak ada fetch bertahap di klien), jadi klien hanya tahu dua keadaan nyata. Tahapan dibuat dua langkah agar jujur:
  - FORM: Menyiapkan → Mengirim login ke {app}.
  - POST / REROUTE: Menyiapkan → Portal masuk ke {app}.
  - REDIRECT: Menyiapkan → Mengalihkan ke {app}.
- Gagal: tahap aktif menjadi `error` (merah), muncul "Coba lagi" dan "Buka manual" (perilaku fallback yang sudah ada dipertahankan).
- Tidak ada jeda buatan; submit tetap segera seperti sekarang.
- CSS `sso-rings-*` dan `sso-glow-pulse`/`sso-ring-spin` di `globals.css` dihapus bila tidak ada pemakai lain.

### 3.6 Tema portal
Night (default). Latar sapaan: gradien mesh radial `--accent` + biru info, opacity rendah, bergeser sangat pelan (`--motion-ambient`), statis di reduced-motion.

---

## 4. Fase 3 — Situs publik (Edisi Pagi)

### 4.1 Halaman depan `/site/[siteSlug]`
1. **Strip edisi** (komponen klien `EditionStrip`): tanggal lengkap · "Edisi Pagi" (06:00–17:59) / "Edisi Malam" · "{n} baru sejak kunjungan terakhir" (disembunyikan bila 0 atau kunjungan pertama).
   - `lastVisit` per situs di `localStorage` `site:{slug}:lastVisit`; dibaca saat mount, diperbarui saat `pagehide` (sehingga kunjungan berjalan tetap menampilkan badge).
2. **Masthead**: nama situs dengan Newsreader 700, garis ganda bawah, aksen `--site-primary`.
3. **FrontPage** (komponen yang ada) ditambah:
   - Garis progress 3px warna `--site-primary` di bawah media lead; animasi `ROTATE_MS`; berhenti saat jeda/hover/fokus (state yang sudah ada).
   - Ken Burns: `scale 1 → 1.06` selama durasi slide pada gambar lead (bukan video).
   - Judul lead masuk dengan `cine-rise` tertunda 120ms setelah media (pemecahan per baris ditunda: butuh pengukuran baris di klien untuk efek yang kecil).
4. **Feed dengan pembatas waktu**: "Hari ini" / "Minggu ini" / "Sebelumnya", dikelompokkan dari `createdAt` saat render server (zona waktu `Asia/Jakarta`). Pagination tetap.
5. **BARU / sudah dibaca** (komponen klien kecil pada kartu):
   - Dibaca: daftar ID artikel di `localStorage` `site:{slug}:read` (maks 200, FIFO); ditulis saat halaman artikel dibuka.
   - Kartu dibaca: judul `text-text-3`. Kartu dengan `createdAt > lastVisit` dan belum dibaca: badge "BARU".
   - Semua akses `localStorage` dalam try/catch; tanpa storage, tampilan default (tanpa badge, tanpa redup).
   - Logika murni (`isNew`, `pushRead`) di `lib/reading-state.ts`; self-check `scripts/test-reading-state.ts`.

### 4.2 Halaman artikel
- **Progress baca**: bar 2px `--site-primary` fixed di atas viewport, dari scroll posisi konten artikel; label "sisa {n} menit" dari `wordCount` × sisa proporsi. Satu jalur: listener scroll pasif + `requestAnimationFrame` (label menit butuh JS juga, jadi jalur CSS scroll-timeline tidak menghemat apa pun).
- **Daftar isi**: dibangun klien dari h2/h3 di `.prose-santos` (menambah `id` slug bila belum ada). Tampil bila ≥ 3 heading: kolom melayang di ≥ lg, tombol "Daftar isi" di bawahnya membuka `<dialog>`. Item aktif disorot via `IntersectionObserver`.
- **Navbar auto-hide** (berlaku di seluruh situs, karena `Navbar` dipakai layout situs): `Navbar.tsx` menyembunyikan diri saat scroll turun > 80px, muncul saat scroll naik; tidak pernah sembunyi saat fokus berada di dalam navbar.
- **Bagikan**: tombol WhatsApp (`https://wa.me/?text={judul}%20{url}`) + salin tautan (`navigator.clipboard` dengan fallback `execCommand`, pola sama dengan `SSOCredentialVault`).
- **Metadata OG**: tambah `generateMetadata` di `app/site/[siteSlug]/[articleSlug]/page.tsx` — `title`, `description` (excerpt), `openGraph.images` (imagePath / thumbnail YouTube), `openGraph.type: "article"`, canonical dari junction `isPrimary`.
- **Transisi kartu → artikel**: `view-transition-name: story-{id}` pada media kartu dan hero artikel (mekanisme sama dengan portal).

---

## 5. Aksesibilitas & motion (berlaku semua fase)
- Semua animasi baru dibungkus `@media (prefers-reduced-motion: no-preference)` atau dimatikan di blok reduce global yang sudah ada.
- Rotasi hero tetap punya tombol jeda (WCAG 2.2.2).
- Setiap elemen interaktif baru punya `focus-visible` dan nama aksesibel.
- Badge "BARU" dan titik status tidak mengandalkan warna saja: badge berteks, status punya teks di tooltip dan `aria-label`.
- Kontras AA dicek untuk setiap token warna baru di Paper dan Night.

## 6. Penanganan error
- `localStorage` tidak tersedia/penuh → fitur per-perangkat (BARU, dibaca, lipat grup, lastVisit) nonaktif diam-diam; halaman tetap benar.
- PATCH pin gagal → rollback optimistik + toast "Gagal menyimpan favorit".
- View Transitions tidak didukung → navigasi biasa.
- Launch gagal → `LaunchBridge` menandai tahap error, tombol coba lagi / buka manual.

## 7. Verifikasi
- Self-check baru (pola `scripts/test-*.ts` repo, tanpa framework): `test-theme-key.ts`, `test-portal-home.ts` (ranking, favorit, hitungan status, pintasan keyboard), `test-reading-state.ts`.
- Self-check portal yang ada tetap lulus.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Uji manual per fase di browser (Chromium + Firefox): portal grid, `Ctrl+K`, pin, launch tiap mode SSO (FORM/POST/REROUTE/VAULT/REDIRECT), situs Paper, BARU/dibaca, artikel (progress, TOC, share, OG via validator), reduced-motion on/off.
- Pasca fase 3: re-run `/impeccable critique` untuk situs publik, bandingkan dengan 21/40.
