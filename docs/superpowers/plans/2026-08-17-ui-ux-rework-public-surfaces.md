# UI/UX Rework — Public & Portal-User Surfaces

**Dibuat:** 2026-08-17
**Status:** Rencana ditulis, **belum dieksekusi**
**Base commit untuk source:** `24af9a3` (== `origin/main`). Semua nomor baris di dokumen ini merujuk ke commit itu.
**HEAD lokal saat penulisan:** `8f36770` — hanya menambah `.planning/` (ROADMAP, STATE, 12-SPEC), **tanpa perubahan source**, jadi tidak mempengaruhi rencana ini.
**Sumber temuan:** `.impeccable/critique/2026-08-17T03-48-03Z__app-site.md` (skor 21/40, 3×P0, 5×P1)

> **Koordinasi dengan track phase-12 (PDF reader inline).** `8f36770` memperkenalkan spec yang akan mengubah **`app/site/[siteSlug]/[articleSlug]/page.tsx`** — file yang sama dengan T2.2, T2.3, dan T4 di sini — serta menambahkan viewer PDF ke dalam konten yang dirender lewat `dangerouslySetInnerHTML`, tepat di tempat T2.3 mengganti class body menjadi `prose-santos`. **Selesaikan T2 sebelum phase-12 mulai**, atau sepakati satu pemilik file lebih dulu. Bila phase-12 jalan lebih dulu, T2.3 harus memastikan blok PDF ikut mewarisi gaya `.prose-santos` dan tidak terpotong oleh `max-width: 72ch`.

## Hubungan dengan roadmap fase admin

Ini **track terpisah** dari `phase0..phase3` yang sudah ada (design system → shell → content desk → data surfaces). Track itu menggarap `app/admin/**`. Rencana ini menggarap permukaan yang dilihat **user akhir**:

1. Pemilihan artikel — `app/site`, `app/site/[siteSlug]`, `app/site/[siteSlug]/search`
2. Halaman artikel — `app/site/[siteSlug]/[articleSlug]`, `app/[slug]`
3. Portal SSO — `app/portal*`, `components/portal/**`

**Jangan** sentuh `app/admin/**`, `components/admin/**`, atau `components/ui/**` kecuali disebut eksplisit di sebuah task (hanya T1 dan T7 yang menyentuhnya, dengan ruang lingkup sempit).

---

## Temuan struktural yang mendasari semua task

Diverifikasi lewat grep pada base commit. Baca ini dulu sebelum task apa pun.

**1. `middleware.ts` me-redirect `/` → `/site` tanpa syarat** (matcher memuat `'/'`). Konsekuensi: `app/page.tsx` **tidak pernah dirender**, sehingga `components/HeroSection.tsx` (605 baris, importer tunggalnya `app/page.tsx`) adalah kode mati.

**2. Portal disiplin, surface publik tidak.** Hitungan pada base commit:

| Sinyal | Surface publik | `components/portal/**` + `app/portal*` |
|---|---|---|
| inline `style={{` | 230 (18 file) | 0 |
| hex hardcoded | 64 (15 file) | 0 |
| `focus-visible` | 0 | 42 |

Karena inline style tak bisa menyatakan `:hover`/`:focus`/media query, **setiap** hover di surface publik diimplementasikan sebagai mutasi DOM lewat `onMouseOver`/`onMouseOut`, dan tidak satu pun punya padanan fokus keyboard. Ini akar dari sebagian besar temuan a11y dan responsif.

**3. `.prose-santos` sudah lengkap di `app/globals.css` tapi tak terpakai.** Body artikel memakai `className="article-content"` yang **nol match CSS** di seluruh repo.

**4. Token yang gagal WCAG AA** (dihitung dari nilai sebenarnya):

| Pasangan | Rasio | Dipakai di |
|---|---|---|
| `--text-3` `#71717A` di `--surface-1` `#111113` | **3.93:1** | label 12px: `AppCard`, `AccountSelector`, label field SSO, `portal-login` |
| putih di `--accent` `#ED1C24` | **4.38:1** | semua `Button` variant primary, CTA portal |
| `text-accent` di `bg-accent-subtle` | **≈4.12:1** | nav item aktif, chip filter aktif |
| `#666` di `#0a0a0a` | **3.45:1** | baris tanggal/view di setiap card |

---

## Batasan global (mengikat semua task)

- **Tailwind tetap v3.** Jangan ubah `postcss.config.mjs`, versi `tailwindcss`, atau `tailwind.config.ts` selain menambah token bila perlu.
- **Jangan sentuh `.env`.** `NEXTAUTH_URL` kosong itu disengaja. Untuk build, override lewat environment shell saja (lihat Gate verifikasi).
- **Token, bukan hex.** Target akhir surface publik: nol hex hardcoded kecuali warna dari DB (`site.primaryColor`, `category.color`) yang memang harus inline.
- **Setiap state hover wajib punya padanan `focus-visible`.** Ganti `onMouseOver`/`onMouseOut` dengan class Tailwind, jangan tambah handler baru.
- **Multi-site adalah domain inti.** Jangan asumsikan satu site per announcement; scope lewat `sites.some({ siteId })`, ambil primary dari junction.
- **Tanpa perubahan skema Prisma.** Tidak ada migration di rencana ini.
- **Tanpa perubahan auth/RBAC.** Gate tulis tetap lewat `lib/site-access.ts`.
- **Minimum tinggi interaktif 44px** di semua surface yang disentuh.
- **Reduced motion dihormati** (`--motion-fast`/`--motion-standard`/`--motion-ease` sudah ada).
- Ikon: surface publik masih `react-icons/fi` — **biarkan**. Migrasi Phosphor adalah track admin, jangan campur ke sini.
- Commit message **bahasa Indonesia**, satu commit per task, hanya file milik task itu.

## Gate verifikasi

Tidak ada dev server dan tidak ada Postgres lokal di environment ini. Verifikasi bersifat statis:

```powershell
npx tsc --noEmit
npx eslint <file-yang-diubah>
npm run audit:tokens
$env:NEXTAUTH_URL="http://localhost:3000"; npm run build
```

**Koreksi terhadap handoff fase sebelumnya:** `npm run build` **tidak** lagi terblokir. Dengan `NEXTAUTH_URL` di-override di shell, build sukses sampai `Generating static pages (58/58)`. Tanpa override, build gagal di `/portal-login` dengan `TypeError: Invalid URL`. Jangan "perbaiki" `.env` untuk mengatasi ini.

Setelah setiap task: `npx tsc --noEmit` harus exit 0. Setelah task terakhir: build harus sukses dan jumlah halaman statis tidak turun tanpa alasan yang dijelaskan.

---

# Task

## T1 — Hapus kode mati & reduksi route legacy

**Kenapa pertama:** menghapus ~900 baris yang tidak pernah dieksekusi mencegah task berikutnya memperbaiki file yang seharusnya hilang.

**Hapus (nol importer, efek user nol):**

| File | Bukti |
|---|---|
| `components/HeroSection.tsx` | importer tunggal `app/page.tsx`, yang tak terjangkau karena middleware |
| `components/SiteHero.tsx` | nol importer |
| `components/SkeletonCard.tsx` | nol importer |
| `components/ReadingTime.tsx` | nol importer |
| `app/page.tsx` | `/` di-redirect ke `/site` oleh `middleware.ts` |

**Reduksi `app/[slug]/page.tsx`** dari ~450 baris menjadi hanya resolver + redirect:

- Pertahankan `getCanonicalSitePath()` dan `redirect(canonical)` apa adanya. Route ini masih menerima tautan legacy.
- Untuk artikel **tanpa** relasi site (orphan): `redirect("/site")`, **bukan** `notFound()`. Keputusan user — tidak boleh ada artikel yang jadi 404.
- Hapus: `getAnnouncement`, `getRelatedAnnouncements`, `getSettings`, `calculateReadingTime`, seluruh JSX, dan semua import yang jadi tak terpakai (`Navbar`, `Footer`, `AnnouncementCard`, `CommentSection`, `Image`, `Link`, `formatDate`, ikon `Fi*`, `ArticleVideoPlayer`, `notFound`).
- Pertahankan `export const dynamic = "force-dynamic"` beserta komentarnya — redirect butuh data segar.

**Catatan orphan (tidak bisa diverifikasi dari environment ini — tanpa akses DB).** API create selalu melampirkan minimal satu site, jadi artikel baru tak mungkin orphan; risikonya hanya baris lama pra-migrasi. Karena orphan di-redirect (bukan 404), tidak ada kehilangan konten meski orphan ada. Bila ingin angka pastinya, jalankan di lingkungan yang punya DB:

```sql
SELECT COUNT(*) FROM announcements a
WHERE NOT EXISTS (SELECT 1 FROM announcement_sites s WHERE s.announcement_id = a.id);
```

**Field hero global di admin Settings.** `app/page.tsx` adalah satu-satunya konsumen `Settings.heroTitle`, `heroSubtitle`, `heroImage`. Setelah dihapus, ketiga kontrol itu tidak mempengaruhi apa pun. **Hapus ketiga input dari form** di `app/admin/settings/page.tsx` (ruang lingkup admin yang diizinkan di task ini). **Jangan** hapus kolom DB dan jangan buat migration — halaman per-site memakai `SiteSettings.heroTitle` dst. yang berbeda. Tinggalkan komentar satu baris di form yang menyebut kolom global sengaja tidak dipakai.

Lokasi terverifikasi di `app/admin/settings/page.tsx`:

| Baris | Isi | Tindakan |
|---|---|---|
| 11-13 | field `heroTitle`/`heroSubtitle`/`heroImage` pada interface | Pertahankan (bentuk respons API tidak berubah) |
| 437-439 | nilai default pada state | Pertahankan |
| 498 | `field: "logoPath" \| "heroImage"` pada handler upload | **Sempitkan** menjadi `"logoPath"` saja. Handler ini **dipakai bersama** dengan logo — jangan hapus handler-nya |
| 775-776, 785-786, 793-805 | input judul, subjudul, dan uploader gambar hero | **Hapus blok input-nya** |

**Verifikasi:** `npx tsc --noEmit` exit 0. `grep -r "HeroSection\|SiteHero\|SkeletonCard\|ReadingTime"` pada `app/` dan `components/` (kecualikan `graphify-out/`) harus nol hasil. Build sukses; jumlah route berkurang tepat satu (`/`).

**Commit:** `chore(public): hapus surface mati dan reduksi route slug legacy`

---

## T2 — P0 responsif & aksesibilitas

Tiga bug yang merusak di perangkat mayoritas. Kerjakan sebagai satu task karena ketiganya menyentuh file yang sama.

### T2.1 Overflow grid di bawah 398px

`gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))"` di dalam container `padding: 0 24px`:

| File | Baris (base commit) |
|---|---|
| `app/site/[siteSlug]/page.tsx` | 161 |
| `app/site/page.tsx` | 120 |
| `app/site/[siteSlug]/search/page.tsx` | 190 |

Di viewport 360px, content box = 312px, sedangkan track tidak bisa menyusut di bawah 350px → halaman scroll horizontal dan teks card terpotong. Ganti ketiganya menjadi:

```
repeat(auto-fill, minmax(min(350px, 100%), 1fr))
```

### T2.2 Tombol "Kembali" tertimbun navbar

`Navbar` = `position: fixed; zIndex: 200; height: 80px`. `app/site/[siteSlug]/[articleSlug]/page.tsx:122` merender `<nav>` kedua di `position: sticky; top: 0; zIndex: 100` yang memuat satu-satunya link "Kembali ke {site.name}" (baris 141). `app/site/[siteSlug]/search/page.tsx` punya konstruksi identik.

- Hapus kedua blok `<nav>` lokal itu (dua landmark `<nav>` per halaman, satu mati secara visual).
- Tambahkan prop opsional ke `Navbar`: `backHref?: string; backLabel?: string`. Bila ada, render di kiri (sebelum logo) memakai `FiArrowLeft` yang sudah dipakai, tinggi target ≥44px.
- Teruskan dari `app/site/[siteSlug]/layout.tsx`. Layout tidak tahu ini halaman artikel atau bukan, jadi cara paling bersih: render back link **di dalam `ArticleHero`** di atas badge kategori, di mana z-index-nya sah. Pilih salah satu, jangan dua-duanya.

### T2.3 Body artikel tanpa tipografi + link tak terlihat

`app/site/[siteSlug]/[articleSlug]/page.tsx:166` — `className="article-content"` (nol match CSS) dengan tiga properti inline (`fontSize: 17px`, `lineHeight: 1.8`, `color: #e0e0e0`).

- Ganti class menjadi `prose-santos`, hapus ketiga properti inline. `.prose-santos` sudah menyetel `color: var(--text-2)`, `max-width: 72ch`, ritme paragraf 1.5em, `text-wrap: pretty`, dan `a { color: var(--accent) }`.
- Di `app/globals.css`, tambahkan `text-decoration: underline` pada rule `.prose-santos a` yang sudah ada. **Alasan wajib:** ada `a { color: inherit; text-decoration: none }` global, dan `SiteThemeProvider` hanya memulihkan warna pada `a:not([class]):hover` — sehingga saat ini setiap hyperlink di dalam artikel tampil sebagai teks biasa dan hanya terungkap saat hover, yang tak pernah terjadi di layar sentuh. WCAG 1.4.1.
- Tambahkan margin atas pada `.prose-santos h2, h3, h4` (heading global `h1..h6` tidak punya margin, jadi heading artikel menempel ke paragraf di atasnya).

### T2.4 Hero artikel memakan 94% viewport

`components/site/ArticleHero.tsx:60-61` — `height: "85vh"; minHeight: "600px"`. Di 360×640 floor 600px yang menang. Ganti dengan `height: min(55vh, 420px)` tanpa `minHeight`. Target: dua baris pertama isi artikel terlihat tanpa scroll di 360×640.

Tambahkan `preload="none"` dan atribut `poster` pada video hero. Paint pertama harus gambar, bukan unduhan video.

### T2.5 Skip link menuju target kosong

`components/Navbar.tsx:63` — `href="#news"`, sedangkan `id="news"` hanya ada di `app/page.tsx` (dihapus di T1). Ganti menjadi `href="#main-content"` dan tambahkan `id="main-content"` pada `<main>` di `app/site/[siteSlug]/layout.tsx`. Tambahkan juga `scroll-margin-top: 80px` agar target tidak berhenti di belakang navbar fixed.

### T2.6 Carousel tak bisa dijeda tanpa mouse

`components/FullscreenHero.tsx` menjeda hanya pada `onMouseEnter`/`onMouseLeave`. User keyboard dan sentuh tidak punya cara menghentikan rotasi 6 detik. WCAG 2.2.2.

- Tambahkan tombol pause/play terlihat di kelompok kontrol yang sudah ada, dengan `aria-label` yang berubah sesuai state.
- Tambahkan `onFocus`/`onBlur` pada `<section>` yang menjeda sama seperti mouse.
- Indikator saat ini `height: 0.25rem` (4px) — target sentuh mustahil. Bungkus bar 4px dalam tombol berpadding transparan sehingga area klik ≥44×44px sementara bar visual tetap 4px.
- Ganti `transition: width` menjadi `transform: scaleX()` (satu-satunya temuan detector: `layout-transition` di `FullscreenHero.tsx:198`).
- Hapus `role="img" aria-label={current.title}` pada div background (baris ~110): judul yang sama sudah ada di `<h1>` tepat setelahnya, jadi screen reader membacanya dua kali. Ganti `aria-hidden="true"`.

**Verifikasi:** tsc + eslint bersih. Grep memastikan nol `minmax(350px, 1fr)`, nol `article-content`, nol `85vh` di file target. Build sukses.

**Commit:** `fix(public): perbaiki overflow mobile, back link, tipografi artikel, jeda carousel`

---

## T3 — Migrasi token Navbar & Footer + state fokus

`components/Navbar.tsx` dan `components/Footer.tsx` adalah chrome yang muncul di **setiap** halaman publik, jadi ini punya leverage terbesar per baris yang diubah.

**Masalah A — handler hover menimpa token dengan hex permanen.** `Navbar.tsx:147-154` mulai dari `var(--text-secondary)` lalu `onMouseOut` menulis `#a3a3a3`. `Footer.tsx` menulis `#333` dan `#737373`. Nilai-nilai itu tidak ada di `globals.css` (`--text-2` = `#A1A1AA`, `--text-3` = `#71717A`), jadi hover menggeser warna secara terlihat **dan** memutus elemen dari token secara permanen setelah hover pertama.

Hapus setiap `onMouseOver`/`onMouseOut` di `Navbar.tsx`, `Footer.tsx`, `SitePickerCard.tsx`. Ganti dengan class, mengikuti pola yang sudah dipakai `components/portal/PortalHeader.tsx`:

```
text-text-2 hover:text-text-1 focus-visible:text-text-1
border-b-2 border-transparent hover:border-accent
```

**Masalah B — navbar melukis layout desktop di first paint mobile.** `Navbar.tsx:22` `useState(false)` lalu baris 50 `const showDesktopNav = mounted ? isDesktop : true;`. Di halaman site, `customLinks` menghasilkan 7 item pada `gap: 40px` ≈ 700px di container 312px → overflow, lalu snap ke hamburger setelah hydration.

Hapus state `isDesktop` dan guard `mounted`. Render kedua cabang tanpa syarat, kendalikan visibilitas dengan `hidden lg:flex` / `lg:hidden`. `app/globals.css` sudah memuat komentar panjang yang mendokumentasikan bug `isDesktop`-default-`true` yang sama beserta perbaikannya untuk shell admin — ikuti pendekatan itu. Pertahankan state `isScrolled` (itu perilaku sah, bukan breakpoint).

**Masalah C — link default `Navbar` sudah rusak.** Default-nya `/`, `/#news`, `/search`. `/` sekarang redirect, dan `#news` hilang di T1. Ganti default menjadi `[{ href: "/site", label: "BERANDA" }]` saja; halaman site tetap mengoper `customLinks` sendiri.

**Masalah D — hamburger tanpa nama aksesibel.** `Navbar.tsx:167-176` tidak punya `aria-label` maupun `aria-expanded`. Tambahkan keduanya (`PortalHeader.tsx:99-101` sudah benar — ikuti).

**Masalah E — heading order.** `Footer.tsx` memakai `<h4>` untuk "TAUTAN" dan `NewsletterSubscribe` memakai `<h4>` untuk "NEWSLETTER", tanpa `<h3>` di atasnya. Naikkan ke `<h2>`.

**Verifikasi:** tsc + eslint. Grep: nol `onMouseOver`/`onMouseOut` dan nol hex di `Navbar.tsx`/`Footer.tsx`. `npm run audit:tokens` tidak menurun.

**Commit:** `refactor(public): navbar & footer token-native, hapus hover DOM, perbaiki breakpoint`

---

## T4 — Satu komponen card

Saat ini ada **empat** implementasi card artikel. Hanya `AnnouncementCard.tsx` yang benar (`next/image` + `alt` + aspect ratio); tiga yang lain adalah div inline dengan `backgroundImage` tanpa alt.

| Lokasi | Bentuk sekarang |
|---|---|
| `components/AnnouncementCard.tsx` | `next/image`, `alt={title}`, `aspectRatio: 16/10` — **basis yang dipakai** |
| `app/site/[siteSlug]/page.tsx:~186` | div `backgroundImage`, `height: 180px`, tanpa alt |
| `app/site/[siteSlug]/search/page.tsx:~207` | div `backgroundImage`, `height: 180px`, tanpa alt |
| `app/site/[siteSlug]/[articleSlug]/page.tsx:~252` | div `backgroundImage`, `height: 140px`, tanpa alt (grid artikel terkait) |

Jadikan `AnnouncementCard` satu-satunya, dipakai di ketiga tempat. Perubahan yang diperlukan:

- **Href harus site-scoped.** Saat ini `href={`/${slug}`}` → memicu hop redirect lewat `app/[slug]`. Tambahkan prop `siteSlug` dan hasilkan `/site/${siteSlug}/${slug}`. Pertahankan mode tanpa `siteSlug` hanya jika masih ada pemanggil global setelah T1/T6 — bila tidak ada, jadikan prop wajib.
- **Urutan baca:** kategori → judul → excerpt → tanggal. Sekarang baris meta (jam + tanggal + mata + view) berada **di atas** judul, sehingga mata pembaca mendarat di "12 Mar 2024 · 47 views" sebelum headline. Pindahkan meta ke bawah excerpt.
- **Buang `viewCount` dari card.** Popularitas pengumuman internal bukan informasi yang dipakai pembaca untuk memutuskan. Prop-nya dihapus, bukan disembunyikan.
- **Badge kategori keluar dari gambar**, letakkan di atas judul supaya kedekatan mengikat label ke objeknya.
- **Ganti placeholder `SJA`** (string literal 32px) dengan blok bertoken tanpa teks, atau logo site bila tersedia.
- **Pertahankan** dukungan thumbnail video yang ditambahkan `24af9a3` (thumbnail YouTube via `img.youtube.com`, frame pertama untuk video upload) — itu perbaikan sah, jangan diregresikan.
- **`preload="metadata"` pada video card:** listing bisa memicu sampai 12 request metadata. Ganti menjadi `preload="none"` dan andalkan `poster`. Bila frame pertama tidak bisa didapat tanpa metadata, batasi elemen `<video>` hanya untuk card yang benar-benar punya `videoPath` **dan** tanpa `imagePath`.
- **Badge play** memakai `rgba(220, 38, 38, 0.9)` hardcoded di empat tempat → `var(--accent)`.

**Verifikasi:** tsc + eslint. Grep: nol `backgroundImage` di ketiga file listing/artikel. Setiap gambar artikel punya `alt`. Build sukses.

**Commit:** `refactor(public): satukan card artikel, alt text + next/image di semua grid`

---

## T5 — Pagination & filter kategori yang berfungsi

**Masalah A — hanya 12 artikel per site yang terjangkau.** `app/site/[siteSlug]/page.tsx:62` — `take: 12`, tanpa `Pagination`, tanpa param `page`. Artikel ke-13 tidak bisa dijangkau dengan menjelajah. `components/Pagination.tsx` sudah ada.

- Baca `searchParams.page`, tambahkan `skip: (page - 1) * 12` dan `prisma.announcement.count()` ke dalam `Promise.all` yang sudah ada di sekitar baris 51.
- Render `<Pagination baseUrl={`/site/${siteSlug}`} ... />` setelah grid.
- **Jangan sentuh query hero** (`take: 5` di baris 71). Itu rail hero yang baru diperbaiki di `2d473ac` dan sengaja terpisah dari feed.

**Masalah B — lima link kategori di navbar mati.** `app/site/[siteSlug]/layout.tsx:41-44` membangun link `?category=slug`, tetapi `app/site/[siteSlug]/page.tsx` tidak pernah membaca `searchParams`. User harus mengingat bahwa filter kategori hanya jalan di halaman search.

- Baca `searchParams.category`, terapkan ke klausa `where` feed (jangan ke hero).
- Render baris chip kategori **di halaman itu sendiri**, bukan hanya sebagai lima link di navbar yang runtuh jadi hamburger di mobile. Pakai `aria-pressed` seperti `components/portal/GroupedAppGrid.tsx:38`.
- Teruskan kategori aktif ke `Pagination` lewat `searchParams` agar paginasi tidak mereset filter.

**Masalah C — artikel pinned di-sort tapi tak terlihat.** Baris ~78 mengurutkan pinned lebih dulu, tetapi dirender identik dengan yang lain. Render item pinned sebagai satu card lebar penuh di atas heading "Artikel Terbaru", dan biarkan grid di bawahnya murni kronologis. Ini memberi pengelompokan dua tingkat yang saat ini tidak ada.

**Verifikasi:** tsc + eslint. Build sukses. Verifikasi manual (butuh DB, catat sebagai belum terverifikasi bila tak tersedia): `?page=2` mengembalikan halaman berbeda, `?category=x` menyaring feed tetapi tidak menghilangkan hero.

**Commit:** `feat(public): pagination feed site, filter kategori aktif, baris pinned`

---

## T6 — Tutup kebocoran lintas site di `/search` global

**P0 isolasi data.** `app/search/page.tsx` melakukan query semua announcement `isPublished: true` **tanpa filter site**, dan bisa diakses siapa saja lewat URL. Ini bertentangan langsung dengan isolasi per-site yang ditegakkan di tempat lain — komentar di `app/[slug]/page.tsx` sendiri menyatakan "per-site data separation is preserved". Halaman ini juga tidak ditautkan dari layout site mana pun (layout memakai `/site/${slug}/search`).

Keputusan: **hapus `/search` global**, arahkan ke `/site`.

- Hapus `app/search/page.tsx`.
- Tambahkan `'/search'` ke matcher `middleware.ts` dan redirect ke `/site`, agar tautan lama tidak 404.
- Setelah ini `components/SearchBar.tsx` dan `components/CategoryFilter.tsx` mungkin kehilangan pemanggil. **Periksa dulu dengan grep sebelum menghapus** — `SearchBar` kemungkinan masih dipakai per-site.

**Sekaligus: `app/site/[siteSlug]/search/page.tsx` ditulis ulang dalam bahasa Indonesia.** Halaman itu sekarang seluruhnya bahasa Inggris ("Back to", "Search articles...", "N results for", "No results for", "Enter a search term") di balik link navbar berlabel `PENCARIAN`, pada produk berbahasa Indonesia untuk karyawan Indonesia. Pakai card dari T4, chip dari T5, dan empty state dari T9.

**Verifikasi:** tsc + eslint. Build sukses; route `/search` hilang dari daftar dan redirect terdaftar di middleware.

**Commit:** `fix(public): hapus search lintas site, lokalkan pencarian per site`

---

## T7 — Perbaikan kontras token

Ruang lingkup sempit di `app/globals.css`, `components/ui/Button.tsx`, `components/SiteThemeProvider.tsx`. Menyentuh `components/ui/**` — diizinkan **hanya** untuk nilai kontras, jangan refaktor komponennya.

| Perbaikan | Detail |
|---|---|
| `--text-3` | `#71717A` → sekitar `#8A8A93`. Mencapai ≈4.6:1 di `--surface-1` sambil tetap jelas tersier. **Wajib override juga di blok `html.theme-light`** — `globals.css` sudah memperingatkan bahwa kanal per-tema harus ikut diubah. Jangan lupa `--text-3-rgb`. |
| Teks tombol primary | Putih di `#ED1C24` = 4.38:1 pada 14px. Pakai `--brand-red-dark` `#C41920` sebagai background variant `primary` (putih ≈6.0:1). Merah brand tetap `--accent` untuk aksen non-teks. |
| Chip/nav aktif | `text-accent` di `bg-accent-subtle` ≈4.12:1. Tambahkan `font-semibold` + outline `border-accent` supaya state tidak dibawa oleh warna 4.12:1 sendirian. |
| `#666` pada baris meta card | → `var(--text-3)` (setelah dinaikkan). Hilang otomatis bila T4 selesai. |
| `getContrastColor()` | `SiteThemeProvider.tsx:78-84` memakai perceived brightness `(0.299r + 0.587g + 0.114b)/255 > 0.5`, bukan relative luminance WCAG. Ganti dengan linearisasi per kanal + threshold 0.179. Ini menentukan warna teks di atas `site.primaryColor` untuk setiap site, jadi sekarang keputusan kontras per-site diambil dari rumus yang salah. |
| `focus:outline-none` | `components/portal/SSOCredentialVault.tsx` memasangnya pada dua input readonly. Pada spesifisitas (0,2,0) ini mengalahkan `*:focus-visible` global (0,1,0) → tab melewati vault tanpa indikator. Hapus. |

**Validasi kategori.** `AnnouncementCard` menyetel teks putih/`--text-primary` di atas `category.color` yang bisa diedit admin tanpa validasi kontras — kategori kuning menghasilkan putih-di-atas-kuning. Pakai `getContrastColor()` yang sudah diperbaiki untuk memilih warna teks badge secara runtime. **Jangan** tambahkan validasi di form admin (di luar lingkup track ini).

**Verifikasi:** tsc + eslint + `npm run audit:tokens`. Hitung ulang rasio untuk keempat pasangan di tabel "Temuan struktural" dan catat hasilnya di commit body.

**Commit:** `fix(a11y): naikkan kontras token teks tersier, tombol, dan chip aktif`

---

## T8 — Alur portal SSO

Ini satu-satunya task pada register **product** (desain melayani tugas). Portal sudah paling rapi di repo — perbaiki alurnya, jangan gaya visualnya.

### T8.1 Relay tanpa failure state dan tak bisa dilewati

`components/portal/SSOAutoSubmit.tsx:26-33` menahan `setTimeout` 1500ms lalu `formRef.current.submit()`. Form-nya `className="hidden"` (baris ~99). Tidak ada `onError`, timeout, tombol submit terlihat, atau cancel. Identik di `SSORerouteSubmit.tsx`.

Komentar di kode menyebut delay itu ada "agar user bisa melihat proses injection kredensial". Karyawan yang membuka empat app tiap pagi membayar 6 detik/hari untuk animasi. Lebih buruk: saat submit gagal (host target mati, blok mixed-content — keduanya masuk akal di `192.168.2.3:3100`), user melihat centang hijau "Selesai!" padahal tidak terjadi apa pun. State paling percaya diri di produk ini juga adalah state gagal-senyapnya.

- Submit saat mount, tanpa delay.
- Kartu berubah peran menjadi **fallback**: setelah 3000ms tanpa navigasi, tampilkan state error yang menyebut nama app — "Tidak bisa membuka {app.name} otomatis" — dengan tombol submit **sungguhan** (`<button type="submit" form="sso-form">`). Form-nya HTML nyata, jadi tombol ini tetap bekerja meski JS rusak.
- Sediakan link sekunder kembali ke `/portal`.
- Hapus `className="hidden"` dari form; sembunyikan dengan teknik gaya `sr-only` supaya tombol submit tetap operabel.
- Bungkus teks status dalam `<p role="status" aria-live="polite">`.
- **Hapus panel kredensial** (yang menampilkan "Username: [nilai] / Password: ••••••••" berwarna hijau). Panel itu ada untuk membuat jeda terasa produktif; begitu tak ada jeda, ia kehilangan alasan keberadaan. Ia juga menarik perhatian ke fakta bahwa kredensial sedang ditangani, tepat di layar di mana user sebaiknya tidak memikirkan itu.

### T8.2 Kosakata implementasi di UI

- `SSORerouteSubmit.tsx` heading: "SSO ke {app.name} **(Reroute)**" → buang "(Reroute)". `AUTO_SUBMIT`/`REROUTE`/`VAULT` adalah nilai konfigurasi; hanya `VAULT` mengubah apa yang harus user lakukan, dan `SSOCredentialVault` sudah menjelaskan dirinya lewat banner 1-2-3.
- "Menyiapkan sesi **server-to-server**" dan status "**Connecting**" (bahasa Inggris di dalam copy Indonesia) → samakan dengan copy `SSOAutoSubmit`.
- `AccountSelector.tsx` merender `{a.id}` — cuid mentah seperti `clx3k9d0a0001` — sebagai label pembeda akun. Ganti dengan username target ter-mask atau `lastUsedAt`; keduanya sudah tersimpan dan keduanya yang dipakai manusia untuk membedakan akun.
- `app/portal/app/[appSlug]/page.tsx` mengoper `logoPath` ke cabang `REROUTE` tetapi **tidak** ke `AUTO_SUBMIT`, sehingga layar launch yang paling sering muncul selalu menampilkan tile huruf padahal logo didukung. Oper juga.

### T8.3 Target sentuh 44px

Setel sekali di primitif, bukan per pemanggil. `components/portal/PortalHeader.tsx` sudah benar dengan `min-h-11`, jadi standarnya sudah ada — tinggal menjangkau primitif.

| Elemen | Sekarang | Jadi |
|---|---|---|
| `Button` size `md` | `h-10` (40px) | `h-11` |
| `Button` size `sm` | `h-8` (32px) | `h-9` |
| `Input` | `h-10` | `h-11` |
| Checkbox `OnboardingWizard` | ~16px dalam baris ~26px | `h-5 w-5` dalam baris `min-h-11` |
| Tombol "Hapus" credentials | `px-3 py-2 text-xs` ≈32px | `min-h-11` |
| Padding halaman portal | `p-8` di semua lebar | `p-4 sm:p-8` |

Padding `p-8` tetap di semua lebar menghabiskan 18% viewport 360px, padahal `PortalHeader` tepat di atasnya sudah benar memakai `px-4 sm:px-6`.

### T8.4 Onboarding jadi opt-in

`components/portal/OnboardingWizard.tsx` menyambut user baru dengan dua pohon checkbox independen sebelum ia melihat satu app pun. Orang yang hanya ingin membuka sistem absensi diminta mengambil keputusan taksonomi.

- Daratkan user pertama di grid app yang sudah terisi, dengan banner yang bisa ditutup dan menawarkan kustomisasi. `Lewati` sudah ada — balik penekanannya sehingga melihat app adalah jalur default.
- Baris 75-82: kegagalan simpan hanya `console.error`, dan `finally` mengembalikan tombol dari "Menyimpan..." ke "Simpan" tanpa pesan. User akan menekannya berulang kali. Tampilkan error dan **pertahankan pilihan user**; `useToast` sudah tersedia (`app/portal/credentials/page.tsx` sudah mengimpornya).
- Beri `indeterminate` pada checkbox grup ketika sebagian—bukan semua—app-nya terlihat. Komentar di file itu sendiri mengakui semantik "group off ≠ app off" belum selesai.

### T8.5 Verifikasi kredensial

`app/portal/credentials/page.tsx` menerima password aplikasi target tanpa reveal toggle dan tanpa langkah verifikasi. Salah taip baru ditemukan beberapa menit kemudian sebagai kegagalan login aplikasi pihak ketiga, di tab lain, dengan kata-kata aplikasi lain. User tidak bisa menghubungkan itu dengan apa yang ia ketikkan di portal.

- Tambahkan reveal toggle pada field password (≥44px, `aria-label` yang berubah sesuai state, `aria-pressed`).
- Tambahkan aksi "Coba Buka" di samping setiap akun tersimpan yang menjalankan launch SSO di tempat.
- Jelaskan "Kredensial" sekali dengan bahasa manusia. Copy sekarang berbunyi "Kredensial disimpan terenkripsi", yang menuntut pemahaman dua istilah. Tugas sebenarnya: "ketik password HRIS Anda supaya portal bisa login untuk Anda".

### T8.6 Rapikan state layar penuh

- Tujuh state portal layar penuh memakai `min-h-screen` di dalam layout yang sudah merender `PortalHeader` 56px, jadi setiap kartu "terpusat" duduk 56px terlalu rendah dan halaman selalu bisa di-scroll. Ganti dengan `min-h-[calc(100vh-3.5rem)]`.
- `CorruptCredential` mengatakan hal yang sama dua kali: "Kredensial rusak. Silakan simpan ulang." lalu "Kredensial untuk X tidak dapat dibaca. Silakan simpan ulang untuk melanjutkan." Sisakan satu.
- `SSOAutoSubmit`, `SSORerouteSubmit`, `SSOCredentialVault` memakai `<h2>` sebagai heading teratas di halaman tanpa `<h1>`, padahal `NoCredential`/`CorruptCredential`/`AccessDenied` sudah benar memakai `<h1>`. Samakan ke `<h1>`.

**Jangan ubah:** keluarga error state (`NoCredential`, `CorruptCredential`, `AccessDenied`) secara struktural — itu pekerjaan desain terbaik di repo dan menjadi pola acuan. Jangan ubah fallback `execCommand` di `SSOCredentialVault.tsx:20-44`; itu sengaja ada untuk deploy internal non-secure-context dan komentarnya menjelaskan kapan boleh dihapus.

**Verifikasi:** tsc + eslint. Grep: nol `setTimeout` 1500 di komponen SSO, nol "Reroute"/"server-to-server"/"Connecting" di copy, nol `{a.id}` sebagai label. Build sukses. Uji alur nyata perlu portal + app target — catat sebagai belum terverifikasi bila tak tersedia.

**Commit:** `fix(portal): SSO submit langsung + fallback gagal, target 44px, copy bahasa user`

---

## T9 — Brand Kapal Api: naik ke strategi Committed

Token `--brand-red: #ED1C24` **sudah** merah Kapal Api. Identitas dipertahankan, bukan diganti — yang berubah adalah seberapa berani warna itu dipakai.

Sekarang merah hanya aksen tipis di atas hampir-hitam (`#09090B`/`#0a0a0a`), sehingga newsroom terasa netral tanpa karakter. Naikkan ke **Committed**: merah membawa 30-60% permukaan pada momen kunci.

| Permukaan | Sekarang | Jadi |
|---|---|---|
| Masthead site (`app/site`) | heading gradient-clipped 48px di atas near-black | Blok merah brand penuh, teks putih, judul `clamp()`. **Wajib hapus** `WebkitBackgroundClip: text` + `WebkitTextFillColor: transparent` di `app/site/page.tsx:86-91` — itu larangan absolut, dan tanpa fallback `color` ia tak terlihat bila background-clip gagal |
| Kategori aktif | teks aksen 4.12:1 | Chip merah terisi, teks `--site-text-on-primary` |
| Blok pinned (T5) | identik dengan card lain | Pita merah + judul lebih besar |
| Empty state | satu kalimat abu dalam kotak | Lihat di bawah |
| CTA artikel | teks merah | Tetap teks, tapi underline + target 44px |

**Empty state.** `app/site/[siteSlug]/page.tsx:~299` mengisi seluruh site kosong dengan satu kalimat abu: "Belum ada artikel untuk site ini." Perusahaan kopi besar yang newsroom internalnya belum punya isi berkata: tidak ada apa-apa. Bandingkan dengan yang dilakukan portal pada situasi yang sama (`NoCredential` dkk.). Tulis ulang mengikuti pola portal: ikon bertint → heading → satu kalimat yang menyebut nama site → satu aksi (mis. link ke site lain lewat `/site`).

**Batas.** Register brand mengizinkan warna berani, tetapi larangan absolut tetap berlaku: tanpa gradient text, tanpa glassmorphism dekoratif, tanpa border-stripe samping, tanpa eyebrow uppercase kecil di atas setiap section. Saat ini `FullscreenHero` punya eyebrow "PENGUMUMAN UNGGULAN" — satu kicker yang disengaja boleh, jangan tambah lagi di section lain.

**Verifikasi:** tsc + eslint + `npm run audit:tokens`. Grep: nol `WebkitBackgroundClip`. Jalankan detector: `node "<skill>/scripts/detect.mjs" --json app/site components app/portal` harus tetap ≤1 temuan.

**Commit:** `feat(public): masthead & aksen Kapal Api committed, empty state bermakna`

---

## T10 — Audit integrasi & re-kritik

- Jalankan seluruh gate: `npx tsc --noEmit`, `npx eslint` pada semua file yang tersentuh, `npm run audit:tokens`, `$env:NEXTAUTH_URL="http://localhost:3000"; npm run build`.
- Jalankan detector pada seluruh surface publik + portal; catat jumlah temuan sebelum/sesudah.
- Hitung ulang keempat pasangan kontras dan catat hasil akhirnya.
- Verifikasi paritas state: setiap surface yang disentuh punya default / hover / focus-visible / disabled / loading / empty / error yang jelas.
- Grep regresi (harus nol pada surface publik): `onMouseOver`, `onMouseOut`, `minmax(350px, 1fr)`, `article-content`, `WebkitBackgroundClip`, `backgroundImage` di grid card, `#dc2626`, `#666`, `#888`, `#a3a3a3`, `#d4d4d4`, `#e0e0e0`.
- Jalankan ulang `/impeccable critique` pada target `app/site` dan bandingkan dengan baseline **21/40** yang tersimpan di `.impeccable/critique/2026-08-17T03-48-03Z__app-site.md`. Target realistis: ≥32/40, nol P0.

**Commit:** `chore(public): audit integrasi rework surface publik & portal`

---

## Di luar lingkup (sengaja)

| Item | Alasan |
|---|---|
| `app/admin/**`, `components/admin/**` | Track fase admin terpisah. Pengecualian tunggal: hapus tiga input hero global di T1 |
| Migrasi ikon `react-icons/fi` → Phosphor di surface publik | Milik track admin; mencampur akan mengaburkan diff |
| Migration skema Prisma | Tidak ada task yang membutuhkannya; kolom hero global tetap ada |
| Field focal point / crop rasio gambar | Butuh perubahan skema + UI admin; `cover` sudah cukup |
| Perbaikan `.env` / `NEXTAUTH_URL` | Sengaja dibiarkan; override hanya di shell saat build |
| Upgrade Tailwind v4 | `globals.css` dan `tailwind.config.ts` ditulis dalam format v3 |
| ISR / caching untuk `force-dynamic` di halaman publik | Perubahan perilaku caching butuh keputusan terpisah; dicatat sebagai temuan, bukan task |
| Validasi kontras `category.color` di form admin | Lingkup admin; T7 menanganinya secara runtime saja |

## Catatan risiko

| Risiko | Mitigasi |
|---|---|
| Artikel orphan jadi tak terjangkau setelah T1 | Orphan di-**redirect** ke `/site`, bukan 404. Query hitung orphan tersedia di T1 |
| `AnnouncementCard` dipakai surface lain setelah T4 mengubah signature | Grep importer sebelum mengubah prop; `app/page.tsx` dan `app/search/page.tsx` sudah hilang di T1/T6 |
| T7 menaikkan `--text-3` merusak tema paper | Wajib override di blok `html.theme-light` **dan** kanal `--text-3-rgb` |
| Perubahan `Button`/`Input` di T8.3 merambat ke admin | `components/ui/**` dipakai admin juga. Naik 40px→44px aman secara visual, tapi verifikasi build + periksa tabel admin yang padat |
| Alur SSO tak bisa diuji tanpa app target | Laporkan sebagai belum terverifikasi; jangan klaim sukses |
