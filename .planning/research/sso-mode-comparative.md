# Riset Komparatif Protokol: REDIRECT vs PROXY vs TOKEN (TASK-12, Milestone #3 Gelombang 1)

Tanggal: 2026-08-26 · Agent: jhonnie-walker-mt9o7hpl (R&D) · Sifat: **input independen** bagi
TASK-10 (desain arsitektur, Arak Bali) dan TASK-11 (threat model, Tuak) — level **protokol**,
bukan implementasi repo. Dokumen untracked; god commit saat sign-off.

## 1. Pertanyaan Riset

> Dari tiga mekanisme yang akan diaktifkan — redirect form-post, reverse-proxy header injection,
> token exchange (OIDC/OAuth2) — mana yang paling cocok untuk karakteristik aplikasi target
> portal ini, dan apa implikasi keamanan tiap mekanisme pada tingkat protokol?

## 2. Konteks & Batasan (fakta terverifikasi dari repo)

- Enum `PortalSsoMode` (7 nilai): mode berjalan hari ini = **FORM / POST / REROUTE / VAULT**
  (`lib/portal-sso-mode.ts`, `app/api/sso/{reroute,post}/route.ts`). REDIRECT/PROXY/TOKEN masih
  halaman "Belum Aktif" sejak commit `32c266c`.
- Mayoritas target = **aplikasi legacy form-based on-premise**: Oracle EBS (REROUTE khusus pola
  XHR `AuthenticateUser`), ASP.NET WebForms/MVC (antiforgery terikat cookie → POST), K2, SPA JS.
  Bukti klasifikasi: `lib/portal-detect-ladder.ts` + `classifySsoMode`.
- **Kendala domain terverifikasi produksi** (memory + `Laporan Investigasi Kendala SSO Oracle.md`):
  portal diakses via IP `192.168.2.3:3100`; browser membuang `Set-Cookie Domain=.santos.co.id`
  dari host non-subdomain (RFC 6265 §5.1.2 + same-origin). Reverse proxy OAF/OAM sudah terbukti
  jalan buntu (MAC rusak). Solusi permanen = DNS shared (`portal.santos.co.id`) +
  `sharedCookieDomain()` (`lib/portal-sso-relay.ts`). Ini menghampari SEMUA mekanisme yang
  menyerahkan sesi via cookie domain ketiga.
- Aturan milestone: file beku OPD-1 zero-diff; tanpa migration baru kecuali terpaksa.

## 3. Cara Kerja Standar per Mekanisme (sumber primer)

### A. REDIRECT (redirect form-post)
Pola umum: portal mengarahkan browser ke endpoint SSO aplikasi target sambil membawa bukti
identitas (biasanya satu kali / berumur sangat pendek) melalui POST body atau parameter query;
target menukar bukti itu menjadi sesi lokalnya sendiri. Ini varian dari keluarga "extension
grant" RFC 6749 §4.5 — pertukaran bukti antar-server dengan HTTP POST — dan mewarisi aturan
mainnya: bukti HARUS berumur pendek, sekali pakai, dan ditukar langsung oleh penerima.
Kerabat spesifikasinya: WS-Federation wsignin1.0 dan SAML HTTP-POST binding (sudah dikenali
`FEDERATION_URL_RE` di kode deteksi). Bedanya dengan SAML/OIDC asli: tidak ada signature
kriptografis atas bukti tersebut kecuali kita menambahkannya sendiri.

### B. PROXY (reverse proxy + header injection)
Pola standar oauth2-proxy/nginx `auth_request`/Authelia: proxy mengautentikasi user SEKALI
(session milik proxy), lalu setiap request ke upstream disuntik identitas via header —
`X-Forwarded-User`/`X-Forwarded-Email` (oauth2-proxy `--pass-user-headers`) atau
`Remote-User`/`Remote-Groups`/`Remote-Email` (konvensi Authelia), atau mapping bebas via nginx
`auth_request_set $upstream_http_*` → `proxy_set_header X-UserId ...`. Upstream dipercaya
buta terhadap header itu. Syarat keamanannya eksplisit di dokumen oauth2-proxy:
upstream TIDAK BOLEH terjangkau langsung oleh klien (hanya lewat proxy), `--skip-auth-strip-headers`
(default true) harus aktif agar klien tak bisa menyelundupkan `X-Forwarded-*`, dan
`--trusted-proxy-ip` dibatasi. Dengan kata lain: keamanan mode ini = keamanan SEGMENTASI JARINGAN.

### C. TOKEN (OIDC/OAuth2 token exchange)
Standar: RFC 8693 — client POST ke token endpoint dengan
`grant_type=urn:ietf:params:oauth:grant-type:token-exchange` + `subject_token` (+ type), opsional
`actor_token`, `audience`/`resource`/`scope`. Respons = token baru (`issued_token_type`,
`expires_in`). Semantik resmi: **impersonasi** (A menjadi B, tak terbedakan) vs **delegasi**
(token komposit `act` claim). Syarat keamanan eksplisit spec: autentikasi client WAJIB — tanpa
itu "compromised token bisa ditukar STS menjadi token lain oleh siapa pun"; token hanya lewat
TLS; scope dibatasi; umur pendek. Prasyarat mutlak: **aplikasi target harus mengerti OAuth2/OIDC**.

## 4. Trade-off Inti & Kompatibilitas Target Legacy

| Kriteria | REDIRECT | PROXY | TOKEN |
|---|---|---|---|
| Kompleksitas implementasi | Sedang — endpoint penerbit bukti + endpoint penukar di sisi target (atau shim) | Tinggi — proxy per-app/per-path, rewrite URL absolut, WebSocket, TLS passthrough vs terminate | Sedang-tinggi di sisi portal, NOL di target jika target sudah OIDC |
| Kebutuhan infra | Hampir nol | **Perlu kontrol routing + segmentasi jaringan** (wajib, bukan opsional) | Hampir nol di infra; perlu IdP/token service |
| Kompatibilitas app legacy form-based | Sedang — butuh modifikasi/shim di target | Rendah-sedang — app tidak sadar SSO, tapi rentan rusak (preseden: OAF MAC rusak saat di-proksi; app JS/XHR yang hardcode path absolut sering rusak) | **Nol** — app legacy tidak mengerti token |
| Perubahan di target app | Ya (endpoint penukar) | Tidak (di luar jaringan) | Ya, besar (adopsi OIDC) |
| Jejak audit | Jelas (bukti sekali pakai per launch) | Tersekat antara proxy dan app | Paling kuat (token bertanda tangan, `act` delegation chain) |

## 5. Implikasi Keamanan Tingkat Protokol

| Vektor | REDIRECT | PROXY | TOKEN |
|---|---|---|---|
| Pencurian bukti/kredensial | Bukti sekali pakai bocor via referrer/log/history bila lewat GET — wajib POST + TTL pendek + one-time | Identitas hanya header internal — tidak bocor ke klien bila strip headers aktif | Token bocor = akses penuh sampai expiry; mitigasi: TTL pendek, scope sempit, client auth |
| Spoofing identitas | Target memercayai bukti tanpa signature → wajib HMAC/signature + audience binding | Klien menyuntik `X-Forwarded-User` langsung ke upstream bila upstream terjangkau — **vektor utama** | Sulit — butuh client secret/private key; impersonasi dikontrol `may_act` |
| Replay | Wajib nonce one-time | Session proxy adalah titik replay (cookie curian = akses semua upstream) | Refresh/replay dikontrol server otorisasi |
| Blast radius salah konfigurasi | Satu aplikasi target | **Semua upstream di belakang proxy sekaligus** | Satu audience |
| Kepatuhan audit trail (repo pakai `logAudit`) | Mudah (event launch) | Harus gabung log proxy + app | Native (token log + `jti`) |

## 6. Tabel Fit terhadap Karakteristik Repo

Skor fit 1–5 (5 = paling cocok) untuk profil target mayoritas: **legacy form-based on-premise,
tanpa kemampuan dimodifikasi, portal via IP hingga DNS shared tersedia.**

| Mode | Fit teknis | Alasan singkat |
|---|---|---|
| **REDIRECT** | **4** | Paling realistis untuk legacy: pola extension-grant butuh satu endpoint penukar kecil di target (atau shim IIS/Apache), sisanya murni sisi portal. Risiko utama = desain bukti (POST, one-time, HMAC, audience). Cocok dgn pola WS-Fed/SAML yang memang sudah ada di beberapa target (terdeteksi `FEDERATION_URL_RE`). |
| **PROXY** | **2** | Secara teori "app tidak perlu diubah", tetapi dua fakta repo menentang: (1) preseden nyata OAF/EBS rusak saat di-proksi (dokumen investigasi); (2) syarat keamanannya — segmentasi jaringan ketat + DNS shared + kontrol routing — belum tersedia (portal masih via IP). Melakukan ini sebelum prasyarat = membangun vektor spoofing. |
| **TOKEN** | **1** (untuk legacy saat ini) · **5** (untuk target modern masa depan) | Secara protokol paling bersih & paling auditable, tetapi butuh target yang mengerti OIDC/OAuth2 — tidak ada satu pun target saat ini yang begitu. Rekomendasikan diimplementasikan sebagai jalur generik (mis. Keycloak sebagai broker) untuk app modern berikutnya, bukan untuk armada legacy. |

### Rekomendasi urutan aktivasi
1. **REDIRECT duluan** (nilai tertinggi / risiko infra terendah untuk armada legacy).
2. **TOKEN kedua**, difokuskan ke aplikasi modern/broker, bukan legacy.
3. **PROXY terakhir**, dan HANYA setelah dua prasyarat non-kode terpenuhi:
   (a) DNS shared domain aktif (`portal.santos.co.id`), (b) segmentasi jaringan yang menjamin
   upstream hanya terjangkau lewat proxy. Tanpa keduanya, mode ini sebaiknya tetap "Belum Aktif".

## 7. Ketidakpastian & Batasan Riset

- Penilaian fit REDIRECT=4 mengasumsikan target legacy dapat menerima endpoint penukar bukti
  kecil (shim). Untuk target yang benar-benar tak bisa disentuh, VAULT/POST (mode berjalan)
  tetap fallback-nya.
- Dokumentasi Authelia gagal dijangkau saat riset (beberapa URL 404); klaim tentang
  `Remote-*` bersumber dari pola umum forward-auth, bukan halaman resmi yang berhasil dibaca.
  Bagian PROXY bertumpu pada oauth2-proxy + nginx docs resmi yang berhasil diverifikasi.
- WebSearch di lingkungan ini mengembalikan hasil kosong; semua kutipan berasal dari
  WebFetch dokumen primer (RFC 8693, RFC 6749, oauth2-proxy config, nginx auth_request).

## 8. Sumber Primer

- RFC 8693 — OAuth 2.0 Token Exchange: https://datatracker.ietf.org/doc/html/rfc8693
- RFC 6749 — OAuth 2.0 Framework (§4.5 Extension Grants; §10 security considerations): https://datatracker.ietf.org/doc/html/rfc6749
- oauth2-proxy Configuration Overview (header injection, `--trusted-proxy-ip`, `--skip-auth-strip-headers`): https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview
- nginx ngx_http_auth_request_module (`auth_request_set`, `$upstream_http_*`): https://nginx.org/en/docs/http/ngx_http_auth_request_module.html
