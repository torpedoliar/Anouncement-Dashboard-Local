# Fase 5 — SSO Launch

> Specs referensi: `04-sso-credential-forwarding.md` §2-§5, `07-pages` §1
> Milestone: M5 · Prasyarat: **Fase 4** (butuh kredensial tersimpan untuk launch)

## Objective

Membangun halaman SSO launch yang melakukan auto-submit form ke `loginUrl` app eksternal
menggunakan kredensial terenkripsi yang user simpan. Termasuk failure UX untuk skenario
tidak ada akses / tidak ada kredensial / kredensial korup.

## Prerequisites

- [ ] Fase 4 selesai (user bisa login + simpan kredensial)
- [ ] Ada minimal 1 app dengan kredensial tersimpan (test dari Fase 4)
- [ ] App test dengan endpoint login yang menerima POST (mis. httpbin.org/forms/post,
    atau app internal test, atau app dummy yang echo field)

## Task list

### 5.1 Halaman SSO launch

- [ ] Buat `app/portal/app/[appSlug]/page.tsx` (server component, `force-dynamic`):
  - [ ] `getServerSession(portalAuthOptions)` → userId (redirect `/portal-login` jika tidak)
  - [ ] `prisma.portalApp.findUnique({ where: { slug } })` → 404 (`notFound()`) jika tidak ada/nonaktif
  - [ ] `canAccessPortalAppBySlug(userId, slug)` → render `<AccessDenied>` jika false
  - [ ] `prisma.portalUserAppCredential.findUnique({ portalUserId, appId })` →
    render `<NoCredential>` (dengan link `/portal/credentials?app=[slug]`) jika tidak ada
  - [ ] `decryptCredential(credentialBlob)` dalam try/catch → render `<CorruptCredential>` jika gagal
  - [ ] Update `lastUsedAt`: `prisma.portalUserAppCredential.update`
  - [ ] `logAudit({ action:"SSO_LAUNCH", category:"SECURITY", appId, outcome:"SUCCESS" })`
  - [ ] Parse `app.extraFields` (JSON array `[{name, value}]`) — termasuk CSRF token
    jika app butuh (mode `static` di MVP; mode `fetch` dinamis = future, lihat `04-sso` §4)
  - [ ] Render auto-submit form:
    ```tsx
    <html><body onLoad="document.forms[0].submit()">
      <p>Mengalihkan ke {app.name}...</p>
      <form method={app.httpMethod.toLowerCase()} action={app.loginUrl} target="_blank">
        <input type="hidden" name={app.usernameField} value={cred.username} />
        <input type="hidden" name={app.passwordField} value={cred.password} />
        {extraFields.map(f => <input type="hidden" name={f.name} value={f.value} />)}
      </form>
    </body></html>
    ```
  - [ ] Catatan: halaman ini render raw HTML (auto-submit). Pastikan tidak ada layout
    portal wrapping (gunakan route group atau `generateMetadata` kosong). Next.js App
    Router: return `<html>` langsung mungkin konflik dengan root layout — alternatif:
    render form di dalam portal layout dengan script auto-submit + pesan loading.

### 5.2 API launch opsional (AJAX)

- [ ] (Opsional) Buat `app/api/portal/launch/[appSlug]/route.ts`:
  - [ ] `GET` — return `{ loginUrl, method, fields: {...} }` (decrypted) untuk client-side submit
  - [ ] **Rekomendasi: skip** — server-rendered form lebih sederhana & tidak expose
    credential ke JS. Hanya buat jika butuh kontrol client-side lebih.

### 5.3 Audit SSO failure

- [ ] Di setiap failure path (AccessDenied/NoCredential/CorruptCredential), tambah
  `logAudit` dengan `outcome:"FAILURE"`:
  - [ ] No access → `SSO_LAUNCH_FAILED` (errorMessage "no access")
  - [ ] No credential → `SSO_LAUNCH_FAILED` (errorMessage "no credential")
  - [ ] Corrupt → `SSO_LAUNCH_FAILED` (errorMessage "decrypt failed")

## Definition of Done (DoD)

- [ ] Klik "Buka Aplikasi" di grid → redirect ke `/portal/app/[slug]` → auto-submit →
  tab baru terbuka ke app eksternal dengan field terisi
- [ ] App eksternal menerima POST (verifikasi via httpbin.org echo atau app test)
- [ ] Failure: akses app tanpa RBAC → tampil "tidak punya akses" + audit FAILURE
- [ ] Failure: app tanpa kredensial → tampil "simpan kredensial dulu" + link + audit FAILURE
- [ ] Failure: kredensial korup (manual corrupt blob di DB) → tampil "rusak, simpan ulang"
- [ ] `lastUsedAt` ter-update setelah launch (verifikasi DB)
- [ ] `SSO_LAUNCH` muncul di `/admin/audit-trail` (jika Fase 2 sudah) atau DB
- [ ] `npm run build && npm run lint` sukses

## Validation steps
```bash
npm run build && npm run lint
# Manual:
# 1. Login portal → simpan kredensial untuk app "Test ERP"
#    (set loginUrl ke https://httpbin.org/forms/post untuk test echo)
# 2. Klik "Buka Aplikasi" → tab baru → httpbin echo field username/password terisi
# 3. Cek DB: portal_user_app_credentials.lastUsedAt ter-update
# 4. Cek AuditLog: SSO_LAUNCH SUCCESS tercatat
# 5. Hapus kredensial → klik app → tampil "simpan kredensial dulu"
# 6. Revoke access (via /admin/portal-users) → klik app → "tidak punya akses"
# 7. Corrupt blob di DB (manual UPDATE) → klik app → "kredensial rusak"
```

## Rollback notes
- Hapus `app/portal/app/[appSlug]/` saja. Grid app button bisa diubah ke link langsung
  (`app.url`) sebagai fallback sementara.