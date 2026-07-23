# Specs & Implementation Plan — Portal Group-Based Access (RBAC via Grup)

> **Repo**: `torpedoliar/Anouncement-Dashboard-Local` · **Branch target**: `main` · **Basis**: commit `ef0fe1d` (portal-apps validation + Portal Karyawan link) · **Tanggal**: 22 Jul 2026 · **Executor**: Subagent **Xiaomi MiMo Pro 2.5**
> 

# 1. Latar Belakang & Masalah

Portal SSO saat ini mengatur akses lewat **binding langsung user → app** (`PortalUserAppAccess`, unique per `portalUserId + appId`). Konsekuensinya:

- Admin harus assign app **satu per satu** ke setiap user.
- Field `category` di `PortalApp` hanya label visual di grid, **tidak dipakai dalam access check**.
- Tidak ada entitas grup yang bisa di-attach ke user maupun app.

**Harapan (target behavior):**

1. Admin membuat **grup** (mis. `Accounting`, `Umum`) yang berisi kumpulan app.
2. Admin **binding user ke satu atau lebih grup**.
3. Saat login, user melihat **gabungan semua app dari grup-grupnya** di grid `/portal`.
4. User mengatur **kredensial masing-masing app** yang tampil (self-service, sudah ada via `/portal/credentials`).

# 2. Goals & Non-Goals

## Goals

- Model data grup: `PortalGroup`, `PortalGroupApp` (grup ↔ app), `PortalUserGroup` (user ↔ grup).
- Resolusi akses berbasis grup (union + dedup lintas grup) di `lib/portal-access.ts`.
- Admin UI: CRUD grup + assign app ke grup + assign grup ke user.
- API: `/api/portal-groups` + `/api/portal-groups/[id]` dengan validasi Zod dan audit log.
- Migration script tanpa kehilangan akses user existing.

## Non-Goals

- TIDAK mengubah mekanisme SSO form-based credential forwarding.
- TIDAK mengubah `PortalUserAppCredential` / enkripsi AES-256-GCM.
- TIDAK mengubah NextAuth portal (`lib/portal-auth.ts`), lockout, atau flow reset password.
- TIDAK mengubah CMS multi-site (`User`, sites, announcements).

# 3. Spesifikasi

## 3.1 Data Model (Prisma)

Tambahkan ke `prisma/schema.prisma` di bawah blok PORTAL SSO MODELS:

```
model PortalGroup {
  id          String   @id @default(cuid())
  name        String   @unique // "Accounting", "Umum"
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  apps    PortalGroupApp[]
  members PortalUserGroup[]

  @@index([isActive])
  @@map("portal_groups")
}

model PortalGroupApp {
  id      String @id @default(cuid())
  groupId String
  appId   String

  group PortalGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  app   PortalApp   @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@unique([groupId, appId])
  @@index([groupId])
  @@index([appId])
  @@map("portal_group_apps")
}

model PortalUserGroup {
  id           String @id @default(cuid())
  portalUserId String
  groupId      String

  portalUser PortalUser  @relation(fields: [portalUserId], references: [id], onDelete: Cascade)
  group      PortalGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([portalUserId, groupId])
  @@index([portalUserId])
  @@index([groupId])
  @@map("portal_user_groups")
}
```

Tambahkan relasi balik:

- `PortalUser`: `groups PortalUserGroup[]`
- `PortalApp`: `groupApps PortalGroupApp[]`

**Keputusan desain:** `PortalUserAppAccess` **dipertahankan** sebagai *override per-user* (exception di luar grup). Akses efektif user = `(app dari semua grup aktif user) ∪ (app dari direct access)`.

## 3.2 Logika Akses — `lib/portal-access.ts`

**`getAccessiblePortalApps(portalUserId)`** — aturan baru:

1. `PORTAL_ADMIN` → semua app aktif (tidak berubah).
2. `PORTAL_USER` → union + dedup (by `app.id`) dari:
    1. App via `PortalUserGroup → PortalGroup(isActive) → PortalGroupApp → PortalApp(isActive)`.
    2. App via `PortalUserAppAccess → PortalApp(isActive)` (direct override).
3. Sort hasil: `displayOrder asc`, lalu `name asc`.
4. Grup non-aktif (`isActive: false`) TIDAK berkontribusi app.

**`canAccessPortalApp(portalUserId, appId)`** — aturan baru:

1. User harus ada dan `isActive`.
2. `PORTAL_ADMIN` → `true`.
3. `true` jika ADA salah satu: direct access ATAU membership di grup aktif yang memuat app tsb. Implementasi dengan satu query Prisma `findFirst`/`count` memakai filter `OR` + `some` (hindari N+1).
4. `canAccessPortalAppBySlug` tidak berubah strukturnya (tetap resolve slug → id → cek).

## 3.3 API — `/api/portal-groups`

Ikuti pola existing `/api/portal-apps` (auth CMS SuperAdmin/session admin, Zod, pagination, audit):

| Method | Endpoint | Deskripsi |
| --- | --- | --- |
| GET | `/api/portal-groups?page=&limit=` | List grup + count member & app (pagination, limit max sesuai konstanta existing) |
| POST | `/api/portal-groups` | Buat grup `{ name, description?, isActive?, appIds: string[] }` |
| GET | `/api/portal-groups/[id]` | Detail grup + daftar app + daftar member |
| PUT | `/api/portal-groups/[id]` | Update grup + replace `appIds` (transactional: `deleteMany`  • `createMany` dalam `$transaction`) |
| DELETE | `/api/portal-groups/[id]` | Hapus grup (cascade membership & group-app) |
| PUT | `/api/portal-users/[id]` (extend) | Terima `groupIds: string[]` → replace `PortalUserGroup` (transactional) |

**Skema Zod** (tambahkan di `lib/validation-schemas.ts`):

```tsx
export const portalGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  appIds: z.array(z.string().cuid()).max(200).optional().default([]),
});
```

**Audit log** (`lib/audit.ts` / `logAudit`) wajib untuk: create/update/delete grup, perubahan `appIds` grup, perubahan `groupIds` user. Simpan diff ringkas (nama grup, jumlah app/member sebelum-sesudah).

## 3.4 Admin UI

**Halaman baru `/admin/portal-groups/page.tsx`** (pola dari `/admin/portal-apps/page.tsx`):

- Tabel: nama, deskripsi, jumlah app, jumlah member, status aktif.
- Modal create/edit: nama, deskripsi, toggle aktif, **multi-select app** (checkbox list dari `/api/portal-apps`).
- Delete dengan konfirmasi (tampilkan jumlah member yang terdampak).

**Update `/admin/portal-users/page.tsx`:**

- Tambah **multi-select grup** di modal user (data dari `/api/portal-groups`).
- Bagian assignment app langsung diberi label **"Akses Langsung (Override)"** agar jelas bedanya dengan akses via grup.
- Kolom tabel user menampilkan chip nama grup.

**Navigasi admin:** tambah menu "Portal Groups" di sidebar/menu admin yang sama dengan Portal Apps/Users/Sessions.

## 3.5 Portal User-Facing

- `/portal` (grid): tidak perlu perubahan selain sumber data `getAccessiblePortalApps` (sudah dipakai). Opsional: section header per `category` tetap seperti sekarang.
- `/portal/credentials`: PASTIKAN daftar app diambil dari `getAccessiblePortalApps` (bukan query terpisah), sehingga user langsung bisa set kredensial semua app hasil resolusi grup.
- `/portal/app/[appSlug]`: tidak berubah — `canAccessPortalAppBySlug` otomatis mengikuti logika baru.

## 3.6 Migrasi Data

Script `scripts/migrate-portal-groups.ts`:

1. Untuk setiap `category` unik pada `PortalApp` yang non-null → buat `PortalGroup` dengan nama = category (skip jika sudah ada).
2. Masukkan app ke grup sesuai category (`PortalGroupApp`).
3. `PortalUserAppAccess` existing **DIBIARKAN** (jadi direct override) — tidak ada user kehilangan akses.
4. Idempotent: aman dijalankan ulang (pakai `upsert`/cek unique constraint).
5. Log ringkasan: jumlah grup dibuat, app di-link, user terdampak = 0 (akses tidak berubah).

# 4. Implementation Plan — Executor: Subagent Xiaomi MiMo Pro 2.5

## 4.0 Protokol Eksekusi (MODE DISIPLIN — WAJIB DIBACA DULU)

<aside>
⚠️

Instruksi ini untuk subagent Xiaomi MiMo Pro 2.5. Kerjakan PERSIS seperti tertulis. DILARANG improvisasi, refactor di luar scope, ganti library, atau "perbaikan kecil" yang tidak diminta. Jika ragu → BLOCKED, bukan menebak.

</aside>

**Aturan eksekusi:**

1. Kerjakan task **berurutan**: TASK-100 → 101 → 102 → 103 → 104 → 105. DILARANG loncat, menggabung, atau paralel.
2. SEBELUM menulis kode di sebuah task, baca dulu SEMUA file di daftar "File" task tersebut. Jangan menebak isi file.
3. Kode yang sudah disediakan di §3 di-copy **verbatim**. Jangan mengubah nama model, field, `@@map`, atau constraint sedikit pun.
4. SETELAH tiap task: jalankan **Gate Global** di bawah + "Gate Verifikasi" milik task tersebut. Semua harus lulus SEBELUM lanjut.
5. Perintah gagal **2x berturut-turut dengan error sama** → STOP, tulis laporan BLOCKED. Jangan coba workaround kreatif.
6. Menemukan ambiguitas / kondisi yang tidak dijelaskan spec → STOP, laporkan BLOCKED dengan pertanyaan spesifik. Jangan mengambil asumsi sendiri.
7. **Satu commit per task**, format pesan: `feat(portal-groups): TASK-1xx - <deskripsi singkat>`.
8. Setiap task ditutup dengan laporan berformat §4.9. Tanpa bukti output perintah = task dianggap BELUM selesai.

**Gate Global (jalankan setelah SETIAP task, semua wajib lulus):**

```bash
npx tsc --noEmit                    # wajib exit 0
npm run build                       # wajib sukses tanpa error
git diff --name-only                # TIDAK BOLEH memuat: lib/portal-crypto.ts, lib/portal-auth.ts, app/api/portal-auth/
git status --porcelain | grep -E "dev\.db|\.env|\.sql"    # wajib KOSONG (tidak ada output)
```

## 4.1 Guardrails

- ❌ JANGAN menyentuh: `lib/portal-crypto.ts`, `lib/portal-auth.ts`, `app/api/portal-auth/**`, flow forgot/reset password, model `PortalUserAppCredential`, seluruh kode CMS multi-site.
- ❌ JANGAN mengubah signature publik `canAccessPortalApp`, `canAccessPortalAppBySlug`, `getAccessiblePortalApps`, `hasCredential` — hanya isi implementasinya.
- ❌ JANGAN commit `dev.db`, file `.env`, atau backup SQL.
- ✅ Semua endpoint baru WAJIB: cek session admin (pola sama dengan `/api/portal-apps`), validasi Zod, pagination limit, `logAudit`.
- ✅ Setiap task diakhiri `npx tsc --noEmit` dan `npm run build` hijau sebelum lanjut.

## TASK-100 — Recon & Baseline (READ-ONLY, tanpa edit apa pun)

**File yang dibaca:** `prisma/schema.prisma`, `lib/portal-access.ts`, `app/api/portal-apps/route.ts`, `app/api/portal-apps/[id]/route.ts`, `app/api/portal-users/[id]/route.ts`, `lib/validation-schemas.ts`, `lib/audit.ts`, `app/admin/portal-apps/page.tsx`, `app/admin/portal-users/page.tsx`, `app/portal/credentials/page.tsx`.

**Langkah:**

1. `git status --porcelain` → wajib kosong (working tree bersih). Jika tidak → BLOCKED.
2. `npm run build` → wajib hijau sebagai baseline. Jika gagal SEBELUM ada perubahan → BLOCKED (memperbaiki build bukan tugasmu).
3. `grep -rn "getAccessiblePortalApps" app/ lib/ --include="*.ts*"` → catat semua call site di laporan.
4. `grep -rn "PortalUserAppAccess\|appAccess" app/ lib/ --include="*.ts*"` → catat semua call site. Jika ada pemakaian di LUAR `lib/portal-access.ts`, `app/admin/portal-users/page.tsx`, dan `app/api/portal-users/**` → BLOCKED, laporkan file + baris.
5. Baca dan catat pola auth check, Zod, pagination, dan `logAudit` di `app/api/portal-apps/route.ts` — pola ini yang WAJIB ditiru di TASK-103.
6. Temukan file navigasi admin: `grep -rn "portal-apps" app/admin/ components/ --include="*.tsx" -l` → catat file yang memuat menu (dipakai TASK-104).

**Gate Verifikasi:** laporan memuat semua output grep di atas, dan `git status --porcelain` tetap kosong (tidak ada file berubah).

## TASK-101 — Schema & Migration

**File yang boleh diedit:** `prisma/schema.prisma` (SATU-SATUNYA file yang diedit manual di task ini; folder `prisma/migrations/` terbentuk otomatis).

**Langkah:**

1. Copy 3 model dari §3.1 **verbatim** ke bawah blok PORTAL SSO MODELS.
2. Tambah relasi balik: `groups PortalUserGroup[]` di `PortalUser` dan `groupApps PortalGroupApp[]` di `PortalApp`. Jangan menyentuh field lain.
3. `npx prisma migrate dev --name portal_groups`
4. `npx prisma generate`

**Gate Verifikasi:**

```bash
npx prisma validate            # exit 0
grep -c "@@map(\"portal_groups\")\|@@map(\"portal_group_apps\")\|@@map(\"portal_user_groups\")" prisma/schema.prisma   # hasil: 3
git diff --name-only           # hanya prisma/schema.prisma + prisma/migrations/**
```

**Acceptance:** migration up bersih di DB dev; tabel `portal_groups`, `portal_group_apps`, `portal_user_groups` ada dengan unique constraints sesuai §3.1.

**STOP jika:** migrate gagal → BLOCKED. DILARANG mengedit file SQL migration secara manual.

## TASK-102 — Access Logic

**File yang boleh diedit:** `lib/portal-access.ts` (SATU-SATUNYA file).

**Langkah:**

1. Update `getAccessiblePortalApps` sesuai §3.2: union + dedup by `app.id`, sort `displayOrder asc` lalu `name asc`. Maksimal 2 query Prisma.
2. Update `canAccessPortalApp` sesuai §3.2: satu query `count`/`findFirst` dengan filter `OR` + `some`.
3. Signature keempat fungsi export TIDAK berubah. `canAccessPortalAppBySlug` dan `hasCredential` TIDAK diedit.
4. Buat seed data uji (via `npx prisma studio` atau script sementara yang TIDAK di-commit): grup `Accounting` (2 app), grup `Umum` (1 app, 1 di antaranya overlap dengan Accounting), user per skenario acceptance.

**Acceptance (uji dengan seed, tulis hasil tiap butir di laporan):**

- [ ]  User di grup `Accounting` (2 app) → grid menampilkan 2 app.
- [ ]  User di grup `Accounting` + `Umum` (1 app overlap) → hasil union tanpa duplikat.
- [ ]  Grup di-nonaktifkan → app dari grup itu hilang dari grid user (kecuali ada direct access).
- [ ]  Direct access tanpa grup tetap berfungsi (regresi = tidak ada).
- [ ]  `PORTAL_ADMIN` tetap melihat semua app aktif.

**Gate Verifikasi:**

```bash
git diff --name-only           # hanya lib/portal-access.ts
```

**STOP jika:** butuh mengubah signature salah satu fungsi export → BLOCKED.

## TASK-103 — API Portal Groups

**File yang boleh dibuat/diedit:** `app/api/portal-groups/route.ts` (baru), `app/api/portal-groups/[id]/route.ts` (baru), `app/api/portal-users/[id]/route.ts` (extend `groupIds` saja), `lib/validation-schemas.ts` (tambah `portalGroupSchema` saja).

**Langkah:**

1. Copy `portalGroupSchema` dari §3.3 **verbatim** ke `lib/validation-schemas.ts`.
2. Buat kedua route dengan meniru PERSIS pola `app/api/portal-apps/route.ts` dan `app/api/portal-apps/[id]/route.ts` (auth check, error handling, pagination, bentuk response) — yang berbeda hanya model & schema. Jangan menciptakan pola baru.
3. PUT replace `appIds` (grup) dan `groupIds` (user) WAJIB atomik: `prisma.$transaction([deleteMany, createMany])`.
4. Panggil `logAudit` untuk SEMUA mutasi (create/update/delete grup, perubahan `appIds`/`groupIds`) dengan pola yang sama seperti mutasi portal-apps.

**Acceptance (tulis hasil tiap butir di laporan):**

- [ ]  POST tanpa session admin → 401/403.
- [ ]  POST `name` duplikat → 400 dengan pesan jelas (bukan 500).
- [ ]  PUT replace `appIds` bersifat atomik (`$transaction`).
- [ ]  DELETE grup → membership ikut terhapus (cascade), app & credential TIDAK terhapus.
- [ ]  Entri audit muncul di `/admin/audit-trail` untuk tiap mutasi.

**Gate Verifikasi:**

```bash
grep -n "logAudit" app/api/portal-groups/route.ts "app/api/portal-groups/[id]/route.ts"    # min. 1 per method mutasi
grep -n "transaction" "app/api/portal-groups/[id]/route.ts" "app/api/portal-users/[id]/route.ts"   # ada di kedua file
git diff --name-only           # hanya 4 file di daftar task ini
```

**STOP jika:** pola auth di `portal-apps` berbeda dari asumsi §3.3 → tiru pola yang ADA di repo; jika tidak ada pola yang bisa ditiru → BLOCKED.

## TASK-104 — Admin UI

**File yang boleh dibuat/diedit:** `app/admin/portal-groups/page.tsx` (baru), `app/admin/portal-users/page.tsx` (edit), file navigasi admin hasil temuan TASK-100 langkah 6 (edit).

**Langkah:**

1. Duplikasi struktur `app/admin/portal-apps/page.tsx` sebagai kerangka `portal-groups/page.tsx`, lalu sesuaikan field form dengan §3.4. Pakai class/style/komponen yang SAMA — dilarang menulis gaya UI baru.
2. Modal grup: nama, deskripsi, toggle aktif, checkbox list app (data dari `/api/portal-apps?limit=100`).
3. Di `portal-users/page.tsx`: tambah multi-select grup (data dari `/api/portal-groups?limit=100`), ubah label bagian assignment app langsung menjadi "Akses Langsung (Override)", tampilkan chip nama grup di tabel user.
4. Tambah menu "Portal Groups" bersebelahan dengan menu Portal Apps di file navigasi hasil TASK-100.

**Acceptance (tulis hasil tiap butir di laporan):**

- [ ]  Buat grup `Accounting`, isi app web accounting → tersimpan, muncul di tabel.
- [ ]  Binding user ke `Accounting` dari halaman users → tersimpan.
- [ ]  UI konsisten dengan tema admin existing (dark, Santos Red).

**Gate Verifikasi:**

```bash
git diff --name-only           # hanya 3 file di daftar task ini
```

## TASK-105 — Migrasi Data & Credentials Page

**File yang boleh dibuat/diedit:** `scripts/migrate-portal-groups.ts` (baru), `app/portal/credentials/page.tsx` (HANYA jika belum memakai `getAccessiblePortalApps`).

**Langkah:**

1. Tulis script sesuai §3.6. WAJIB idempotent (`upsert`/cek unique constraint). DILARANG menghapus atau mengubah baris `PortalUserAppAccess`.
2. Jalankan script **2x berturut-turut**; tempel output run ke-2 di laporan (wajib 0 error, 0 duplikasi).
3. `grep -n "getAccessiblePortalApps" app/portal/credentials/page.tsx` → jika halaman memakai query sendiri, ganti sumber datanya ke `getAccessiblePortalApps`. Jika SUDAH memakai, JANGAN edit file ini.

**Acceptance (tulis hasil tiap butir di laporan):**

- [ ]  Script jalan 2x tanpa error/duplikasi.
- [ ]  Tidak ada user kehilangan akses (bandingkan daftar app per user sebelum vs sesudah).
- [ ]  User grup bisa set kredensial app grupnya di `/portal/credentials` lalu SSO launch sukses.

**Gate Verifikasi:**

```bash
git diff --name-only           # maksimal 2 file di daftar task ini
```

## Smoke Test End-to-End (wajib sebelum DONE)

1. Admin buat grup `Accounting` berisi 1 app web accounting.
2. Admin binding user `budi@example.com` ke grup `Accounting` saja.
3. Login sebagai budi → `/portal` hanya menampilkan app accounting.
4. Budi set kredensial di `/portal/credentials` → health indicator hijau.
5. Budi klik app → auto-submit form ke `loginUrl` → berhasil masuk app target.
6. Admin tambah budi ke grup `Umum` → app umum ikut muncul tanpa logout/login ulang sesi berikutnya.
7. Admin nonaktifkan grup `Accounting` → app accounting hilang dari grid budi.
8. Cek `/admin/audit-trail` → semua mutasi grup/membership tercatat.

## 4.9 Format Laporan (WAJIB per task, tanpa ini task belum selesai)

```
TASK-1xx : DONE | BLOCKED
File berubah   : <tempel output `git diff --name-only`>
Gate Global    : tsc [OK/FAIL] · build [OK/FAIL] · guardrail-diff [OK/FAIL] · secret-check [OK/FAIL]
Gate Task      : <hasil tiap perintah Gate Verifikasi + potongan output>
Acceptance     : x/y lulus — sebutkan butir yang gagal (jika ada)
Commit         : <hash + pesan commit>
Catatan        : <jika BLOCKED: file, baris, error VERBATIM, dan pertanyaan spesifik>
```

## Kriteria DONE / BLOCKED

**DONE** jika SEMUA terpenuhi:

1. TASK-100 s/d 105 berstatus DONE dengan laporan format §4.9 + bukti output.
2. Smoke Test E2E langkah 1–8 lulus semua.
3. `npm run build` hijau di kondisi akhir.
4. `git log --oneline` menunjukkan tepat 1 commit per task (TASK-101 s/d 105) dengan format pesan sesuai protokol.
5. `git diff <basis>..HEAD --name-only` TIDAK memuat file guardrail, `dev.db`, `.env`, atau `*.sql`.

**BLOCKED** jika salah satu terjadi (STOP segera, laporkan, JANGAN improvisasi):

- Working tree tidak bersih atau build baseline gagal (TASK-100).
- Migration gagal di DB dev.
- Ditemukan pemakaian `PortalUserAppAccess` di luar file yang diizinkan (TASK-100 langkah 4).
- Perintah gagal 2x berturut-turut dengan error sama.
- Spec ambigu / kondisi tidak terdefinisi / butuh mengubah signature fungsi export.

Laporan BLOCKED wajib memuat: file + baris, error verbatim, dan pertanyaan spesifik yang menunggu jawaban. Setelah lapor BLOCKED → berhenti total, jangan lanjut ke task berikutnya.