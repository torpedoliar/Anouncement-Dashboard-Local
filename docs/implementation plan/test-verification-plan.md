# Test & Verification Plan

> Strategi test per fase. Codebase tidak punya test framework (per CLAUDE.md), jadi
> validasi via `npm run build` + `npm run lint` + manual test + script one-off.

## 1. Strategi test

| Level | Metode | Kapan |
|-------|--------|------|
| **Compile** | `npm run build` | Tiap fase (TypeScript harus sukses) |
| **Lint** | `npm run lint` | Tiap fase (ESLint bersih) |
| **Unit (manual)** | `npx tsx -e "..."` one-off | Fase 1 (crypto, audit helper) |
| **Integration (manual)** | Manual via UI + cek DB | Tiap fase (smoke test) |
| **End-to-end** | Smoke test di `test-verification-plan` §6 | Fase 6 (final) |
| **Security** | Checklist `08-security.md` §9 | Sebelum deploy |

> Tidak ada test framework otomatis. Jika diinginkan future: tambah Vitest (ringan,
> kompatibel Next.js). Saat ini: manual + script.

## 2. Test Fase 1 (Fondasi)

### 2.1 Crypto round-trip
```bash
# Set PORTAL_CREDENTIAL_KEY di .env dulu
npx tsx -e "import('./lib/portal-crypto').then(m=>{
  const b=m.encrypt('secret123');
  console.log('blob:', b.substring(0,20)+'...');
  console.log('decrypt OK:', m.decrypt(b)==='secret123');
  const c=m.encryptCredential({username:'john',password:'p'});
  console.log('cred decrypt:', JSON.stringify(m.decryptCredential(c)));
})"
```
- [ ] encrypt/decrypt round-trip = true
- [ ] encryptCredential/decryptCredential = correct object
- [ ] Decrypt blob korup → throw (test: `m.decrypt('invalid')` → error)

### 2.2 Audit helper non-blocking
```bash
npx tsx -e "import('./lib/audit').then(async m=>{
  // Simulasi: logAudit harus tidak throw meski error
  try {
    await m.logAudit({ actorType:'SYSTEM', category:'SYSTEM', action:'TEST', entityType:'TEST' });
    console.log('logAudit OK (no throw)');
  } catch(e) { console.log('FAIL: threw', e); }
})"
```
- [ ] logAudit tidak throw (meski tabel kosong/tidak ada actor)

### 2.3 Env validation fail-closed
- [ ] Hapus `PORTAL_CREDENTIAL_KEY` dari `.env` → `npm run build` atau start server → throw
- [ ] Set key invalid (bukan 64 hex) → throw
- [ ] Set key valid → sukses

### 2.4 Migrasi
- [ ] `prisma migrate dev` sukses
- [ ] Tabel baru ada: `\dt` di psql → `portal_users`, `portal_apps`, `portal_user_app_access`,
  `portal_user_app_credentials`, `portal_sessions`, `audit_logs`
- [ ] Enum ada: `\dT` → 6 enum baru
- [ ] Tabel lama tidak berubah (verifikasi: `activity_logs`, `users` struktur sama)

## 3. Test Fase 2 (Audit Trail)

### 3.1 Retrofit verification
- [ ] Buat pengumuman via `/admin` → cek `audit_logs` ada row (action=CREATE, category=CONTENT)
- [ ] Edit pengumuman → row UPDATE
- [ ] Hapus pengumuman → row DELETE
- [ ] Buat kategori → row CREATE category=CONTENT
- [ ] Buat user CMS → row CREATE category=USER_MGMT
- [ ] Revoke sesi → row SESSION_REVOKED category=AUTH
- [ ] Update settings → row UPDATE category=CONFIG
- [ ] Scheduler run (force) → row SCHEDULER_RUN actorType=SYSTEM actorId=null

### 3.2 Halaman audit trail
- [ ] `/admin/audit-trail` load (SuperAdmin)
- [ ] Bukan SuperAdmin akses → 403 (test dengan user EDITOR)
- [ ] Filter category=CONTENT → hanya row CONTENT
- [ ] Filter outcome=FAILURE → hanya row gagal
- [ ] Filter date range → hanya row di rentang
- [ ] Search "CREATE" → row dengan action CREATE
- [ ] Export CSV → file terdownload, buka → kolom benar
- [ ] Export JSON → file terdownload, valid JSON
- [ ] Detail expand → changes tampil (field sensitif = `[REDACTED]`)
- [ ] Actor badge: ADMIN_USER / PORTAL_USER / SYSTEM tampil benar

### 3.3 Backfill
- [ ] `npx tsx scripts/backfill-audit-log.ts` → "Backfill selesai: N baris"
- [ ] Re-run → "Backfill selesai: 0 baris" (idempotent)
- [ ] `/admin/audit-trail` menampilkan data lama (backfilled) + baru
- [ ] Data lama: actorType=ADMIN_USER, metadata.backfilled=true

### 3.4 Retensi
- [ ] Set `AUDIT_RETENTION_DAYS=0` → scheduler skip purge
- [ ] Set `AUDIT_RETENTION_DAYS=1` + insert row lama (manual createdAt 2 hari lalu) →
  scheduler purge → row hilang + row AUDIT_RETENTION_PURGE muncul


## 4. Test Fase 3 (Admin Portal)

### 4.1 Portal Apps CRUD
- [ ] `/admin/portal-apps` load (SuperAdmin); EDITOR → 403
- [ ] Create app → row di `portal_apps` + audit PORTAL_APP_CREATED
- [ ] Edit app → audit UPDATE; Delete app → audit DELETE + cascade
- [ ] Duplicate slug → 400; Invalid URL → 400 (Zod)

### 4.2 Portal Users CRUD + RBAC
- [ ] Create user (+ appIds) → `portal_users` + `portal_user_app_access` + audit
- [ ] Duplicate email → 400; Password < 8 → 400
- [ ] Edit/Delete user → audit + cascade
- [ ] Assign/revoke access → audit ACCESS_GRANTED/REVOKED
- [ ] Reset password → hash berubah + audit
- [ ] Activate/deactivate → audit

### 4.3 Portal Sessions
- [ ] `/admin/portal-sessions` load (SuperAdmin); Revoke → isRevoked + audit

## 5. Test Fase 4-5 (Portal + SSO)

### 5.1 Login portal
- [ ] Login benar → redirect `/portal` + sesi row + audit PORTAL_LOGIN_SUCCESS
- [ ] Email/password salah → error + audit FAILED + failedLoginCount++
- [ ] 5x gagal → "terkunci 15 menit" + lockedUntil + audit ACCOUNT_LOCKED
- [ ] Login saat locked → "coba lagi X menit"; isActive=false → "dinonaktifkan"
- [ ] Cookie `portal-auth.session-token` set (bukan `next-auth.*`)

### 5.2 Grid + RBAC
- [ ] `/portal` hanya app yang di-assign; app nonaktif tidak muncul
- [ ] User tanpa access → "belum punya akses"
- [ ] Health indicator ✓/⚠ benar; filter+search berfungsi

### 5.3 Credentials
- [ ] Simpan → `credentialBlob` encrypted (bukan plaintext) + audit CREDENTIAL_SAVED
- [ ] Update/Delete → audit; API tidak return plaintext
- [ ] Simpan untuk app tanpa access → 403

### 5.4 SSO Launch
- [ ] Klik app (dengan cred) → tab baru → app eksternal terima POST
- [ ] `lastUsedAt` update + audit SSO_LAUNCH SUCCESS
- [ ] No cred → "simpan dulu" + audit FAILURE; No access → "tidak punya akses" + audit
- [ ] Corrupt blob → "rusak" + audit FAILURE

### 5.5 Lupa/reset password
- [ ] Forgot → email terkirim; email tidak terdaftar tetap "link dikirim"
- [ ] Reset via token → login password baru sukses; token expired → error; reuse token → error

## 6. End-to-end smoke test (Fase 6)

- [ ] 1. Login admin → buat app "HR System"
- [ ] 2. Buat user Budi + assign access HR System
- [ ] 3. Reset password Budi
- [ ] 4. Login portal Budi → grid muncul HR System (⚠)
- [ ] 5. Simpan kredensial → HR System jadi ✓
- [ ] 6. Klik "Buka Aplikasi" → auto-submit → HR System login
- [ ] 7. `/admin/audit-trail` → verifikasi semua event tercatat (IP + actor benar)
- [ ] 8. Logout Budi → `/admin/portal-sessions` → sesi muncul
- [ ] 9. Backup → restore staging → verifikasi tabel portal ada

## 7. Security checklist (sebelum production)

Mengikuti `08-security.md` §9:
- [ ] `PORTAL_CREDENTIAL_KEY` set (64 hex), tidak di git
- [ ] `instrumentation.ts` fail-closed teruji
- [ ] Lockout 5x/15min teruji
- [ ] Rate-limit portal-auth 10/min (curl → 429)
- [ ] Cookie prefix `portal-auth.*` (browser devtools)
- [ ] Guard `/portal/*` redirect; `/admin/portal-*` + `/admin/audit-trail` 403
- [ ] API credential tidak return plaintext
- [ ] Audit redaksi: password → `[REDACTED]`
- [ ] `AuditLog` tidak ada DELETE API
- [ ] Backup cover portal + audit
- [ ] HTTPS production; `NEXTAUTH_SECRET` kuat