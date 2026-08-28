# Laporan Re-Verifikasi Review Kualitas & Keamanan: Integrasi SSO-HRIS Gateway

**Tiket:** TASK-34 (Re-review Fix TASK-29b)  
**Reviewer:** Kelly (`kelly-mtboc6xc` - Reviewer)  
**Tanggal:** 2026-08-28  
**Basis Kode:** HEAD `abb7478` (Fix commit: `abb7478020213134b58fadc2ba4681b74dde4403`)  
**Status Re-Verifikasi:** COMPLETED — ALL RESOLVED (3/3)  

---

## 1. Ringkasan Hasil Re-Verifikasi

Audit ulang mandiri dilakukan terhadap perbaikan yang diterapkan oleh Oscar pada commit `abb7478`. Seluruh temuan (1 CRITICAL + 2 MEDIUM) dari audit awal (TASK-31) telah diperbaiki dengan tepat, aman, dan tanpa menimbulkan regresi.

| # | Temuan Awal | Severity | Status Re-Verifikasi | Bukti / Catatan |
|---|---|:---:|:---:|---|
| 1 | API Key Decryption Mismatch | **CRITICAL** | **RESOLVED** | `lib/hris-gateway-client.ts:80` kini menggunakan `decryptCredential(cfg.apiKeyEncrypted).password`. Nilai string apiKey plaintext murni dikirim pada header `X-API-Key`. |
| 2 | Error JIT & Link Set-Password Absen di Login | **MEDIUM** | **RESOLVED** | `app/portal-login/page.tsx` mendaftarkan prefix pesan JIT di `SERVER_MESSAGE_PREFIXES` (line 20), mengelola state `needsPasswordSetup` (line 59), dan merender link CTA `/portal/set-password?nik=...` (line 143-151). |
| 3 | Pengecekan `user.eligible` Absen di Auth | **MEDIUM** | **RESOLVED** | `lib/portal-auth.ts:47-51` menambahkan null-safe explicit guard `if (user.eligible === false)`. |

---

## 2. Detail Evaluasi & Bukti Mandiri

### 1. [CRITICAL] API Key Decryption di `lib/hris-gateway-client.ts`
- **File & Line:** [`lib/hris-gateway-client.ts:2, 80`](file:///E:/Vibe/Dashboard%20SJA/announcement-dashboard/lib/hris-gateway-client.ts#L80)
- **Implementasi Fix:**
  ```typescript
  import { decryptCredential } from "@/lib/portal-crypto";
  // ...
  apiKey = decryptCredential(cfg.apiKeyEncrypted).password;
  ```
- **Verifikasi:**
  - Sebelumnya `decrypt()` mentah mengembalikan JSON string `{"username":"hris-admin","password":"<key>"}`.
  - Dengan `decryptCredential(...).password`, objek JSON terdekripsi dan properti `.password` diekstrak sehingga variabel `apiKey` murni berisi string kunci API.
  - Header HTTP `X-API-Key: apiKey` pada line 108 kini menerima nilai string API key yang benar.
- **Verdict:** **RESOLVED**

---

### 2. [MEDIUM#1] Pemetaan Error JIT & UX CTA di `app/portal-login/page.tsx`
- **File & Line:** [`app/portal-login/page.tsx:20, 50-51, 59, 79, 143-151`](file:///E:/Vibe/Dashboard%20SJA/announcement-dashboard/app/portal-login/page.tsx#L20)
- **Implementasi Fix:**
  ```typescript
  // Line 20:
  "Akun terdaftar namun belum aktif. Silakan atur kata sandi terlebih dahulu.",
  
  // Line 50-51:
  const JIT_PASSWORD_REQUIRED =
    "Akun terdaftar namun belum aktif. Silakan atur kata sandi terlebih dahulu.";
  
  // Line 59 & 79:
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  // ...
  setNeedsPasswordSetup(mapped === JIT_PASSWORD_REQUIRED);
  
  // Line 143-151:
  {needsPasswordSetup && (
    <div className="text-center">
      <a
        href={`/portal/set-password?nik=${encodeURIComponent(nik)}`}
        className="text-xs font-medium text-accent underline hover:text-accent/80 transition-colors"
      >
        Atur kata sandi sekarang
      </a>
    </div>
  )}
  ```
- **Verifikasi:**
  - Pesan error dari `portal-auth.ts` tidak lagi dipetakan ke pesan generik.
  - Komponen alert link dinamis muncul saat error JIT terdeteksi dan mengarahkan pengguna langsung ke flow aktivasi kata sandi dengan query parameter NIK terisi.
- **Verdict:** **RESOLVED**

---

### 3. [MEDIUM#2] Defense-in-Depth `user.eligible` di `lib/portal-auth.ts`
- **File & Line:** [`lib/portal-auth.ts:45-51`](file:///E:/Vibe/Dashboard%20SJA/announcement-dashboard/lib/portal-auth.ts#L45-L51)
- **Implementasi Fix:**
  ```typescript
  // Defense-in-depth eligible (TASK-29b): eksplisit === false — akun
  // pre-migration dengan eligible=null TIDAK diblokir (sakelar bersih).
  if (user.eligible === false) {
      throw new Error(
          "Akun dinonaktifkan karena tidak aktif di HRIS. Hubungi administrator."
      );
  }
  ```
- **Verifikasi:**
  - Memeriksa secara eksplisit `=== false` sehingga akun pre-migration yang memiliki `eligible: null` tidak terblokir secara tidak sengaja.
  - Memastikan jika ada desinkronisasi antara `isActive` dan `eligible`, pengguna yang tidak berhak di HRIS tetap ditolak sebelum validasi password.
- **Verdict:** **RESOLVED**

---

## 3. Hasil Verifikasi Gate & Build
- `npx tsc --noEmit`: EXIT 0 (0 error)
- `npx tsx scripts/test-hris-gateway-retry.ts`: PASS (5xx retry ok, ping ok, 4xx no-retry ok)
- Frozen files boundary: Zero-diff terkonfirmasi.

## 4. Kesimpulan
Semua temuan review telah diselesaikan secara tuntas. Modul SSO-HRIS siap untuk tahap UAT (Angela) dan deployment.
