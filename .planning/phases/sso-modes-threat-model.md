# Threat Model — Mode SSO REDIRECT / PROXY / TOKEN (Gate pra-implementasi)

Tanggal: 2026-08-26 · Agent: Tuak (Security/AppSec) · Milestone: SSO Modes (Gelombang 1)
Status: dokumen gate — implementasi REDIRECT/PROXY/TOKEN **tidak dibuka** sebelum kontrol wajib di §4 disepakati desain (Arak Bali) dan acceptance checks §5 masuk rencana QA (Amer).

---

## 0. Konteks sistem (fakta terverifikasi dari repo)

Enum `PortalSsoMode` (prisma/schema.prisma:370-378) memuat 7 nilai; REDIRECT/PROXY/TOKEN masih
"(future)" dan kini menampilkan halaman "Belum Aktif" (`app/portal/app/[appSlug]/page.tsx:185-209`,
fix `32c266c`). Implementasi pembanding yang sudah jalan dan menjadi pola acuan:

| Pola existing | Bukti |
|---|---|
| Guard berlapis saat launch | `app/api/sso/reroute/route.ts:25-42`, `app/api/sso/post/route.ts:62-76`: sesi portal (401) → app aktif + `ssoMode === MODE` (404) → `canAccessPortalAppBySlug` (403) |
| Kredensial milik sendiri | `findFirst({ id: credentialId, portalUserId })` — credentialId dari luar tak bisa menyasar milik orang lain; fallback akun pertama |
| Kripto at-rest | `lib/portal-crypto.ts` AES-256-GCM, fail-closed jika `PORTAL_CREDENTIAL_KEY` invalid |
| Audit | `logAudit({ actorType:"PORTAL_USER", category:"SECURITY", action:"SSO_LAUNCH", entityId, appId, outcome, errorMessage, metadata:{appSlug, appName, ssoMode, ...} })` — non-blocking, `.catch(() => {})`, tanpa nilai rahasia di metadata |
| Kegagalan mengarahkan ke banner | `/portal?error=sso_failed&app=<slug>` / `sso_cross_domain` (tanpa bocoran detail internal) |
| Fetch engine | `lib/portal-fetch-html.ts`: blocklist host statis (baris 71-75), ikut redirect manual max 12 hop, `relayRequest` dengan `allowInsecureTLS` per-request |
| Relay federasi | `lib/portal-sso-relay.ts`: `relayLogin` ikuti rantai, serah-terima auto-POST WS-Fed/SAML, `sharedCookieDomain()` untuk re-issue cookie |
| RBAC portal | `lib/portal-access.ts` — `PORTAL_ADMIN` bypass; restricted app = direct access ATAU grup aktif |

**Catatan trust boundary penting:** `PortalApp` **tidak punya `siteId`** (schema diverifikasi) —
domain portal tidak ter-scope multi-tenant situs. Batas kepercayaan yang relevan untuk ketiga mode
ini adalah RBAC portal (isPublic / grup / direct access) + pembatasan konfigurasi (lihat bawah),
bukan `siteId`. Jangan menambahkan asumsi site-scoping ke desain.

Siapa boleh menitipkan URL/konfigurasi target: create PortalApp = CMS `role ADMIN` atau SuperAdmin
(`app/api/portal-apps/route.ts:15`), update/delete = **SuperAdmin saja**
(`app/api/portal-apps/[id]/route.ts:17,38`). Uji login (verify-login) juga admin CMS + rate-limit
per-admin tersendiri. Artinya: konfigurasi target adalah *trusted-but-error-prone* (salah ketik =
SSRF), bukan input publik — tapi pengguna portal biasa yang men-trigger efek jaringannya saat launch.

Aset yang dilindungi (berlaku lintas mode):
1. **Kredensial aplikasi per pengguna** (`PortalUserAppCredential.credentialBlob`, terenkripsi) — aset paling sensitif; sekali dibocorkan ke app/host yang salah, kompromi akun korban di app tersebut.
2. **Sesi portal** (cookie `portal-auth.*`, httpOnly) — tidak boleh bocor ke aplikasi target.
3. **Sesi aplikasi target** yang di-re-issue ke browser — tidak boleh terpakai ulang lintas pengguna/lintas app.
4. **Jaringan internal** — server portal adalah posisi istimewa di LAN; fitur fetch server-side menjadikannya mesin SSRF potensial.
5. **Integritas audit** — jejak `SSO_LAUNCH` adalah satu-satunya forensik lintas mode.
6. **Reputasi origin portal** — redirect dari domain portal dipercaya pengguna; disalahgunakan = senjata phishing.

Trust boundaries:
```
Browser pengguna ──(cookie portal-auth)──▶ Portal Next.js ──(server-to-server, kredensial diteruskan)──▶ Aplikasi target / IdP
     ▲                                        │   ▲
     └── cookie sesi app di-re-issue ─────────┘   └── batas: URL/konfigurasi target dikontrol admin CMS;
                                                      input runtime pengguna: appSlug, credentialId (cuid), query error
```

---

## 1. Mode REDIRECT — redirect SSO

Semantik kerja (usulan): portal melakukan satu pengalihan browser ke URL aplikasi target,
opsional setelah handshake ringan; tanpa reverse proxy, tanpa penyimpanan token baru.

### 1a. Vektor serangan

| # | Vektor | Severity | Penjelasan konkret |
|---|--------|----------|--------------------|
| R-1 | Open redirect lewat parameter | High | Bila destination dibaca dari query (`?next=`, `?redirect_uri=`) siapa pun bisa membuat tautan `portal…/app/x?next=https://evil.com` — halaman phishing memakai otoritas domain portal. Precedent nyata di repo: tujuan REROUTE diambil dari respons Oracle tanpa divalidasi (`reroute/route.ts:138,167` `new URL(authUrl, loginUrl)`) — kelas bug yang sama harus dicegah sejak desain. |
| R-2 | Allowlist bypass via parsing URL | High | `z.string().url()` (validation-schemas.ts:268,271) menerima **semua skema apa pun yang lolos `new URL()`**, termasuk `javascript:` dan `data:`; trik klasik lain: userinfo `https://app.santos.co.id@evil.com`, backslash `https://evil.com\@santos.co.id`, homograf IDN/punycode, subdomain palsu `evil-santos.co.id` (suffix-match yang salah), fragment `#`. Satu validator pusat wajib dipakai di schema DAN jalur launch. |
| R-3 | Drift rantai redirect | Medium | `fetchLoginPage` memeriksa blocklist HANYA di URL awal (`portal-fetch-html.ts:111-113`); hop berikutnya diikuti tanpa re-check — URL sah bisa 302 ke host internal/metadata. |
| R-4 | DNS rebinding / TOCTOU | Low-Medium | Validasi host dilakukan pada nama, koneksi pada IP yang di-resolve belakangan; dalam LAN risikonya rendah tapi tetap dicatat. |
| R-5 | Downgrade skema | Low | `http://` ke host yang semestinya https → kredensial/token di jalur terbuka. |

### 1b. Kontrol wajib

1. **Satu resolver URL terpusat** (mis. `lib/portal-url-guard.ts`) dipakai oleh: Zod schema create/update, semua mode SSO baru, dan idealnya diretrofit ke REROUTE/POST. Aturannya: skema `http(s)` saja; host **exact-match** terhadap allowlist per-app (kolom baru atau derivasi deterministik dari host `app.url`; suffix/parent-domain hanya boleh bila didaftarkan eksplisit); tolak userinfo (`user@host`), normalisasi IDN→ASCII sebelum banding; tolak port tak terdaftar bila app mendefinisikannya.
2. **Tujuan redirect HANYA dari konfigurasi DB** — dilarang membaca URL tujuan dari query/body pengguna. Param yang boleh lewat: `appSlug`, `credentialId` (opaque, sudah divalidasi milik user). Halaman error mengarah ke path fix `/portal?error=…`.
3. **Re-validasi tiap hop** bila mode ini sempat memicu fetch server-side; hop keluar allowlist → putus rantai, `outcome: FAILURE`.
4. **Cookie & audit mengikuti pola existing**: bila mode ini menerbitkan cookie → `HttpOnly; SameSite=Lax; Path=/; Domain=<sharedCookieDomain tervalidasi>; Max-Age≤28800; Secure` saat https. Audit `SSO_LAUNCH` sukses/gagal persis pola reroute/post (appId wajib — KPI /admin/portal-audit memfilter appId).
5. **Error 500 tidak membocorkan detail** — jangan tiru `details: err.message` di reroute/route.ts:204; pakai pola post/route.ts:227 (pesan generik).

### 1c. Acceptance Security Checks (untuk QA otomatis)

1. App dengan `loginUrl` host luar allowlist → launch ditolak (403 / banner `sso_invalid_target`), **tidak ada** request keluar dari server.
2. `loginUrl` = `https://app.santos.co.id@evil.com`, `javascript:alert(1)`, `http://169.254.169.254/` → semua ditolak di validasi (create/update maupun launch).
3. Rantai redirect yang melompat keluar allowlist → rantai diputus + AuditLog `outcome:FAILURE`.
4. `GET /portal/app/<slug>?next=https://evil.com` → tujuan tetap dari konfigurasi; `next` diabaikan total.
5. Setiap percobaan launch (sukses/gagal) meninggalkan tepat satu baris AuditLog `action=SSO_LAUNCH, metadata.ssoMode="REDIRECT"`.

---

## 2. Mode PROXY — reverse proxy + header injection

Semangat historis yang harus dipertahankan: reverse proxy penuh **pernah ada lalu dihapus**
karena OOM + OAF MAC rusak (komentar enum `c72332d`). Desain baru wajib menyatakan sikapnya
terhadap penulisan-ulang HTML — rekomendasi security: **tanpa rewriting body**; kalau terpaksa,
itu permukaan XSS/canvas-baru yang butuh review terpisah.

### 2a. Vektor serangan

| # | Vektor | Severity | Penjelasan konkret |
|---|--------|----------|--------------------|
| P-1 | SSRF terpandu | High | Proxy memberi pengguna terautentikasi kemampuan membuat server meminta PATH arbitrer pada host backend; bila pin host longgar (path absolut, redirect diikuti bebas), ia jadi jembatan ke panel admin app lain / layanan internal. Blocklist statis existing (3 host exact) jelas tak cukup. |
| P-2 | Spoofing header identitas | Critical | Header identitas (`X-Remote-User`, `X-Authenticated-User`, `Authorization`, `X-Forwarded-*`) yang diteruskan mentah dari klien = **auth bypass total di app backend** (pengguna menamai dirinya `admin`). Ini vektor #1 mode ini. |
| P-3 | Cookie-jar confusion | High | (a) Cookie `portal-auth.*` portal ikut terkirim ke backend = kebocoran sesi portal ke app pihak ketiga; (b) `CookieJar` existing di-key NAMA saja (`Map<string,string>`, portal-fetch-html.ts:29-60) — cookie dua host dalam satu rantai saling menimpa dan SEMUA dikirim ke tiap hop berikutnya; di proxy stateful, jar yang salah scope = **sesi pengguna A terpakai sebagai sesi pengguna B**. |
| P-4 | Response-splitting / injeksi header balikan | Medium | Nilai `Set-Cookie`/header upstream disalin verbatim ke respons; karakter kontrol (\r\n) atau nama cookie berbahaya dari backend (yang mungkin dikompromikan) menyuntik header ke respons portal. |
| P-5 | Header hop-by-hop & smuggling | Medium | `Connection`, `Transfer-Encoding`, `Upgrade` dsb. yang diteruskan membuka request smuggling antara proxy dan backend. |
| P-6 | Host-header confusion | Low-Medium | Meneruskan Host asli pengguna memecah routing vhost backend dan bisa mengubah perilaku generasi URL absolut. |
| P-7 | TLS relaxation berlebihan | Medium | `allowInsecureTLS` existing itu per-request; di proxy ia harus terikat konfigurasi per-app yang eksplisit, bukan default global — kalau tidak, MITM di jalur kredensial. |

### 2b. Kontrol wajib

1. **Pin backend per-app**: satu `(scheme, host, port, basePath)` dari DB; path request pengguna diselesaikan RELATIF terhadap basePath; tolak target absolut/`//host`; redirect upstream diikuti hanya selama host tetap dalam pin (atau dipetakan ke path proxy).
2. **Sanitasi header dua arah**: buang daftar deny inbound (`x-remote-*`, `x-forwarded-*`, `authorization`, `cookie` milik portal, hop-by-hop) SEBELUM injeksi; injeksi identitas hanya dari sisi portal (`X-Remote-User = cred.username` / identitas portal), idealnya ditandatangani HMAC dengan secret per-app bila backend mendukung. Validasi charset semua nama/nilai header yang diteruskan (tolak CR/LF/NUL).
3. **Cookie store ter-partisi**: key = `(portalSession/user, backendHost, path-prefix)`; JANGAN pakai `CookieJar` flat existing untuk proxy; filter keluar cookie bernama `portal-auth*`; re-scope `Set-Cookie` upstream ke path proxy portal (Domain dihapus/di-set ke host portal), pertahankan `HttpOnly`+`Secure`, `SameSite=Lax`.
4. **Batas resource**: ukuran body maksimum (reuse pola MAX_BYTES), timeout per request, batas hop, rate-limit **per pengguna** (middleware existing menggrup semua `/api/sso` dalam satu bucket 300/menit/IP — untuk proxy yang me-relay trafik app penuh, itu terlalu longgar; lihat §4.5).
5. **TLS**: `rejectUnauthorized:false` hanya bila flag eksplisit per-app (mis. `allowInsecureTls Boolean @default(false)`), tidak pernah default.
6. **Audit**: baris `SSO_LAUNCH` saat sesi proxy dibuka + `outcome:FAILURE` tiap penolakan (pin violation, header spoof terdeteksi, cookie portal terfilter) — metadata `ssoMode:"PROXY"`; tanpa isi body/header sensitif.

### 2c. Acceptance Security Checks

1. `curl -H "X-Remote-User: admin"` ke endpoint proxy → header DIBUANG; backend menerima hanya nilai injeksi portal (verifikasi via echo backend / log).
2. Permintaan dengan path absolut/`../` yang mencoba keluar basePath/backend → 403/400, nol request keluar ke host lain (network log bersih).
3. Cookie `portal-auth` TIDAK PERNAH muncul di request ke backend (assertion di fetch layer uji).
4. Dua backend berbeda dalam satu sesi pengguna tidak saling menukar cookie (jar ter-partisi; unit test dua host).
5. `Set-Cookie` upstream berisi `\r\n` atau nama kosong → ditolak, respons 502 bersih, tanpa header injection.
6. Upstream redirect ke host luar pin → diblokir + audit FAILURE.
7. Pengguna tanpa `canAccessPortalAppBySlug` → 403 sebelum satu byte pun diforward.

---

## 3. Mode TOKEN — OIDC/OAuth2

Semantik kerja (usulan): portal bertindak sebagai klien OIDC/OAuth2 (authorization-code flow)
terhadap IdP/aplikasi target, lalu menyerahkan hasilnya (redirect dengan cookie sesi app atau
token exchange sesuai dukungan aplikasi).

### 3a. Vektor serangan

| # | Vektor | Severity | Penjelasan konkret |
|---|--------|----------|--------------------|
| T-1 | `state` hilang / dipakai ulang | High | Tanpa `state` satu-pakai terikat sesi browser: CSRF login — penyerang menempel kode milik akunnya ke browser korban → korban masuk sebagai akun penyerang (login CSRF / session swapping). |
| T-2 | `nonce` hilang | High | id_token di-reply ke callback lain; tanpa pencocokan nonce, token yang direkam penyerang bisa diputar ulang. |
| T-3 | Audience/issuer mismatch | Critical | Menerima token tanpa memvalidasi `iss` (harus = issuer terkonfigurasi), `aud` (= client_id portal utk app itu), `exp`, dan `azp`: token klien lain / IdP lain diterima → cross-client token substitution = akun diambil dengan token yang bukan miliknya. |
| T-4 | Kebocoran token | High | Token di query/fragment URL (masuk history, Referer, access-log), di `localStorage`, atau — paling relevan repo — di metadata AuditLog. Redaksi otomatis `logAudit` ada, tapi JANGAN diandalkan untuk menyimpan token. |
| T-5 | Replay kode otorisasi | Medium | Kode dipakai dua kali (retry logic portal bisa men-mask kegagalan); kode harus single-use dan kegagalan exchange tidak boleh diam-diam mengulang dengan kode lama. |
| T-6 | Token at-rest jangka panjang | Medium | Access/refresh token disimpan tanpa enkripsi/TTL → dump DB = bearer token curian. Reuse pola `portal-crypto` (AES-256-GCM) + TTL + rotasi. |
| T-7 | IdP/AS jahat lewat konfigurasi | Medium | `issuer`/`jwksUri` dikonfigurasi admin — JWKS harus diambil HANYA dari issuer terkonfigurasi (tidak menerima `jwks_uri` arbitrer dari respons), kalau tidak konfigurasi salah/jahat = validasi tanda tangan mati. |

### 3b. Kontrol wajib

1. **Flow**: authorization-code **dengan PKCE** (walaupun klien konfiden), `response_type=code` saja; redirect_uri fix per registrasi app (tanpa wildcard).
2. **`state`**: acak ≥128-bit CSPRNG (`crypto.randomBytes`), disimpan di cookie portal httpOnly `SameSite=Lax` ber-TTL pendek (<10 menit) terikat sesi, dibandingkan constant-time, **single-use** (hapus saat dipakai).
3. **`nonce`**: sama polanya dengan state; wajib cocok dengan klaim `nonce` id_token.
4. **Validasi token**: `iss` == konfigurasi, `aud` == client_id (dan `azp` bila ada), `exp` dengan skew ≤60 detik, signature diverifikasi via JWKS dari issuer terkonfigurasi (cache + rotasi berkala). Gagal validasi apa pun → tolak + audit FAILURE dengan ALASAN (bukan isi token).
5. **Penyimpanan token**: bila portal perlu menyimpan access/refresh token → enkripsi via `encryptCredential` (AES-256-GCM existing) + kolom expiresAt + hapus/rotasi saat launch baru; dilarang menaruh token di URL, log aplikasi, atau metadata audit.
6. **Cookie & audit**: pola sama dengan §1b.4; `metadata.ssoMode:"TOKEN"`, alasan kegagalan spesifik (`state_mismatch`, `aud_mismatch`, `expired_token`) untuk forensik tanpa membocorkan nilai.
7. **Revokasi**: saat logout/revoked session portal, revoke token di IdP bila endpoint revocation tersedia (best-effort, gagal dicatat sebagai warning audit).

### 3c. Acceptance Security Checks

1. Callback tanpa cookie `state`, dengan `state` kedaluwarsa, atau dengan `state` yang sudah dipakai → 403/banner error, TIDAK ada redirect ke IdP, TIDAK ada exchange kode.
2. id_token dengan `aud` salah / `iss` salah / `exp` lewat → ditolak; AuditLog FAILURE berisi alasan spesifik dan NOL karakter token.
3. Grep seluruh pipeline (log + tabel audit + URL): token/id_token/code tidak pernah muncul.
4. Kode otorisasi yang sama dikirim dua kali ke endpoint callback → yang kedua ditolak (tidak ada silent retry).
5. `state` dan `nonce` dihasilkan per-launch, ≥128-bit entropi, dan tidak dapat diprediksi dari dua launch berurutan (unit test keunikan).
6. Pengguna tanpa akses app → 403 sebelum flow OIDC dimulai.

---

## 4. Kontrol lintas-mode (berlaku untuk ketiganya)

1. **Validator URL pusat** (§1b.1) — satu implementasi, dipakai schema + semua mode; ini prasyarat nomor satu.
2. **Cookie re-issue**: `HttpOnly; SameSite=Lax; Path=/; Domain=<hasil sharedCookieDomain()>; Max-Age≤28800; Secure` saat https — persis pola reroute/post hari ini. Tambahan: **validasi `PORTAL_SSO_COOKIE_DOMAIN`** — `sharedCookieDomain()` (portal-sso-relay.ts:294-315) memakai env override apa adanya tanpa cek bahwa nilai itu memang suffix bersama portal & app; nilai salah (mis. `.com`) menyebarkan cookie sesi app ke seluruh domain luas. Wajib: override hanya diterima bila merupakan suffix bersama kedua host.
3. **Audit**: field wajib persis pola existing — `category:"SECURITY"`, `action:"SSO_LAUNCH"`, `entityType:"PORTAL_APP"`, `entityId`, **`appId`** (KPI), `outcome`, `errorMessage` human-readable tanpa rahasia, `metadata.{appSlug, appName, ssoMode}`. Non-blocking `.catch(() => {})`. Jangan menulis langsung ke tabel.
4. **Error handling**: pesan generik di 500 (pola post/route.ts:227). Anti-pattern yang TIDAK boleh disalin: `details: err.message` di reroute/route.ts:204 (kebocoran internal — catatan perbaikan terpisah, bukan scope task ini).
5. **Rate limit per pengguna**: middleware menghitung `${ip}:${segmen}` — semua `/api/sso/*` berbagi bucket 300/menit per IP. Endpoint yang meneruskan kredensial / membuka sesi proxy / memulai flow OIDC butuh limit per-user lebih ketat; tiru pola `checkVerifyLimit` (verify-login) — map in-memory per userId + window.
6. **Prinsip least-data**: kredensial didekripsi hanya di titik pakai; jangan menaruh password di props komponen lebih dari yang sudah terjadi (FORM menanamnya di hidden input — pola existing, di luar scope, tapi mode BARU tidak boleh menambah titik paparan baru).

---

## 5. Ringkasan risiko & keputusan

| Mode | Risiko tertinggi | Keputusan gate |
|------|------------------|----------------|
| REDIRECT | Open redirect + allowlist bypass (R-1/R-2) | **APPROVED WITH RISK** bila validator URL pusat + larangan tujuan-dari-query masuk desain; tanpa itu BLOCKED |
| PROXY | Header spoof identitas + cookie confusion (P-2/P-3) | **BLOCKED sampai desain menyatakan**: sanitasi header dua arah, pin backend, cookie store ter-partisi, sikap resmi thd HTML rewriting |
| TOKEN | state/nonce + audience validation (T-1..T-3) | **APPROVED WITH RISK** bila checklist §3b (PKCE, state, nonce, iss/aud/exp/JWKS) masuk desain; library OIDC standar (mis. openid-client) lebih aman daripada implementasi manual |

Risiko residual eksplisit: (a) lingkungan intranet memang mengizinkan host privat — blocklist global tidak akan pernah lengkap; pengaman yang realistis adalah pin host per-app, bukan blacklist. (b) `verify-login` dan `detect-fields` tetap permukaan SSRF pra-existing milik admin — di luar scope task ini, dicatat agar tidak hilang.

---

## 6. Catatan untuk Desain (Arak Bali — god yang meneruskan)

Temuan berikut memengaruhi desain tapi bukan keputusan saya; mohon diteruskan:

1. **Zod `url`/`loginUrl` menerima skema apa pun** (`javascript:`, `data:` lolos `z.string().url()`). Validator pusat §4.1 sebaiknya dipakai juga di `PortalAppCreateSchema`.
2. **`fetchLoginPage` tidak re-check blocklist per hop** — hop diikuti mentah; penting untuk REDIRECT & POST existing.
3. **`CookieJar` flat (key nama saja)** — cookie lintas host dalam satu rantai saling bocor; memengaruhi POST existing sebelum PROXY dibangun.
4. **REROUTE redirect destination dari respons Oracle tidak divalidasi** — kelas open-redirect yang sama dgn REDIRECT; pertimbangkan retrofit validator pusat.
5. **`sharedCookieDomain()` memercayai `PORTAL_SSO_COOKIE_DOMAIN` tanpa validasi suffix** — sarankan validasi.
6. **`refreshVolatileFields` mem-fetch server-side di SETIAP launch FORM oleh pengguna portal mana pun** — artinya SSRF-via-konfigurasi bukan cuma urusan admin; pin host per-app menutupnya.
7. **Bucket rate-limit `/api/sso` digabung semua mode** (300/menit/IP) — pisahkan per mode/per-user untuk mode baru.
8. Saran teknologi: untuk TOKEN, pakai library OIDC teruji (mis. `openid-client`) alih-alih implementasi manual — menghilangkan mayoritas vektor T-1..T-3 secara gratis. Untuk PROXY, pertimbangkan apakah kebutuhan bisnisnya benar-benar butuh proxy penuh atau cukup header-injection gateway di depan app target (menghilangkan P-1..P-5 dari portal).
