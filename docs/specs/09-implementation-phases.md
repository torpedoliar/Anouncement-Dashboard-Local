# 09 — Implementation Phases

> 6 fase berurutan. Tiap fase menghasilkan yang bisa di-build & di-test.
> Validasi per fase: `npm run build` + `npm run lint` + manual test.

## Fase 1: Fondasi Data & Auth

**Lingkup:** Skema Prisma + crypto + auth portal + logging auth CMS.

**File baru:**
- `lib/portal-crypto.ts` — AES-256-GCM encrypt/decrypt
- `lib/portal-auth.ts` — NextAuth instance portal (cookie prefix terpisah)
- `lib/audit.ts` — helper `logAudit()` terpusat (redaksi + IP/UA)
- `lib/portal-access.ts` — helper permission RBAC portal
- `app/api/portal-auth/[...nextauth]/route.ts` — handler auth portal
- `instrumentation.ts` — validasi env saat startup

**File dimodifikasi:**
- `prisma/schema.prisma` — + enum (PortalRole, PortalAppRole, PortalSsoMode,
  AuditActor, AuditOutcome, AuditCategory) + 6 model (PortalUser, PortalApp,
  PortalUserAppAccess, PortalUserAppCredential, PortalSession, AuditLog)
- `lib/auth.ts` — + `logAudit` LOGIN_SUCCESS/FAILED/LOGOUT (CMS)
- `lib/validation-schemas.ts` — + PortalUserCreate/Update, PortalAppCreate/Update,
  PortalCredential schemas
- `types/next-auth.d.ts` — + tipe sesi portal
- `.env.example` — + `PORTAL_CREDENTIAL_KEY`, `AUDIT_RETENTION_DAYS`

**Langkah:**
1. Edit `schema.prisma` → `npm run prisma:generate` → `npm run prisma:migrate --name add_portal_and_audit`
2. Buat `lib/portal-crypto.ts`, `lib/audit.ts`, `lib/portal-access.ts`, `lib/portal-auth.ts`
3. Buat `app/api/portal-auth/[...nextauth]/route.ts`
4. Update `lib/auth.ts` (tambah logging auth)
5. Update `lib/validation-schemas.ts` + `types/next-auth.d.ts`
6. Buat `instrumentation.ts`
7. `npm run build && npm run lint`

## Fase 2: Audit Trail (retrofit + halaman)

**Lingkup:** Retrofit `logAudit` ke semua route mutasi + halaman audit terpadu + export.

**File baru:**
- `app/api/audit-trail/route.ts` — GET list + filter + export CSV/JSON
- `app/api/audit-trail/[id]/route.ts` — GET detail
- `app/admin/audit-trail/page.tsx` — halaman audit terpadu (filter, export, detail)
- `scripts/backfill-audit-log.ts` — backfill ActivityLog → AuditLog

**File dimodifikasi (retrofit `logAudit`):**
- `app/api/announcements/route.ts` + `[id]/route.ts` + `bulk/route.ts`
- `app/api/categories/route.ts` + `[id]/route.ts`
- `app/api/comments/[id]/route.ts`
- `app/api/users/route.ts` + `[id]/route.ts`
- `app/api/sessions/route.ts`
- `app/api/settings/route.ts`
- `app/api/email/settings/route.ts`
- `app/api/backup/route.ts` — + tabel portal & audit di backup/restore
- `app/api/update/route.ts`
- `lib/scheduler.ts` — + retensi audit purge
- `components/admin/AdminSidebar.tsx` — ganti "AUDIT LOG" → "AUDIT TRAIL"
- `app/admin/audit-logs/page.tsx` — redirect ke `/admin/audit-trail`

**Langkah:**
1. Retrofit setiap route: tambah `logAudit(...)` disamping `ActivityLog.create` lama
2. Buat API + halaman audit trail
3. Tambah retensi di `lib/scheduler.ts`
4. Jalankan `npx tsx scripts/backfill-audit-log.ts`
5. Hapus `ActivityLog.create` dari route (setelah backfill diverifikasi)
6. `npm run build && npm run lint`

## Fase 3: Admin Portal Management

**Lingkup:** Halaman admin untuk kelola app + user portal + sesi.

**File baru:**
- `app/api/portal-apps/route.ts` + `[id]/route.ts` — CRUD app
- `app/api/portal-users/route.ts` + `[id]/route.ts` + `[id]/access/route.ts`
  + `[id]/reset-password/route.ts` + `[id]/status/route.ts`
- `app/api/portal-sessions/route.ts` — list + revoke
- `app/admin/portal-apps/page.tsx` — manajemen app
- `app/admin/portal-users/page.tsx` — manajemen user portal + RBAC
- `app/admin/portal-sessions/page.tsx` — manajemen sesi portal

**File dimodifikasi:**
- `components/admin/AdminSidebar.tsx` — + menu PORTAL APPS, PORTAL USERS, PORTAL SESI

**Langkah:**
1. Buat semua API route (mengikuti pola `getServerSession` + Zod + `logAudit`)
2. Buat halaman admin (client component, inline-style dark UI)
3. Update sidebar
4. `npm run build && npm run lint`
5. Manual test: create app → create user → assign access → reset password

## Fase 4: Portal User Experience

**Lingkup:** Login portal + grid app + kelola kredensial + lupa password.

**File baru:**
- `app/portal-login/page.tsx` — login portal (client)
- `app/portal/layout.tsx` — guard sesi portal + header (server)
- `app/portal/page.tsx` — grid app (server, force-dynamic)
- `app/portal/credentials/page.tsx` — kelola kredensial (client)
- `app/portal/forgot-password/page.tsx` — lupa password (client)
- `app/portal/reset-password/page.tsx` — reset via token (client)
- `app/portal/settings/page.tsx` — pengaturan akun (client, opsional)
- `app/api/portal/credentials/route.ts` + `[appId]/route.ts` — CRUD credential
- `components/portal/PortalHeader.tsx` — header portal (logout)
- `components/portal/AppCard.tsx` — card app dengan health indicator
- `components/portal/AccessDenied.tsx`, `NoCredential.tsx`, `CorruptCredential.tsx`

**Langkah:**
1. Buat login page → test login dengan user yang dibuat di Fase 3
2. Buat layout guard → test redirect jika tidak login
3. Buat grid app → test filter RBAC (hanya app yang di-assign)
4. Buat credentials page → test save/delete kredensial (cek enkripsi di DB)
5. Buat forgot/reset password
6. `npm run build && npm run lint`

## Fase 5: SSO Launch

**Lingkup:** Halaman launch SSO + auto-submit form + failure UX.

**File baru:**
- `app/portal/app/[appSlug]/page.tsx` — SSO launch (server, auto-submit form)
- `app/api/portal/launch/[appSlug]/route.ts` — (opsional) AJAX launch

**Langkah:**
1. Buat SSO launch page (lihat `04-sso` §3)
2. Test dengan app dummy (mis. httpbin.org/forms/post atau app test lokal)
3. Test failure states: no access, no credential, corrupt credential
4. Verifikasi audit: `SSO_LAUNCH` muncul di `/admin/audit-trail`
5. `npm run build && npm run lint`

## Fase 6: Integrasi & Hardening

**Lingkup:** Backup/restore, middleware, env, seed, script, dokumentasi.

**File baru:**
- `scripts/make-portal-admin.ts` — analog `make-super-admin.ts` untuk portal
- `scripts/rotate-portal-key.ts` — (future) key rotation

**File dimodifikasi:**
- `app/api/backup/route.ts` — + tabel portal & audit di backup/restore
- `middleware.ts` — + `/portal/:path*`, `/portal-login` matcher + rate-limit portal-auth
- `next.config.ts` — (opsional) root redirect strategy
- `prisma/seed.ts` — + portal admin awal + contoh app
- `docker-compose.yml` — + env `PORTAL_CREDENTIAL_KEY`, `AUDIT_RETENTION_DAYS`
- `version.json` — schemaVersion 8 → 9, version 2.7.0 → 3.0.0
- `CLAUDE.md` — + dokumentasi arsitektur portal + audit

**Langkah:**
1. Update backup/restore (test: backup → restore → verifikasi tabel portal ada)
2. Update middleware (test: `/portal` tanpa login → redirect)
3. Update seed → `npm run prisma:seed`
4. Update docker-compose → `docker-compose up --build`
5. Update version.json, CLAUDE.md
6. Full test: `npm run build && npm run lint`
7. Deploy: `docker-compose up --build` → `docker-compose exec -T web npx prisma migrate deploy`

## Ringkasan daftar file

### File baru (total ~25)
| Kategori | File |
|----------|------|
| Lib | `lib/portal-crypto.ts`, `lib/portal-auth.ts`, `lib/audit.ts`, `lib/portal-access.ts` |
| Auth | `app/api/portal-auth/[...nextauth]/route.ts` |
| API portal-apps | `app/api/portal-apps/route.ts`, `[id]/route.ts` |
| API portal-users | `app/api/portal-users/route.ts`, `[id]/route.ts`, `[id]/access/route.ts`, `[id]/reset-password/route.ts`, `[id]/status/route.ts` |
| API portal-sessions | `app/api/portal-sessions/route.ts` |
| API portal credential | `app/api/portal/credentials/route.ts`, `[appId]/route.ts` |
| API portal launch | `app/api/portal/launch/[appSlug]/route.ts` |
| API audit | `app/api/audit-trail/route.ts`, `[id]/route.ts` |
| Admin pages | `app/admin/portal-apps/page.tsx`, `portal-users/page.tsx`, `portal-sessions/page.tsx`, `audit-trail/page.tsx` |
| Portal pages | `app/portal-login/page.tsx`, `app/portal/layout.tsx`, `app/portal/page.tsx`, `app/portal/app/[appSlug]/page.tsx`, `app/portal/credentials/page.tsx`, `app/portal/forgot-password/page.tsx`, `app/portal/reset-password/page.tsx` |
| Components | `components/portal/PortalHeader.tsx`, `AppCard.tsx`, `AccessDenied.tsx`, `NoCredential.tsx`, `CorruptCredential.tsx` |
| Scripts | `scripts/backfill-audit-log.ts`, `scripts/make-portal-admin.ts` |
| Root | `instrumentation.ts` |

### File dimodifikasi (total ~18)
`prisma/schema.prisma`, `lib/auth.ts`, `lib/validation-schemas.ts`, `lib/scheduler.ts`,
`types/next-auth.d.ts`, `middleware.ts`, `next.config.ts`, `components/admin/AdminSidebar.tsx`,
`app/admin/audit-logs/page.tsx` (→redirect), `app/api/backup/route.ts`, `prisma/seed.ts`,
`docker-compose.yml`, `version.json`, `CLAUDE.md`, `.env.example`, + retrofit ~10 route API

## Validasi akhir

```bash
npm run prisma:generate     # Regenerate client
npm run build               # Production build (harus sukses tanpa error)
npm run lint                # ESLint (harus bersih)
npm run prisma:seed         # Seed (portal admin + contoh app)
# Manual test end-to-end:
# 1. Login admin → buat portal app → buat portal user → assign access
# 2. Login portal → lihat grid → simpan kredensial → SSO launch
# 3. Cek audit trail → verifikasi semua event tercatat
# 4. Test lockout (5x login gagal)
# 5. Test backup → restore
```
