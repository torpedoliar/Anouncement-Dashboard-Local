# 03 — RBAC (Role-Based Access Control)

> Tiga lapis kontrol akses: SuperAdmin CMS → PORTAL_ADMIN → PORTAL_USER.
> Pemisahan tegas: **Access** (admin atur app mana) vs **Credential** (user simpan kredensial sendiri).

## 1. Model role 3-layer

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: SuperAdmin CMS (User.isSuperAdmin=true)    │
│  • Akses penuh panel /admin                          │
│  • Kelola PortalApp (CRUD)                           │
│  • Kelola PortalUser (CRUD + reset password)         │
│  • Assign/revoke PortalUserAppAccess                 │
│  • Lihat & revoke PortalSession                      │
│  • Lihat Audit Trail                                 │
│  • Kelola CMS (announcement, category, dll — tetap)  │
├─────────────────────────────────────────────────────┤
│ Layer 2: PORTAL_ADMIN (PortalUser.role=PORTAL_ADMIN) │
│  • (FUTURE) Kelola PortalUser + assign access        │
│  • (FUTURE) Lihat audit portal                       │
│  • Saat ini: sama fungsinya dengan PORTAL_USER       │
│    (role disiapkan, belum diaktifkan)                │
├─────────────────────────────────────────────────────┤
│ Layer 3: PORTAL_USER (PortalUser.role=PORTAL_USER)   │
│  • Login portal                                      │
│  • Lihat grid app sesuai PortalUserAppAccess         │
│  • SSO launch ke app yang diizinkan                  │
│  • CRUD kredensial sendiri (PortalUserAppCredential) │
│  • Lihat & revoke sesi sendiri                       │
└─────────────────────────────────────────────────────┘
```

## 2. Matriks akses

### 2.1 Panel Admin CMS (`/admin/*`)

| Aksi | SuperAdmin | ADMIN | EDITOR | VIEWER | Publik |
|------|------------|-------|--------|--------|--------|
| Dashboard `/admin` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Kelola Pengumuman | ✓ (all) | ✓ (assigned) | ✓ (assigned) | read | ✗ |
| Kelola Kategori | ✓ | ✓ | ✓ | ✗ | ✗ |
| Kelola Media | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Portal Apps** `/admin/portal-apps` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Portal Users** `/admin/portal-users` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Portal Sessions** `/admin/portal-sessions` | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Audit Trail** `/admin/audit-trail` | ✓ | ✗ | ✗ | ✗ | ✗ |
| Sites & Users mgmt | ✓ | ✗ | ✗ | ✗ | ✗ |

> Portal management hanya SuperAdmin. `isSuperAdmin ? [...] : []` di AdminSidebar.

### 2.2 Portal (`/portal/*`)

| Aksi | PORTAL_ADMIN (future) | PORTAL_USER | Tidak login |
|------|-----------------------|-------------|-------------|
| Login `/portal-login` | ✓ | ✓ | ✓ (page publik) |
| Grid app `/portal` | ✓ (all apps?) | ✓ (assigned only) | redirect login |
| SSO launch `/portal/app/[slug]` | ✓ | ✓ (if access) | redirect login |
| Kelola kredensial `/portal/credentials` | ✓ | ✓ (own) | redirect login |
| Ubah password sendiri | ✓ | ✓ | redirect login |
| Lihat sesi sendiri | ✓ | ✓ | redirect login |
| Revoke sesi sendiri | ✓ | ✓ | redirect login |
| Kelola user portal | ✓ (future) | ✗ | ✗ |

### 2.3 Akses per-app (PortalUserAppAccess)

| Kondisi | Hasil |
|---------|-------|
| Baris ada `PortalUserAppAccess(userId, appId)` | App muncul di grid; SSO launch diizinkan |
| Baris tidak ada | App tidak muncul; SSO launch → 403 |
| `PortalApp.isActive=false` | App tidak muncul untuk siapapun (meski ada access) |
| `PortalUser.isActive=false` | Login ditolak; tidak bisa akses apapun |
| `PortalUser.role=PORTAL_ADMIN` (future) | Akses semua app aktif (bypass access check) |

## 3. Pemisahan Access vs Credential

Ini adalah prinsip kunci sesuai permintaan "kredensial disimpan user masing-masing":

| Aspek | Access (PortalUserAppAccess) | Credential (PortalUserAppCredential) |
|-------|------------------------------|--------------------------------------|
| Siapa atur | **Admin** (SuperAdmin CMS) | **User sendiri** (PORTAL_USER) |
| Apa isinya | App mana yang bisa diakses | Username+password untuk app tsb |
| Tabel | `portal_user_app_access` | `portal_user_app_credentials` |
| UI | `/admin/portal-users` (assign access) | `/portal/credentials` (user input) |
| Enkripsi | Tidak perlu (hanya relasi) | AES-256-GCM (sensitif) |
| Audit | `ACCESS_GRANTED`, `ACCESS_REVOKED` | `CREDENTIAL_SAVED`, `CREDENTIAL_DELETED` |

**Alur lengkap:**
1. Admin buat `PortalApp` (definisi app + loginUrl + field).
2. Admin buat `PortalUser` (akun).
3. Admin assign `PortalUserAppAccess` (app mana yang bisa diakses user).
4. User login portal → lihat grid app (yang sudah di-assign).
5. User buka `/portal/credentials` → input username+password untuk tiap app.
6. User klik app di grid → SSO launch dengan kredensial yang dia simpan.

> Admin **tidak pernah** melihat plaintext kredensial user. Admin hanya tahu app mana
> yang di-assigned. User bertanggung jawab atas kredensialnya sendiri.

## 4. Helper permission

File baru: `lib/portal-access.ts`

```ts
import prisma from "@/lib/prisma";

// Cek apakah portal user bisa akses app tertentu
export async function canAccessPortalApp(portalUserId: string, appId: string): Promise<boolean> {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: {
            isActive: true, role: true,
            appAccess: { where: { appId }, select: { id: true } },
        },
    });
    if (!user || !user.isActive) return false;
    if (user.role === "PORTAL_ADMIN") return true; // future: bypass
    return user.appAccess.length > 0;
}

// Cek akses by slug (untuk route /portal/app/[appSlug])
export async function canAccessPortalAppBySlug(portalUserId: string, appSlug: string): Promise<boolean> {
    const app = await prisma.portalApp.findUnique({
        where: { slug: appSlug },
        select: { id: true, isActive: true },
    });
    if (!app || !app.isActive) return false;
    return canAccessPortalApp(portalUserId, app.id);
}

// Daftar app yang bisa diakses user (untuk grid /portal)
export async function getAccessiblePortalApps(portalUserId: string) {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: {
            role: true,
            appAccess: { include: { app: { select: {
                id: true, name: true, slug: true, description: true,
                logoPath: true, url: true, category: true, displayOrder: true,
            }}}},
        },
    });
    if (!user) return [];
    if (user.role === "PORTAL_ADMIN") {
        return prisma.portalApp.findMany({
            where: { isActive: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        });
    }
    return user.appAccess.filter((a) => a.app).map((a) => a.app)
        .sort((a, b) => a.displayOrder - b.displayOrder);
}

// Cek apakah user sudah simpan kredensial (health indicator)
export async function hasCredential(portalUserId: string, appId: string): Promise<boolean> {
    const cred = await prisma.portalUserAppCredential.findUnique({
        where: { portalUserId_appId: { portalUserId, appId } },
        select: { id: true },
    });
    return !!cred;
}
```

## 5. Guard layout portal

File baru: `app/portal/layout.tsx` (server component)

```ts
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { redirect } from "next/navigation";

export default async function PortalLayout({ children }) {
    const session = await getServerSession(portalAuthOptions);
    if (!session?.user?.id) {
        redirect("/portal-login");
    }
    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#fff" }}>
            <PortalHeader userName={session.user?.name} />
            <main>{children}</main>
        </div>
    );
}
```

> `getServerSession(portalAuthOptions)` — instance portal, bukan `authOptions` CMS.
> Cookie prefix berbeda → sesi tidak bercampur.

## 6. Zod validation schemas

Tambah di `lib/validation-schemas.ts` (mengikuti pola yang sudah ada):

```ts
// ===== PORTAL USER SCHEMAS =====
export const PortalUserCreateSchema = z.object({
    email: z.string().email("Invalid email format").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    name: z.string().min(2).max(100).transform(sanitizeText),
    role: z.enum(["PORTAL_ADMIN", "PORTAL_USER"]).default("PORTAL_USER"),
    isActive: z.boolean().default(true),
    appIds: z.array(z.string().cuid()).optional(),
});
export const PortalUserUpdateSchema = PortalUserCreateSchema.partial().omit({ password: true });

// ===== PORTAL APP SCHEMAS =====
export const PortalAppCreateSchema = z.object({
    name: z.string().min(2).max(100).transform(sanitizeText),
    slug: z.string().regex(slugPattern, "Invalid slug format"),
    description: z.string().max(500).transform(sanitizeText).nullable().optional(),
    url: z.string().url("Invalid URL"),
    loginUrl: z.string().url("Invalid login URL"),
    ssoMode: z.enum(["FORM", "REDIRECT", "PROXY", "TOKEN"]).default("FORM"),
    httpMethod: z.enum(["POST", "GET"]).default("POST"),
    usernameField: z.string().min(1).max(100).default("username"),
    passwordField: z.string().min(1).max(100).default("password"),
    extraFields: z.any().nullable().optional(),
    category: z.string().max(100).nullable().optional(),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
});
export const PortalAppUpdateSchema = PortalAppCreateSchema.partial();

// ===== PORTAL CREDENTIAL SCHEMA =====
export const PortalCredentialSchema = z.object({
    appId: z.string().cuid("Invalid app ID"),
    username: z.string().min(1).max(255),
    password: z.string().min(1).max(500),
    extra: z.record(z.string(), z.string()).optional(),
});
```

## 7. RBAC audit events

Setiap perubahan RBAC dicatat di `AuditLog` (lihat `05-audit-trail.md`):

| Event | category | actorType | outcome |
|-------|----------|-----------|---------|
| `ACCESS_GRANTED` | USER_MGMT | ADMIN_USER | SUCCESS |
| `ACCESS_REVOKED` | USER_MGMT | ADMIN_USER | SUCCESS |
| `PORTAL_USER_CREATED` | USER_MGMT | ADMIN_USER | SUCCESS |
| `PORTAL_USER_UPDATED` | USER_MGMT | ADMIN_USER | SUCCESS |
| `PORTAL_USER_DELETED` | USER_MGMT | ADMIN_USER | SUCCESS |
| `PORTAL_USER_ACTIVATED` / `_DEACTIVATED` | USER_MGMT | ADMIN_USER | SUCCESS |
| `PORTAL_APP_CREATED` / `_UPDATED` / `_DELETED` | PORTAL | ADMIN_USER | SUCCESS |
