# Risk Register

> Daftar risiko implementasi + mitigasi + contingency. Update saat eksekusi muncul
> risiko baru.

## Tingkat dampak

| Level | Definisi |
|-------|----------|
| Kritis | Menghentikan seluruh fitur / data loss / keamanan breach |
| Tinggi | Menghentikan satu fase / perlu rework signifikan |
| Sedang | Delay / workaround ada / sebagian fungsi terganggu |
| Rendah | Minor / bisa diakomodasi / cosmetic |

## Risiko teridentifikasi

### R1 — Migrasi DB gagal di production
- **Dampak:** Kritis
- **Kemungkinan:** Rendah
- **Penyebab:** Prisma migrate conflict, FK error, enum clash, koneksi DB
- **Mitigasi:**
  - Backup DB eksisting sebelum migrasi
  - Test migrasi di staging dulu (DB copy)
  - Migrasi non-destructive (hanya CREATE, tidak DROP/ALTER lama)
  - Verifikasi migration SQL sebelum apply (`prisma migrate dev --create-only` lalu review)
- **Contingency:** Revert code ke pre-migration; tabel baru tidak ganggu fungsi lama.
  Jika tabel setengah jadi: `prisma migrate resolve --rolled-back` + manual cleanup.

### R2 — Cross-origin SSO tidak jalan (SameSite=Strict app)
- **Dampak:** Sedang
- **Kemungkinan:** Sedang
- **Penyebab:** App eksternal set cookie `SameSite=Strict` → cross-site POST tidak set cookie
- **Mitigasi:**
  - Dokumentasi: app harus set `SameSite=Lax` atau `None; Secure`
  - Health indicator = best-effort; user manual cek & update kredensial jika gagal
  - Mode `REDIRECT`/`PROXY` (future) untuk app yang strict
- **Contingency:** App yang strict → fallback link langsung ke `app.url` (user login manual).
  Tandai app tsb sebagai "manual login" di grid.

### R3 — Kredensial key leak (PORTAL_CREDENTIAL_KEY)
- **Dampak:** Kritis
- **Kemungkinan:** Rendah
- **Penyebab:** Key di-commit, di-log, atau di-share
- **Mitigasi:**
  - `.env` di `.gitignore` (verifikasi)
  - Key tidak di-log (cek `console.log` tidak print key)
  - `instrumentation.ts` tidak print key saat error
  - Key di docker-compose = placeholder, set via secret management di production
- **Contingency:** Jika leak: generate key baru → `scripts/rotate-portal-key.ts` (future)
  re-encrypt semua credential, atau minta user re-simpan (acceptable untuk fresh deploy).

### R4 — Retrofit audit merusak route eksisting
- **Dampak:** Tinggi
- **Kemungkinan:** Sedang
- **Penyebab:** `logAudit` throw tidak tertangkap, atau mengubah alur route
- **Mitigasi:**
  - `logAudit` dibungkus try/catch non-blocking (tidak throw)
  - Tambah `logAudit` di samping `ActivityLog` lama (dual-write) — fungsi lama tetap jalan
  - Test per route setelah retrofit
- **Contingency:** Revert retrofit di route bermasalah; fungsi lama (`ActivityLog`) tetap jalan.

### R5 — Backfill duplikat data
- **Dampak:** Rendah
- **Kemungkinan:** Rendah
- **Penyebab:** Script di-run 2x
- **Mitigasi:**
  - Script idempoten: cek existing (metadata.backfilled + originalId) sebelum insert
  - Re-run aman → "0 baris" jika sudah
- **Contingency:** `TRUNCATE audit_logs WHERE metadata->>'backfilled' = 'true'` lalu re-run.

### R6 — Lockout mengunci user sah
- **Dampak:** Sedang
- **Kemungkinan:** Sedang
- **Penyebab:** User lupa password, salah 5x, terkunci 15 menit
- **Mitigasi:**
  - Threshold 5x (tidak terlalu rendah) + durasi 15 menit (tidak permanen)
  - Admin bisa reset password (langsung unlock) via `/admin/portal-users`
  - Pesan jelas "Coba lagi dalam X menit"
- **Contingency:** Admin reset password user terkunci → `failedLoginCount=0`, `lockedUntil=null`.

### R7 — Rate-limit in-memory reset saat restart
- **Dampak:** Rendah
- **Kemungkinan:** Tinggi (selalu terjadi saat restart)
- **Penyebab:** `Map` di memory, bukan persistent
- **Mitigasi:**
  - Acceptable untuk single Docker container
  - Lockout (DB-backed) tetap berlaku meski rate-limit reset → dua lapis
- **Contingency:** Future: Redis-backed rate limit untuk multi-instance.


### R8 — NextAuth dual-instance cookie bentrok
- **Dampak:** Tinggi · **Kemungkinan:** Sedang
- **Penyebab:** Dua instance NextAuth (CMS + portal) pakai cookie default → bentrok
- **Mitigasi:** Portal pakai cookie prefix `portal-auth.*`; test login CMS + portal terpisah
- **Contingency:** `signIn` custom fetch ke portal endpoint + set cookie manual

### R9 — Auto-submit diblokir popup blocker
- **Dampak:** Sedang · **Kemungkinan:** Sedang
- **Penyebab:** `target="_blank"` + auto-submit JS diblokir
- **Mitigasi:** Auto-submit dari user gesture (klik tombol) → umum tidak diblokir; tombol fallback
- **Contingency:** Tombol manual submit

### R10 — Audit log membengkak (performance)
- **Dampak:** Sedang · **Kemungkinan:** Sedang (jangka panjang)
- **Penyebab:** Setiap mutasi tulis `AuditLog` → tabel besar
- **Mitigasi:** Indeks dioptimasi; retensi purge via scheduler; paginasi max 100
- **Contingency:** Retensi lebih agresif; arsip cold storage (future)

### R11 — Prisma client tidak re-generate
- **Dampak:** Sedang · **Kemungkinan:** Sedang
- **Penyebab:** Lupa `npm run prisma:generate` setelah edit schema
- **Mitigasi:** Checklist eksplisit; type error fail-fast di build
- **Contingency:** Jalankan `npm run prisma:generate` → rebuild

### R12 — Email reset password tidak terkirim
- **Dampak:** Sedang · **Kemungkinan:** Sedang (SMTP salah)
- **Penyebab:** Konfigurasi SMTP salah / unreachable
- **Mitigasi:** Reuse `lib/email.ts`; dev log console; UX tidak leak SMTP error
- **Contingency:** Admin reset password manual via `/admin/portal-users`

## Template risiko baru
```
### RN — [Judul]
- Dampak: [Kritis/Tinggi/Sedang/Rendah]
- Kemungkinan: [Rendah/Sedang/Tinggi]
- Penyebab: [akar masalah]
- Mitigasi: [langkah cegah]
- Contingency: [jika terjadi]
- Status: [Open/Mitigated/Closed]
- Tanggal: [YYYY-MM-DD]
```

## Ringkasan risiko

| ID | Judul | Dampak | Status |
|----|-------|--------|--------|
| R1 | Migrasi DB gagal | Kritis | Mitigated |
| R2 | Cross-origin SSO SameSite | Sedang | Mitigated |
| R3 | Kredensial key leak | Kritis | Mitigated |
| R4 | Retrofit rusak route | Tinggi | Mitigated |
| R5 | Backfill duplikat | Rendah | Mitigated |
| R6 | Lockout user sah | Sedang | Mitigated |
| R7 | Rate-limit reset restart | Rendah | Accepted |
| R8 | Cookie bentrok | Tinggi | Mitigated |
| R9 | Popup blocker | Sedang | Mitigated |
| R10 | Audit membengkak | Sedang | Mitigated |
| R11 | Prisma tidak re-gen | Sedang | Mitigated |
| R12 | Email reset gagal | Sedang | Mitigated |

> Semua risiko punya mitigasi. Tidak ada risiko Open tanpa plan.