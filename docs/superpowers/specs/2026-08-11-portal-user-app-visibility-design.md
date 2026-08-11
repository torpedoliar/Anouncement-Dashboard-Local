# Portal — Per-User App Visibility (Onboarding Wizard + Toggle Grup/App)

Tanggal: 2026-08-11
Status: Draf — menunggu review user

## Latar Belakang / Tujuan

Saat ini tampilan grid `/portal` ditentukan **oleh admin** (group membership `PortalUserGroup` + direct access `PortalUserAppAccess`). Permintaan user: **user menentukan sendiri** app mana yang tampil di grid-nya, sambil admin hanya membangun & mengelompokkan aplikasi.

Keputusan yang sudah disepakati (brainstorming):

1. **Kemampuan akses**: semua user bisa semua aplikasi aktif. Tidak ada pembatasan per-user lagi.
2. **Kredensial SSO**: tetap per-user (`PortalUserAppCredential` untuk REROUTE/VAULT Oracle). Tidak berubah.
3. **Pola toggle**: on/off per-grup **dan** per-app (per-user).
4. **App baru**: default TAMPAIL. User yang tidak mau bisa menyembunyikannya.
5. **UI**: onboarding wizard khusus login pertama + pengaturan lanjutan pasca-login.

## Arsitektur

### Model data — tabel baru `PortalUserAppVisibility`

```
model PortalUserAppVisibility {
  id            String   @id @default(cuid())
  portalUserId  String
  groupId       String?  // set kalau override grup
  appId         String?  // set kalau override app
  visible       Boolean  // false = hidden; true = override show (menang atas grup hidden)

  portalUser    PortalUser @relation(fields: [portalUserId], references: [id], onDelete: Cascade)
  group         PortalGroup? @relation(fields: [groupId], references: [id], onDelete: Cascade)
  app           PortalApp?   @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@unique([portalUserId, groupId])
  @@unique([portalUserId, appId])
  @@map("portal_user_app_visibility")
}
```

Relasi back: `PortalUser.visibility PortalUserAppVisibility[]`, `PortalGroup.visibility ...`, `PortalApp.visibility ...`.

Tambahan kolom di `PortalUser`: `onboardingDone Boolean @default(false)` — flag eksplisit bahwa user sudah melewati wizard. Tidak boleh bergantung pada "tidak ada row visibility" untuk mendeteksi onboarding, karena tombol "Lewati" menghasilkan nol row (lihat Bug jarak di bawah).

**Semantik default-visible:**
- Tidak ada row = app tampil.
- Row `(user, groupId, visible=false)` = seluruh app di grup itu disembunyikan.
- Row `(user, appId, visible=false)` = app itu disembunyikan.
- Row `(user, appId, visible=true)` = override: app itu **ditampilkan** meski grupnya hidden. (App override menang atas grup override.)

Karena kolom ini immutable-per-user dan jumlah opini user terbatas, **tidak perlu materialisasi** — query langsung di join.

### Alur login pertama (onboarding wizard)

Deteleksi "belum pernah memilih": `PortalUser.onboardingDone == false` → status `NEEDS_ONBOARDING`. (Bukan dengan mengecek jumlah row visibility — tombol "Lewati" menghasilkan nol row, yang sama dengan user yang belum pernah membuka wizard. Gunakan flag eksplisit.)

- Saat `/portal` dimuat dan `getVisibilityProfile(userId)` mengembalikan `needsOnboarding = true` (onboardingDone == false), render **wizard** (modal penuh atau langkah) sebagai overlay:
  - Daftar semua grup aktif dengan checkbox (toggle grup → semua app on/off).
  - Setiap grup expandable menampilkan appnya dengan checkbox individu.
  - Mode default awal: **semua on**. User hanya mematikan yang tidak mau → simpan hanya override (yang off / grup toggled).
  - Tombol "Simpan" → `POST /api/portal/visibility` (body: `{ groupIdsOff: [...], appIdsOff: [...], appIdsOn: [...] }`) → tulis rows override + **set `onboardingDone = true`** → reload grid.
  - Tombol "Lewati" → `POST /api/portal/visibility` (body: `{ groupIdsOff: [], appIdsOff: [], appIdsOn: [] }`, flag `skip: true`) → delete semua rows user + **set `onboardingDone = true`** → seluruh app tampil (semua on). Wizard tidak muncul lagi di login berikutnya.

### Pengaturan pasca-login

Halaman `/portal/settings` (gear icon di header `/portal`):
- Daftar **semua** grup aktif + app di dalamnya (termasuk yang sudah disembunyikan), dengan toggle yang sama seperti wizard. Tujuan: user bisa memunculkan kembali app yang disembunyikan.
- Setiap perubahan langsung `PATCH /api/portal/visibility` (partial update, tidak perlu tombol simpan).
- Pengaturan mencerminkan status nyata: app dengan override `visible=false` muncul sebagai off; grup hidden + app override on → grup toggle on, app on.

Halaman grid `/portal` sendiri **hanya** menampilkan app yang tampil (tidak ada mekanisme reveal di sana — akses reveal lewat `/portal/settings`).

**App baru vs grup yang disembunyikan:** kalau admin menambahkan app baru ke grup yang sudah user sembunyikan (`visible=false`), app baru itu **tetap tersembunyi** bagi user tersebut (konsisten dengan aturan grup override). User bisa memunculkannya lewat `/portal/settings`.

### Query grid `/portal`

`getAccessiblePortalApps(userId)` diubah:
1. Ambil **semua app aktif** (tidak lagi dibatasi group/direct membership).
2. Ambil semua visibility rows user (1 query: `groupRows` where `groupId != null`, `appRows` where `appId != null`).
3. Ambil struktur grup: `PortalGroupApp` (group → apps) untuk pengelompokan & penentuan "grup hidden".
4. Filter: app di-exclude jika
   - ada row app `visible=false` → hidden, ATAU
   - grupnya punya row `visible=false` DAN tidak ada row app `visible=true` override.
5. Kelompokkan hasil per grup (indeks grup → apps terurut displayOrder+name). App tanpa grup → grup "Lainnya".
6. Sortir grup: name asc; dalam grup: displayOrder asc, name asc.

`APP_SELECT` ditambah `id` (sudah ada), `category`, dan dipakai konsisten.

### Perubahan berkas yang terlibat

| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | Tambah model `PortalUserAppVisibility` + kolom `onboardingDone` di `PortalUser` + relasi back di `PortalUser`/`PortalGroup`/`PortalApp` |
| `lib/portal-access.ts` | Ubah `getAccessiblePortalApps` (query visibility), tambah `getVisibilityProfile` + `saveVisibility` |
| `app/api/portal/visibility/route.ts` (baru) | POST simpan penuh (onboarding, set `onboardingDone`), PATCH partial (settings) |
| `app/portal/page.tsx` | Render wizard overlay saat `needsOnboarding`; passing user/pass profile |
| `components/portal/OnboardingWizard.tsx` (baru) | Wizard pertama-login |
| `components/portal/VisibilitySettings.tsx` (baru) | Halaman/panel pengaturan pasca-login |
| `app/portal/settings/page.tsx` (baru) | Route pengaturan |
| `lib/validation-schemas.ts` | Tambah `saveVisibilitySchema`/`patchVisibilitySchema` |
| `lib/audit.ts` (opsional) | Typing untuk action visibility kalau dibutuhkan |

### API

- `POST /api/portal/visibility` — onboarding: `{ groupIdsOff: string[], appIdsOff: string[], appIdsOn: string[], skip?: boolean }` → replace semua rows user (transactional delete+create) + **set `onboardingDone = true`** (skip=true → delete all rows, without creating). Guard: hanya user sendiri (session).
- `PATCH /api/portal/visibility` — settings: partial `{ groupId?: string, visible?: boolean }` / `{ appId?: string, visible?: boolean }` → create/update/delete satu row. Guard: hanya user sendiri.

Tidak ada peran admin baru. Admin tetap kelola `PortalGroup`/`PortalApp` via halaman yang ada.

### Error handling

- Validasi Zod di kedua endpoint (`saveVisibilitySchema`, `patchVisibilitySchema`).
- `$transaction` untuk replace (onboarding) — kalau gagal, rollback dan 500.
- Session/authorisasi: hanya pemilik user (session.user.id) yang bisa baca/tulis visibility-nya.
- Audit: log action `VISIBILITY_SAVE` (onboarding) dan `VISIBILITY_UPDATE` (per-toggle) via `logAudit` (non-blocking, `.catch(() => {})`).

### Testing

- Sebelum implementasi: tulis test kecil (satu script di `scripts/` atau `__tests__`) yang menguji `getVisibilityProfile` + `saveVisibility` untuk skenario: `onboardingDone=false` (wizard muncul), `onboardingDone=true` tanpa rows (wizard tidak muncul — hasil "Lewati"), sembunyikan grup, sembunyikan app, override app-on di grup-hidden, app baru setelah simpan.
- Verify manual di browser: login pertama → wizard → save → grid sesuai; toggle di settings → grid berubah seketika; app baru ditambah admin → tampil untuk user yang sudah onboarding.

## Batasan & Keputusan YAGNI

- **Tidak** ada audit "siapa menyembunyikan apa" (tidak diminta).
- **Tidak** ada animasi/tour bertahap — wizard satu langkah sederhana.
- **Tidak** ada mekanisme admin untuk mengatur visibility user (user mengatur sendiri).
- **Tidak** ada urutan grup kustom per-user (urutan pakai name asc).
- **Tidak** ada fitur "pin" app.
- `PortalUserGroup` / `PortalUserAppAccess` **tetap ada di schema** (tidak dihapus) — kompatibilitas dengan data lama & kredensial; hanya saja `getAccessiblePortalApps` tidak memfilter berdasarkan itu lagi. (Opsional migrasi cleanup di plan terpisah.)