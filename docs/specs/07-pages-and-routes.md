# 07 — Pages & Routes

> Daftar lengkap halaman baru, layout guard, perubahan navigasi/sidebar, dan middleware.

## 1. Halaman Portal (user-facing)

### `/portal-login` — Login portal
- **Type:** Client component (`"use client"`)
- **Fungsi:** Form login (email + password). `signIn("credentials", {...})` via
  `next-auth/react` tapi memakai endpoint portal (`/api/portal-auth/...`).
- **UI:** Dark inline-style, mirip `/admin-login` tapi branding "Portal SSO".
- **Lockout UX:** Tampilkan pesan "Akun terkunci. Coba lagi dalam X menit."
- **Redirect sukses:** `router.push("/portal")`
- **Link:** "Lupa password?" → `/portal/forgot-password`

### `app/portal/layout.tsx` — Guard sesi portal
- **Type:** Server component
- **Fungsi:** `getServerSession(portalAuthOptions)` → redirect `/portal-login` jika belum login.
- **Render:** Header portal (logo, nama user, tombol logout) + `<main>{children}</main>`.
- **Logout:** `signOut({ callbackUrl: "/portal-login" })` dari `PortalHeader` (client).

### `/portal` — Grid aplikasi
- **Type:** Server component (`export const dynamic = "force-dynamic"`)
- **Fungsi:** Tampilkan grid app yang bisa diakses user (`getAccessiblePortalApps`).
- **Per app card:** logo, name, description, category, health indicator
  (✓ kredensial tersimpan / ⚠ belum), tombol "Buka Aplikasi" → `/portal/app/[slug]`
  atau "Simpan Kredensial" → `/portal/credentials?app=[slug]`.
- **Filter/search:** kategori dropdown + search box (client-side atau server query).
- **Kosong:** "Anda belum punya akses ke aplikasi apapun. Hubungi administrator."

### `/portal/credentials` — Kelola kredensial sendiri
- **Type:** Client component
- **Fungsi:** Daftar app yang diakses + form input/save/delete kredensial per app.
- **Per app:** input username + password (type=password) + extra fields (jika ada).
- **API:** `GET /api/portal/credentials` (status), `POST` (save), `DELETE` (hapus).
- **Security:** password field tidak pernah di-prefill (tidak retrieve plaintext).
  Hanya tampilkan "Kredensial tersimpan (update?)" atau "Belum ada (simpan)".
- **Audit:** setiap save/delete → `CREDENTIAL_SAVED` / `CREDENTIAL_DELETED`.

### `/portal/app/[appSlug]` — SSO Launch
- **Type:** Server component (lihat `04-sso` §3 untuk detail penuh)
- **Fungsi:** Cek login + RBAC + credential → render auto-submit form ke app.loginUrl.
- **Failure states:** AccessDenied, NoCredential, CorruptCredential components.

### `/portal/forgot-password` — Lupa password
- **Type:** Client component
- **Fungsi:** Form email → POST → kirim reset link via email.
- **Redirect:** "Cek email Anda untuk reset password."

### `/portal/reset-password` — Reset password via token
- **Type:** Client component
- **Query:** `?token=...`
- **Fungsi:** Validasi token → form password baru → POST → redirect `/portal-login`.

### `/portal/settings` — Pengaturan akun (opsional)
- **Type:** Client component
- **Fungsi:** Ubah password sendiri, lihat sesi sendiri, revoke sesi sendiri.
- **API:** ubah password → internal; sesi → `/api/portal-sessions`.

## 2. Halaman Admin (manajemen portal, di panel `/admin`)

### `/admin/portal-apps` — Manajemen aplikasi portal
- **Type:** Client component (di dalam `app/admin/layout.tsx` yang sudah guard SuperAdmin)
- **Fungsi:** CRUD `PortalApp`. Tabel daftar + modal form (name, slug, url, loginUrl,
  ssoMode, httpMethod, usernameField, passwordField, extraFields, category, isActive).
- **API:** `/api/portal-apps` + `/api/portal-apps/[id]`.
- **Hanya SuperAdmin** (cek di API + layout).

### `/admin/portal-users` — Manajemen user portal
- **Type:** Client component
- **Fungsi:** CRUD `PortalUser` + assign/revoke app access + reset password + activate/deactivate.
- **UI:** Tabel user + modal form (email, name, role, isActive, checkbox app access).
  Per user: expand → daftar app access + tombol revoke + tombol reset password.
- **API:** `/api/portal-users` + `/[id]` + `/[id]/access` + `/[id]/reset-password` + `/[id]/status`.

### `/admin/portal-sessions` — Manajemen sesi portal
- **Type:** Client component (mirror `/admin/sessions`)
- **Fungsi:** Daftar `PortalSession` + revoke. Tampilkan: user, IP, perangkat, status, lastActive.
- **API:** `/api/portal-sessions`.

### `/admin/audit-trail` — Audit trail terpadu
- **Type:** Client component (mirror `/admin/audit-logs` dengan filter lebih kaya)
- **Fungsi:** Daftar `AuditLog` + filter (actorType, category, outcome, severity,
  entityType, date range, search) + export CSV/JSON + detail expand.
- **API:** `/api/audit-trail` + `?export=csv|json`.

## 3. Perubahan AdminSidebar

File: `components/admin/AdminSidebar.tsx` — tambah menu portal (pola `isSuperAdmin ? [...] : []`):

```ts
const navItems = [
    { href: "/admin", icon: FiHome, label: "DASHBOARD" },
    ...(isSuperAdmin ? [
        { href: "/admin/sites", icon: FiGlobe, label: "SITES" },
        { href: "/admin/users", icon: FiUsers, label: "PENGGUNA" },
        // ===== BARU: PORTAL =====
        { href: "/admin/portal-apps", icon: FiGrid, label: "PORTAL APPS" },
        { href: "/admin/portal-users", icon: FiUserPlus, label: "PORTAL USERS" },
        { href: "/admin/portal-sessions", icon: FiMonitor, label: "PORTAL SESI" },
        // =====
        { href: "/admin/global-analytics", icon: FiPieChart, label: "GLOBAL ANALYTICS" },
        { href: "/admin/audit-trail", icon: FiActivity, label: "AUDIT TRAIL" }, // ganti AUDIT LOG
    ] : []),
    { href: "/admin/announcements", icon: FiFileText, label: "PENGUMUMAN" },
    // ... (sisanya tetap)
];
```

> Import tambahan dari `react-icons/fi`: `FiGrid`, `FiUserPlus`.
> Menu "AUDIT LOG" lama → "AUDIT TRAIL" (redirect `/admin/audit-logs` → `/admin/audit-trail`).

## 4. Perubahan middleware

File: `middleware.ts` — tambah `/portal` & `/portal-login` ke matcher + rate-limit portal auth.

```ts
export const config = {
    matcher: [
        '/',
        '/api/:path*',
        '/admin/:path*',
        '/site/:path*',
        '/portal/:path*',        // BARU
        '/portal-login',         // BARU
        '/api/portal-auth/:path*', // BARU (rate-limit lebih ketat)
    ],
};
```

Rate limit tambahan di blok `path.startsWith('/api/')`:
```ts
if (path.includes('/portal-auth') || path.includes('/portal-login')) {
    maxRequests = 10; // Auth portal: 10 req/min (sama dengan /auth)
}
```

## 5. Navigasi & root redirect

### Strategi root `/`
Saat ini `/` → redirect ke `/site` (site picker publik). Dengan portal:

**Opsi A (rekomendasi):** `/` tetap → `/site` (publik). Portal diakses via `/portal`
atau link terpisah. Alasan: site pengumuman tetap publik, portal butuh login eksplisit.

**Opsi B:** `/` → halaman landing yang punya link ke:
- "Lihat Pengumuman" → `/site`
- "Portal SSO" → `/portal-login` (atau `/portal` jika sudah login)
- "Admin Dashboard" → `/admin-login` (atau `/admin` jika sudah login)

> Implementasi: tambah halaman `app/page.tsx` (landing) atau tetap redirect `/` → `/site`.
> **Rekomendasi MVP:** Opsi A (minimal perubahan). Landing page bisa ditambah fase berikutnya.

### Link antar-area
- `/portal` header: tidak ada link ke `/admin` (portal user tidak akses admin).
- `/admin` sidebar: ada link "Buka Portal" → `/portal` (SuperAdmin bisa akses keduanya).
- `/site` footer: bisa tambah link "Portal Karyawan" → `/portal-login`.

## 6. Route map lengkap (setelah implementasi)

| Route | Auth | Tipe | Fungsi |
|-------|------|------|--------|
| `/` | Publik | Redirect | → `/site` (atau landing) |
| `/site` | Publik | Server | Site picker |
| `/site/[slug]/...` | Publik | Server | Konten site |
| `/admin-login` | Publik | Client | Login CMS |
| `/admin/...` | CMS session | Mixed | Panel admin (tetap + portal mgmt) |
| `/portal-login` | Publik | Client | Login portal |
| `/portal` | Portal session | Server | Grid app |
| `/portal/app/[slug]` | Portal session | Server | SSO launch |
| `/portal/credentials` | Portal session | Client | Kelola kredensial |
| `/portal/forgot-password` | Publik | Client | Lupa password |
| `/portal/reset-password` | Publik (token) | Client | Reset password |
| `/portal/settings` | Portal session | Client | Pengaturan akun |
| `/api/portal-auth/...` | Publik | NextAuth | Handler auth portal |
| `/api/portal-apps/...` | SuperAdmin | REST | CRUD app |
| `/api/portal-users/...` | SuperAdmin | REST | CRUD user portal |
| `/api/portal-sessions` | SuperAdmin/owner | REST | Sesi portal |
| `/api/portal/credentials` | Portal session | REST | Kredensial self-service |
| `/api/portal/launch/[slug]` | Portal session | REST | (opsional) AJAX launch |
| `/api/audit-trail` | SuperAdmin | REST | Audit + export |
| `/api/...` (eksisting) | Sesuai | REST | Route CMS (tetap) |
