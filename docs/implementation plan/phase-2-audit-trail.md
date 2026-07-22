# Fase 2 — Audit Trail (Retrofit + Halaman + Export)

> Specs referensi: `05-audit-trail.md`, `06-api-reference.md` §6
> Milestone: M2 · Prasyarat: **Fase 1** (butuh `AuditLog` model + `logAudit`)

## Objective

Mengaktifkan audit menyeluruh: retrofit `logAudit()` ke semua route mutasi eksisting,
membangun halaman admin terpadu `/admin/audit-trail` dengan filter + export, backfill data
`ActivityLog` lama ke `AuditLog`, dan tambah retensi audit di scheduler.

## Prerequisites

- [ ] Fase 1 selesai (DoD terpenuhi)
- [ ] `lib/audit.ts` + `AuditLog` model tersedia

## Task list

### 2.1 Retrofit `logAudit` ke route mutasi (tambah di samping `ActivityLog` lama)

Untuk tiap route: tambah `await logAudit({...})` SETELAH operasi berhasil (dan tambah
`outcome:"FAILURE"` di catch block). Pola umum:
```ts
// setelah prisma.create/update/delete sukses:
await logAudit({
    actorType: "ADMIN_USER", actorId: (session.user as {id:string}).id,
    category: "CONTENT", action: "CREATE", entityType: "ANNOUNCEMENT",
    entityId: result.id, changes: {...}, siteId, request,
});
```

- [ ] `app/api/announcements/route.ts` POST → action `CREATE` category `CONTENT`
- [ ] `app/api/announcements/[id]/route.ts` PUT → `UPDATE` / DELETE → `DELETE` (CONTENT)
- [ ] `app/api/announcements/bulk/route.ts` → `BULK_DELETE` / `BULK_PUBLISH` / `BULK_UNPUBLISH`
- [ ] `app/api/categories/route.ts` POST → `CREATE` category `CONTENT`
- [ ] `app/api/categories/[id]/route.ts` PUT/DELETE → `UPDATE`/`DELETE`
- [ ] `app/api/comments/[id]/route.ts` → `MODERATE_APPROVED`/`_REJECTED`/`_SPAM` / `DELETE`
- [ ] `app/api/users/route.ts` POST → `CREATE` category `USER_MGMT`
- [ ] `app/api/users/[id]/route.ts` PUT/DELETE → `UPDATE`/`DELETE`
- [ ] `app/api/sessions/route.ts` DELETE → `SESSION_REVOKED` category `AUTH`
- [ ] `app/api/settings/route.ts` PUT → `UPDATE` category `CONFIG`, entityType `SETTINGS`
- [ ] `app/api/email/settings/route.ts` PUT → `UPDATE` entityType `EMAIL_SETTINGS`
- [ ] `app/api/update/route.ts` → `UPDATE_SYSTEM` category `SYSTEM`
- [ ] `lib/scheduler.ts` → `SCHEDULER_RUN` (actorType `SYSTEM`, actorId null) — ganti
  trik `sysUser.id` lama dengan actorType SYSTEM yang sebenarnya

### 2.2 Backup/restore cover tabel portal + audit

- [ ] Edit `app/api/backup/route.ts`:
  - [ ] Tambah `portal_users`, `portal_apps`, `portal_user_app_access`,
    `portal_user_app_credentials`, `portal_sessions`, `audit_logs` ke backup
  - [ ] Restore urutan: PortalApp → PortalUser → PortalUserAppAccess →
    PortalUserAppCredential → PortalSession → AuditLog (perhatikan FK)
  - [ ] Audit: `BACKUP` (category SYSTEM) saat backup; `RESTORE_DATABASE` saat restore
  - [ ] Catatan: `credentialBlob` sudah encrypted → aman di-backup as-is

### 2.3 API audit trail

- [ ] Buat `app/api/audit-trail/route.ts` (GET, SuperAdmin only):
  - [ ] `getServerSession(authOptions)` + `isSuperAdmin` check → 403 jika bukan
  - [ ] Query params: `page`, `limit` (via `validatePagination`), `actorType`,
    `category`, `outcome`, `severity`, `entityType`, `from`, `to`, `search`, `export`
  - [ ] `where` clause build dari filter
  - [ ] Export CSV: `Content-Type: text/csv`, kolom timestamp, actor, category, action,
    outcome, IP, severity, changes. Pakai filter, tanpa paginasi
  - [ ] Export JSON: array lengkap dengan filter
  - [ ] Response 200: `{ data, pagination }` (non-export)
- [ ] Buat `app/api/audit-trail/[id]/route.ts` (GET detail, SuperAdmin) → `{ ...log }`

### 2.4 Halaman admin audit trail

- [ ] Buat `app/admin/audit-trail/page.tsx` (client, mirror `audit-logs/page.tsx`):
  - [ ] Filter: `actorType` (dropdown), `category`, `outcome`, `severity`,
    `entityType`, date range (from/to), search (email/action)
  - [ ] Tabel: waktu, actor (name+email+badge ADMIN/PORTAL/SYSTEM), category, action,
    entityType+entityId, outcome (sukses hijau/gagal merah), IP, perangkat (parse UA)
  - [ ] Detail expand: `changes` (JSON, `<code>` block), `errorMessage`, `metadata`
  - [ ] Tombol Export CSV + Export JSON (trigger download)
  - [ ] Paginasi (pola `validatePagination`)
  - [ ] Inline-style dark UI (sesuai konvensi `#0a0a0a`/`#262626`)

### 2.5 Sidebar & redirect

- [ ] Edit `components/admin/AdminSidebar.tsx`:
  - [ ] Ganti menu "AUDIT LOG" → `{ href: "/admin/audit-trail", icon: FiActivity, label: "AUDIT TRAIL" }`
  - [ ] Import `FiGrid`, `FiUserPlus` (untuk fase 3, sekalian)
- [ ] Edit `app/admin/audit-logs/page.tsx` → redirect ke `/admin/audit-trail`:
  ```ts
  import { redirect } from "next/navigation";
  export default function Page() { redirect("/admin/audit-trail"); }
  ```

### 2.6 Retensi audit di scheduler

- [ ] Edit `lib/scheduler.ts` — tambah blok 3 (setelah auto-publish/takedown):
  - [ ] Baca `AUDIT_RETENTION_DAYS` (default 365, 0 = skip)
  - [ ] `prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })`
  - [ ] `logAudit({ actorType:"SYSTEM", action:"AUDIT_RETENTION_PURGE", metadata:{ purgedCount } })`

### 2.7 Backfill ActivityLog → AuditLog

- [ ] Buat `scripts/backfill-audit-log.ts` (sesuai `05-audit-trail.md` §6):
  - [ ] `CATEGORY_MAP` (ANNOUNCEMENT→CONTENT, USER→USER_MGMT, dll.)
  - [ ] Loop `activityLog.findMany` → skip jika sudah ada (idempoten via metadata check)
  - [ ] Insert ke `auditLog` dengan `actorType: "ADMIN_USER"`, `metadata: { backfilled:true, originalId }`
- [ ] Jalankan: `npx tsx scripts/backfill-audit-log.ts`
- [ ] Verifikasi: count `audit_logs` ≈ count `activity_logs` (data lama) + new entries

### 2.8 Hapus `ActivityLog.create` lama (setelah backfill diverifikasi)

- [ ] Setelah backfill sukses & diverifikasi di `/admin/audit-trail`:
  - [ ] Hapus `await prisma.activityLog.create({...})` dari semua route yang di-retrofit
  - [ ] Pertahankan tabel `activity_logs` (no DROP) untuk safety
  - [ ] Catatan: lakukan bertahap jika ragu — bisa dual-write dulu lalu hapus

## Definition of Done (DoD)

- [ ] Semua route mutasi eksisting memakai `logAudit` (grep: tidak ada
  `prisma.activityLog.create` baru selain yang sengaja dipertahankan)
- [ ] `/admin/audit-trail` menampilkan audit log dengan filter berfungsi
- [ ] Export CSV & JSON menghasilkan file terdownload
- [ ] Backfill selesai: data `ActivityLog` lama muncul di `AuditLog`
- [ ] Retensi audit jalan (test: `AUDIT_RETENTION_DAYS=0` → skip; kecil → purge)
- [ ] `/admin/audit-logs` redirect ke `/admin/audit-trail`
- [ ] Backup include tabel portal + audit
- [ ] `npm run build && npm run lint` sukses

## Validation steps
```bash
npm run build && npm run lint
npx tsx scripts/backfill-audit-log.ts
# Manual:
# 1. Login admin → buat pengumuman → cek /admin/audit-trail muncul "CREATE ANNOUNCEMENT"
# 2. Filter category=CONTENT → muncul data lama (backfilled) + baru
# 3. Export CSV → file terdownload, buka di Excel
# 4. Backup via /admin → restore di staging → verifikasi audit_logs ada
```

## Rollback notes
- `ActivityLog` lama tidak di-drop → jika retrofit bermasalah, kode lama tetap jalan
  (dual-write aman). Revert kode audit retrofit saja.
- Backfill idempoten → re-run aman jika ada error di tengah.
