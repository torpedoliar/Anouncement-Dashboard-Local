# Fase 4 — Portal User Experience

> Specs referensi: `02-authentication` §4, `03-rbac`, `04-sso` §6/§8, `06-api` §4, `07-pages` §1
> Milestone: M4 · Prasyarat: **Fase 3** (butuh user + access untuk di-test)

## Objective

Membangun pengalaman user portal: halaman login, layout guard, grid aplikasi (dengan
RBAC filter + health indicator), halaman kelola kredensial sendiri, dan alur lupa/reset
password. Setelah fase ini, user portal bisa login, melihat app yang diizinkan, dan
menyimpan kredensial untuk tiap app.

## Prerequisites

- [ ] Fase 3 selesai (ada `PortalUser` + `PortalUserAppAccess` untuk test)
- [ ] `lib/portal-auth.ts` + `lib/portal-access.ts` tersedia (dari Fase 1)
- [ ] Ada minimal 1 portal user + 1 app + 1 access assignment (buat via Fase 3 atau seed)

## Task list

### 4.1 Halaman login portal

- [ ] Buat `app/portal-login/page.tsx` (client component):
  - [ ] Form email + password; `signIn("credentials", { email, password, redirect:false })`
    — NextAuth akan route ke `/api/portal-auth/...` (cookie prefix beda → instance portal)
  - [ ] **Penting:** konfigurasi `signIn` agar pakai portal endpoint. NextAuth `signIn`
    default pakai `/api/auth/...`. Solusi: set `csrfToken` endpoint atau pakai custom fetch
    ke `/api/portal-auth/callbacks/credentials`. Alternatif: form POST langsung
    ke `/api/portal-auth/callback/credentials`.
    → **Rekomendasi:** test dulu `signIn("credentials", {...})` — jika cookie bentrok,
    pakai custom POST fetch ke portal endpoint + set cookie manual. Lihat `08-security` §7.
  - [ ] Lockout UX: tampilkan pesan error "Akun terkunci. Coba lagi dalam X menit."
  - [ ] Loading state; error state (email tidak ditemukan, password salah, akun nonaktif)
  - [ ] Redirect sukses → `router.push("/portal")`
  - [ ] Link "Lupa password?" → `/portal/forgot-password`
  - [ ] Inline-style dark UI (mirror `/admin-login` tapi branding "Portal SSO")

### 4.2 Layout guard portal

- [ ] Buat `app/portal/layout.tsx` (server component):
  - [ ] `getServerSession(portalAuthOptions)` → redirect `/portal-login` jika tidak login
  - [ ] Render `<PortalHeader userName={session.user.name} />` + `<main>{children}</main>`
- [ ] Buat `components/portal/PortalHeader.tsx` (client):
  - [ ] Logo + nama user + tombol Logout (`signOut({ callbackUrl:"/portal-login" })`)
  - [ ] Link: "Aplikasi" → `/portal`, "Kredensial" → `/portal/credentials`,
    "Pengaturan" → `/portal/settings`
  - [ ] Responsif (mobile menu toggle, pola AdminSidebar)

### 4.3 Grid aplikasi

- [ ] Buat `app/portal/page.tsx` (server, `export const dynamic = "force-dynamic"`):
  - [ ] `getServerSession(portalAuthOptions)` → userId
  - [ ] `getAccessiblePortalApps(userId)` → daftar app
  - [ ] Per app: cek `hasCredential(userId, appId)` → health indicator
    (optimasi: satu query left-join credential, hindari N+1)
  - [ ] Render grid `AppCard` per app
  - [ ] Filter kategori (dropdown) + search (client-side atau server query param)
  - [ ] Kosong: "Anda belum punya akses ke aplikasi apapun. Hubungi administrator."
- [ ] Buat `components/portal/AppCard.tsx`:
  - [ ] Logo (atau placeholder), name, description, category
  - [ ] Health indicator: ✓ "Kredensial tersimpan" / ⚠ "Belum ada kredensial"
  - [ ] Tombol: "Buka Aplikasi" → `/portal/app/[slug]` (jika ada cred) ATAU
    "Simpan Kredensial" → `/portal/credentials?app=[slug]` (jika belum)
  - [ ] Inline-style dark UI

### 4.4 API kredensial (user self-service)

- [ ] Buat `app/api/portal/credentials/route.ts`:
  - [ ] `GET` — `getServerSession(portalAuthOptions)` → list app + status
    `[{ appId, appName, appSlug, hasCredential, lastUsedAt }]` (no plaintext)
  - [ ] `POST` — body `PortalCredentialSchema`; cek `canAccessPortalApp(userId, appId)`;
    `encryptCredential({username, password, extra})` → upsert `PortalUserAppCredential`;
    `logAudit({ action:"CREDENTIAL_SAVED"/"_UPDATED", category:"SECURITY" })`
- [ ] Buat `app/api/portal/credentials/[appId]/route.ts`:
  - [ ] `DELETE` — owner check; `logAudit` `CREDENTIAL_DELETED`

### 4.5 Halaman kelola kredensial

- [ ] Buat `app/portal/credentials/page.tsx` (client component):
  - [ ] Daftar app yang diakses (`GET /api/portal/credentials`)
  - [ ] Per app: form input username + password (type=password) + extra fields (jika app punya)
  - [ ] State: "Kredensial tersimpan (last used: ...)" + tombol Update / Hapus
    ATAU "Belum ada" + tombol Simpan
  - [ ] **Password field tidak pernah di-prefill** (tidak retrieve plaintext)
  - [ ] Query param `?app=[slug]` → auto-scroll/expand app tsb (dari link AppCard)
  - [ ] `logAudit` otomatis via API

### 4.6 Lupa & reset password

- [ ] Buat `app/portal/forgot-password/page.tsx` (client):
  - [ ] Form email → POST ke API (atau server action) → generate reset token
  - [ ] Simpan `resetTokenHash` + `resetTokenExpiresAt` di `PortalUser`
    (tambah 2 kolom di schema Fase 1, atau tabel `PortalPasswordReset` terpisah)
  - [ ] Kirim email via `lib/email.ts` (nodemailer + handlebars) dengan reset link
  - [ ] UX: "Jika email terdaftar, link reset telah dikirim." (no user enumeration)
  - [ ] `logAudit` `PASSWORD_RESET_REQUESTED`
- [ ] Buat `app/portal/reset-password/page.tsx` (client):
  - [ ] Query `?token=...` → validasi token (compare hash, cek expiry)
  - [ ] Form password baru + konfirmasi → POST → `bcrypt.hash` → update
  - [ ] Invalidate token setelah dipakai
  - [ ] `logAudit` `PASSWORD_RESET_COMPLETED`
  - [ ] Redirect `/portal-login` dengan pesan sukses

### 4.7 Komponen failure (untuk Fase 5, sekalian buat)

- [ ] Buat `components/portal/AccessDenied.tsx` — "Anda tidak punya akses ke [AppName]"
- [ ] Buat `components/portal/NoCredential.tsx` — "Belum simpan kredensial" + tombol link
- [ ] Buat `components/portal/CorruptCredential.tsx` — "Kredensial rusak, simpan ulang"

### 4.8 Halaman pengaturan (opsional)

- [ ] Buat `app/portal/settings/page.tsx` (client):
  - [ ] Ubah password sendiri (password lama + baru) → API internal
  - [ ] Lihat sesi sendiri (`GET /api/portal-sessions` milik sendiri) + revoke

## Definition of Done (DoD)

- [ ] Login portal berfungsi: user dari Fase 3 bisa login → redirect `/portal`
- [ ] `/portal` menampilkan grid app sesuai RBAC (hanya app yang di-assign)
- [ ] Health indicator benar: app tanpa kredensial → ⚠; dengan kredensial → ✓
- [ ] Simpan kredensial berfungsi (verifikasi `credentialBlob` ter-encrypt di DB)
- [ ] Hapus kredensial berfungsi
- [ ] Lupa password: email terkirim (cek mailtrap/log); reset via token sukses
- [ ] Layout guard: akses `/portal` tanpa login → redirect `/portal-login`
- [ ] Logout berfungsi → kembali ke `/portal-login`
- [ ] Sesi portal muncul di `/admin/portal-sessions` (Fase 3) setelah login
- [ ] `npm run build && npm run lint` sukses

## Validation steps
```bash
npm run build && npm run lint
# Manual (gunakan user dari Fase 3):
# 1. /portal-login → login dengan portal user → redirect /portal
# 2. /portal → lihat grid (app yang di-assigned muncul, lain tidak)
# 3. Klik "Simpan Kredensial" → input username/password → simpan
#    → cek DB: portal_user_app_credentials.credentialBlob terisi (bukan plaintext!)
# 4. Refresh /portal → health indicator jadi ✓
# 5. /portal-login → logout → login lagi → masih bisa akses
# 6. Test lockout: login salah 5x → "Akun terkunci 15 menit"
# 7. /portal/forgot-password → input email → cek email (dev: console log nodemailer)
# 8. Klik reset link → set password baru → login dengan password baru
# 9. Akses /portal tanpa cookie (incognito) → redirect /portal-login
```

## Rollback notes
- Halaman portal baru tidak mengganggu `/admin` atau `/site`. Revert = hapus file portal.
- Kredensial yang sudah disimpan tetap di DB (terenkripsi) — aman ditinggal.
