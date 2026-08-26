# Desain Arsitektur Aktivasi Mode SSO REDIRECT / PROXY / TOKEN

Tanggal: 2026-08-26 · Agent: arak-bali-mt9w2be8 (Solution Architect) · Milestone: SSO M3 — Gelombang 1 (desain)
Status: **DESAIN — belum ada perubahan kode aplikasi**

## 1. Ringkasan keputusan (TL;DR)

| Mode | Rekomendasi | Inti keputusan |
|---|---|---|
| REDIRECT | **Siap eksekusi, tunda sampai ada ≥1 aplikasi target nyata** | Identity-assertion redirect (HMAC token URL), ~120 baris, nol migration |
| PROXY | **Jangan pernah reverse-proxy in-process; jalur resmi = gateway eksternal** | Cukup satu endpoint forward-auth + runbook ops |
| TOKEN | **Tunda; dilarang menyimpan rahasia di `extraFields`** | Tertahan kolom rahasia app-level (= migration) + prinsip jangan bangun IdP sendiri |

Yang layak dibangun **sekarang** bukan mesin SSO-nya, melainkan dua perbaikan kecil bernilai langsung
(bagian 4): guardrail picker admin + kartu panduan pengganti halaman mati. Desain penuh tiap mode tetap
disiapkan di bawah supaya eksekusi tinggal dispatch tanpa riset ulang.

## 2. Fakta dasar (terverifikasi di repo)

- Enum final 7 nilai di `prisma/schema.prisma:370-378`; migrations lengkap tercatat di `.planning/phases/opd2-audit.md`. Desain ini **tidak menambah enum/migration**.
- Titik integrasi: `app/portal/app/[appSlug]/page.tsx:183-209` — blok "SSO Mode {X} Belum Aktif" (hasil fix `32c266c`) adalah branch yang diganti/diperluas.
- **`PortalApp` tidak punya kolom `metadata` umum** (`schema.prisma:609-658`). Kolom konfigurasi yang ada: `url`, `loginUrl`, `httpMethod`, `usernameField`, `passwordField`, `extraFields Json?`. `extraFields` berisi nilai form yang dikirim ke aplikasi — **bukan tempat rahasia** (tersimpan sebagai JSON polos).
- Preseden konfigurasi via env: `PORTAL_SSO_COOKIE_DOMAIN` dibaca `sharedCookieDomain()` (`lib/portal-sso-relay.ts:294`) dan `PORTAL_CREDENTIAL_KEY` fail-closed di `lib/portal-crypto.ts:11`.
- Infra reusable (semua sudah ada, tidak perlu disentuh): `fetchLoginPage`/`CookieJar`/`relayRequest`/`refreshVolatileFields` (`lib/portal-fetch-html.ts`), `relayLogin`/`findFederationAutoPost`/`classifyRedirect`/`parseOracleAuthResponse` (`lib/portal-sso-relay.ts`), `decryptCredential`, `logAudit` (wajib set `appId`), banner `SsoErrorBanner` (`sso_failed`, `sso_cross_domain`), pola komponen submit `SSORerouteSubmit`/`SSOPostSubmit`.
- Sejarah penting: reverse proxy **sudah pernah ada lalu dihapus** — komentar `app/api/sso/reroute/route.ts:129-137` mencatat crash OOM di route proxy lama dan OAF MAC breakage karena URL rewriting. Ini bukti empiris, bukan spekulasi.
- File beku OPD-1 (`lib/portal-access.ts`, `lib/portal-layout.ts`, `lib/portal-auth.ts`, `lib/auth.ts`, `middleware.ts`): semua desain di bawah hanya **memanggil** fungsi dari file-file itu (pola yang sudah dipakai dispatcher hari ini: `getServerSession(portalAuthOptions)`, `canAccessPortalAppBySlug`) — tidak ada yang perlu diedit. Import ≠ edit; zero-diff terjaga.
- Picker admin (`app/admin/portal-apps/page.tsx`, blok Select "SSO MODE") menampilkan ketiga mode tanpa penanda bahwa belum aktif — sumber miskonfigurasi utama saat ini.

## 3. Kontrak perilaku per mode

### 3.1 REDIRECT — identity-assertion redirect (HMAC token)

**Semantik**: portal tidak meneruskan kredensial sama sekali; ia menerbitkan *asersi identitas*
berumur sangat pendek dan mengarahkan browser ke aplikasi dengannya. Beda fundamental dari POST/REROUTE
(yang mengirim username/password) dan cocok untuk aplikasi/gateway internal yang bisa memvalidasi token.

**Flow end-to-end**
```
PortalUser klik app (REDIRECT)
  → Dispatcher (launch page, server component):
      1. sesi + akses + kredensial? → TIDAK PERLU kredensial (beda dgn mode lain;
         langkah 4-8 dispatcher dilewati untuk mode ini)
      2. baca PORTAL_SSO_REDIRECT_SECRET; kosong → tetap render kartu "Belum Aktif"
         (degradasi anggun, konsisten fail-closed ala portal-crypto)
      3. mint token: base64url(payload) + "." + base64url(HMAC-SHA256(secret, payload))
         payload = { v:1, sub: portalUserId, slug: app.slug, exp: now+60 }
      4. logAudit SSO_LAUNCH SUCCESS (appId wajib, metadata.ssoMode:"REDIRECT")
      5. 302 → loginUrl||url + (punya query ? …&sso=<token> : ?sso=<token>)
  → Aplikasi/gateway target memvalidasi HMAC + exp + slug, membaca sub sebagai identitas
    (kontrak integrasi di luar repo ini — lihat Risiko)
```

**Route/komponen**
| Berkas | Baru/Modifikasi | Isi |
|---|---|---|
| `lib/portal-sso-token.ts` | baru | `mintRedirectToken()` + getter secret fail-closed (~50 baris; gaya `getKey()` portal-crypto) |
| `app/api/sso/redirect/route.ts` | baru (opsional) | hanya jika ingin paritas audit ulang-klik dgn REROUTE/POST; versi minimum cukup di dispatcher |
| `app/portal/app/[appSlug]/page.tsx:183-209` | modifikasi | branch REDIRECT → mint + 302; PROXY/TOKEN tetap kartu status |
| `.env.example` | modifikasi | dokumentasi `PORTAL_SSO_REDIRECT_SECRET` |

**Config**: nol kolom baru. Secret via env (rotasi = ganti env + restart; token lama hangus ≤60 dtk).
**Kegagalan**: tanpa secret → kartu status (bukan error); audit FAILURE hanya bila mint/redirect throw.

### 3.2 PROXY — header-injection via gateway eksternal (bukan in-process)

**Keputusan inti**: reverse proxy di dalam Next.js **ditolak** — sudah terbukti gagal di repo ini
(OOM crash route lama; OAF MAC pecah oleh URL rewriting; plus websocket/streaming/path absolut yang
tidak akan pernah selesai ditangani). Kebutuhan nyata di balik PROXY adalah *"aplikasi percaya header
identitas (mis. REMOTE_USER/X-Forwarded-User)"* — itu pekerjaan **gateway**, bukan monolith Next.js.

**Desain jika diaktifkan**
```
Browser → [gateway eksternal: Traefik forwardAuth / oauth2-proxy / nginx auth_request]
            └─ sebelum proxy ke aplikasi, panggil:
               GET /api/sso/proxy-check?app=<slug>   (cookie portal ikut)
               ← 200 + x-forwarded-user: <portalUserId>   |   401
```
| Berkas | Baru/Modifikasi | Isi |
|---|---|---|
| `app/api/sso/proxy-check/route.ts` | baru | validasi sesi portal (`getServerSession(portalAuthOptions)` — import saja) + `canAccessPortalAppBySlug` + logAudit; respons header identitas (~40 baris) |
| `app/portal/app/[appSlug]/page.tsx` | modifikasi | branch PROXY → kartu panduan "mode ini butuh gateway; hubungi admin" |
| `docs/` runbook | baru | contoh konfig Traefik/nginx |

Dispatcher TIDAK melakukan apa pun selain menjelaskan syaratnya — peluncuran normal lewat URL aplikasi
langsung, gateway yang mengurus otentikasi per-request. Effort in-repo sangat kecil; risiko hampir nol.

### 3.3 TOKEN — OIDC/OAuth2

Dua kemungkinan makna, keduanya tertahan fakta repo:

1. **Token endpoint milik aplikasi** (portal panggil pakai akun servis): butuh **rahasia app-level
   terenkripsi** — struktur kredensial sekarang per-PortalUser (`PortalUserAppCredential`), dan
   `extraFields` JSON polos dilarang keras untuk rahasia. Terobos = butuh migration/model baru
   (`AppCredential` terenkripsi) → di luar batasan milestone ini.
2. **Portal sebagai OIDC RP/IdP**: butuh registrasi client per deployment, manajemen signing key,
   discovery/JWKS — proyek tersendiri dengan permukaan keamanan besar. Prinsip arsitektur: **jangan
   membangun IdP sendiri**; bila suatu hari dibutuhkan, adopsi OSS (Keycloak/Authentik/Zitadel) dan
   posisikan portal sebagai pembungkus peluncuran.

**Desain cadangan (bila prasyarat #1 dipenuui suatu saat)**: `app/api/sso/token/route.ts` meniru pola
POST (guard `ssoMode !== "TOKEN"`, access check, logAudit) → server-to-server panggil token endpoint,
lalu serahkan token ke browser via fragmen `#token=` (fragmen, bukan query, agar tak masuk log server).
Komponen UI tidak perlu — 302/handoff halam ala `autoPostHandoffPage`.

## 4. MVP cut — usulan keputusan produk (bagian yang DIEKSEKUSI dari milestone ini)

**Bangun sekarang (kecil, bernilai langsung, nol migration):**

1. **Guardrail picker admin** (`app/admin/portal-apps/page.tsx`): label ketiga mode diberi sufiks
   "(nonaktif)", dan saat dipilih muncul konfirmasi + saran mode aktif terdekat:
   REDIRECT → POST/REROUTE · PROXY → VAULT · TOKEN → VAULT. Konfirmasi, bukan blokir — pra-konfigurasi
   tetap mungkin. (Mencegah dead-end di sumbernya.)
2. **Kartu panduan pengganti halaman mati**: ekstrak blok 183-209 menjadi
   `components/portal/SSOModeInactive.tsx` dan perkaya per mode — alasan + "mode terdekat yang bisa
   dipakai sekarang". Pengguna tidak lagi hanya disuruh "hubungi admin".

**Tunda + pemicu aktivasi (dokumen ini = usulan keputusan "separate product decision" di ROADMAP):**

| Mode | Pemicu aktivasi | Prasyarat |
|---|---|---|
| REDIRECT | Ada ≥1 aplikasi target riil yang bisa memvalidasi token HMAC | Setuju env `PORTAL_SSO_REDIRECT_SECRET`; gelombang 3 jalan (~hari kerja terkecil) |
| PROXY | Organisasi mau memasang gateway eksternal | Keputusan DevOps; di luar scope repo |
| TOKEN | Ada aplikasi yang benar-benar bicara OIDC/token-endpoint | Migration model rahasia app-level + keputusan produk |

**Alasan anti-spekulasi**: menulis mesin SSO tanpa satu pun konsumen nyata menghasilkan kode
otentikasi tak teruji lapangan — permukaan risiko tanpa nilai terbukti. Guardrail + kartu panduan
menutup 100% masalah pengguna yang ada hari ini (miskonfigurasi & dead-end).

## 5. Dekomposisi tugas siap-dispatch (Gelombang 2 — MVP)

Lane paralel bebas konflik (tiap lane menyentuh file berbeda):

| Lane | Agent | File | Isi |
|---|---|---|---|
| UI admin | Hennesy | `app/admin/portal-apps/page.tsx` | label "(nonaktif)" + konfirmasi + saran mode terdekat |
| Portal/dispatcher | Oscar | `app/portal/app/[appSlug]/page.tsx` + `components/portal/SSOModeInactive.tsx` (baru) | ekstrak & perkaya kartu status per mode |
| QA rilis | Baileys Irish Cream | — | gate: tsc + eslint scoped + review diff + push |

Gelombang 3 (hanya bila Open Question #1 dijawab "ya"): REDIRECT engine —
Kawa: `lib/portal-sso-token.ts` + `app/api/sso/redirect/route.ts`; Oscar: dispatcher branch +
`.env.example`; Hennesy: hint picker REDIRECT dilepas dari "(nonaktif)".

Gate semua lane: `npx tsc --noEmit` + eslint scoped; commit atomik; file beku OPD-1 zero-diff;
tanpa migration; enum & `lib/validation-schemas.ts:240` tidak berubah.

## 6. Risiko teknis & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Token REDIRECT bocor (log/referer) | impersonasi | TTL 60 dtk, aud=slug, secret env-only; kontrak: aplikasi wajib HTTPS intranet; pertimbangkan single-use nonce saat dieksekusi |
| Clock skew antar host | token ditolak | toleransi ±30 dtk di sisi validator (kontrak integrasi) |
| Rotasi secret | SSO berhenti sebentar | rotasi = restart; degradasi ke kartu status, bukan error 500 |
| Validasi sisi aplikasi salah dibangun | SSO diam-diam gagal | runbook + contoh verifier di docs saat gelombang 3 |
| Guardrail dianggap menyulitkan admin | friksi kecil | konfirmasi dapat dilewati; tidak mengubah API/zod |
| PROXY dicoba diimplement in-process di masa depan | OOM/MAC ulang | keputusan tertulis di dokumen ini + kartu status menjelaskan syarat gateway |
| Rahasia dicempel ke `extraFields` | kebocoran rahasia | dilarang eksplisit di dokumen + reviewer gate |

## 7. Open Questions (untuk god / human — jangan parkir kerja MVP)

1. **Adakah ≥1 aplikasi target nyata untuk REDIRECT?** Menentukan Gelombang 3 jalan atau tidak.
2. **Penamaan & rotasi** `PORTAL_SSO_REDIRECT_SECRET` — ikuti konvensi env existing, cukup disepakati god.
3. **Copy picker admin** "(nonaktif)" — persetujuan ringan atas perubahan teks admin.
4. **PROXY**: apakah organisasi mau jalur gateway eksternal (keputusan ops/DevOps, di luar repo)?

## 8. Verifikasi desain

- Dokumen murni `.planning/` — nol sentuhan kode; gate `npx tsc --noEmit` dijalankan saat commit untuk memastikan tree tetap sehat.
- Analisis file beku: semua pola yang dirujuk (`getServerSession(portalAuthOptions)`, `canAccessPortalAppBySlug`, `logAudit`) sudah dipakai dispatcher/route hari ini lewat import — tidak ada file beku yang perlu diedit.
- Tanpa migration: konfigurasi mode memakai kolom `PortalApp` existing + env var; kebutuhan yang tidak muat di situ (rahasia app-level) sengaja menjadi pemicu aktivasi, bukan ditempel paksa.
