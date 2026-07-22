# 00 — Overview Portal Web SSO + Audit Trail

> Status: SPEC (belum diimplementasi) · Versi: 3.0.0-draft · schemaVersion: 9
> Tanggal: 2026-07-22 · Santos Jaya Abadi (SJA) — Dashboard Pengumuman

## 1. Tujuan

Aplikasi saat ini adalah **multi-tenant announcement CMS** (dashboard admin + site publik).
Spesifikasi ini menambahkan tiga kapabilitas besar tanpa menghapus fungsi yang sudah ada:

1. **Portal Web SSO** — pintu masuk terpisah tempat user login sekali, lalu melihat
   daftar aplikasi web eksternal yang boleh diaksesnya. Saat user membuka aplikasi,
   portal melakukan **SSO otomatis** menggunakan kredensial yang user simpan sendiri.
2. **RBAC Portal** — user portal sepenuhnya terpisah dari user admin CMS. Aplikasi yang
   muncul per user ditentukan oleh hak akses yang diberikan admin.
3. **Audit Trail Menyeluruh** — satu sumber kebenuran yang mencatat **semua transaksi
   semua user** (admin CMS, user portal, sistem): login/logout, CRUD konten, CRUD user,
   akses SSO, perubahan konfigurasi, backup/restore — lengkap dengan hasil (sukses/gagal),
   IP, perangkat, dan detail yang sudah ter-redaksi field sensitif.

## 2. Keputusan utama

| # | Keputusan | Alasan |
|---|-----------|--------|
| D1 | User portal **terpisah** dari user admin CMS (`PortalUser` vs `User`) | Permintaan eksplisit: "harus terpisah usernya khusus untuk portal" |
| D2 | SSO memakai **form-based credential forwarding** | Pilihan user pada sesi klarifikasi; paling kompatibel cross-domain |
| D3 | Kredensial tiap app disimpan **terenkripsi (AES-256-GCM)** per (user, app) | Keamanan at-rest; user input sendiri, admin hanya atur akses |
| D4 | Audit memakai **satu tabel `AuditLog` baru** (bukan reuse `ActivityLog`) | `ActivityLog.userId` NOT NULL → tidak bisa catat event sistem/portal; FK membuat log hilang saat user dihapus |
| D5 | `ActivityLog` lama **dipertahankan** + backfill ke `AuditLog` | Migrasi aman, data lama tidak hilang |
| D6 | Tanpa dependency baru (`node:crypto`, `bcryptjs`, `next-auth`, Prisma, Zod) | Mengikuti batasan codebase |
| D7 | Manajemen portal oleh **SuperAdmin CMS** lewat panel `/admin` yang ada | Hindari layer admin tambahan; `PORTAL_ADMIN` untuk delegasi future |
| D8 | SSO mode `FORM` dulu; enum `PortalSsoMode` extensible (`REDIRECT`,`PROXY`,`TOKEN`) | Fokus MVP, ruang ekspansi terdokumentasi |

## 3. Scope

### In-scope
- Model: `PortalUser`, `PortalApp`, `PortalUserAppAccess`, `PortalUserAppCredential`,
  `PortalSession`, `AuditLog` + enum.
- Auth portal: NextAuth terpisah (cookie prefix `portal-auth.*`), revocation DB,
  lockout, lupa/ubah password.
- RBAC portal: akses per-app, helper permission, halaman manajemen admin.
- SSO form-based: penyimpanan terenkripsi, auto-submit form, health indicator,
  failure UX, CSRF via `extraFields`.
- Audit trail: helper `lib/audit.ts`, retrofit semua route mutasi + event auth, halaman
  admin terpadu + export + retensi + backfill.
- Infra: env, docker-compose, seed, script helper, version bump, dokumentasi.

### Out-of-scope (future)
- SSO mode `REDIRECT`/`PROXY`/`TOKEN` (OIDC/OAuth2/SAML).
- Delegasi admin portal (`PORTAL_ADMIN` mengelola tanpa SuperAdmin CMS).
- Email notifikasi portal (welcome/lockout) — infra `lib/email.ts` sudah ada.
- App health/online probe otomatis. Self-service registrasi portal user.


## 4. Arsitektur tinggi

```
                        ┌──────────────────────────────────────────┐
   Browser ───────────► │  Next.js 15 App Router                    │
                        │  /portal-login ──► PortalUser auth        │
                        │       │                                  │
                        │       ▼                                  │
                        │  /portal (guard sesi portal)             │
                        │   • grid app (filter RBAC)               │
                        │   • /portal/credentials (kelola sendiri) │
                        │   • /portal/app/[slug] (launch SSO)      │
                        │        └─ decrypt ─ auto POST ke app     │
                        ├──────────────────────────────────────────┤
                        │  /admin/portal-apps     (SuperAdmin)     │
                        │  /admin/portal-users    (SuperAdmin)     │
                        │  /admin/portal-sessions (SuperAdmin)     │
                        │  /admin/audit-trail     (SuperAdmin)     │
                        ├──────────────────────────────────────────┤
                        │  /admin/* (CMS — tetap)                  │
                        │  /site/[siteSlug]/* (publik — tetap)     │
                        │  /api/* (eksisting + baru)               │
                        └───────────────┬──────────────────────────┘
                                        │  PostgreSQL (Prisma 5)
                                        │  + tabel portal + audit
```

## 5. Alur SSO (form-based)

```
User klik app di /portal
  → /portal/app/[appSlug] (server)
  → cek PortalSession + PortalUserAppAccess (RBAC)
  → ambil PortalUserAppCredential → decrypt (AES-256-GCM)
  → render <form method=POST action={app.loginUrl} target=_blank>
        input[name=usernameField] + input[name=passwordField] + extraFields
     </form> + JS auto-submit
  → browser POST langsung ke domain app → app set cookie sesi di domainnya
  → tulis AuditLog (action=SSO_LAUNCH, category=SECURITY, outcome=SUCCESS)
```

## 6. Glossary

| Istilah | Definisi |
|---------|----------|
| Portal User | Akun pengguna portal (`PortalUser`), terpisah dari admin CMS (`User`) |
| Portal App | Definisi aplikasi web eksternal yang bisa diakses via portal (`PortalApp`) |
| SSO Launch | Portal mengirim kredensial user ke loginUrl app agar user terlogin otomatis |
| Credential Forwarding | Mekanisme SSO: portal submit username+password user ke form login app |
| RBAC Portal | Aturan app mana yang muncul untuk user tertentu (`PortalUserAppAccess`) |
| Audit Trail | Catatan semua transaksi semua user di tabel `AuditLog` |
| SuperAdmin CMS | `User` dengan `isSuperAdmin=true` — admin tertinggi |
| PORTAL_ADMIN | Role `PortalUser` untuk delegasi manajemen portal (future) |
| Redaksi | Penghapusan otomatis field sensitif dari payload audit |
| Health Indicator | Penanda apakah user sudah simpan kredensial untuk sebuah app |

## 7. Prinsip desain

1. **Tidak merusak yang ada** — dashboard & site publik tetap utuh; tabel lama tidak di-drop.
2. **Pemisahan tegas** — sesi portal ≠ sesi admin; user portal ≠ user admin; audit baru ≠ lama.
3. **Konsistensi konvensi** — `@/lib/...`, `getServerSession`, Zod+`validateInput`,
   `validatePagination`, inline-style dark UI, string Indonesia.
4. **Keamanan by default** — kredensial terenkripsi at-rest; field ter-redaksi; lockout +
   rate-limit; session revocation DB-backed.
5. **Audit tidak pernah menggagalkan transaksi** — `logAudit()` try/catch non-blocking.
6. **Tanpa dependency baru** — hanya `node:crypto`, `bcryptjs`, `next-auth`, Prisma, Zod.
7. **Extensible** — enum SSO mode, role portal, kategori audit dirancang untuk berkembang.

## 8. Daftar dokumen specs

| Dokumen | Topik |
|---------|-------|
| `00-overview.md` | Dokumen ini |
| `01-data-model.md` | Skema Prisma penuh + relasi + migrasi |
| `02-authentication-and-sessions.md` | Auth portal, sesi, lockout, password |
| `03-rbac.md` | Model role, matriks akses, helper permission |
| `04-sso-credential-forwarding.md` | Alur SSO, enkripsi, auto-submit, failure |
| `05-audit-trail.md` | AuditLog, helper, katalog event, retrofit, export |
| `06-api-reference.md` | Semua route baru — method, auth, request/response |
| `07-pages-and-routes.md` | Halaman, layout guard, navigasi, middleware |
| `08-security.md` | Threat model, enkripsi, limitasi cross-origin |
| `09-implementation-phases.md` | 6 fase, daftar file, validasi, backfill |
| `10-changelog-and-env.md` | version.json, env, docker, seed, script, docs |