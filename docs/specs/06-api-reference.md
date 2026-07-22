# 06 — API Reference

> Semua route baru. Konvensi: `getServerSession(authOptions)` untuk admin CMS,
> `getServerSession(portalAuthOptions)` untuk portal. Validasi via Zod + `validateInput`.
> Paginasi via `validatePagination`. Mutasi → `logAudit()`.

## 1. Portal Apps (SuperAdmin CMS)

### `GET /api/portal-apps`
- **Auth:** `getServerSession(authOptions)` + `isSuperAdmin`
- **Query:** `page`, `limit`, `category`, `isActive`, `search`
- **Response 200:** `{ data: PortalApp[], pagination: {...} }`

### `POST /api/portal-apps`
- **Auth:** SuperAdmin
- **Body:** `PortalAppCreateSchema` (Zod)
- **Response 201:** `{ ...app }`
- **Audit:** `PORTAL_APP_CREATED` (category=PORTAL)

### `GET /api/portal-apps/[id]`
- **Auth:** SuperAdmin
- **Response 200:** `{ ...app }`

### `PUT /api/portal-apps/[id]`
- **Auth:** SuperAdmin
- **Body:** `PortalAppUpdateSchema`
- **Response 200:** `{ ...app }`
- **Audit:** `PORTAL_APP_UPDATED`

### `DELETE /api/portal-apps/[id]`
- **Auth:** SuperAdmin
- **Response 200:** `{ message: "App dihapus" }`
- **Audit:** `PORTAL_APP_DELETED`

## 2. Portal Users (SuperAdmin CMS)

### `GET /api/portal-users`
- **Auth:** SuperAdmin
- **Query:** `page`, `limit`, `search`, `isActive`, `role`
- **Response 200:** `{ data: PortalUser[], pagination: {...} }`
- **Field select:** id, email, name, role, isActive, createdAt, `appAccess: [{appId}]`
  (tidak mengembalikan `passwordHash`, `failedLoginCount`, `lockedUntil` kecuali SuperAdmin)

### `POST /api/portal-users`
- **Auth:** SuperAdmin
- **Body:** `PortalUserCreateSchema` (`{ email, password, name, role, isActive, appIds }`)
- **Logic:**
  1. Cek email unik di `portal_users`.
  2. `bcrypt.hash(password, 10)`.
  3. Transaction: create `PortalUser` + create `PortalUserAppAccess` untuk tiap `appIds`.
  4. Audit: `PORTAL_USER_CREATED` + `ACCESS_GRANTED` (per app).
- **Response 201:** `{ id, email, name, role, isActive, appIds }`

### `GET /api/portal-users/[id]`
- **Auth:** SuperAdmin
- **Response 200:** `{ ...user, appAccess: [{ appId, appName, appSlug }] }`

### `PUT /api/portal-users/[id]`
- **Auth:** SuperAdmin
- **Body:** `PortalUserUpdateSchema` (tanpa password)
- **Response 200:** `{ ...user }`
- **Audit:** `PORTAL_USER_UPDATED`

### `DELETE /api/portal-users/[id]`
- **Auth:** SuperAdmin
- **Cascade:** hapus `PortalUserAppAccess`, `PortalUserAppCredential`, `PortalSession`
  (onDelete: Cascade di schema). `AuditLog` tetap (FK SetNull).
- **Response 200:** `{ message: "User dihapus" }`
- **Audit:** `PORTAL_USER_DELETED`

### `POST /api/portal-users/[id]/access` — assign app access
- **Auth:** SuperAdmin
- **Body:** `{ appId: string, role?: "USER" | "ADMIN" }`
- **Logic:** upsert `PortalUserAppAccess`. Cek app exists + active.
- **Response 201:** `{ message: "Akses diberikan" }`
- **Audit:** `ACCESS_GRANTED`

### `DELETE /api/portal-users/[id]/access?appId=[cuid]` — revoke app access
- **Auth:** SuperAdmin
- **Response 200:** `{ message: "Akses dicabut" }`
- **Audit:** `ACCESS_REVOKED`

### `POST /api/portal-users/[id]/reset-password` — admin reset
- **Auth:** SuperAdmin
- **Body:** `{ password: string }` (min 8)
- **Response 200:** `{ message: "Password direset" }`
- **Audit:** `ADMIN_RESET_PORTAL_PASSWORD` (category=AUTH)

### `PATCH /api/portal-users/[id]/status` — activate/deactivate
- **Auth:** SuperAdmin
- **Body:** `{ isActive: boolean }`
- **Audit:** `PORTAL_USER_ACTIVATED` / `PORTAL_USER_DEACTIVATED`


## 3. Portal Sessions (SuperAdmin + Portal User)

### `GET /api/portal-sessions`
- **Auth:** SuperAdmin (semua) atau PORTAL_USER (milik sendiri via `portalAuthOptions`)
- **Query:** `page`, `limit`, `portalUserId`
- **Response 200:** `{ data: PortalSession[], pagination: {...} }`

### `DELETE /api/portal-sessions?id=[cuid]`
- **Auth:** SuperAdmin atau owner
- **Response 200:** `{ message: "Sesi dicabut" }`
- **Audit:** `PORTAL_SESSION_REVOKED`

## 4. Portal Credentials (Portal User self-service)

### `GET /api/portal/credentials`
- **Auth:** `getServerSession(portalAuthOptions)` (portal user)
- **Response 200:** `[{ appId, appName, appSlug, hasCredential, lastUsedAt }]`
- **Tidak mengembalikan plaintext** — hanya status.

### `POST /api/portal/credentials` — simpan/update
- **Auth:** portal session + `canAccessPortalApp(userId, appId)`
- **Body:** `PortalCredentialSchema` (`{ appId, username, password, extra? }`)
- **Logic:** `encryptCredential({username, password, extra})` → upsert
- **Response 201:** `{ message: "Kredensial tersimpan" }`
- **Audit:** `CREDENTIAL_SAVED` / `CREDENTIAL_UPDATED` (category=SECURITY)

### `DELETE /api/portal/credentials?appId=[cuid]` — hapus
- **Auth:** portal session + owner check
- **Response 200:** `{ message: "Kredensial dihapus" }`
- **Audit:** `CREDENTIAL_DELETED`

## 5. Portal Launch (SSO)

### `GET /portal/app/[appSlug]` (halaman server, bukan API)
- Server component yang render auto-submit form. Lihat `04-sso` §3.
- Guard: portal session + RBAC + credential + decrypt + audit.

### `POST /api/portal/launch/[appSlug]` (opsional — AJAX launch)
- **Auth:** portal session + RBAC
- **Response 200:** `{ loginUrl, method, fields: {...} }` (decrypted, client-side submit)
- **Audit:** `SSO_LAUNCH`
- **Rekomendasi:** server-rendered form (tidak expose credential ke JS).

## 6. Audit Trail (SuperAdmin)

### `GET /api/audit-trail`
- **Auth:** `getServerSession(authOptions)` + `isSuperAdmin`
- **Query:** `page`, `limit`, `actorType`, `category`, `outcome`, `severity`,
  `entityType`, `from`, `to`, `search`
- **Response 200:** `{ data: AuditLog[], pagination: {...} }`

### `GET /api/audit-trail?export=csv`
- **Auth:** SuperAdmin
- **Response 200:** `Content-Type: text/csv` — download
- **Kolom:** timestamp, actorType, actorEmail, actorName, category, action,
  entityType, entityId, outcome, errorMessage, ipAddress, severity, changes

### `GET /api/audit-trail?export=json`
- **Auth:** SuperAdmin
- **Response 200:** array lengkap (dengan filter, tanpa paginasi)

### `GET /api/audit-trail/[id]`
- **Auth:** SuperAdmin → `{ ...log }` (detail lengkap)

## 7. Status code konvensi

| Code | Kapan |
|------|-------|
| 200 | GET/PUT/DELETE sukses |
| 201 | POST create sukses |
| 400 | Validasi gagal (Zod via `formatZodErrors`) |
| 401 | Tidak login / sesi invalid |
| 403 | Login tapi tidak punya izin |
| 404 | Entitas tidak ditemukan |
| 409 | Konflik (email sudah ada) |
| 429 | Rate limit (middleware) |
| 500 | Server error |

## 8. Pattern response error
```json
{ "error": "Forbidden: SuperAdmin only" }
{ "error": "Email already registered" }
{ "errors": [{ "field": "email", "message": "..." }] }
```