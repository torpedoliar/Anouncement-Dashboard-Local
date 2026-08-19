# Handoff — Rework UI/UX Surface Publik & Portal User

**Dibuat:** 2026-08-17
**Status:** Rencana ditulis, **belum dieksekusi**
**Plan file:** `docs/superpowers/plans/2026-08-17-ui-ux-rework-public-surfaces.md`
**Base commit untuk source:** `24af9a3` (== `origin/main`). Working tree bersih untuk `app/`, `components/`, `lib/`, `scripts/`. Semua nomor baris merujuk ke commit ini.
**HEAD lokal:** `8f36770` — hanya `.planning/` (ROADMAP, STATE, 12-SPEC), **tanpa source**. Belum dipush.
**Baseline kritik:** `.impeccable/critique/2026-08-17T03-48-03Z__app-site.md` — **21/40**, 3×P0, 5×P1

> ⚠️ **Tabrakan file dengan track phase-12 (PDF reader inline).** Spec di `8f36770` akan mengubah `app/site/[siteSlug]/[articleSlug]/page.tsx` — file yang sama dengan T2.2, T2.3, dan T4 — dan menyuntikkan blok PDF ke konten yang dirender `dangerouslySetInnerHTML`, persis di tempat T2.3 mengganti class body menjadi `prose-santos`. **Selesaikan T2 lebih dulu**, atau tentukan satu pemilik file sebelum keduanya jalan.

---

## Apa yang dikerjakan track ini

Tiga permukaan yang dilihat user akhir, bukan admin:

1. **Pemilihan artikel** — `app/site`, `app/site/[siteSlug]`, `app/site/[siteSlug]/search`
2. **Halaman artikel** — `app/site/[siteSlug]/[articleSlug]`, `app/[slug]`
3. **Portal SSO** — `app/portal*`, `components/portal/**`

Ini **track terpisah** dari `phase0..phase3` (design system → shell → content desk → data surfaces) yang menggarap `app/admin/**`. Tidak ada tabrakan penomoran: dokumen ini dinamai berdasarkan isi, bukan nomor fase.

---

## Temuan yang wajib dibaca sebelum menyentuh kode

**1. `middleware.ts` me-redirect `/` → `/site` tanpa syarat.** Karena itu `app/page.tsx` tidak pernah dirender, dan `components/HeroSection.tsx` (605 baris) adalah kode mati. Ini mengubah "pilih salah satu dari dua carousel" menjadi "hapus yang sudah tidak dieksekusi".

**2. Repo ini punya dua standar kualitas.** Hitungan pada base commit:

| Sinyal | Surface publik | Portal |
|---|---|---|
| inline `style={{` | 230 (18 file) | **0** |
| hex hardcoded | 64 (15 file) | **0** |
| `focus-visible` | **0** | 42 |

Portal memakai token semantik, `focus-visible`, `aria-*`, `role="group"`, `aria-pressed`, `ConfirmDialog`. Surface publik memakai inline style dengan hex, dan karena inline style tak bisa menyatakan `:hover`/`:focus`/media query, semua hover-nya adalah mutasi DOM lewat `onMouseOver`/`onMouseOut` tanpa satu pun padanan fokus keyboard.

**Konsekuensi praktis:** ketika ragu bagaimana menulis sesuatu di surface publik, **contoh yang benar sudah ada di `components/portal/**`**. Ikuti itu, jangan invent pola baru.

**3. `.prose-santos` lengkap tapi tak terpakai.** Body artikel memakai `className="article-content"` yang nol match CSS di seluruh repo.

---

## Status pekerjaan sebelumnya (jangan diregresikan)

| Commit | Isi | Catatan |
|---|---|---|
| `3d12535` | Pulihkan pipeline Tailwind v3 + shell admin | PostCSS sempat memakai plugin v4 sehingga seluruh utility scale tidak ter-emit. **Jangan ubah `postcss.config.mjs`** |
| `2d473ac` | Hero rail: query hero per-site terpisah (`take: 5`), rotasi 6s, frame 16:9 | T5 **tidak boleh** menyentuh query hero, hanya query feed |
| `24af9a3` | Thumbnail untuk artikel hero video di listing/search/related | Perbaikan sah. T4 harus mempertahankan dukungan thumbnail YouTube + frame video, tapi menggantinya ke `AnnouncementCard` |

---

## 10 task, ringkas

| Task | File utama | Deliverable |
|---|---|---|
| **T1** hapus kode mati | Hapus `components/HeroSection.tsx`, `SiteHero.tsx`, `SkeletonCard.tsx`, `ReadingTime.tsx`, `app/page.tsx`; reduksi `app/[slug]/page.tsx`; hapus 3 input hero global di `app/admin/settings/page.tsx` | ~900 baris hilang, **efek user nol** |
| **T2** P0 responsif & a11y | `app/site/[siteSlug]/page.tsx`, `app/site/page.tsx`, `.../search/page.tsx`, `.../[articleSlug]/page.tsx`, `components/site/ArticleHero.tsx`, `components/FullscreenHero.tsx`, `components/Navbar.tsx`, `app/globals.css` | Overflow 360px, back link tertimbun, `prose-santos`, tinggi hero, skip link, jeda carousel |
| **T3** token Navbar/Footer | `components/Navbar.tsx`, `Footer.tsx`, `SitePickerCard.tsx` | Hapus hover DOM + hex, breakpoint CSS, `aria-expanded` |
| **T4** satu card | `components/AnnouncementCard.tsx` + 3 pemanggil | Alt text + `next/image` di semua grid, href site-scoped |
| **T5** pagination & kategori | `app/site/[siteSlug]/page.tsx` | Artikel ke-13+ terjangkau, 5 link kategori mati jadi hidup, baris pinned |
| **T6** tutup kebocoran search | Hapus `app/search/page.tsx`, `middleware.ts`, `.../search/page.tsx` | **P0 isolasi data**, lokalkan copy ke bahasa Indonesia |
| **T7** kontras token | `app/globals.css`, `components/ui/Button.tsx`, `SiteThemeProvider.tsx` | 4 pasangan token lolos AA, `getContrastColor` pakai rumus WCAG |
| **T8** alur SSO | `components/portal/SSOAutoSubmit.tsx`, `SSORerouteSubmit.tsx`, `AccountSelector.tsx`, `OnboardingWizard.tsx`, `app/portal/**` | Submit langsung + fallback gagal, 44px, copy bahasa user |
| **T9** brand Kapal Api | `app/site/page.tsx`, `app/site/[siteSlug]/page.tsx`, `FullscreenHero.tsx` | Strategi Committed, hapus gradient text, empty state bermakna |
| **T10** audit | Semua file tersentuh | Gate + re-kritik, target ≥32/40, nol P0 |

Kerjakan **berurutan**. T1 lebih dulu supaya task lain tidak memperbaiki file yang seharusnya hilang. T4 bergantung pada T1 (dua pemanggil `AnnouncementCard` hilang di T1/T6). T5 bergantung pada T4 (card baru). T9 bergantung pada T7 (nilai kontras final).

---

## Keputusan yang sudah diambil user — jangan tanya ulang

| Pertanyaan | Keputusan |
|---|---|
| Prioritas mana dulu | **Semua tiga kelompok** (P0 responsif/a11y, utang design system, alur SSO) |
| Artikel orphan setelah reduksi `app/[slug]` | **Redirect ke `/site`**, bukan `notFound()`. Tidak boleh ada artikel yang hilang |
| Field hero global di admin Settings | **Hapus tiga input dari form.** Kolom DB tetap, tanpa migration |
| Nada surface publik | **Pakai brand Kapal Api**, naik ke strategi Committed. `--brand-red: #ED1C24` sudah benar — identitas dipertahankan, keberaniannya yang dinaikkan |
| Hapus duplikat | **Ya.** 5 dari 7 penghapusan efeknya nol karena kodenya sudah tidak dieksekusi |

---

## Gate verifikasi

```powershell
cd "E:\Vibe\Dashboard SJA\announcement-dashboard"
npx tsc --noEmit
npx eslint <file-yang-diubah>
npm run audit:tokens
$env:NEXTAUTH_URL="http://localhost:3000"; npm run build
```

**Koreksi penting terhadap `HANDOFF-PHASE3.md`:** dokumen itu menyatakan `npm run build` terblokir oleh env. Itu **tidak lagi benar**. Dengan `NEXTAUTH_URL` di-override di shell, build sukses sampai `Generating static pages (58/58)`. Tanpa override, build gagal di `/portal-login` dengan `TypeError: Invalid URL`.

**Jangan** perbaiki `.env` untuk mengatasi ini — `NEXTAUTH_URL` kosong disengaja. Override hanya di shell.

### Yang TIDAK bisa diverifikasi di environment ini

Catat sebagai belum terverifikasi, jangan klaim sukses:

- **Tidak ada dev server, tidak ada automasi browser.** Tidak ada screenshot, tidak ada pengukuran kontras runtime, tidak ada uji responsif nyata. Semua klaim visual bersifat statis dari source.
- **Tidak ada Postgres lokal.** Pagination, filter kategori, hitungan orphan, dan alur SSO tidak bisa diuji end-to-end.
- Detector (`detect.mjs`) berjalan dalam mode regex untuk TSX, jadi hasil bersih adalah pernyataan tentang cakupan rule, **bukan** tentang kualitas UI. Baseline: **1 temuan** (`layout-transition` di `FullscreenHero.tsx:198`) — T2.6 memperbaikinya.

---

## Standing rules (dari CLAUDE.md & fase sebelumnya)

- `.env` sengaja tidak disentuh.
- Tailwind tetap v3; `postcss.config.mjs` tidak diubah.
- Multi-site adalah domain inti — jangan asumsikan satu site per announcement; scope lewat `sites.some({ siteId })`, ambil primary dari junction.
- Gate tulis lewat `lib/site-access.ts` (`canEditOnSite`, `canAdminSite`, `getAccessibleSites`) — jangan hand-roll.
- Audit lewat `logAudit()` dari `lib/audit.ts` (non-blocking, tidak pernah throw, auto-redact).
- Commit message bahasa Indonesia, satu commit per task, hanya file milik task itu.
- **Jangan `git add -A`.** Working tree memuat banyak perubahan tak terkait yang harus tetap unstaged: `CLAUDE.md`, `graphify-out/`, `.superpowers/`, `docs/agents/`, `From Server Prod/`, `HANDOFF-PHASE2.md`, `image.png`. Stage file secara eksplisit per nama.
- Ikon: surface publik masih `react-icons/fi` — biarkan. Migrasi Phosphor milik track admin.

---

## Referensi cepat: bukti per temuan

Semua sudah diverifikasi terhadap `24af9a3`. Nomor baris bisa bergeser setelah task berjalan.

| Temuan | Lokasi | Bukti |
|---|---|---|
| Overflow grid | `app/site/[siteSlug]/page.tsx:161`, `app/site/page.tsx:120`, `.../search/page.tsx:190` | `minmax(350px, 1fr)` dalam container `padding: 0 24px`; di 360px content box 312px |
| Back link tertimbun | `Navbar` `fixed`/`zIndex: 200`/`80px` vs `.../[articleSlug]/page.tsx:122` `sticky`/`zIndex: 100`, link di baris 141 | Dibaca langsung dari source |
| Body artikel tanpa CSS | `.../[articleSlug]/page.tsx:166` | Grep `article-content` → hanya 1 hasil, di file itu sendiri. Nol rule CSS |
| Navbar desktop-first | `components/Navbar.tsx:22` + `:50` | `showDesktopNav = mounted ? isDesktop : true` |
| Skip link buntu | `components/Navbar.tsx:63` `href="#news"` | Grep `id="news"` → hanya `app/page.tsx:108`, yang dihapus di T1 |
| Feed terbatas 12 | `app/site/[siteSlug]/page.tsx:62` `take: 12` | Grep `Pagination` di file itu → nol |
| Query hero (jangan disentuh) | `app/site/[siteSlug]/page.tsx:71` `take: 5` | Ditambahkan `2d473ac` |
| Search lintas site | `app/search/page.tsx` | `where` hanya `isPublished: true`, tanpa filter site |
| Kode mati | `HeroSection`, `SiteHero`, `SkeletonCard`, `ReadingTime` | Grep importer → `HeroSection` hanya dari `app/page.tsx` (tak terjangkau); tiga lainnya nol importer |
| Email tidak terpengaruh T1 | `lib/email.ts:294` | `articleUrl: ${baseUrl}/site/${siteSlug}/${announcement.slug}` — sudah canonical, bukan bare slug |
| Kontras token | `app/globals.css` | `--text-3` `#71717A` di `#111113` = 3.93:1; putih di `#ED1C24` = 4.38:1 |
| Rumus kontras salah | `components/SiteThemeProvider.tsx:78-84` | Perceived brightness, bukan relative luminance WCAG |
| Delay SSO | `components/portal/SSOAutoSubmit.tsx:26-33` | `setTimeout` 1500ms + form `className="hidden"`, tanpa `onError` |
| Fokus tertekan | `components/portal/SSOCredentialVault.tsx` | `focus:outline-none` (0,2,0) mengalahkan `*:focus-visible` global (0,1,0) |
| Gradient text | `app/site/page.tsx:86-91` | `WebkitBackgroundClip: text` + `WebkitTextFillColor: transparent`, tanpa fallback `color` |

---

## Jangan diubah

Ini pekerjaan terbaik di repo dan menjadi pola acuan untuk sisanya:

- **Keluarga error state portal** — `NoCredential`, `CorruptCredential`, `AccessDenied`. Satu skeleton: tile ikon 56px bertint → heading `font-display` → satu kalimat dengan nama app di-bold → tepat satu aksi, dengan tombol yang sudah pre-targeted ke perbaikannya. T8 hanya menghapus redundansi copy di `CorruptCredential` dan memperbaiki `min-h-screen`; strukturnya jangan disentuh.
- **Fallback `execCommand`** di `SSOCredentialVault.tsx:20-44`. Sengaja ada untuk deploy internal non-secure-context; komentarnya menjelaskan kondisi dan kapan boleh dihapus.
- **Layer token** di `app/globals.css` dan `tailwind.config.ts`, termasuk pasangan kanal `--*-rgb`. Komentarnya mencatat bahwa tanpa placeholder `<alpha-value>`, Tailwind membuang setiap utility beralpha secara senyap — 36 kelas pernah tidak menghasilkan CSS. T7 hanya mengubah **nilai**, bukan mekanismenya.

---

## Mulai dari mana

1. Baca `docs/superpowers/plans/2026-08-17-ui-ux-rework-public-surfaces.md` seluruhnya. Plan itu self-contained: setiap task punya file, alasan, arah perubahan, verifikasi, dan commit message.
2. Baca bagian "Batasan global" di plan — mengikat semua task.
3. Eksekusi T1 → T10 berurutan, satu commit per task, `npx tsc --noEmit` di antara task.
4. Setelah T10, jalankan ulang `/impeccable critique` pada `app/site` dan bandingkan dengan baseline 21/40.
