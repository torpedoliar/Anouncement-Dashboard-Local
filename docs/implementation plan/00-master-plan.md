# 00 — Master Implementation Plan

> Status: PLAN (belum diimplementasi)
> Berdasarkan: `docs/specs/00-overview.md` s/d `10-changelog-and-env.md`
> Target version: 3.0.0 · schemaVersion 9

## 1. Tujuan dokumen ini

Specs (`docs/specs/`) menjawab **apa** yang dibangun. Dokumen ini menjawab **bagaimana
cara mengeksekusinya**: urutan, dependensi, tugas ter-trackable, definisi selesai (DoD),
langkah validasi, risiko, dan strategi rollout.

## 2. Prinsip eksekusi

1. **Fase berurutan** — tiap fase depend pada fase sebelumnya. Jangan skip urutan.
2. **Buildable per fase** — setelah tiap fase, `npm run build` + `npm run lint` harus sukses.
3. **Non-destructive** — tabel/data lama tidak di-drop. Migrasi hanya menambah.
4. **Validasi sebelum lanjut** — tiap fase punya DoD. Jika DoD tidak terpenuhi, jangan lanjut.
5. **Backup sebelum migrasi** — sebelum Fase 1 migrasi DB, jalankan backup eksisting.
6. **Tanpa dependency baru** — hanya `node:crypto`, `bcryptjs`, `next-auth`, Prisma, Zod.

## 3. Dependency graph antar fase

```
Fase 1 (Fondasi: schema + crypto + auth + audit helper)
   │
   ├─► Fase 2 (Audit Trail: retrofit + halaman)    [butuh: AuditLog + logAudit]
   │      └─ (independen, bisa paralel setelah Fase 1)
   │
   ├─► Fase 3 (Admin Portal: CRUD app/user/sesi)    [butuh: schema + portal-access]
   │      └─► Fase 4 (Portal UX: login + grid + cred) [butuh: portal-users + access]
   │             └─► Fase 5 (SSO Launch: auto-submit)  [butuh: credentials]
   │
   └─► Fase 6 (Integrasi & Hardening)               [butuh: semua fase sebelumnya]
```

- **Fase 1** adalah gate — semua fase lain butuh schema + helper.
- **Fase 2 & 3** bisa dikerjakan paralel setelah Fase 1 (tim berbeda).
- **Fase 4** butuh Fase 3 (butuh user + access untuk di-test).
- **Fase 5** butuh Fase 4 (butuh credential untuk launch).
- **Fase 6** terakhir (backup, docker, seed, docs menyatukan semua).

## 4. Milestones

| Milestone | Fase | Kriteria utama |
|-----------|------|----------------|
| M1 — Fondasi | Fase 1 | Migrasi DB sukses; `logAudit()` + `portalAuthOptions` ter-build |
| M2 — Audit hidup | Fase 2 | `/admin/audit-trail` menampilkan semua transaksi + backfill selesai |
| M3 — Admin portal | Fase 3 | Admin bisa CRUD app + user + assign access via panel |
| M4 — Portal fungsional | Fase 4 | User login portal, lihat grid sesuai RBAC, kelola kredensial |
| M5 — SSO bekerja | Fase 5 | Klik app → auto-submit → terlogin di app eksternal |
| M6 — Production-ready | Fase 6 | Backup/restore portal + docker env + seed + docs lengkap |

## 5. Estimasi effort (indikatif)

| Fase | Estimasi | Kompleksitas | Catatan |
|------|----------|--------------|---------|
| Fase 1 | 1.5–2 hari | Sedang | Banyak file baru tapi pola jelas (copy `auth.ts`) |
| Fase 2 | 2–3 hari | Sedang–tinggi | Retrofit ~10 route + halaman + export + backfill |
| Fase 3 | 2–3 hari | Sedang | CRUD mirip `users` eksisting; 3 halaman admin |
| Fase 4 | 2–3 hari | Sedang | 7 halaman portal + guard + komponen |
| Fase 5 | 1 hari | Rendah–sedang | 1 halaman launch + failure states |
| Fase 6 | 1–1.5 hari | Rendah | Integrasi + env + docs |
| **Total** | **~9–13 hari** | | Satu developer; bisa paralel Fase 2&3 |

> Estimasi untuk satu developer penuh waktu. Fase 2 & 3 paralel = hemat ~2 hari.

## 6. Strategi rollout / deployment

### Pre-deploy checklist
- [ ] Backup database eksisting sebelum migrasi (`scripts/backup.ps1` atau via `/admin`)
- [ ] Generate `PORTAL_CREDENTIAL_KEY`: `openssl rand -hex 32`
- [ ] Pastikan `NEXTAUTH_SECRET` kuat
- [ ] Staging environment untuk test (jangan langsung production)

### Urutan deploy
1. Merge code ke branch main (atau release branch)
2. `npm run build` di staging — verifikasi sukses
3. Jalankan migrasi di staging: `npm run prisma:migrate --name add_portal_and_audit`
4. Jalankan backfill: `npx tsx scripts/backfill-audit-log.ts`
5. Smoke test di staging (login admin, login portal, audit trail)
6. Set env production: `PORTAL_CREDENTIAL_KEY`, `AUDIT_RETENTION_DAYS`
7. Deploy production: `docker-compose up --build`
8. `docker-compose exec -T web npx prisma migrate deploy`
9. Backfill production: `docker-compose exec -T web npx tsx scripts/backfill-audit-log.ts`
10. Smoke test production

### Rollback
- **Migrasi non-destructive** → rollback = revert code + tidak perlu revert DB
  (tabel baru tidak mengganggu fungsi lama jika code lama di-restore).
- **Jika backfill bermasalah**: `AuditLog` bisa di-truncate (data derived dari
  `ActivityLog` lama yang tetap ada) lalu re-run backfill.
- **Jika credential key salah**: tidak ada data credential yang sudah tersimpan
- **Jika credential key salah**: tidak ada data credential yang sudah tersimpan
  (user belum simpan) → aman ganti key sebelum go-live.

## 7. Risk summary (detail di `risk-register.md`)

| Risiko | Dampak | Mitigasi inti |
|--------|--------|---------------|
| Migrasi DB gagal di production | Tinggi | Backup dulu; migrasi non-destructive; test staging |
| Cross-origin SSO tidak jalan (SameSite strict) | Sedang | Dokumentasi kebutuhan app; mode FORM = best-effort |
| Kredensial key leak | Kritis | Env terpisah; gitignore; validasi fail-closed |
| Retrofit audit merusak route eksisting | Sedang | Tambah `logAudit` di samping lama; verifikasi per route |
| Backfill duplikat data | Rendah | Script idempoten (cek existing sebelum insert) |
| Lockout mengunci user sah | Sedang | Threshold 5x + durasi 15 menit (tidak permanen) |
| Rate-limit in-memory reset saat restart | Rendah | Single container saat ini; Redis future |

## 8. Ringkasan scope file

- **File baru:** ~25 (lib, API, pages, components, scripts, instrumentation)
- **File dimodifikasi:** ~18 (schema, auth, validation, scheduler, middleware, sidebar,
  backup, seed, docker, version, CLAUDE.md, .env, + retrofit ~10 route API)
- **Dokumen specs referensi:** 11 file di `docs/specs/`

## 9. Daftar dokumen implementation plan

| Dokumen | Isi |
|---------|-----|
| `00-master-plan.md` | Dokumen ini — overview, milestone, dependency, rollout |
| `phase-1-foundation.md` | Fase 1: schema + crypto + auth + audit helper — tugas terperinci |
| `phase-2-audit-trail.md` | Fase 2: retrofit audit + halaman + export + backfill |
| `phase-3-admin-portal.md` | Fase 3: CRUD app/user/sesi di panel admin |
| `phase-4-portal-ux.md` | Fase 4: login portal + grid + credentials + lupa password |
| `phase-5-sso-launch.md` | Fase 5: halaman launch SSO + auto-submit + failure UX |
| `phase-6-integration-hardening.md` | Fase 6: backup + middleware + env + seed + docs |
| `test-verification-plan.md` | Strategi test + test case per fase (manual, e2e) |
| `risk-register.md` | Daftar risiko + mitigasi + contingency |

## 10. Cara pakai dokumen ini

1. Baca `00-master-plan.md` (dokumen ini) untuk gambaran besar.
2. Kerjakan fase berurutan: buka `phase-N-*.md`, ikuti checklist.
3. Setelah tiap fase, verifikasi via `test-verification-plan.md` section fase tsb.
4. Catat risiko yang muncul di `risk-register.md`.
5. Hanya lanjut fase berikutnya setelah DoD fase saat ini terpenuhi.

> Format checklist: `- [ ]` = belum, `- [x]` = selesai. Update saat eksekusi.
  (user belum simpan) → aman ganti key sebelum go-live.
