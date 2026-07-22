# 05 — Audit Trail Menyeluruh

> Satu sumber kebenaran untuk semua transaksi semua user (admin CMS, portal, sistem).
> Model `AuditLog` lihat `01-data-model.md`. Halaman admin: `/admin/audit-trail`.

## 1. Helper terpusat: `lib/audit.ts`

Satu pintu masuk supaya semua pencatatan konsisten & IP/UA selalu tertangkap.

```ts
import prisma from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { AuditActor, AuditOutcome, AuditCategory, LogSeverity } from "@prisma/client";

interface AuditParams {
  actorType: AuditActor;
  actorId?: string;         // null untuk SYSTEM
  category: AuditCategory;
  action: string;           // LOGIN_SUCCESS, CREATE, SSO_LAUNCH, ...
  entityType: string;       // ANNOUNCEMENT, PORTAL_APP, ...
  entityId?: string;
  outcome?: AuditOutcome;   // default SUCCESS
  errorMessage?: string;
  changes?: Record<string, unknown>;  // auto-redaksi field sensitif
  metadata?: Record<string, unknown>;
  severity?: LogSeverity;   // default INFO
  siteId?: string;
  appId?: string;
  request?: NextRequest;    // untuk ambil IP & User-Agent otomatis
}

// Field yang otomatis di-redaksi dari changes/metadata
const SENSITIVE_KEYS = [
  "password", "passwordHash", "credentialBlob", "token",
  "secret", "sessionToken", "resetToken", "smtpPass",
];

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      result[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function extractIp(request?: NextRequest): string | null {
  if (!request) return null;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip") || null;
}

function extractUserAgent(request?: NextRequest): string | null {
  if (!request) return null;
  return request.headers.get("user-agent") || null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const changes = params.changes ? JSON.stringify(redact(params.changes)) : null;
    const metadata = params.metadata ? redact(params.metadata) : undefined;

    // Denormalisasi actor (email/name) dari tabel terkait
    let actorEmail: string | null = null;
    let actorName: string | null = null;
    if (params.actorId && params.actorType === "ADMIN_USER") {
      const u = await prisma.user.findUnique({
        where: { id: params.actorId }, select: { email: true, name: true },
      });
      actorEmail = u?.email ?? null;
      actorName = u?.name ?? null;
    } else if (params.actorId && params.actorType === "PORTAL_USER") {
      const u = await prisma.portalUser.findUnique({
        where: { id: params.actorId }, select: { email: true, name: true },
      });
      actorEmail = u?.email ?? null;
      actorName = u?.name ?? null;
    }

    await prisma.auditLog.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId ?? null,
        actorEmail, actorName,
        category: params.category,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        outcome: params.outcome ?? "SUCCESS",
        errorMessage: params.errorMessage ?? null,
        changes, metadata,
        ipAddress: extractIp(params.request),
        userAgent: extractUserAgent(params.request),
        severity: params.severity ?? "INFO",
        siteId: params.siteId ?? null,
        appId: params.appId ?? null,
        portalUserId: params.actorType === "PORTAL_USER" ? params.actorId : null,
      },
    });
  } catch (error) {
    // Audit TIDAK PERNAH menggagalkan transaksi utama
    console.error("[Audit] Failed to write audit log:", error);
  }
}
```

**Prinsip:**
- `logAudit()` dibungkus `try/catch` — error audit tidak membatalkan operasi utama.
- `redact()` otomatis mengganti field sensitif dengan `[REDACTED]`.
- `extractIp()`/`extractUserAgent()` ambil dari header request otomatis.
- Denormalisasi `actorEmail`/`actorName` → log tetap terbaca walau user dihapus.


## 2. Katalog event audit (lengkap)

### 2.1 AUTH (CMS + Portal)

| action | actorType | entityType | outcome | Kapan |
|--------|-----------|------------|---------|-------|
| `LOGIN_SUCCESS` | ADMIN_USER | USER_SESSION | SUCCESS | Admin CMS login berhasil |
| `LOGIN_FAILED` | ADMIN_USER | USER_SESSION | FAILURE | Admin CMS login gagal |
| `LOGOUT` | ADMIN_USER | USER_SESSION | SUCCESS | Admin CMS logout |
| `SESSION_REVOKED` | ADMIN_USER | USER_SESSION | SUCCESS | Sesi CMS direvoke |
| `PORTAL_LOGIN_SUCCESS` | PORTAL_USER | PORTAL_SESSION | SUCCESS | Portal user login berhasil |
| `PORTAL_LOGIN_FAILED` | PORTAL_USER | PORTAL_SESSION | FAILURE | Portal user login gagal |
| `PORTAL_LOGOUT` | PORTAL_USER | PORTAL_SESSION | SUCCESS | Portal user logout |
| `PORTAL_SESSION_REVOKED` | ADMIN_USER/PORTAL_USER | PORTAL_SESSION | SUCCESS | Sesi portal direvoke |
| `PORTAL_PASSWORD_CHANGE` | PORTAL_USER | PORTAL_USER | SUCCESS/FAILURE | User ubah password sendiri |
| `ADMIN_RESET_PORTAL_PASSWORD` | ADMIN_USER | PORTAL_USER | SUCCESS | Admin reset password portal user |
| `PASSWORD_RESET_REQUESTED` | PORTAL_USER | PORTAL_USER | SUCCESS | User minta reset password |
| `PASSWORD_RESET_COMPLETED` | PORTAL_USER | PORTAL_USER | SUCCESS/FAILURE | User set password baru via token |

### 2.2 SECURITY

| action | actorType | entityType | outcome | Kapan |
|--------|-----------|------------|---------|-------|
| `ACCOUNT_LOCKED` | PORTAL_USER | PORTAL_USER | FAILURE | Akun portal terkunci (5x gagal) |
| `BRUTE_FORCE_BLOCKED` | SYSTEM | — | FAILURE | Rate-limit middleware block |
| `CREDENTIAL_SAVED` | PORTAL_USER | PORTAL_CREDENTIAL | SUCCESS | User simpan kredensial app |
| `CREDENTIAL_UPDATED` | PORTAL_USER | PORTAL_CREDENTIAL | SUCCESS | User update kredensial app |
| `CREDENTIAL_DELETED` | PORTAL_USER | PORTAL_CREDENTIAL | SUCCESS | User hapus kredensial app |
| `CREDENTIAL_DECRYPTED` | PORTAL_USER | PORTAL_CREDENTIAL | SUCCESS | Kredensial didekrip untuk SSO |
| `SSO_LAUNCH` | PORTAL_USER | PORTAL_APP | SUCCESS | User buka app via SSO |
| `SSO_LAUNCH_FAILED` | PORTAL_USER | PORTAL_APP | FAILURE | SSO launch gagal (no cred/corrupt) |

### 2.3 USER_MGMT

| action | actorType | entityType | outcome | Kapan |
|--------|-----------|------------|---------|-------|
| `CREATE` | ADMIN_USER | USER | SUCCESS | Buat user CMS |
| `UPDATE` | ADMIN_USER | USER | SUCCESS/FAILURE | Edit user CMS |
| `DELETE` | ADMIN_USER | USER | SUCCESS | Hapus user CMS |
| `PORTAL_USER_CREATED` | ADMIN_USER | PORTAL_USER | SUCCESS | Buat portal user |
| `PORTAL_USER_UPDATED` | ADMIN_USER | PORTAL_USER | SUCCESS/FAILURE | Edit portal user |
| `PORTAL_USER_DELETED` | ADMIN_USER | PORTAL_USER | SUCCESS | Hapus portal user |
| `PORTAL_USER_ACTIVATED` | ADMIN_USER | PORTAL_USER | SUCCESS | Aktifkan portal user |
| `PORTAL_USER_DEACTIVATED` | ADMIN_USER | PORTAL_USER | SUCCESS | Nonaktifkan portal user |
| `ACCESS_GRANTED` | ADMIN_USER | PORTAL_USER_APP_ACCESS | SUCCESS | Assign app access ke user |
| `ACCESS_REVOKED` | ADMIN_USER | PORTAL_USER_APP_ACCESS | SUCCESS | Hapus app access dari user |

### 2.4 PORTAL

| action | actorType | entityType | outcome | Kapan |
|--------|-----------|------------|---------|-------|
| `PORTAL_APP_CREATED` | ADMIN_USER | PORTAL_APP | SUCCESS | Buat definisi app |
| `PORTAL_APP_UPDATED` | ADMIN_USER | PORTAL_APP | SUCCESS/FAILURE | Edit definisi app |
| `PORTAL_APP_DELETED` | ADMIN_USER | PORTAL_APP | SUCCESS | Hapus definisi app |
| `APP_LAUNCH` | PORTAL_USER | PORTAL_APP | SUCCESS | (alias SSO_LAUNCH) |

### 2.5 CONTENT

| action | actorType | entityType | outcome | Kapan |
|--------|-----------|------------|---------|-------|
| `CREATE` | ADMIN_USER | ANNOUNCEMENT | SUCCESS | Buat pengumuman |
| `UPDATE` | ADMIN_USER | ANNOUNCEMENT | SUCCESS/FAILURE | Edit pengumuman |
| `DELETE` | ADMIN_USER | ANNOUNCEMENT | SUCCESS | Hapus pengumuman |
| `BULK_DELETE` | ADMIN_USER | ANNOUNCEMENT | SUCCESS | Hapus massal |
| `BULK_PUBLISH` | ADMIN_USER | ANNOUNCEMENT | SUCCESS | Publish massal |
| `BULK_UNPUBLISH` | ADMIN_USER | ANNOUNCEMENT | SUCCESS | Unpublish massal |
| `CREATE`/`UPDATE`/`DELETE` | ADMIN_USER | CATEGORY | SUCCESS | CRUD kategori |
| `MODERATE_APPROVED`/`_REJECTED`/`_SPAM` | ADMIN_USER | COMMENT | SUCCESS | Moderasi komentar |
| `DELETE` | ADMIN_USER | COMMENT | SUCCESS | Hapus komentar |
| `UPLOAD` | ADMIN_USER | MEDIA | SUCCESS | Upload media |

### 2.6 SYSTEM

| action | actorType | entityType | outcome | Kapan |
|--------|-----------|------------|---------|-------|
| `BACKUP` | ADMIN_USER | SYSTEM | SUCCESS | Backup database |
| `RESTORE_DATABASE` | ADMIN_USER | SYSTEM | SUCCESS/FAILURE | Restore database |
| `SCHEDULER_RUN` | SYSTEM | SYSTEM | SUCCESS | Scheduler auto-publish/takedown |
| `UPDATE_SYSTEM` | ADMIN_USER | SYSTEM | SUCCESS | System update (git pull) |
| `AUDIT_RETENTION_PURGE` | SYSTEM | AUDIT_LOG | SUCCESS | Hapus audit lama (retensi) |

### 2.7 CONFIG

| action | actorType | entityType | outcome | Kapan |
|--------|-----------|------------|---------|-------|
| `UPDATE` | ADMIN_USER | SETTINGS | SUCCESS | Update settings |
| `UPDATE` | ADMIN_USER | EMAIL_SETTINGS | SUCCESS | Update email settings |
        portalUserId: params.actorType === "PORTAL_USER" ? params.actorId : null,
      },
    });
  } catch (error) {
    // Audit TIDAK PERNAH menggagalkan transaksi utama
    console.error("[Audit] Failed to write audit log:", error);
  }
}
```


## 3. Retrofit ke route yang sudah ada

Setiap mutasi admin eksisting ditambah `logAudit(...)`. Contoh retrofit
`app/api/announcements/route.ts` POST:

```ts
// Setelah create announcement berhasil:
await logAudit({
    actorType: "ADMIN_USER",
    actorId: session.user.id,
    category: "CONTENT",
    action: "CREATE",
    entityType: "ANNOUNCEMENT",
    entityId: announcement.id,
    changes: { title, slug, siteIds },
    siteId: primarySiteId,
    request,  // ← IP & UA otomatis
});
```

Daftar route yang di-retrofit (semua yang punya `prisma.activityLog.create` saat ini):
- `app/api/announcements/route.ts` (POST) + `[id]/route.ts` (PUT, DELETE)
- `app/api/announcements/bulk/route.ts` (BULK_DELETE, BULK_PUBLISH, BULK_UNPUBLISH)
- `app/api/categories/route.ts` (POST) + `[id]/route.ts` (PUT, DELETE)
- `app/api/comments/[id]/route.ts` (MODERATE, DELETE)
- `app/api/users/route.ts` (POST) + `[id]/route.ts` (PUT, DELETE)
- `app/api/sessions/route.ts` (DELETE — REVOKE_SESSION)
- `app/api/settings/route.ts` (PUT)
- `app/api/email/settings/route.ts` (PUT)
- `app/api/backup/route.ts` (BACKUP, RESTORE)
- `app/api/update/route.ts` (UPDATE_SYSTEM)
- `lib/scheduler.ts` (SCHEDULER_RUN — actorType=SYSTEM, actorId=null)

**Tambahan logging auth yang belum ada:**
- `lib/auth.ts`: di callback `jwt` saat `trigger === "signIn"` → `LOGIN_SUCCESS`;
  di `authorize()` saat throw error → `LOGIN_FAILED` (perlu try/catch wrapper).
- `lib/portal-auth.ts`: sama untuk portal — `PORTAL_LOGIN_SUCCESS` / `PORTAL_LOGIN_FAILED`.

> `ActivityLog` lama tetap dipertahankan (tidak dihapus). Route menulis **keduanya**
  selama transisi, lalu `ActivityLog.create` dihapus setelah backfill selesai & diverifikasi.

## 4. Halaman admin: `/admin/audit-trail`

Mirror `/admin/audit-logs` yang sekarang, dengan filter lebih kaya:
- Filter: `actorType`, `category`, `outcome`, `severity`, `entityType`,
  rentang tanggal (from/to), pencarian email/aksi.
- Kolom: waktu, actor (nama+email+badge ADMIN/PORTAL/SYSTEM), kategori, aksi,
  entitas, outcome (sukses/gagal badge), IP, perangkat (dari User-Agent).
- Detail expand: `changes` (sudah ter-redaksi), `errorMessage`, `metadata`.
- **Export CSV/JSON** untuk kebutuhan eksternal/compliance.
- Paginasi via `validatePagination` (pola yang sudah ada).

### API: `/api/audit-trail`
- `GET` — list + filter + paginasi (SuperAdmin only).
- `GET ?export=csv` atau `?export=json` — export full (dengan filter, tanpa paginasi).
- Query params: `page`, `limit`, `actorType`, `category`, `outcome`, `severity`,
  `entityType`, `from`, `to`, `search`, `export`.

## 5. Retensi audit

Env `AUDIT_RETENTION_DAYS` (default 365, 0 = selamanya).

Tambah di `lib/scheduler.ts` (sudah ada, throttled 60s):
```ts
// 3. Audit retention purge
const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || "365");
if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const purged = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
    });
    if (purged.count > 0) {
        await logAudit({
            actorType: "SYSTEM", category: "SYSTEM",
            action: "AUDIT_RETENTION_PURGE", entityType: "AUDIT_LOG",
            outcome: "SUCCESS", metadata: { purgedCount: purged.count, retentionDays },
        });
    }
}
```

## 6. Backfill `ActivityLog` → `AuditLog`

Script one-time: `scripts/backfill-audit-log.ts` (jalankan via `npx tsx`).

```ts
// Pseudocode:
const oldLogs = await prisma.activityLog.findMany();
for (const log of oldLogs) {
    await prisma.auditLog.create({
        data: {
            actorType: "ADMIN_USER",
            actorId: log.userId,
            category: mapCategory(log.entityType), // map lama → AuditCategory
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            outcome: "SUCCESS",
            changes: log.changes,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            severity: log.severity,
            siteId: log.siteId,
            createdAt: log.createdAt,
        },
    });
}
```

**Idempoten:** cek apakah baris sudah di-backfill (mis. track via metadata
`{ backfilled: true, originalId: log.id }`) → skip jika sudah ada.

**Mapping kategori lama → baru:**
| `entityType` lama | `AuditCategory` |
|-------------------|-----------------|
| ANNOUNCEMENT | CONTENT |
| CATEGORY | CONTENT |
| COMMENT | CONTENT |
| USER | USER_MGMT |
| USER_SESSION | AUTH |
| SETTINGS / EMAIL_SETTINGS | CONFIG |
| SYSTEM | SYSTEM |

## 7. Migrasi halaman audit

- `/admin/audit-logs` (lama) → **redirect** ke `/admin/audit-trail` (baru).
- Atau: pertahankan `/admin/audit-logs` baca dari `AuditLog` (filter actorType=ADMIN_USER
  saja) untuk backward compat, dan `/admin/audit-trail` baca semua.
- **Rekomendasi:** redirect + update sidebar menu "AUDIT LOG" → "AUDIT TRAIL".
