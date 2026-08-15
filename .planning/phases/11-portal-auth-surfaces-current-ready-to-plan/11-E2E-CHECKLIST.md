# 11-E2E-CHECKLIST.md — Verifikasi Manual E2E Phase 11 (UI Ugrade Portal & Auth Surfaces)

> Plan: `11-04-PLAN.md` (Task 4). Berlaku setelah 3 commit UI (P11-04) diterapkan dan dev server berjalan.
> Prasyarat: `PORTAL_CREDENTIAL_KEY` ter-set, DB memiliki minimal 1 portal user, 1 app SSO (FORM), 1 grup.

---

## A. Alur Manual (8 Langkah)

### Langkah 1 — Login Portal
1. Buka `/admin-login`, login sebagai SuperAdmin.
2. Buka `/portal-login`, login sebagai portal user (`PORTAL_USER`).
3. Harapan: redirect ke `/portal` (app grid) — **bukan** `/portal-login`.
4. Harapan: baris `PortalSession` baru dibuat (cek `/admin/portal-sessions`).

### Langkah 2 — App Grid & Visibilitas
1. Sebagai `PORTAL_ADMIN` buka `/portal`:
   - App `isPublic = true` tampil untuk semua user.
   - App `isPublic = false` hanya tampil untuk user dengan akses langsung/grup (verifikasi via `/admin/portal-apps` toggle `isPublic` — Publik/Terbatas).
2. Cek grid kosong untuk user tanpa akses: tidak ada error, hanya app publik.

### Langkah 3 — Simpan Kredensial App
1. Buka detail satu app (FORM) di `/portal`.
2. Pilih akun simpan kredensial → simpan username/password.
3. Harapan: blob terenkripsi (AES-256-GCM), **tidak ada plaintext**.
4. `logAudit` terisi baris `portal_credential_saved`/sejenis di `/admin/audit-trail` (kredensial sudah auto-redact — cek kolom `changes` tidak mengandung plaintext).

### Langkah 4 — SSO Auto-Submit (Alur Utama)
1. Di `/portal`, klik app yang sudah punya kredensial.
2. Harapannya: auto-`POST` form ke `loginUrl` app (bukan navigasi manual ke halaman login).
3. Harapannya: app tujuan menerima session (misal: app lihat dashboard app).
4. `PortalSession.lastActiveAt` ter-update; `audit_logs` baris `portal_launch`/sejenis bertambah di `/admin/portal-audit` tab "Trend Penggunaan Aplikasi (30 Hari)".

### Langkah 5 — Account Picker (Multi-Kredensial)
1. Simpan 2+ kredensial beda user app untuk app yang sama.
2. Klik app → muncul pemilih akun (pilih user).
3. Pilih salah satu → SSO lanjut dengan kredensial yang dipilih.

### Langkah 6 — Jalur Gagal (Kredensial Salah)
1. Simpan kredensial dengan password salah pada app tertentu.
2. Klik app → app menolak login.
3. Harapan: tidak freeze, ada jalur kembali ke `/portal` dan tombol/aksen "edit kredensial" masih bisa dipakai tanpa login ulang.
4. Harapan: entry audit log launch tetap tercatat (walaupun gagal di sisi app).

### Langkah 7 — Reset / Revocation Sesi
1. Di `/admin/portal-sessions`: revoke (cabut) sesi portal user.
2. Setelah revoke, akses user ke app → kembali ke `/portal-login` (sesi batal).
3. Alternatif: reset password di `/admin/portal-users` → password lama harus ditolak.

### Langkah 8 — Verifikasi Audit Trail (ISO 27001)
1. Buka `/admin/portal-audit`:
   - Tab Ringkasan: Top 5 risiko sharing muncul jika ada.
   - Tab "Deteksi Account Sharing": baris dengan `targetUsername` yang dipakai >1 user.
   - Tab "Unused Access": >90 hari tidak aktif.
   - Tab "Access Control Matrix": sel берhubung (credential ada / kosong).
   - Tab "Histori Pencabutan": baris revoke yang baru saja dilakukan Langkah 7.
2. Buka `/admin/audit-trail`: seluruh aksi portal (saved cred, launch, revoke, reset password) ada dengan `entityType=portal*` dan metadata ter-redact.

---

## B. Kepatuhan Code (OPD / Frozen Files)

### OPD-1 — Frozen Files (Zero-Diff)
Files berikut **TIDAK BOLEH berubah** pada fase ini (UI-only). Verifikasi:

```bash
git diff HEAD -- lib/portal-access.ts lib/portal-layout.ts lib/portal-auth.ts lib/auth.ts middleware.ts
```

Hasil di commit P11-04: **kosong (zero-diff)** — STATUS: ✅ PASS

### OPD-4 — Tidak Ada Stock Compound Lookup Baru
Scan diff seluruh commit fase untuk pola stale `portalUserId_appId` compound:

```bash
git diff HEAD~3..HEAD | grep -iE "portalUser.*appId.*(unique|compound)|appId.*portalUser.*(unique|compound)"
```

Hasil di commit P11-04: **tidak ada match** — STATUS: ✅ PASS

### Scope Check — Hanya UI
```bash
git diff --name-only HEAD~3..HEAD
```
Hasil (5 file, semuanya `app/admin/portal-*/page.tsx`):
- `app/admin/portal-apps/page.tsx`
- `app/admin/portal-audit/page.tsx`
- `app/admin/portal-groups/page.tsx`
- `app/admin/portal-sessions/page.tsx`
- `app/admin/portal-users/page.tsx`

Tidak ada API route / lib / schema / middleware ikut berubah — STATUS: ✅ PASS

---

## C. Status Akhir
| Item | Status |
|------|--------|
| Langkah 1 (login portal) | ⬜ manual |
| Langkah 2 (grid visibility) | ⬜ manual |
| Langkah 3 (simpan kredensial) | ⬜ manual |
| Langkah 4 (SSO auto-submit) | ⬜ manual |
| Langkah 5 (account picker) | ⬜ manual |
| Langkah 6 (failure path) | ⬜ manual |
| Langkah 7 (lockout/revoke) | ⬜ manual |
| Langkah 8 (audit rows) | ⬜ manual |
| OPD-1 frozen-diff | ✅ PASS |
| OPD-4 compound scan | ✅ PASS |
| Scope (UI only) | ✅ PASS |

> Diisi manual oleh tester pada browser produksi/parity (docker-compose) setelah build.