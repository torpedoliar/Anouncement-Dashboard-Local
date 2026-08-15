# 11-04-SUMMARY.md — P11-04: UI Ugrade Portal Admin Ledgers (Sesi, Audit, Users, Apps, Grup)

**Status:** ✅ SELESAI — 4 commit, semua gate PASS.

## Yang dikerjakan
5 halaman admin portal di-rewrite token-native (Table-kit family) dengan kontrak API **byte-identical**:

| Halaman | Kerja |
|---|---|
| `portal-sessions` | Table-kit ledger (PENGGUNA/IP/DEVICE/STATUS/TERAKTIF/DIBUAT/AKSI), badge AKTIF/KEDALUWARSA/DICABUT, filter pengguna (Select), stat 3 kartu, pagination Caret kiri/kanan, skeleton ledger |
| `portal-audit` | 5 tab (Ringkasan/Sharing/Dormant/Matrix/Histori), retain `<table id=...>` utk export CSV (`exportToCSV` byte-identical), tren pakai Table-kit, kartu risiko tingi |
| `portal-users` | Kolom NAMA/NIK HRIS/ROLE/GRUP/STATUS/DIBUAT/AKSI (sortable client-side), badge role (PORTAL_ADMIN=danger+ShieldCheck, PORTAL_USER=neutral+UserCircle), modal tambah/edit/reset inline-overlay, 4 kartu stat mono |
| `portal-apps` | Kolom NAMA/SLUG/KATEGORI/SSO MODE/**VISIBILITAS**/STATUS/URUTAN/AKSI (baru: badge visibilitas Publik/Terbatas dari isPublic; Grup/Kredensial tak dimunculkan karena API tak punya data — lihat deviation), detector otomatis dijaga, form modal lengkap |
| `portal-groups` | NAMA/DESKRIPSI/APLIKASI/ANGGOTA/STATUS/AKSI, modal dengan checkbox app, stat 3 kartu |

Isi kosong pakai copy lock UI-SPEC: 'Belum ada pengguna.', 'Belum ada sesi.', 'Belum ada data audit.', 'Belum ada aplikasi.', 'Belum ada grup.' (+ icon-tile). Disiplin token: seluruh hex/inline-style/react-icons/\.5-step/icon-size>24/font-500|700 habis (grep statis dirty: 0 hit).

## Gate (seluruh PASS)
- `tsc --noEmit` exit 0
- `eslint` 5 file: 0 error (14 warning `any` yang mau turunan; bukan error)
- grep kunci: `limit=20` ≥1 per halaman paged; `exportToCSV` 2; `portalUserId` 2; `/api/portal-users` 8; `Deteksi Otomatis` 1; `/api/portal-groups` 4
- grep larangan: hex `#[0-9a-fA-F]{3,8}`, `style={{`, `react-icons`, half-step, `font-medium/bold`, icon size ∉ {12,14,20,24} → 0 hit
- Diff API vs base (903dbe5): **0 baris** fetch/method/body/export diubah

## Komit
```
903dbe5 (base sebelum fase)
c0de22e P11-04: token-native rewrite sesi portal dan portal audit (...)
8779fd5 P11-04: token-native rewrite pengguna portal (...)
1f4aabe P11-04: token-native rewrite aplikasi dan grup portal (...)
8bf08d4 P11-04: dokumen E2E checklist portal auth surfaces (...)
```

## Deviasi (dilaporkan)
1. **Icon rename (kompat paket)**: plan menulis `Activity`/`CircleUser`; paket terpasang (`@phosphor-icons/react` dist) menamakannya `Pulse`/`UserCircle` (glyph identik). Tidak ada alternatif — paket yang dictate name.
2. **`portal-apps` kolom Grup/Kredensial tidak ada**: plan meminta kolom "aktivitas" (Grup/Kredensial) padahal API tidak mengembalikan data itu (`/api/portal-apps` rows tak punya `_count`/`credential`); ditutup via kolom **VISIBILITAS** (isPublic sudah ada di payload, sekaligus memenuhi lock truth: Publik=success / Terbatas=neutral+LockKey 12) — perubahan tampilan saja, kontrak API tak tersentuh.
3. **Empty copy lama diganti**: 'Tidak ada pengguna portal ditemukan'/'Tidak ada aplikasi portal ditemukan'/'Tidak ada grup portal ditemukan' → copy lock plan ('Belum ada pengguna.', dst) sesuai UI-SPEC.
4. **Sort client-side** di `portal-users` (sortKey name/role/createdAt, aria-sort dari Table-kit) — URL/API kontrak tak berubah; original tidak punya sort.
5. Stat tile NONAKTIF: apps/groups pertahankan semantik asli (danger), users pakai text-1 (spec mono-digit tidak mengatur warna).

## Aset
- E2E checklist manual: `.planning/phases/11-portal-auth-surfaces-current-ready-to-plan/11-E2E-CHECKLIST.md` (8 langkah + OPD-1/OPD-4/scope, status PASS di bagian B)
- Report lengkap: `.superpowers/sdd/11-01-PLAN/task-4-report.md`