# Fase 1 — Fondasi Data & Auth

> Specs referensi: `01-data-model.md`, `02-authentication-and-sessions.md`,
> `03-rbac.md` (helper), `04-sso-credential-forwarding.md` (crypto), `05-audit-trail.md` (helper)
> Milestone: M1 · Prasyarat: tidak ada (fase pertama)

## Objective

Membangun fondasi: skema database (6 tabel portal + 1 audit), helper enkripsi kredensial,
instance auth portal terpisah, helper audit terpusat, helper RBAC portal, dan validasi env
fail-closed. Setelah fase ini, infrastruktur inti siap dipakai semua fase berikutnya.

## Prerequisites

- [ ] Backup database eksisting sebelum migrasi
- [ ] Branch baru: `git checkout -b feature/portal-sso`
- [ ] Pastikan `npm run build` & `npm run lint` bersih di kondisi awal (baseline)

## Task list

### 1.1 Skema Prisma (data model)

- [ ] Edit `prisma/schema.prisma` — tambah 6 enum baru:
  - [ ] `PortalRole` (PORTAL_ADMIN, PORTAL_USER)
  - [ ] `PortalAppRole` (USER, ADMIN)
  - [ ] `PortalSsoMode` (FORM, REDIRECT, PROXY, TOKEN)
  - [ ] `AuditActor` (ADMIN_USER, PORTAL_USER, SYSTEM)
  - [ ] `AuditOutcome` (SUCCESS, FAILURE)
  - [ ] `AuditCategory` (AUTH, CONTENT, USER_MGMT, PORTAL, SECURITY, SYSTEM, CONFIG)
- [ ] Tambah 5 model portal (persis sesuai `01-data-model.md` §2):
  - [ ] `PortalUser` (dengan `failedLoginCount`, `lockedUntil`, `isActive`, `role`)
  - [ ] `PortalApp` (dengan `loginUrl`, `usernameField`, `passwordField`, `extraFields` Json)
  - [ ] `PortalUserAppAccess` (unique `[portalUserId, appId]`)
  - [ ] `PortalUserAppCredential` (unique `[portalUserId, appId]`, `credentialBlob`)
  - [ ] `PortalSession` (mirror `UserSession`, `sessionToken` unique)
- [ ] Tambah model `AuditLog` (tanpa FK ke `User`; FK opsional `portalUserId` SetNull;
  indeks `[actorType,actorId]`, `[category,createdAt]`, `[outcome]`, `[entityType,entityId]`, `[createdAt]`, `[severity]`)
- [ ] Verifikasi: tidak mengubah model lama sama sekali
- [ ] `npm run prisma:generate`
- [ ] `npm run prisma:migrate --name add_portal_and_audit`
- [ ] Verifikasi migration SQL: hanya CREATE TABLE + CREATE TYPE (no DROP, no ALTER lama)
- [ ] Bump `version.json`: `schemaVersion` 8 → 9

### 1.2 Helper enkripsi kredensial

- [ ] Buat `lib/portal-crypto.ts` (sesuai `04-sso` §1):
  - [ ] `getKey()` — ambil dari `PORTAL_CREDENTIAL_KEY`, validasi `^[0-9a-f]{64}$`
  - [ ] `encrypt(plaintext)` — AES-256-GCM, IV 12 byte random, format base64(iv+tag+ciphertext)
  - [ ] `decrypt(blob)` — parse, setAuthTag, throw jika mismatch
  - [ ] `encryptCredential(cred)` / `decryptCredential(blob)` — wrapper JSON
  - [ ] Export `CredentialData` interface
- [ ] Test manual: `npx tsx -e "import {encrypt,decrypt} from './lib/portal-crypto'; const b=encrypt('test'); console.log(decrypt(b))"` (perlu env key set)


### 1.3 Helper audit terpusat

- [ ] Buat `lib/audit.ts` (sesuai `05-audit-trail.md` §1):
  - [ ] `SENSITIVE_KEYS` array (password, passwordHash, credentialBlob, token, secret, sessionToken, resetToken, smtpPass)
  - [ ] `redact(obj)` — rekursif, case-insensitive, ganti `[REDACTED]`
  - [ ] `extractIp(request)` / `extractUserAgent(request)` — dari header
  - [ ] `logAudit(params)` — try/catch non-blocking, denormalisasi actor, tulis `AuditLog`
  - [ ] Export `AuditParams` interface
- [ ] Verifikasi: `logAudit` tidak throw meski DB error (test manual)

### 1.4 Helper RBAC portal

- [ ] Buat `lib/portal-access.ts` (sesuai `03-rbac.md` §4):
  - [ ] `canAccessPortalApp(portalUserId, appId)`
  - [ ] `canAccessPortalAppBySlug(portalUserId, appSlug)`
  - [ ] `getAccessiblePortalApps(portalUserId)` — daftar app untuk grid
  - [ ] `hasCredential(portalUserId, appId)` — health indicator

### 1.5 Instance auth portal

- [ ] Buat `lib/portal-auth.ts` (sesuai `02-authentication` §1):
  - [ ] `portalAuthOptions` — CredentialsProvider validasi `PortalUser`
  - [ ] Cookie prefix `portal-auth.*` (sessionToken, callbackUrl, csrfToken)
  - [ ] `authorize()`: cek email → isActive → lockedUntil → compare → lockout logic
  - [ ] Lockout: `MAX_FAILED_ATTEMPTS=5`, `LOCKOUT_DURATION_MS=15*60*1000`
  - [ ] jwt callback: buat `PortalSession` saat signIn + continuous validation
  - [ ] session callback: inject id + role; events.session: update lastActiveAt
  - [ ] `pages.signIn: "/portal-login"`, `session.maxAge: 12*60*60`, reuse `NEXTAUTH_SECRET`
  - [ ] Tambah `logAudit` di authorize (LOGIN_SUCCESS/FAILED) + jwt

### 1.6 Route handler auth portal

- [ ] Buat `app/api/portal-auth/[...nextauth]/route.ts`:
  ```ts
  import NextAuth from "next-auth";
  import { portalAuthOptions } from "@/lib/portal-auth";
  const handler = NextAuth(portalAuthOptions);
  export { handler as GET, handler as POST };
  ```

### 1.7 Logging auth CMS (yang belum ada)

- [ ] Edit `lib/auth.ts`:
  - [ ] `authorize()` sukses → `logAudit({ actorType:"ADMIN_USER", category:"AUTH", action:"LOGIN_SUCCESS" })`
  - [ ] `authorize()` gagal → tangkap + `logAudit(... action:"LOGIN_FAILED", outcome:"FAILURE" })`

### 1.8 Validation schemas + types

- [ ] Edit `lib/validation-schemas.ts` — tambah `PortalUserCreateSchema`,
  `PortalUserUpdateSchema`, `PortalAppCreateSchema`, `PortalAppUpdateSchema`,
  `PortalCredentialSchema` (sesuai `03-rbac.md` §6)
- [ ] Edit `types/next-auth.d.ts` — pastikan `role: string` mendukung portal role

### 1.9 Env & startup validation

- [ ] Edit `.env.example` — + `PORTAL_CREDENTIAL_KEY`, `AUDIT_RETENTION_DAYS`, `PORTAL_SESSION_MAX_AGE`
- [ ] Buat `instrumentation.ts` (root) — `validateEnv()` fail-closed
- [ ] Set `.env` lokal: `PORTAL_CREDENTIAL_KEY=` (generate `openssl rand -hex 32`)

## Definition of Done (DoD)

- [ ] `npm run prisma:generate` & `prisma:migrate` sukses; tabel baru ada di DB
- [ ] `npm run build` sukses tanpa error TypeScript
- [ ] `npm run lint` bersih
- [ ] `encrypt`/`decrypt` round-trip test lulus
- [ ] `logAudit` tidak throw saat DB error
- [ ] `instrumentation.ts` throw jika `PORTAL_CREDENTIAL_KEY` kosong/invalid
- [ ] `version.json` schemaVersion = 9

## Validation steps
```bash
npm run prisma:generate && npm run prisma:migrate --name add_portal_and_audit
npm run build && npm run lint
npx tsx -e "import('./lib/portal-crypto').then(m=>{const b=m.encrypt('hello');console.log('decrypt OK:', m.decrypt(b)==='hello')})"
```

## Rollback notes
- Migrasi non-destructive → revert code + tabel baru tidak mengganggu fungsi lama.