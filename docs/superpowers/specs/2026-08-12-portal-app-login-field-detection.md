---
name: portal-app-login-field-detection
description: Deteksi otomatis username/password field dari halaman login aplikasi saat admin menambah aplikasi portal
---

# Portal App: Deteksi Otomatis Field Login (username/password)

## Ringkasan

Saat admin menambah/mengedit aplikasi di `/admin/portal-apps`, admin sering salah mengisi
`USERNAME FIELD` / `PASSWORD FIELD` secara manual walaupun yakin format form benar.
Fitur ini menambahkan **tombol "Deteksi Otomatis"**: sistem mengambil halaman `loginUrl`
aplikasi (server-side), mem-parse HTML-nya, lalu **mengisi otomatis** `usernameField`,
`passwordField`, dan `extraFields` di form admin. Admin tinggal review & simpan.

## Konteks yang Ada

- Form admin di `app/admin/portal-apps/page.tsx` (client component) punya field
  `loginUrl`, `usernameField` (default `"username"`), `passwordField` (default `"password"`),
  dan `extraFields` (textarea teks JSON, di-parse ke objek saat submit).
- `lib/validation-schemas.ts` — `PortalAppCreateSchema`/`PortalAppUpdateSchema`:
  `loginUrl: z.string().url()`, `usernameField`/`passwordField: z.string().max(100).default(...)`,
  `extraFields: z.any().nullable().optional()`.
- `app/api/portal-apps/route.ts` (POST) & `app/api/portal-apps/[id]/route.ts` (PUT) —
  SuperAdmin only, validasi via Zod, simpan via Prisma `portalApp`.
- `prisma/schema.prisma` `PortalApp`: `loginUrl String?`, `usernameField/passwordField String @default(...)`,
  `extraFields Json?` (**format `Record<string,string>`**).
- SSO launch `app/portal/app/[appSlug]/page.tsx` mem-parse `app.extraFields as Record<string,string>`
  dan `cred.extra` → array `{name,value}`, disuntik ke form hidden di `SSOAutoSubmit`.
- `lib/portal-crypto.ts` `CredentialData { username, password, extra?: Record<string,string> }`.

## Perilaku Fitur

1. Di form Tambah/Edit Aplikasi, di sebelah input `LOGIN URL` muncul tombol **"Deteksi Otomatis"**.
2. Admin mengisi `LOGIN URL` (contoh `https://app.example.com/login`), klik tombol.
3. Client POST ke API baru `POST /api/portal-apps/detect-fields` dengan body `{ url }`.
4. API (server) fetch halaman `url`, parse HTML, temukan form login, kembalikan:
   ```json
   { "usernameField": "user_id", "passwordField": "pwd", "extraFields": [{ "name": "csrf", "value": "..." }] }
   ```
   - `usernameField` & `passwordField` adalah **nilai `name`** (fallback `id`) dari input.
   - `extraFields` hanya **hidden input statis** yang punya `name` dan `value` non-kosong.
5. Client isi otomatis `formData.usernameField`, `formData.passwordField`, dan menulis
   `extraFields` ke textarea `EXTRA FIELDS` (JSON array dari `{name,value}` yang bisa admin edit).
6. Admin review, lalu simpan seperti biasa.

### Deteksi Username
Dalam `<form>` yang berisi input `type="password"`, ambil input kandidat username dari jenis
`text` | `email` | `tel` | `search`, **pilih berdasarkan prioritas**:
1. `autocomplete="username"` (nilai pasti);
2. `name`/`id` (lowercase) mengandung `user` / `login` / `email` / `account`;
3. input non-password pertama dalam form.
Jika tidak ada → null (admin isi manual).

### Deteksi Password
Dalam `<form>` yang sama, ambil input `type="password"`:
1. input password pertama.

### Deteksi Extra Fields
Semua `<input type="hidden">` dalam form yang sama dengan `name` dan `value` non-kosong,
ditambah `<input>` tanpa type (default hidden) yang punya `name` + `value`.
`csrf_token`/`_token`/`authenticity_token` ikut terdeteksi (nilainya per-session; admin bisa hapus).

## Batasan (Kerja Nyata)

- Hanya mem-parsing **HTML statis** (tanpa eksekusi JS). Aplikasi dengan form login yang
  di-render via JavaScript tidak terdeteksi — fallback ke `username`/`password` manual.
- Halaman login yang butuh session/cookie internal (mis. Oracle REROUTE/`AppsLocalLogin.jsp`) —
  deteksi memakai GET polos, mungkin redirect ke SSO eksternal; hasil bisa null/gagal.
- Deteksi **tidak** membuka kredensial; `extraFields` nilai dinamis (per-session) mungkin tidak
  berguna disimpan — admin bisa hapus.

## Keamanan (SSRF & URL Validation)

- API **SuperAdmin only** (pakai `getServerSession(authOptions)` + `isSuperAdmin`).
- Validasi URL: hanya `http: | https:`. Batasi host via allowlist sederhana:
  tolak `localhost`, `127.0.0.0/8`, `0.0.0.0`, `10/8`, `172.16/12`, `192.168/16`,
  `169.254/16` (link-local). Ini SSRF harden dasar (SuperAdmin internal apps).
- `fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) })`.
- Batasi respons body: ambil `res.text()` lalu potong ke ~`64KB` sebelum parse (cegah harganya mahal).
  - Lebih aman: gunakan `res.body` reader dengan cap 64KB → abort jika lewat.
- Error tidak pernah me-leak isi HTML (hanya pesan singkat).

## Perubahan File

**Create:**
- `app/api/portal-apps/detect-fields/route.ts` — API POST `{ url }` → `{ usernameField, passwordField, extraFields }`.
- `lib/portal-login-detect.ts` — pure function `detectLoginFields(html: string): { usernameField, passwordField, extraFields }`.
- `scripts/test-login-detect.ts` — self-check untuk parser (unit test tanpa DB).
- **Unit test regex/parser:** banyak variasi HTML (dengan/autocomplete, email vs text, hidden csrf, tanpa form, multipel form) — `npx tsx scripts/test-login-detect.ts`.

**Modify:**
- `app/admin/portal-apps/page.tsx` — tombol "Deteksi Otomatis" + handler + preview + isi otomatis.
- (opsional) `lib/validation-schemas.ts` — tidak perlu; body `{ url }` validasi sederhana di route.

## Tidak Dibuat (YAGNI)

- Auto-trigger saat ketik nama / on-change LOGIN URL (hanya tombol).
- Deteksi dari `url` aplikasi (hanya dari `loginUrl`).
- Render visual field terdeteksi (hanya isi teks field).
- Dukungan aplikasi yang di-render JS penuh.
- Menyimpan hasil deteksi ke DB (kerja sekali-pakai).
