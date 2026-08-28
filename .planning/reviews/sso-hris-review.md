# Laporan Review Kualitas & Keamanan: Integrasi SSO-HRIS Gateway

**Tiket:** TASK-31 (Wave 3)  
**Reviewer:** Kelly (`kelly-mtboc6xc` - Reviewer)  
**Tanggal:** 2026-08-28  
**Basis Kode:** HEAD `539c971`  
**Status Audit:** COMPLETED  

---

## 1. Ringkasan Eksekutif

Audit independen terhadap hasil implementasi integrasi SSO-HRIS gateway (Wave 2: TASK-29 oleh Oscar & TASK-30 oleh Meredith) telah selesai dilakukan. Audit mencakup aspek keamanan secret/kredensial, integritas JIT provisioning, keandalan batch sync, penanganan error/fail-closed, null-guard akun tanpa kata sandi, kepatuhan batas file beku (zero-diff), dan kualitas antarmuka admin/portal.

### Ringkasan Temuan
| Severity | Jumlah | Status |
|---|:---:|---|
| **CRITICAL** | 1 | Perlu perbaikan segera sebelum rilis / pengujian gateway nyata |
| **HIGH** | 0 | - |
| **MEDIUM** | 2 | Perlu perbaikan untuk konsistensi UX dan defense-in-depth |
| **LOW** | 3 | Peningkatan minor & kebersihan kode |
| **PASS / VERIFIED** | 7 | Aspek inti terverifikasi aman & sesuai kontrak |

---

## 2. Daftar Temuan Berperingkat Severity

### [CRITICAL-1] API Key Decryption Mismatch Mengirim Payload JSON Mentah di Header HTTP
- **Lokasi:** `lib/hris-gateway-client.ts:79`
- **Kategori:** Security / Functional Bug
- **Deskripsi:**  
  Pada `POST /api/admin/hris/config` (line 100), konfigurasi API key disimpan terenkripsi menggunakan wrapper `encryptCredential({ username: "hris-admin", password: apiKey })`.  
  Namun pada `lib/hris-gateway-client.ts:79`, fungsi `getConfig()` mendekripsi `cfg.apiKeyEncrypted` menggunakan fungsi `decrypt()` mentah, bukan `decryptCredential()`.  
  Akibatnya, nilai variabel `apiKey` yang dihasilkan adalah string JSON:
  ```json
  "{\"username\":\"hris-admin\",\"password\":\"<actual_api_key>\"}"
  ```
  Ketika request dikirimkan ke endpoint gateway HRIS pada line 108:
  ```typescript
  headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
  }
  ```
  Header HTTP yang dikirimkan bernilai JSON mentah, bukan nilai string API key yang sebenarnya.
- **Dampak:**  
  Semua panggilan ke HRIS Gateway (`/ping`, `/auth/lookup`, `/auth/verify`) akan ditolak oleh gateway dengan status `401 Unauthorized` / `Invalid API key` saat dihubungkan ke server HRIS sesungguhnya. Test unit mock (`scripts/test-hris-gateway-retry.ts`) tidak mendeteksi bug ini karena fetch mock hanya mengecek status code dan tidak memverifikasi isi header `X-API-Key`.
- **Rekomendasi:**  
  Ubah fungsi `getConfig()` pada `lib/hris-gateway-client.ts` untuk mengurai kredensial dengan `decryptCredential`:
  ```typescript
  import { decryptCredential, decrypt } from "@/lib/portal-crypto";
  // ...
  let apiKey: string;
  try {
      const cred = decryptCredential(cfg.apiKeyEncrypted);
      apiKey = cred.password;
  } catch {
      // Fallback jika disimpan sebagai encrypted raw string
      try {
          apiKey = decrypt(cfg.apiKeyEncrypted);
      } catch {
          throw new HrisGatewayError("Gagal mendekripsi API key gateway HRIS", undefined, "CONFIG");
      }
  }
  ```

---

### [MEDIUM-1] Error JIT Tidak Dikenali di `portal-login` & Hilangnya UX CTA Set-Password
- **Lokasi:** `app/portal-login/page.tsx:14-19`
- **Kategori:** User Experience / Auth Integration
- **Deskripsi:**  
  Pada `lib/portal-auth.ts:57-59`, otentikasi akun JIT (`passwordHash === null`) melempar pesan error:
  `"Akun terdaftar namun belum aktif. Silakan atur kata sandi terlebih dahulu."`  
  Namun pada `app/portal-login/page.tsx`, daftar `SERVER_MESSAGE_PREFIXES` tidak memuat pesan tersebut. Akibatnya fungsi `mapLoginError()` mengubah error ini menjadi pesan kesalahan generik (`"Terjadi kesalahan. Silakan coba lagi."` atau `"NIK atau password salah"`).  
  Selain itu, tidak ada tautan atau mekanisme di halaman login yang mengarahkan pengguna baru ke `/portal/set-password?nik=...` sesuai spesifikasi desain Jim (§2.3).
- **Dampak:**  
  Karyawan baru hasil provisioning JIT yang mencoba login akan bingung karena menerima pesan error generik tanpa petunjuk bahwa mereka harus mengaktifkan akun di halaman set-password terlebih dahulu.
- **Rekomendasi:**  
  1. Tambahkan `"Akun terdaftar namun belum aktif"` ke dalam array `SERVER_MESSAGE_PREFIXES` di `app/portal-login/page.tsx`.
  2. Tambahkan komponen alert bersyarat di halaman login yang menampilkan tautan menuju `/portal/set-password?nik=${encodeURIComponent(nik)}` jika error tersebut terjadi.

---

### [MEDIUM-2] Pengecekan `user.eligible` Absen pada `portalAuthOptions.authorize`
- **Lokasi:** `lib/portal-auth.ts:41-43`
- **Kategori:** Defense-in-Depth / Authorization
- **Deskripsi:**  
  Berdasarkan desain Jim (§1.1 & §5.2), akses portal memerlukan `PortalUser.isActive == true AND PortalUser.eligible == true`.  
  Saat ini `lib/portal-auth.ts` hanya memeriksa `if (!user.isActive)`. Meskipun proses `runHrisSync` mengatur `isActive = false` ketika `eligible = false`, jika terjadi situasi di mana flag `isActive` diubah manual atau terjadi desinkronisasi kolom, pengguna non-eligible masih dapat melewati autentikasi password jika `isActive` bernilai `true`.
- **Dampak:**  
  Kurangnya lapis pertahanan tambahan (defense-in-depth) pada gateway login lokal.
- **Rekomendasi:**  
  Tambahkan pengecekan eksplisit di `lib/portal-auth.ts`:
  ```typescript
  if (user.eligible === false) {
      throw new Error("Akun dinonaktifkan karena tidak aktif di HRIS. Hubungi administrator.");
  }
  ```

---

### [LOW-1] Test Connection (Ping) Mengaktifkan Flag `enabled` Secara Implisit
- **Lokasi:** `app/api/admin/hris/ping/route.ts:46`
- **Kategori:** Configuration Side-Effect
- **Deskripsi:**  
  Pada endpoint `POST /api/admin/hris/ping`, update database melakukan:
  ```typescript
  enabled: ok ? true : undefined
  ```
  Jika administrator sebelumnya sengaja menonaktifkan gateway (`enabled: false`), penekanan tombol "Test Connection" yang berhasil (`ok: true`) akan secara otomatis mengubah konfigurasi menjadi `enabled: true` di database.
- **Dampak:**  
  Side-effect yang tidak diharapkan saat sekadar menguji konektivitas jaringan.
- **Rekomendasi:**  
  Hapus mutasi kolom `enabled` dari endpoint ping, pertahankan perubahan status `enabled` hanya melalui form simpan konfigurasi (`POST /api/admin/hris/config`).

---

### [LOW-2] UI Sinkronisasi Admin Terbatas pada Mode Inkremental
- **Lokasi:** `app/admin/hris-gateway/page.tsx:183`
- **Kategori:** Feature Completeness
- **Deskripsi:**  
  Fungsi `handleRunSync` di UI admin mengirim payload permanen `{ full: false }`. Modal konfirmasi tidak memberikan opsi bagi administrator untuk menjalankan *Full Sync* (sinkronisasi ulang semua user terlepas dari `lastSyncAt`).
- **Dampak:**  
  Admin tidak dapat memaksa sinkronisasi menyeluruh melalui antarmuka visual jika terjadi kebutuhan rekonsiliasi data darurat.
- **Rekomendasi:**  
  Tambahkan checkbox pilihan "Sinkronisasi Penuh (semua pengguna)" pada modal konfirmasi sinkronisasi di `HrisGatewayPage`.

---

### [LOW-3] Sisa Komentar TODO pada Komponen UI `set-password`
- **Lokasi:** `app/portal/set-password/page.tsx:60`
- **Kategori:** Code Hygiene
- **Deskripsi:**  
  Terdapat komentar usang `// TODO: Replace with actual API call once Oscar completes TASK-29` meskipun integrasi API riil sudah aktif di bawahnya.
- **Dampak:**  
  Minor code hygiene.
- **Rekomendasi:**  
  Hapus komentar TODO tersebut.

---

## 3. Matriks Verifikasi Spesifikasi & Keamanan

| Item Audit | Kriteria Verifikasi | Status | Bukti / Catatan |
|---|---|:---:|---|
| **Secret Protection** | API key tidak bocor ke log, respons client, atau file bundle | **PASS** | `GET /api/admin/hris/config` melakukan masking `****${key.slice(-4)}`; SuperAdmin-only guard; tidak ada console.log sensitive data. |
| **JIT Provisioning Safety** | Akun hanya dibuat untuk NIK valid & eligible; fail-closed jika gateway down | **PASS** | `lib/hris-jit.ts` memeriksa `lookup.valid` & `lookup.eligible`; error jaringan mengembalikan `unavailable` tanpa membuat record DB palsu. |
| **Sync Non-Destructive** | HRIS sync tidak merusak data lokal penting (password hash, avatar, role) | **PASS** | `lib/hris-sync.ts` hanya memutasi `name`, `email`, `nikHris`, `nikSantos`, `eligible`, `lastSyncAt`, dan `isActive`. Password lokal tetap utuh. |
| **Per-Row Sync Isolation** | Kegagalan baris perorangan tidak membatalkan batch sync | **PASS** | Blok `try/catch` per entri user mengumpulkan error ke dalam array `errors` dan melanjutkan proses iterasi. |
| **Null-Guard JIT Accounts** | Akun dengan `passwordHash: null` tidak memicu crash bcrypt saat login & reveal | **PASS** | Null-guard terverifikasi pada `lib/portal-auth.ts:56` dan `app/api/portal/credentials/reveal/route.ts:39`. |
| **SSRF & Input Guard** | Base URL gateway divalidasi skema protokol HTTP/HTTPS | **PASS** | `app/api/admin/hris/config/route.ts` memvalidasi URL protocol sebelum menyimpan ke DB. |
| **Frozen Files Boundary** | File beku zero-diff terhadap baseline | **PASS** | `app/api/sso/*`, `lib/portal-url-guard.ts`, `lib/portal-sso-relay.ts`, dan enum `PortalSsoMode` terverifikasi 100% 0-diff. |
| **Design System & A11y** | Form admin & portal memenuhi a11y, tema token, dan loading state | **PASS** | Meredith menerapkan token CSS native, aria attributes, modal konfirmasi, dan skeleton loading lengkap. |

---

## 4. Kesimpulan & Rekomendasi Tindak Lanjut

Implementasi Wave 2 oleh Oscar dan Meredith secara keseluruhan memiliki struktur arsitektur yang solid, rapi, dan mematuhi batasan proyek (*zero new dependencies*, kepatuhan schema additive, dan pemisahan tanggung jawab).

Namun, temuan **[CRITICAL-1]** wajib diperbaiki pada `lib/hris-gateway-client.ts` agar integrasi dapat berkomunikasi secara valid dengan HRIS Gateway. Perbaikan ini cukup dilakukan dengan penggantian pemanggilan `decryptCredential(cfg.apiKeyEncrypted).password` di fungsi `getConfig()`. Temuan **[MEDIUM-1]** dan **[MEDIUM-2]** direkomendasikan untuk disempurnakan demi keutuhan alur pengguna (UX) dan keandalan sistem otentikasi.
