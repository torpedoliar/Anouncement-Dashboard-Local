# Fase 3 — Admin Portal Management

> Specs referensi: `03-rbac.md`, `06-api-reference.md` §1-§3, `07-pages-and-routes.md` §2
> Milestone: M3 · Prasyarat: **Fase 1** (schema + portal-access). Bisa paralel dengan Fase 2.

## Objective

Membangun panel admin untuk mengelola aplikasi portal, user portal, dan sesi portal.
Setelah fase ini, SuperAdmin bisa CRUD `PortalApp`, CRUD `PortalUser`, assign/revoke
akses app, reset password, activate/deactivate, dan lihat/revoke sesi portal.

## Prerequisites

- [ ] Fase 1 selesai (schema + `lib/portal-access.ts` + `lib/audit.ts`)
- [ ] `PortalUser`/`PortalApp` model tersedia di Prisma client

## Task list

### 3.1 API Portal Apps (SuperAdmin)

- [ ] Buat `app/api/portal-apps/route.ts`:
  - [ ] `GET` — list + paginasi (`validatePagination`) + filter `category`, `isActive`, `search`
  - [ ] `POST` — create via `PortalAppCreateSchema` + `validateInput` + `formatZodErrors`;
    cek slug unik; `logAudit({ action:"PORTAL_APP_CREATED", category:"PORTAL" })`
- [ ] Buat `app/api/portal-apps/[id]/route.ts`:
  - [ ] `GET` — detail by id
  - [ ] `PUT` — update via `PortalAppUpdateSchema`; `logAudit` `PORTAL_APP_UPDATED`
  - [ ] `DELETE` — hapus (cascade access + credential via onDelete); `logAudit` `PORTAL_APP_DELETED`
- [ ] Semua route: `getServerSession(authOptions)` + `isSuperAdmin` check → 403 jika bukan

### 3.2 API Portal Users (SuperAdmin)

- [ ] Buat `app/api/portal-users/route.ts`:
  - [ ] `GET` — list + paginasi + filter `search`, `isActive`, `role`; select tanpa `passwordHash`
  - [ ] `POST` — create via `PortalUserCreateSchema`; cek email unik; `bcrypt.hash`;
    transaction create `PortalUser` + `PortalUserAppAccess` (per `appIds`);
    `logAudit` `PORTAL_USER_CREATED` + `ACCESS_GRANTED` (per app)
- [ ] Buat `app/api/portal-users/[id]/route.ts`:
  - [ ] `GET` — detail + `appAccess` (include app name/slug)
  - [ ] `PUT` — update via `PortalUserUpdateSchema` (tanpa password); `logAudit` `PORTAL_USER_UPDATED`
  - [ ] `DELETE` — hapus (cascade); `logAudit` `PORTAL_USER_DELETED`
- [ ] Buat `app/api/portal-users/[id]/access/route.ts`:
  - [ ] `POST` — assign access `{ appId, role? }`; upsert `PortalUserAppAccess`;
    cek app exists+active; `logAudit` `ACCESS_GRANTED`
  - [ ] `DELETE` — revoke `?appId=`; `logAudit` `ACCESS_REVOKED`
- [ ] Buat `app/api/portal-users/[id]/reset-password/route.ts`:
  - [ ] `POST` `{ password }` (min 8); `bcrypt.hash`; `logAudit` `ADMIN_RESET_PORTAL_PASSWORD`
- [ ] Buat `app/api/portal-users/[id]/status/route.ts`:
  - [ ] `PATCH` `{ isActive }`; `logAudit` `PORTAL_USER_ACTIVATED`/`_DEACTIVATED`

### 3.3 API Portal Sessions

- [ ] Buat `app/api/portal-sessions/route.ts`:
  - [ ] `GET` — list + paginasi; SuperAdmin (semua) atau PORTAL_USER (milik sendiri via
    `portalAuthOptions`); include `portalUser` (name/email)
  - [ ] `DELETE` `?id=` — revoke; cek ownership (SuperAdmin atau owner); `logAudit` `PORTAL_SESSION_REVOKED`

### 3.4 Halaman admin: Portal Apps

- [ ] Buat `app/admin/portal-apps/page.tsx` (client component):
  - [ ] Tabel daftar app: name, slug, category, ssoMode, isActive, displayOrder
  - [ ] Modal form (create/edit): name, slug, description, url, loginUrl, ssoMode
    (dropdown), httpMethod, usernameField, passwordField, extraFields (JSON textarea),
    category, isActive, displayOrder
  - [ ] Tombol: Tambah App, Edit, Hapus (confirm)
  - [ ] Validasi slug format di client (regex `[a-z0-9-]+`)
  - [ ] Inline-style dark UI (mirror `app/admin/sites/page.tsx`)

### 3.5 Halaman admin: Portal Users

- [ ] Buat `app/admin/portal-users/page.tsx` (client component):
  - [ ] Tabel daftar user: name, email, role, isActive, createdAt
  - [ ] Modal form (create/edit): email, name, role (dropdown), isActive,
    checkbox list app access (assign saat create)
  - [ ] Per user: expand → daftar `appAccess` (appName + role) + tombol Revoke
  - [ ] Tombol: Tambah User, Edit, Hapus (confirm), Reset Password (modal password baru),
    Activate/Deactivate
  - [ ] Search + filter role/isActive
  - [ ] Inline-style dark UI (mirror `app/admin/users/page.tsx`)

### 3.6 Halaman admin: Portal Sessions

- [ ] Buat `app/admin/portal-sessions/page.tsx` (client component):
  - [ ] Tabel: portalUser (name+email), IP, perangkat (parse User-Agent → icon),
    status (active/revoked/expired), lastActive, createdAt
  - [ ] Tombol Revoke per sesi (confirm)
  - [ ] Filter by portalUserId (dropdown user)
  - [ ] Inline-style dark UI (mirror `app/admin/sessions/page.tsx`)

### 3.7 Update sidebar

- [ ] Edit `components/admin/AdminSidebar.tsx` (sekalian dengan fase 2 atau di sini):
  - [ ] Tambah di blok `isSuperAdmin ? [...]`:
    - `{ href: "/admin/portal-apps", icon: FiGrid, label: "PORTAL APPS" }`
    - `{ href: "/admin/portal-users", icon: FiUserPlus, label: "PORTAL USERS" }`
    - `{ href: "/admin/portal-sessions", icon: FiMonitor, label: "PORTAL SESI" }`
  - [ ] Import `FiGrid`, `FiUserPlus` dari `react-icons/fi`

## Definition of Done (DoD)

- [ ] Semua API portal-apps/portal-users/portal-sessions ter-build & SuperAdmin-only
- [ ] CRUD app berfungsi: create → edit → delete (verifikasi di DB)
- [ ] CRUD user berfungsi: create (dengan appIds) → edit → delete
- [ ] Assign/revoke access berfungsi (verifikasi `PortalUserAppAccess`)
- [ ] Reset password berfungsi (verifikasi hash berubah di DB)
- [ ] Activate/deactivate berfungsi
- [ ] Sesi portal: list + revoke berfungsi
- [ ] Semua aksi tercatat di `AuditLog` (verifikasi `/admin/audit-trail` — butuh Fase 2
  atau cek langsung DB jika Fase 2 belum selesai)
- [ ] Sidebar menampilkan 3 menu baru (SuperAdmin only)
- [ ] `npm run build && npm run lint` sukses

## Validation steps
```bash
npm run build && npm run lint
# Manual (login sebagai SuperAdmin):
# 1. /admin/portal-apps → buat app "Test ERP" (url + loginUrl dummy)
# 2. /admin/portal-users → buat user test@test.com + assign access ke Test ERP
# 3. Edit user → revoke access → re-assign
# 4. Reset password user → login portal dengan password baru (butuh Fase 4 untuk UI login,
#    atau test via API langsung)
# 5. /admin/portal-sessions → (kosong sampai ada login portal) → akan terisi di Fase 4
# 6. Cek AuditLog di DB: PORTAL_APP_CREATED, PORTAL_USER_CREATED, ACCESS_GRANTED tercatat
```

## Rollback notes
- API & halaman baru tidak mengganggu fungsi lama. Revert = hapus file baru + hapus menu sidebar.
- Data `PortalApp`/`PortalUser` yang sudah dibuat tetap di DB (aman — tidak mengganggu).
