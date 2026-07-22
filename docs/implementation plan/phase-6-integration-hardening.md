# Fase 6 — Integration & Hardening

> Specs referensi: `08-security.md`, `10-changelog-and-env.md`, `07-pages` §4-§5
> Milestone: M6 · Prasyarat: **Semua fase 1-5**

## Objective

Menyatukan semua: update backup/restore untuk cover tabel portal+audit, update middleware
(portal route + rate-limit), update seed, update docker-compose env, bump version,
update CLAUDE.md, dan buat script helper. Setelah fase ini, sistem production-ready.

## Prerequisites

- [ ] Fase 1-5 selesai & ter-validasi
- [ ] (Jika Fase 2 backup belum di-update, pastikan sekarang)

## Task list

### 6.1 Backup/restore lengkap

- [ ] Verifikasi/update `app/api/backup/route.ts`:
  - [ ] Backup include: `portal_users`, `portal_apps`, `portal_user_app_access`,
    `portal_user_app_credentials`, `portal_sessions`, `audit_logs`
  - [ ] Restore urutan: PortalApp → PortalUser → PortalUserAppAccess →
    PortalUserAppCredential → PortalSession → AuditLog (perhatian FK)
  - [ ] Catatan: `credentialBlob` sudah encrypted → aman di-backup as-is
  - [ ] `AuditLog` bisa di-skip dari backup jika terlalu besar (opsional, tergantung policy)
- [ ] Test: backup → restore di DB kosong → verifikasi semua tabel portal ada

### 6.2 Middleware update

- [ ] Edit `middleware.ts`:
  - [ ] Tambah ke `config.matcher`: `'/portal/:path*'`, `'/portal-login'`, `'/api/portal-auth/:path*'`
  - [ ] Rate-limit: `if (path.includes('/portal-auth') || path.includes('/portal-login')) { maxRequests = 10; }`
  - [ ] Security headers tetap berlaku untuk `/portal/*` (sudah otomatis via matcher)

### 6.3 Seed update

- [ ] Edit `prisma/seed.ts` — tambah (sesuai `10-changelog-and-env.md` §4):
  - [ ] Portal admin: `portal.admin@santosjayaabadi.co.id` / `portal-admin-123` (role PORTAL_ADMIN)
  - [ ] Portal user demo: `portal.user@santosjayaabadi.co.id` / `portal-user-123`
  - [ ] Sample app: `example-erp` (loginUrl dummy)
  - [ ] Assign access: portal user → sample app
  - [ ] Pakai `upsert` (idempoten)
- [ ] Jalankan: `npm run prisma:seed`
- [ ] Verifikasi: login portal dengan seed user berhasil

### 6.4 Docker-compose env

- [ ] Edit `docker-compose.yml` — tambah di service `web.environment`:
  - [ ] `PORTAL_CREDENTIAL_KEY=CHANGE_THIS_KEY` (catatan: ganti di production!)
  - [ ] `AUDIT_RETENTION_DAYS=365`
  - [ ] `PORTAL_SESSION_MAX_AGE=43200`

### 6.5 Script helpers

- [ ] Buat `scripts/make-portal-admin.ts` (sesuai `10-changelog` §5):
  - [ ] Promote portal user ke PORTAL_ADMIN by email
  - [ ] `npx tsx scripts/make-portal-admin.ts <email>`
- [ ] (Future) `scripts/rotate-portal-key.ts` — re-encrypt semua credential dengan key baru

### 6.6 Version & docs

- [ ] Edit `version.json`: `version` 2.7.0 → 3.0.0, `schemaVersion` 8 → 9,
  `releaseNotes` update (lihat `10-changelog` §1), `buildDate` update
- [ ] Edit `CLAUDE.md` — tambah section (sesuai `10-changelog` §6):
  - [ ] "### Portal SSO (separate from CMS)" — ringkasan file kunci + mekanisme
  - [ ] "### Audit Trail" — `AuditLog` + `logAudit()` + `/admin/audit-trail`
  - [ ] "### Required env (additional)" — `PORTAL_CREDENTIAL_KEY`, `AUDIT_RETENTION_DAYS`

### 6.7 Env validation final

- [ ] Verifikasi `.env.example` punya semua env baru dengan komentar
- [ ] Verifikasi `instrumentation.ts` (dari Fase 1) fail-closed untuk `PORTAL_CREDENTIAL_KEY`
- [ ] Verifikasi `.env` lokal punya key valid (64 hex)

### 6.8 Navigasi root (opsional)

- [ ] Edit `next.config.ts` atau `middleware.ts` — strategi root `/`:
  - [ ] **Rekomendasi MVP:** tetap `/` → `/site` (publik). Portal via `/portal` eksplisit.
  - [ ] (Opsional) tambah link "Portal Karyawan" di `/site` footer → `/portal-login`

## Definition of Done (DoD)

- [ ] Backup/restore mencakup semua tabel portal + audit (test restore di DB kosong)
- [ ] Middleware: `/portal/*` & `/portal-login` di matcher; rate-limit portal-auth 10/min
- [ ] Test: akses `/portal` tanpa login → redirect `/portal-login` (middleware + layout guard)
- [ ] Seed: `npm run prisma:seed` sukses; login portal dengan seed user berhasil
- [ ] docker-compose punya 3 env baru
- [ ] `scripts/make-portal-admin.ts` berfungsi (test promote user)
- [ ] `version.json`: 3.0.0 / schema 9
- [ ] `CLAUDE.md` punya section Portal SSO + Audit Trail + env
- [ ] `.env.example` lengkap & `instrumentation.ts` fail-closed teruji
- [ ] Full `npm run build && npm run lint` sukses
- [ ] End-to-end smoke test (lihat validation) lulus

## Validation steps
```bash
npm run prisma:generate && npm run build && npm run lint
npm run prisma:seed

# End-to-end smoke test:
# 1. Login admin (SuperAdmin) → /admin/portal-apps → buat app
# 2. /admin/portal-users → buat user → assign access
# 3. /admin/portal-users → reset password
# 4. Login portal (seed user) → /portal → lihat grid
# 5. /portal/credentials → simpan kredensial → verifikasi encrypted di DB
# 6. /portal/app/[slug] → SSO launch → app eksternal terima POST
# 7. /admin/audit-trail → verifikasi: PORTAL_USER_CREATED, ACCESS_GRANTED,
#    PORTAL_LOGIN_SUCCESS, CREDENTIAL_SAVED, SSO_LAUNCH semua tercatat
# 8. Test lockout: login salah 5x → terkunci
# 9. /admin → backup → restore di staging → verifikasi tabel portal ada
# 10. npx tsx scripts/make-portal-admin.ts portal.user@... → role jadi PORTAL_ADMIN

# Docker deploy test:
docker-compose up --build
docker-compose exec -T web npx prisma migrate deploy
```

## Production deployment
```bash
# 1. Set env production (PORTAL_CREDENTIAL_KEY = openssl rand -hex 32)
# 2. Backup DB eksisting
# 3. git pull (atau build image baru)
docker-compose up --build
docker-compose exec -T web npx prisma migrate deploy
docker-compose exec -T web npx tsx scripts/backfill-audit-log.ts
docker-compose exec -T web npm run prisma:seed  # (opsional, untuk seed awal)
# 4. Smoke test production
```

## Rollback notes
- Migrasi non-destructive → revert code = fungsi lama kembali jalan (tabel baru tidak ganggu).
- Jika backfill bermasalah: `TRUNCATE audit_logs` (data derived dari ActivityLog lama) → re-run.
- Jika credential key salah sebelum user simpan kredensial: aman ganti key (belum ada data).
- Jika key salah SETELAH user simpan: jalankan `scripts/rotate-portal-key.ts` (future) atau
  minta user re-simpan kredensial (acceptable untuk fresh deploy).
