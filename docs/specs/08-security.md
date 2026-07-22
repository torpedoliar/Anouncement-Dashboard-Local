# 08 — Security

> Threat model, enkripsi, redaksi, lockout, rate-limit, validasi env, limitasi cross-origin.

## 1. Threat model

| Ancaman | Vektor | Mitigasi |
|---------|--------|----------|
| **Kredensial app dicuri dari DB** | Akses langsung DB / SQL injection | AES-256-GCM encrypt at-rest; key di env terpisah |
| **Kredensial app dicuri dari memory** | Memory dump server | Dekripsi hanya saat SSO launch; tidak cache plaintext |
| **Kredensial app ter-expose ke client** | API return plaintext | API credential tidak pernah return plaintext; hanya status |
| **Brute-force login portal** | Percobaan login berulun | Lockout 5x → 15 menit + rate-limit 10 req/min per-IP |
| **Session hijacking** | Cookie dicuri | httpOnly + sameSite=lax; revocation DB-backed per refresh |
| **Privilege escalation** | Portal user akses admin | Sesi terpisah (cookie prefix berbeda); guard terpisah |
| **RBAC bypass** | User akses app tanpa access | `canAccessPortalApp` di setiap route + server-side check |
| **XSS di audit changes** | changes berisi HTML | `changes` disimpan sebagai JSON stringify (bukan HTML render); ditampilkan sebagai `<code>` |
| **Audit log manipulasi** | Attacker hapus log | Tidak ada DELETE API untuk audit; hanya retensi sistem (scheduler) |
| **Credential tampering** | Blob dimanipulasi di DB | AES-GCM auth tag → `decrypt()` throw jika tag mismatch |
| **Env key leak** | Key di commit/log | Key di `.env` (gitignored); tidak di-log; validasi format saat startup |

## 2. Enkripsi kredensial (AES-256-GCM)

Lihat detail di `04-sso-credential-forwarding.md` §1. Ringkasan keamanan:
- **Algoritma:** AES-256-GCM (confidentiality + integrity).
- **Key:** 32 byte dari `PORTAL_CREDENTIAL_KEY` (64-char hex). Validasi: `^[0-9a-f]{64}$`.
- **IV:** 12 byte random per encrypt (tidak reuse — critical untuk GCM security).
- **Auth tag:** 16 byte — mencegah tampering. `decrypt()` throw jika mismatch.
- **Format blob:** `base64(iv[12] + tag[16] + ciphertext)`.
- **Key rotation:** Jika key diganti, semua blob lama tidak bisa di-decrypt. Untuk rotasi:
  baca semua credential dengan key lama → re-encrypt dengan key baru. (Future: script
  `scripts/rotate-portal-key.ts`.)

## 3. Redaksi field sensitif

`lib/audit.ts` `redact()` otomatis mengganti field yang mengandung keyword sensitif:

```ts
const SENSITIVE_KEYS = [
    "password", "passwordHash", "credentialBlob", "token",
    "secret", "sessionToken", "resetToken", "smtpPass",
];
```

Contoh:
```json
// Input changes:
{ "email": "john@test.com", "password": "secret123", "name": "John" }
// Disimpan di AuditLog.changes:
{ "email": "john@test.com", "password": "[REDACTED]", "name": "John" }
```

Redaksi berlaku rekursif (nested object). Case-insensitive matching.

## 4. Lockout akun

Lihat detail di `02-authentication-and-sessions.md` §3. Ringkasan:
- **Threshold:** 5 percobaan gagal berturut-turut.
- **Durasi:** 15 menit lockout.
- **Reset:** `failedLoginCount` + `lockedUntil` di-reset saat login sukses.
- **Audit:** `ACCOUNT_LOCKED` (category=SECURITY, outcome=FAILURE).
- **Bersama rate-limit:** middleware rate-limit 10 req/min per-IP di `/api/portal-auth`;
  lockout bekerja di level akun (per-email). Dua lapis proteksi.

## 5. Rate limiting

Middleware yang sudah ada (`middleware.ts`) memakai in-memory `Map<key, {count, timestamp}>`:
- Default: 300 req/min per (IP + path segment).
- Auth (`/auth`, `/login`): 10 req/min.
- **Baru:** `/portal-auth`, `/portal-login`: 10 req/min.
- Backup: 5 req/min.

> Limitasi: in-memory → reset saat server restart, tidak distributed. Untuk multi-instance
> (Kubernetes), perlu Redis-backed rate limit (future). Saat ini single Docker container.


## 6. Validasi env saat startup

Tambah di module yang di-import early (mis. `instrumentation.ts` di root, Next.js 15):

```ts
function validateEnv() {
    const key = process.env.PORTAL_CREDENTIAL_KEY;
    if (!key) {
        throw new Error("FATAL: PORTAL_CREDENTIAL_KEY not set. Generate: openssl rand -hex 32");
    }
    if (!/^[0-9a-f]{64}$/i.test(key)) {
        throw new Error("FATAL: PORTAL_CREDENTIAL_KEY must be 64 hex chars (32 bytes)");
    }
}
validateEnv();
```

> Fail-closed: aplikasi tidak start jika env invalid. `instrumentation.ts` jalan saat
> startup sebelum menerima request.

## 7. Limitasi cross-origin (penting!)

Mode SSO `FORM` memakai cross-origin form POST. Limitasi:

### 7.1 Cookie SameSite di app eksternal
- Saat portal POST ke `app.loginUrl` (domain berbeda), app set cookie sesi.
- Cookie tunduk kebijakan `SameSite` yang app set:
  - `SameSite=Lax` (default modern): cookie SET untuk POST navigation → **biasanya OK**.
  - `SameSite=Strict`: cookie tidak set cross-site → **mungkin gagal**.
  - `SameSite=None; Secure`: butuh HTTPS → OK.
- **Portal tidak bisa kontrol ini** — tergantung app eksternal.
- **Mitigasi:** dokumentasikan bahwa app harus set `SameSite=Lax` atau `None; Secure`.

### 7.2 Deteksi hasil login (tidak bisa)
- Setelah POST ke app eksternal, portal **tidak bisa** deteksi sukses/gagal
  (cross-origin, no callback). User lihat hasil di tab baru.
- **Mitigasi:** health indicator (kredensial tersimpan) = best-effort; user update
  kredensial jika gagal.

### 7.3 CSRF protection di app eksternal
- App dengan CSRF token: butuh `extraFields` config (lihat `04-sso` §4).
- Mode `static` (token tetap): di MVP. Mode `fetch` (dinamis): future.

### 7.4 CORS
- Form POST navigation tidak terkena CORS (CORS hanya untuk fetch/XHR).
- Auto-submit form = navigasi, bukan XHR → OK.

## 8. Password policy

Konsisten dengan `UserCreateSchema` CMS: min 8, max 100. Hash: `bcrypt.hash(password, 10)`.
Portal: sama (`PortalUserCreateSchema`). Future: enforce complexity via Zod `.regex()`.

## 9. Security checklist (sebelum deploy)

- [ ] `PORTAL_CREDENTIAL_KEY` di-set (64 hex) di `.env` + `docker-compose.yml`
- [ ] `.env` di `.gitignore` (verifikasi)
- [ ] `instrumentation.ts` validasi env fail-closed
- [ ] Lockout: 5x → 15 menit (test login gagal berulang)
- [ ] Rate-limit `/api/portal-auth`: 10 req/min (test curl berulang)
- [ ] Cookie prefix `portal-auth.*` (tidak bentrok `next-auth.*`)
- [ ] Guard `/portal/*` → redirect `/portal-login` jika tidak login
- [ ] Guard `/admin/portal-*` + `/admin/audit-trail` → 403 jika bukan SuperAdmin
- [ ] API credential tidak return plaintext
- [ ] Audit `redact()` berfungsi (test: create user → cek `changes` = `[REDACTED]`)
- [ ] `AuditLog` tidak ada DELETE API (hanya retensi scheduler)
- [ ] Backup include tabel portal + audit
- [ ] HTTPS di production (cookie Secure flag)
- [ ] `NEXTAUTH_SECRET` kuat (verifikasi)

## 10. Compliance & privacy

- **Retention:** `AUDIT_RETENTION_DAYS` (default 365, 0 = selamanya).
- **Kredensial app:** dienkripsi at-rest; hanya didekrip saat SSO launch; tidak di-share.
- **IP/User-Agent di audit:** dicatat untuk forensik. Anonimisasi IP (hash) = future.
- **Right to erasure:** hapus `PortalUser` → cascade credential + session;
  `AuditLog` tetap (SetNull + denormalisasi) — sesuai praktik audit.
- **Export audit:** CSV/JSON untuk compliance/forensik.