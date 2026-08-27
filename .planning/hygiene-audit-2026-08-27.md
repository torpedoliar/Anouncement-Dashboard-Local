# Audit Hygiene Repository — 2026-08-27

- **Auditor:** CAP TIKUS (`cap-tikus-mtb0n2jm`)
- **Target Repository:** `announcement-dashboard` (`E:\Vibe\Dashboard SJA\announcement-dashboard`)
- **Status Working Tree:** READ-ONLY audit; active implementation in progress (TASK-20 Ryan, TASK-21 Hennessey).

---

## Ringkasan Eksekutif
Audit dilakukan secara read-only pada seluruh working tree dan git index. Ditemukan sejumlah sampah historis (log build tua tracked, empty directories, cache files historis tracked di index), artefak orphan di root, dan celah aturan `.gitignore` lokal vs repository.

---

## 1. (S1) Sampah Hapus Aman (Safe to Delete)

| Path | Tipe / Status | Ukuran | Umur / Commit | Alasan & Rekomendasi |
|---|---|---|---|---|
| `build.log` | File (Tracked) | 8.1 KB (259 baris) | 30 Des 2025 (`b36e169`) | Log build Next.js tua dari initial commit. Tidak relevan untuk repo. Hapus via `git rm build.log`. |
| `src/` | Folder (Untracked) | 0 B (Kosong) | 27 Des 2025 | Folder sisa setup Next.js awal sebelum migrasi ke root `app/`, `components/`, `lib/`. Hapus folder fisik. |
| `scripts/backups/` | Folder (Untracked) | 0 B (Kosong) | 29 Des 2025 | Folder kosong sisa testing script backup lama. Hapus folder fisik. |
| `prisma/migrations$(date +%Y%m%d%H%M%S)_add_portal_and_audit/` | Folder (Untracked) | 0 B (Kosong) | 22 Jul 2026 | Folder hasil typo eksekusi bash expansion di PowerShell. Hapus folder fisik. |
| `image.png` | File (Untracked, Ignored) | 40.3 KB | 30 Jul 2026 | Screenshot liar di root, tidak direferensikan kode mana pun (sesuai catatan di `.gitignore:67`). Hapus fisik. |
| `graphify-out/cache/` *(Tracked Index Items)* | File (Tracked Index) | ~150 KB (35 files) | 17 Agu 2026 (`13b1491`) | 27 file `ast/` dan 7 file `semantic/` + `stat-index.json` masih tercatat di git index walau `.gitignore` sudah abaikan cache. Untrack via `git rm --cached -r graphify-out/cache`. |

---

## 2. (S2) Rekomendasi Tambah ke `.gitignore`

| Pola / Path | Alasan & Dampak |
|---|---|
| `*.log`, `/build.log` | Mencegah file log build/eksekusi lokal ter-commit kembali ke repository. |
| `/.claude/` | File config per-user `.claude/settings.local.json` saat ini hanya di-ignore via global gitignore user (`~/.config/git/ignore`), bukan di repo `.gitignore`. |
| `/.impeccable/` | Konfigurasi cache & pending lokal (`hook.cache.json`, `config.local.json`) saat ini ada di `.git/info/exclude`, perlu dipindah ke `.gitignore` repo agar konsisten. |
| `scripts/backups/`, `/backups/` | Mencegah folder output backup lokal masuk status untracked. |
| `/.kilo/`, `/.kilocode/` | Mencegah file agent worktree lokal masuk repo jika exclude lokal hilang. |

### Rekomendasi Patch `.gitignore` (Proposal)
```diff
--- a/.gitignore
+++ b/.gitignore
@@ -28,6 +28,8 @@ dev.db
 # debug
+*.log
+/build.log
 npm-debug.log*
 yarn-debug.log*
 yarn-error.log*
@@ -48,6 +50,15 @@ docker-compose.override.yml
 # typescript
 *.tsbuildinfo
 next-env.d.ts
+
+# agent & IDE local config
+/.claude/
+/.impeccable/hook.*.json
+/.impeccable/config.local.json
+/.kilo/
+/.kilocode/
+scripts/backups/
+backups/
```

---

## 3. (S3) Seharusnya di-Commit / File Kerja Aktif (Bukan Sampah)

| Path | Ukuran | Umur | Pemilik / Status | Catatan |
|---|---|---|---|---|
| `lib/portal-api-probe.ts` | 7.6 KB | 27 Agu 2026 | Ryan (TASK-20) | OpenAPI & HTML probe module aktif untuk deteksi login v2. WAJIB di-commit bersama TASK-20. |
| `scripts/test-detect-verify-v2.ts` | 6.4 KB | 27 Agu 2026 | Ryan (TASK-20) | Test harness aktif untuk verifikasi deteksi & login v2. WAJIB di-commit bersama TASK-20. |
| `prisma/migrations/20260722000000_add_portal_and_audit/` | 7.4 KB | 22 Jul 2026 | Tracked (Sah) | Migration resmi untuk tabel portal & audit log. VALID & JANGAN disentuh. |
| `docker-compose.yml`, `lib/portal-*`, `app/api/portal-apps/*` | Beragam | 27 Agu 2026 | Ryan (TASK-20) | File modified aktif untuk implementasi TASK-20. |
| `app/admin/portal-apps/page.tsx` | ~40 KB | 27 Agu 2026 | Hennessey (TASK-21) | File modified aktif untuk UI form & test portal v2. |

---

## 4. Observasi Kebersihan Tambahan (Hygiene Notes)
- **Duplikasi Script:** Ditemukan duplikasi antara script di root (`backup.ps1`, `deploy.ps1`, `restore.ps1`, `backup-full.ps1`, `restore-full.ps1`) dan di folder `scripts/` (`scripts/backup.ps1`, dll). Versi root cenderung lebih baru (Jan-Feb 2026) dibanding versi `scripts/` (Des 2025). Perlu konsolidasi di masa mendatang setelah milestone fitur stabil.
- **Cache `.planning`:** Terdapat 3 file cache `.planning/research/.cache/*.json` yang terlanjur ter-commit di commit `ff8ce1e` (19 Agu 2026). Tidak membahayakan, tetapi bisa dipertimbangkan untuk di-untrack.
