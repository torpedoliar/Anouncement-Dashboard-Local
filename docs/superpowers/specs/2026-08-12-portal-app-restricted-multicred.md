# Portal: Restricted Apps + Multi-Credential — Design

> **Status:** Draft untuk review
> **Tanggal:** 2026-08-12

## Konteks

Portal SSO saat ini menyimpan kredensial per user per app dengan **satu login per app** (`@@unique([portalUserId, appId])`), dan **semua app aktif tampil** untuk semua user (filter hanya soal visibility — hide/show). Dua kebutuhan baru:

1. **Aplikasi keuangan (dll.) tidak boleh tampil untuk umum** — hanya user/grup tertentu yang berhak melihat dan membukanya.
2. **Satu user kadang punya 2 (atau lebih) login dalam aplikasi yang sama** (mis. akun pusat & akun cabang di ERP), dan harus bisa memilih akun mana yang dipakai saat SSO.

Keduanya menyentuh lapisan yang sama (skema + akses + UI kredensial), sehingga digabung dalam satu spec. Masih produk yang sama: portal SSO form-forwarding.

## Tujuan

- App bisa ditandai **non-publik** → hanya terlihat/dibuka oleh user yang punya akses (via grup ATAU direct).
- User bisa menyimpan **banyak akun per app**, masing-masing berlabel, mengelola lewat **halaman Kelola Kredensial yang sudah ada**.
- Saat SSO dan user punya >1 akun untuk app, user **memilih akun** sebelum eksekusi.

## Non-Goals (YAGNI)

- Tidak ada layar matriks admin user×group×app baru — akses restricted memakai `PortalUserGroup` + `PortalUserAppAccess` yang sudah ada.
- Tidak ada pembatasan jumlah akun (unlimited).
- Tidak ada publikasi/audit baru selain yang sudah ada (account-sharing tetap via `appUsername`).
- Tidak mengubah mode REROUTE Oracle atau mode VAULT selain dari sisi *pemilihan* kredensial.

---

## Bagian A — Restricted Apps

### Perubahan skema (Prisma)

```prisma
model PortalApp {
  ...
  isPublic Boolean @default(true)   // true=berlaku semua user; false=hanya berhak akses
  ...
}
```

### Aturan akses — sumber tunggal

Aturan ini dipakai **konsisten** di:
- `getAccessiblePortalApps(portalUserId)` — daftar app di grid & wizard.
- `canAccessPortalApp(portalUserId, appId)` — guard route & cek hak simpan kredensial.

```
if (!app.isActive)                     → tidak akses
else if (user.role === PORTAL_ADMIN)   → akses (bypass, seperti sekarang)
else if (app.isPublic)                 → akses; lanjut filter visibility user (default-show)
else // restricted
    ada direct access PortalUserAppAccess?          → akses
    ATAU ada membership PortalUserGroup (grup aktif) yang memuat app?  → akses
    selain itu → TIDAK akses
```

Konsekuensi penting: **grid, wizard onboarding, daftar kredensial, dan route `/portal/app/[slug]` sama-sama berhenti di app restricted yang tidak user akses.** Tidak ada kebocoran nama app (bahkan di kartu/URL).

### Perilaku user

- App publik: seperti sekarang (default tampil, bisa di-hide via visibility).
- App restricted yang user punya akses: tampil seperti biasa.
- App restricted yang user tidak punya akses: **tidak muncul di mana pun** — tidak bisa dipaksa buka via URL (guard route).

### Admin UI (`/admin/portal-apps`)

- Tambah toggle **"Publik / Restricted"** per app.
- Sumber akses: `PortalUserGroup` (assign user ke grup) + `PortalUserAppAccess` (assign langsung) — keduanya sudah ada di admin, tanpa layar baru.

---

## Bagian B — Multi-Credential

### Perubahan skema (Prisma)

```prisma
model PortalUserAppCredential {
  ...
  label  String   // WAJIB — nama akun, mis. "Akun Pusat"
  ...
  @@unique([portalUserId, appId, label])   // GANTI @@unique([portalUserId, appId])
}
```

### Migrasi data

1. Data lama: `label` diisi `'default'` untuk semua baris yang ada (agar tidak null).
2. Jadikan `label` NOT NULL.
3. Hapus unique lama `(portalUserId, appId)`; pasang unique baru `(portalUserId, appId, label)`.
4. **Efek samping wajib ditangani**: semua `findUnique({ where: { portalUserId_appId } })` dan `upsert({ where: { portalUserId_appId } })` harus diganti (lihat Bagian C).

### Model akun (runtime)

- Satu user bisa punya N kredensial untuk satu app, tiap satu `label`.
- `label` unik per (user, app) — duplikat label ditolak.
- `appUsername` tetap tersimpan untuk audit account sharing.

---

## Bagian C — Dampak menyebar & alur

### Halaman Kelola Kredensial (`/portal/credentials`) — tempat mengelola akun

Halaman ini (lewat menu header "Kredensial") yang jadi pusat multi-akun:

- Tiap app menampilkan **daftar akun** (label + status).
- **Tambah akun**: form username + password + label (wajib). Menambah akun ke app yang sudah punya akun = create baru.
- **Hapus akun**: per credential (by id), bukan per app.
- **Indikator** di list: jumlah akun per app, bukan sekadar boolean.

### API `/api/portal/credentials`

| Method | Sekarang (unique user+app) | Baru (by id / list) |
|--------|--------------------------|---------------------|
| `GET`  | daftar app + `hasCredential` | daftar app + `credentialCount` (dan/atau list akun tiap app) |
| `POST` | upsert (simpan/update 1 login) | **create** akun baru (label wajib, validasi unique per user+app+label) |
| `DELETE` | hapus by `appId` | hapus by `credentialId` |

- Validasi: `label` wajib, non-kosong; `appId` harus app yang bisa diakses user.

### Alur SSO — pemilih akun

- **1 akun** → langsung SSO (perilaku saat ini, tanpa langkah tambahan).
- **>1 akun** → tampil **modal pemilih akun** di halaman `/portal/app/[appSlug]`; user pilih akun → eksekusi mode yang sesuai (FORM auto-submit / REROUTE / VAULT) dengan kredensial akun itu.

Catatan implementasi:
- Halaman `/portal/app/[appSlug]` sekarang `findUnique` → jadi **ambil list** (`findMany`); kalau >1, render komponen pemilih (client) yang POST pilihan ke route eksekusi.
- Route REROUTE (`/api/sso/reroute`) menerima `credentialId` (tambahan opsional) dan mengambil credential by id (bukan by user+app).
- Komponen `SSOCredentialVault` dan `SSOAutoSubmit` menerima credential yang sudah **dipilih**, tidak berubah selain sumber data.

### Grid / kartu app

- `hasCredential` → `credentialCount` (jumlah akun).
- AppCard menampilkan "✓ N akun" (atau "Belum ada akun" bila 0).
- Link "Buka Aplikasi" tetap `/portal/app/[slug]` (pemilih muncul di sana bila >1 akun).

### Audit & realita lainnya

- **Account sharing** (`/api/admin/portal-audit`): grup per `(appId, appUsername)` sudah iterasi semua baris — tetap valid dengan multi-akun; label menambah konteks. Tidak ada perubahan semantik.
- **Lain-lain** yang menyentuh unique user+app: cari `portalUserId_appId` di seluruh repo dan sesuaikan.

---

## Keamanan

- Akses restricted diperiksa di sisi server (`canAccessPortalApp`) — tidak hanya disembunyikan di UI.
- Pemilihan akun: `credentialId` divalidasi milik user yang login (tidak bisa pilih akun orang lain).
- Tidak ada plaintext berlebihan: password tetap hanya tersimpan terenkripsi (`credentialBlob`); `appUsername` tetap untuk audit.

---

## Pengujian

- **Self-check parser/logika akses** (script `scripts/` via `npx tsx`) untuk aturan restricted:
  - publik + admin → akses; publik + user → akses.
  - restricted + no access → tolak; restricted + direct access → akses; restricted + grup aktif → akses; restricted + grup non-aktif → tolak.
- **Type check** (`npx tsc --noEmit`).
- Manual (di server): tambah app restricted, cek user tanpa akses tidak melihat; tambah 2 akun, cek pemilih muncul; SSO dengan akun terpilih.

## File yang berubah (perkiraan)

- `prisma/schema.prisma` — `PortalApp.isPublic`, `PortalUserAppCredential.label` + unique baru.
- `lib/portal-access.ts` — aturan restricted di `getAccessiblePortalApps` & `canAccessPortalApp` (+ `BySlug`).
- `lib/portal-layout.ts` — pastikan wizard/grid pakai hasil yang sudah ter-filter.
- `lib/validation-schemas.ts` — schema kredensial + label.
- `app/api/portal/credentials/route.ts` — GET count/list, POST create, DELETE by id.
- `app/admin/portal-apps/page.tsx` — toggle Publik/Restricted.
- `app/portal/credentials/page.tsx` — daftar akun per app, tambah/hapus, label.
- `app/portal/page.tsx` — `credentialCount`.
- `components/portal/GroupedAppGrid.tsx`, `components/portal/AppCard.tsx` — indikator jumlah akun.
- `app/portal/app/[appSlug]/page.tsx` — list credential + pemilih akun.
- `app/api/sso/reroute/route.ts` — terima `credentialId`, by id.
- `components/portal/*` — komponen pemilih akun baru (bila perlu).
- `app/api/admin/portal-audit/route.ts` — verifikasi grouping tetap (bisa tanpa perubahan kode).
- Migration SQL baru.

## Pembukaan / pertanyaan tersisa

- Tidak ada. Desain sudah Turing-complete untuk kebutuhan: restricted access + pilih akun saat SSO.
