# 10 — Changelog, Env & Infra

> Perubahan version, env, docker-compose, seed, script helper, dokumentasi.

## 1. version.json

```json
{
    "version": "3.0.0",
    "buildDate": "2026-07-22",
    "schemaVersion": "9",
    "releaseNotes": "Portal Web SSO (form-based credential forwarding) + RBAC portal + audit trail menyeluruh. Fitur: PortalUser terpisah, PortalApp dengan SSO auto-submit, kredensial AES-256-GCM at-rest, lockout akun, lupa/ubah password, manajemen sesi portal, AuditLog terpadu semua transaksi, export audit, retensi audit. Tabel lama dipertahankan + backfill.",
    "repository": "https://github.com/torpedoliar/Anouncement-Dashboard-Local"
}
```

> schemaVersion 8 → 9 (tambah enum + 6 tabel portal + 1 tabel audit).
> version 2.7.0 → 3.0.0 (major: fitur portal baru).

## 2. .env.example

Tambah setelah baris yang ada:

```env
# ===== PORTAL SSO =====
# Generate dengan: openssl rand -hex 32
# WAJIB. 64 hex chars (32 byte) untuk AES-256-GCM encrypt kredensial app.
PORTAL_CREDENTIAL_KEY=CHANGE_THIS_KEY

# ===== AUDIT TRAIL =====
# Retensi audit log dalam hari. 0 = simpan selamanya. Default: 365
AUDIT_RETENTION_DAYS=365

# ===== PORTAL SESSION (opsional) =====
# Max age sesi portal dalam detik. Default: 43200 (12 jam)
PORTAL_SESSION_MAX_AGE=43200
```

## 3. docker-compose.yml

Tambah env di service `web`:

```yaml
services:
  web:
    environment:
      # ... (yang sudah ada) ...
      - PORTAL_CREDENTIAL_KEY=CHANGE_THIS_KEY  # GANTI di production!
      - AUDIT_RETENTION_DAYS=365
      - PORTAL_SESSION_MAX_AGE=43200
```

> **Penting:** Ganti `CHANGE_THIS_KEY` dengan key yang di-generate sebelum deploy.

## 4. prisma/seed.ts

Tambah setelah seed yang sudah ada (site + admin CMS):

```ts
// ===== SEED PORTAL =====
import bcrypt from "bcryptjs";

// 1. Portal admin awal (untuk testing)
const portalAdminPassword = await bcrypt.hash("portal-admin-123", 10);
const portalAdmin = await prisma.portalUser.upsert({
    where: { email: "portal.admin@santosjayaabadi.co.id" },
    update: {},
    create: {
        email: "portal.admin@santosjayaabadi.co.id",
        passwordHash: portalAdminPassword,
        name: "Portal Admin",
        role: "PORTAL_ADMIN",
        isActive: true,
    },
});

// 2. Contoh portal user
const portalUserPassword = await bcrypt.hash("portal-user-123", 10);
const portalUser = await prisma.portalUser.upsert({
    where: { email: "portal.user@santosjayaabadi.co.id" },
    update: {},
    create: {
        email: "portal.user@santosjayaabadi.co.id",
        passwordHash: portalUserPassword,
        name: "Portal User Demo",
        role: "PORTAL_USER",
        isActive: true,
    },
});

// 3. Contoh portal app
const sampleApp = await prisma.portalApp.upsert({
    where: { slug: "example-erp" },
    update: {},
    create: {
        name: "Example ERP",
        slug: "example-erp",
        description: "Sistem ERP contoh untuk demo SSO",
        url: "https://erp.example.com",
        loginUrl: "https://erp.example.com/login",
        ssoMode: "FORM",
        httpMethod: "POST",
        usernameField: "username",
        passwordField: "password",
        category: "Internal",
        isActive: true,
        displayOrder: 1,
    },
});

// 4. Assign access: portal user → sample app
await prisma.portalUserAppAccess.upsert({
    where: {
        portalUserId_appId: { portalUserId: portalUser.id, appId: sampleApp.id },
    },
    update: {},
    create: {
        portalUserId: portalUser.id,
        appId: sampleApp.id,
        role: "USER",
    },
});

console.log("Seed portal selesai:", {
    portalAdmin: portalAdmin.email,
    portalUser: portalUser.email,
    sampleApp: sampleApp.slug,
});
```

> Password seed (`portal-admin-123`, `portal-user-123`) hanya untuk dev/demo.
> Ganti di production. Atau: jangan seed password, biarkan admin reset via panel.

## 5. Script helpers

### `scripts/make-portal-admin.ts` — analog `make-super-admin.ts`

```ts
// Promote user portal ke PORTAL_ADMIN (atau buat baru)
// Jalankan: npx tsx scripts/make-portal-admin.ts <email>
import prisma from "../lib/prisma";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage: npx tsx scripts/make-portal-admin.ts <email>");
        process.exit(1);
    }
    const user = await prisma.portalUser.findUnique({ where: { email } });
    if (!user) {
        console.error(`Portal user ${email} tidak ditemukan.`);
        process.exit(1);
    }
    await prisma.portalUser.update({
        where: { id: user.id },
        data: { role: "PORTAL_ADMIN" },
    });
    console.log(`✓ ${email} sekarang PORTAL_ADMIN`);
}
main().finally(() => prisma.$disconnect());
```

### `scripts/backfill-audit-log.ts` — backfill ActivityLog → AuditLog

```ts
// One-time, idempoten. Jalankan setelah migrasi:
// npx tsx scripts/backfill-audit-log.ts
import prisma from "../lib/prisma";

const CATEGORY_MAP: Record<string, string> = {
    ANNOUNCEMENT: "CONTENT", CATEGORY: "CONTENT", COMMENT: "CONTENT",
    USER: "USER_MGMT", USER_SESSION: "AUTH",
    SETTINGS: "CONFIG", EMAIL_SETTINGS: "CONFIG", SYSTEM: "SYSTEM",
};

async function main() {
    const oldLogs = await prisma.activityLog.findMany({ orderBy: { createdAt: "asc" } });
    console.log(`Backfill ${oldLogs.length} ActivityLog → AuditLog...`);
    let count = 0;
    for (const log of oldLogs) {
        const existing = await prisma.auditLog.findFirst({
            where: { actorType: "ADMIN_USER", actorId: log.userId,
                action: log.action, entityType: log.entityType, createdAt: log.createdAt },
        });
        if (existing) continue;
        await prisma.auditLog.create({
            data: {
                actorType: "ADMIN_USER", actorId: log.userId,
                category: (CATEGORY_MAP[log.entityType] as any) || "SYSTEM",
                action: log.action, entityType: log.entityType,
                entityId: log.entityId, outcome: "SUCCESS",
                changes: log.changes, ipAddress: log.ipAddress,
                userAgent: log.userAgent, severity: log.severity,
                siteId: log.siteId, createdAt: log.createdAt,
                metadata: { backfilled: true, originalId: log.id },
            },
        });
        count++;
    }
    console.log(`✓ Backfill selesai: ${count} baris`);
}
main().finally(() => prisma.$disconnect());
```

## 6. CLAUDE.md — tambahan dokumentasi

Tambah section setelah "Access control (two layers)":

```markdown
### Portal SSO (separate from CMS)
A web portal SSO layer sits alongside the CMS. Portal users are separate
(`PortalUser`, table `portal_users`) from admin CMS users (`User`). Key files:
- `lib/portal-auth.ts` — NextAuth instance with cookie prefix `portal-auth.*`.
- `lib/portal-crypto.ts` — AES-256-GCM encrypt/decrypt for stored app credentials.
- `lib/portal-access.ts` — RBAC helpers (`canAccessPortalApp`, `getAccessiblePortalApps`).
- `lib/audit.ts` — centralized audit logging (`logAudit`) for all transactions.
- Routes: `/portal-login` → `/portal` (app grid) → `/portal/app/[slug]` (SSO launch).
- Admin: `/admin/portal-apps`, `/admin/portal-users`, `/admin/portal-sessions`, `/admin/audit-trail`.

SSO uses form-based credential forwarding: portal stores each user's credentials
per app (encrypted at-rest with `PORTAL_CREDENTIAL_KEY`), then auto-submits a POST form
to the app's `loginUrl` when the user clicks an app.

### Audit Trail
`AuditLog` (table `audit_logs`) is the single source of truth for ALL transactions across
admin CMS, portal users, and system. Use `logAudit()` from `lib/audit.ts` — never write
to `audit_logs` directly. `ActivityLog` (legacy) is retained + backfilled; new code uses
`AuditLog` exclusively. Admin page: `/admin/audit-trail` (SuperAdmin only) with export.

### Required env (additional)
`PORTAL_CREDENTIAL_KEY` (64 hex chars, AES-256-GCM key — MANDATORY, fail-closed at startup),
`AUDIT_RETENTION_DAYS` (default 365, 0 = forever).
```

## 7. Ringkasan perubahan infra

| Item | Perubahan |
|------|-----------|
| `version.json` | schemaVersion 8→9, version 2.7.0→3.0.0 |
| `.env.example` | + `PORTAL_CREDENTIAL_KEY`, `AUDIT_RETENTION_DAYS`, `PORTAL_SESSION_MAX_AGE` |
| `docker-compose.yml` | + 3 env di service web |
| `prisma/seed.ts` | + portal admin + portal user + sample app + access |
| `prisma/schema.prisma` | + 6 enum + 6 model (non-destructive) |
| `CLAUDE.md` | + section Portal SSO + Audit Trail + env |
| `scripts/` | + `make-portal-admin.ts`, `backfill-audit-log.ts` |
| `instrumentation.ts` | + env validation fail-closed |

## 8. Verifikasi akhir dokumen specs

Dokumen specs yang dibuat di `docs/specs/`:
- ✅ `00-overview.md` — tujuan, scope, arsitektur, glossary
- ✅ `01-data-model.md` — skema Prisma penuh + migrasi
- ✅ `02-authentication-and-sessions.md` — auth portal, lockout, password
- ✅ `03-rbac.md` — 3-layer role, matriks, helper, Zod
- ✅ `04-sso-credential-forwarding.md` — enkripsi, auto-submit, failure UX
- ✅ `05-audit-trail.md` — helper, katalog event, retrofit, export, retensi
- ✅ `06-api-reference.md` — semua route baru
- ✅ `07-pages-and-routes.md` — halaman, guard, sidebar, middleware, route map
- ✅ `08-security.md` — threat model, enkripsi, limitasi, checklist
- ✅ `09-implementation-phases.md` — 6 fase, daftar file, validasi
- ✅ `10-changelog-and-env.md` — dokumen ini
