# 01 — Data Model (Prisma Schema)

> Tambahan pada `prisma/schema.prisma`. Tidak mengubah model yang sudah ada.
> Setelah edit: `npm run prisma:generate` lalu `npm run prisma:migrate --name add_portal_and_audit`.
> Bump `schemaVersion` di `version.json`: 8 → 9.

## 1. Enum baru

```prisma
// ===== PORTAL ENUMS =====
enum PortalRole {
  PORTAL_ADMIN // Delegasi manajemen portal (future); saat ini SuperAdmin CMS kelola
  PORTAL_USER  // User biasa portal
}

enum PortalAppRole {
  USER  // Buka app via SSO
  ADMIN // (future) kelola konfigurasi app tertentu
}

// Extensible: FORM sekarang; sisanya fase berikutnya
enum PortalSsoMode {
  FORM      // Credential forwarding via auto-submit form
  REDIRECT  // (future) redirect SSO
  PROXY     // (future) reverse proxy + header injection
  TOKEN     // (future) OIDC/OAuth2 token
}

// ===== AUDIT ENUMS =====
enum AuditActor {
  ADMIN_USER   // User CMS (tabel users)
  PORTAL_USER  // User portal (tabel portal_users)
  SYSTEM       // Proses otomatis (scheduler, backup) — actorId null
}

enum AuditOutcome {
  SUCCESS
  FAILURE
}

enum AuditCategory {
  AUTH        // Login/logout/revoke (CMS + portal)
  CONTENT     // Announcement, category, comment, media
  USER_MGMT   // CRUD user admin + portal + access grant/revoke
  PORTAL      // CRUD portal app, app launch
  SECURITY    // Credential save/decrypt/delete, SSO launch, lockout, brute-force
  SYSTEM      // Backup, restore, scheduler, system update
  CONFIG      // Settings, email settings
}
```

> `LogSeverity` (INFO/WARNING/ERROR) sudah ada di schema — di-reuse untuk `AuditLog.severity`.

## 2. Model Portal

### 2.1 PortalUser

```prisma
model PortalUser {
  id               String     @id @default(cuid())
  email            String     @unique
  passwordHash     String
  name             String
  avatar           String?
  role             PortalRole @default(PORTAL_USER)
  isActive         Boolean    @default(true)

  // Lockout (anti brute-force)
  failedLoginCount Int        @default(0)
  lockedUntil      DateTime?

  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  appAccess     PortalUserAppAccess[]
  credentials   PortalUserAppCredential[]
  sessions      PortalSession[]
  auditLogs     AuditLog[]

  @@index([isActive])
  @@index([role])
  @@map("portal_users")
}
```

Field kunci:
- `email` unik global portal (terpisah dari `User.email` CMS — boleh sama email).
- `failedLoginCount` + `lockedUntil`: reset saat login sukses (lihat `02-authentication`).
- `isActive=false`: login ditolak, tidak muncul di grid manajemen aktif.

### 2.2 PortalApp

```prisma
model PortalApp {
  id            String        @id @default(cuid())
  name          String
  slug          String        @unique
  description   String?
  logoPath      String?
  url           String        // URL aplikasi (link langsung / fallback)
  loginUrl      String        // Endpoint form login aplikasi (target POST SSO)
  ssoMode       PortalSsoMode @default(FORM)
  httpMethod    String        @default("POST") // "POST" | "GET"
  usernameField String        @default("username")
  passwordField String        @default("password")
  extraFields   Json?         // field tambahan form (CSRF token, hidden field)
  category      String?       // grup di grid portal
  isActive      Boolean       @default(true)
  displayOrder  Int           @default(0)

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  userAccess    PortalUserAppAccess[]
  credentials   PortalUserAppCredential[]
  auditLogs     AuditLog[]

  @@index([isActive])
  @@index([category])
  @@index([displayOrder])
  @@map("portal_apps")
}
```

Field kunci:
- `extraFields`: JSON array, mis.
  `[{"name":"csrf_token","type":"static","value":"abc"}, {"name":"company","type":"fixed","value":"SJA"}]`
  Mendukung `{"type":"fetch","selector":"input[name=csrf]"}` (future — fetch token dari halaman login app).
- `httpMethod`: sebagian besar app pakai POST; GET untuk app yang terima credential via query string.

### 2.3 PortalUserAppAccess (RBAC)

```prisma
model PortalUserAppAccess {
  id            String         @id @default(cuid())
  portalUserId  String
  appId         String
  role          PortalAppRole  @default(USER)

  portalUser    PortalUser     @relation(fields: [portalUserId], references: [id], onDelete: Cascade)
  app           PortalApp      @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@unique([portalUserId, appId])
  @@index([portalUserId])
  @@index([appId])
  @@map("portal_user_app_access")
}
```

Baris di tabel ini = app muncul di grid portal user. Tidak ada baris = tidak ada akses.
`role=ADMIN` disiapkan untuk future (kelola app tertentu).

### 2.4 PortalUserAppCredential (kredensial terenkripsi)

```prisma
model PortalUserAppCredential {
  id              String   @id @default(cuid())
  portalUserId    String
  appId           String
  credentialBlob  String   // AES-256-GCM: base64(iv + tag + ciphertext)
  lastUsedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  portalUser      PortalUser @relation(fields: [portalUserId], references: [id], onDelete: Cascade)
  app             PortalApp  @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@unique([portalUserId, appId])
  @@index([portalUserId])
  @@index([appId])
  @@map("portal_user_app_credentials")
}
```

- Satu baris per (user, app). Ada baris = user sudah simpan kredensial (health ✓).
- `credentialBlob` = JSON terenkripsi: `{"username":"...","password":"...","extra":{...}}`.
- Hanya user pemilik yang bisa CRUD kredensialnya sendiri (via `/portal/credentials`).
- Admin tidak melihat plaintext kredensial (lihat `04-sso`).

### 2.5 PortalSession

```prisma
model PortalSession {
  id            String   @id @default(cuid())
  portalUserId  String
  portalUser    PortalUser @relation(fields: [portalUserId], references: [id], onDelete: Cascade)

  sessionToken  String   @unique
  ipAddress     String?
  userAgent     String?
  deviceInfo    String?

  createdAt     DateTime @default(now())
  lastActiveAt  DateTime @default(now())
  expiresAt     DateTime
  isRevoked     Boolean  @default(false)

  @@index([portalUserId])
  @@index([sessionToken])
  @@map("portal_sessions")
}
```

Mirror `UserSession` CMS. Revocation DB-backed (pola `lib/auth.ts`).

## 3. Model Audit

### 3.1 AuditLog (sumber kebenaran tunggal)

```prisma
model AuditLog {
  id           String        @id @default(cuid())

  // Siapa (admin + portal + sistem)
  actorType    AuditActor
  actorId      String?       // null untuk SYSTEM
  actorEmail   String?       // denormalisasi — tetap ada walau user dihapus
  actorName    String?

  // Apa
  category     AuditCategory
  action       String        // LOGIN_SUCCESS, CREATE, UPDATE, DELETE, SSO_LAUNCH, ...
  entityType   String        // ANNOUNCEMENT, PORTAL_APP, PORTAL_CREDENTIAL, ...
  entityId     String?

  // Hasil
  outcome      AuditOutcome  @default(SUCCESS)
  errorMessage String?

  // Detail (field sensitif auto di-redaksi oleh lib/audit.ts)
  changes      String?
  metadata     Json?

  // Konteks
  ipAddress    String?
  userAgent    String?
  severity     LogSeverity   @default(INFO)   // reuse enum yang sudah ada
  siteId       String?       // konteks site CMS (nullable, no FK)
  appId        String?       // konteks portal app (nullable, no FK)
  createdAt    DateTime      @default(now())

  // Relasi opsional (actor bisa portal user)
  portalUser   PortalUser?   @relation(fields: [portalUserId], references: [id], onDelete: SetNull)
  portalUserId String?

  @@index([actorType, actorId])
  @@index([category, createdAt])
  @@index([outcome])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([severity])
  @@map("audit_logs")
}
```

**Keputusan desain AuditLog:**
- **Tidak ada FK ke `User` (CMS)** — log tetap ada walau admin dihapus. `actorId` +
  `actorEmail`/`actorName` denormalisasi.
- **FK opsional ke `PortalUser`** dengan `onDelete: SetNull` — portal user bisa dihapus
  tanpa menghapus log.
- `siteId`/`appId` tanpa FK — pure metadata, agar log tidak hilang saat site/app dihapus.
- `changes` tetap `String?` (JSON stringify) untuk konsistensi dengan `ActivityLog` lama;
  `metadata` `Json?` untuk data terstruktur tambahan.

## 4. Relasi ER (ringkas)

```
User (CMS) ──< ActivityLog (lama, dipertahankan)
User (CMS) ──< UserSiteAccess >── Site

PortalUser ──< PortalUserAppAccess >── PortalApp
PortalUser ──< PortalUserAppCredential >── PortalApp
PortalUser ──< PortalSession
PortalUser ──< AuditLog (opsional, SetNull)

AuditLog (actorType=ADMIN_USER  → actorId=User.id, denormalisasi email/name)
AuditLog (actorType=PORTAL_USER → portalUserId FK opsional + actorId denormalisasi)
AuditLog (actorType=SYSTEM      → actorId=null)
```

## 5. Catatan migrasi (aman, non-destructive)

1. **Tambah enum + model** di `schema.prisma` (tidak ubah model lama).
2. `npm run prisma:generate`
3. `npx prisma migrate dev --name add_portal_and_audit` — migration SQL baru yang hanya
   menambah tabel & enum (CREATE TABLE, CREATE TYPE). Tidak ada DROP.
4. **Tidak DROP** `activity_logs` — tabel lama dipertahankan untuk kompatibilitas.
5. **Backfill** data `ActivityLog` → `AuditLog` via `scripts/backfill-audit-log.ts`
   (lihat `09-implementation-phases.md`). One-time, idempoten.
6. Bump `version.json`: `schemaVersion` 8 → 9, `version` 2.7.0 → 3.0.0.
7. Deploy production (Docker): `docker-compose exec -T web npx prisma migrate deploy`.

## 6. Indeks & performa

| Tabel | Indeks penting | Tujuan |
|-------|----------------|--------|
| `audit_logs` | `[category, createdAt]` | Filter halaman audit trail per kategori + waktu |
| `audit_logs` | `[actorType, actorId]` | "Semua aksi user X" |
| `audit_logs` | `[entityType, entityId]` | "Riwayat entitas Y" |
| `audit_logs` | `[outcome]` | Filter sukses/gagal cepat |
| `portal_user_app_access` | `[portalUserId]`, `[appId]` | Cek RBAC O(1) via unique `[portalUserId, appId]` |
| `portal_user_app_credentials` | `[portalUserId]`, `[appId]` | Lookup kredensial saat SSO launch |
| `portal_sessions` | `[sessionToken]` unique | Validasi sesi per refresh token |

> Pertimbangkan retensi: dengan `AUDIT_RETENTION_DAYS` (default 365), job scheduler
> menghapus `audit_logs` lebih tua dari threshold. Tanpa retensi = simpan selamanya
> (untuk compliance). Lihat `05-audit-trail.md`.
