# Riset Komparatif Mode SSO: REDIRECT vs PROXY vs TOKEN — Level Protokol

| | |
|---|---|
| Penulis | Jhonnie Walker (R&D), TASK-12 gelombang 1 Milestone #3 |
| Tanggal | 2026-08-26 |
| Status | Selesai — input independen untuk TASK-10 (desain) & TASK-11 (threat model); dokumen **untracked**, god commit saat sign-off |
| Scope | Karakteristik protokol/pola umum, BUKAN implementasi repo. Read-only kode aplikasi |
| Sumber primer | RFC 8693 (token exchange); RFC 9700 OAuth Security BCP; OpenID `oauth-v2-form-post-response-mode-1_0`; nginx Admin Guide *Configuring Subrequest Authentication*; oauth2-proxy docs (*Behaviour*, *Integrations › Nginx*) |

Notasi: **[F]** fakta terverifikasi dari sumber primer · **[O]** observasi pola industri · **[A]** asumsi/konteks repo.

---

## 1. Pertanyaan riset

Dari tiga mekanisme aktivasi SSO (`PortalSsoMode`: REDIRECT = redirect hand-off, PROXY = reverse proxy + header injection, TOKEN = OIDC/OAuth2 token) — bagaimana cara kerja standarnya menurut spec, apa trade-off intinya, apa implikasi keamanan tingkat protokol, dan mana yang paling cocok untuk karakteristik aplikasi target di repo ini (mayoritas app legacy form-based: Oracle EBS, K2, ASP.NET — bukti: `lib/portal-sso-relay.ts`, `lib/portal-sso-mode.ts`)?

## 2. Konteks & kendala

- **[A]** Target mayoritas tidak punya endpoint federasi sendiri; deteksi repo bahkan mengklasifikasikan rantai WS-Fed/ADFS/SAML/OIDC lewat `FEDERATION_URL_RE` (`portal-sso-mode.ts:40`) — sebagian kecil target jelas federated.
- **[A]** Portal = monolit Next.js satu proses (IP internal :3100); tidak ada lapisan reverse proxy umum di depan semua app target hari ini.
- **[A]** Constraint cookie lintas host sudah diketahui: hanya domain suffix bersama yang bisa dipakai (`sharedCookieDomain()`); portal diakses via IP di non-prod.
- **[F]** Desain repo (TASK-10) telah menolak PROXY di dalam Next.js dan menjadikan TOKEN blueprint kondisional — riset ini uji independen level protokol atas dua keputusan itu.

## 3. Temuan per mekanisme

### 3.1 REDIRECT — redirect hand-off (analog: alur berbasis redirect OAuth2/CAS + Form Post Response Mode)

- **(a) Cara kerja standar [F]** Browser diarahkan (302) ke IdP/portal, autentikasi terjadi di sana, respons dikembalikan ke app lewat redirect/callback dengan parameter tiket/kode. Varian *form post*: respons dikirim sebagai HTML form auto-submit `method=POST` ke `redirect_uri` sehingga parameter tidak masuk URL/history/referrer/log; spec mewajibkan `state` divalidasi klien dan `Cache-Control: no-store` pada halaman respons.
- **(b) Trade-off inti**: kompleksitas rendah–sedang, tanpa infra baru (cukup HTTPS). Syarat mutlak: **app target harus punya titik integrasi** (endpoint validasi tiket, secret bersama, atau dukungan federasi) — redirect murni tanpa kerja sama app tidak mengautentikasi apa pun. Untuk app legacy tanpa titik itu, nilai REDIRECT ≈ nol dibanding FORM/POST existing.
- **(c) Implikasi keamanan [F]** (RFC 9700): `redirect_uri` WAJIB exact-match (prefix match dilarang — §2.1, serangan §4.1); `state` satu-pakai terikat UA untuk CSRF (§2.1); pertahanan mix-up attack WAJIB bila >1 authorization server (§4.4). Parameter tiket di URL = bocor ke history/referrer/log → gunakan pola form-post atau POST callback.
- **(d) Fit repo**: paling luas untuk app yang punya sedikit pun titik integrasi; sejalan dengan arsitektur hand-off existing (REROUTE/POST) dan constraint cookie.

### 3.2 PROXY — reverse proxy + header injection (pola: nginx `auth_request` + oauth2-proxy/authelia)

- **(a) Cara kerja standar [F]** Proxy memvalidasi tiap request lewat *subrequest* ke endpoint auth (oracle boolean: 2xx boleh, 401/403 tolak; body request dibuang dari subrequest; lokasi auth ditandai `internal`). Identitas terverifikasi disuntik sebagai header ke upstream via `auth_request_set` → `proxy_set_header` (mis. `X-User`/`X-Forwarded-User` dari `$upstream_http_x_auth_request_user` saat `--set-xauthrequest`).
- **(b) Trade-off inti**: UX terbaik bagi app (tanpa ubah app), tapi biaya infra tertinggi: butuh lapisan proxy riil di depan SETIAP app + isolasi jaringan. App legacy seperti Oracle EBS tidak otomatis percaya header eksternal — butuh konfigurasi produk tambahan (SSO/OAM dsb.) [O].
- **(c) Implikasi keamanan**: model keamanannya **runtuh total** bila upstream bisa dijangkau langsung — siapa pun yang lolos ke port app bisa memalsukan `X-Forwarded-User`. Dokumentasi resmi tidak menyatakan ini eksplisit, tapi mengikut secara struktural dari pola header-trust [F+O]. Wajib: strip header identitas dari klien sebelum injeksi, deny-by-default akses langsung upstream. Ini konsisten dengan risiko spoofing di threat model TASK-11 (R-2 allowlist bypass).
- **(d) Fit repo**: RENDAH saat ini — menuntut re-arsitektur jaringan (semua app target hanya reachable via proxy) yang di luar kendali portal Next.js; desain repo sudah tepat menolak PROXY-in-process (Next.js bukan full proxy; streaming/websocket/upload passthrough jadi permukaan bug baru) [A+F].

### 3.3 TOKEN — token exchange / federasi OIDC-OAuth2 (analog: authorization code flow + RFC 8693)

- **(a) Cara kerja standar [F]** App target bertindak klien OIDC: redirect ke authorize → kode → tukar token (confidential client) → validasi ID token. RFC 8693 menambah grant `token-exchange`: portal menukar `subject_token` menjadi token utk `audience` tertentu, mendukung delegasi (`act` claim; A bertindak untuk B) vs impersonasi (A = B dalam batas scope/waktu).
- **(b) Trade-off inti**: kompleksitas tertinggi; syarat mutlak **app target OIDC-aware** (atau penerima bearer token). Bagi app legacy non-federasi: tidak dapat dipakai sama sekali. Nilainya tinggi justru untuk minoritas target yang terdeteksi federated (rantai WS-Fed/ADFS/OIDC di evidence deteksi).
- **(c) Implikasi keamanan [F]** (RFC 9700 + RFC 8693): PKCE direkomendasikan juga utk confidential client, WAJIB utk public (§2.1.1); access token idealnya *sender-constrained* (mTLS/DPoP) atau berumur pendek + *audience-restricted* (§4.10); client authentication pada token endpoint krusial — tanpa itu "token sekali bocor bisa ditukar jadi token lain oleh siapa saja" (RFC 8693 §2.1). Model kriptografis terkuat dari ketiganya.
- **(d) Fit repo**: cocok persis untuk subset app federasi; untuk mayoritas legacy = bukan opsi. Menempatkannya sebagai blueprint kondisional (keputusan TASK-10) selaras temuan ini.

## 4. Tabel trade-off

| Kriteria | REDIRECT | PROXY | TOKEN |
|---|---|---|---|
| Kompatibilitas app legacy tanpa integrasi | Rendah–sedang (butuh titik integrasi) | Sedang (butuh percaya header — jarang bawaan) | Sangat rendah (wajib OIDC-aware) |
| Kompatibilitas app federasi | Tinggi | Sedang | **Tinggi** |
| Kompleksitas implementasi | Sedang | Tinggi (per-app infra) | Tinggi (kripto + validasi) |
| Biaya operasional | Rendah | Tinggi (lapisan proxy permanen + isolasi jaringan) | Rendah–sedang |
| Permukaan keamanan baru | Redirect validation, tiket di URL | Spoofing header bila upstream bocor langsung — fatal | Key management, mix-up, replay token |
| Keandalan terhadap app yang tak bisa diubah | Bergantung app | Terbaik (app tak disentuh) | Tidak ada |
| Vendor lock-in | Rendah | Ikut produk proxy | Rendah (standar terbuka) |

## 5. Rekomendasi fit (level protokol)

1. **REDIRECT duluan** — nilai/biaya terbaik untuk repo: tanpa infra baru, aman bila disiplin RFC 9700 (exact `redirect_uri`, `state`, tiket satu-pakai pendek, respons via POST bukan GET-query). Prioritas implementasi gelombang 2. **[rekomendasi]**
2. **TOKEN tetap blueprint** — satu-satunya jalur benar untuk app federasi; aktifkan hanya saat ada target nyata yang OIDC-aware, dengan client auth + audience restriction + token pendek sebagai syarat minimum. **[rekomendasi]**
3. **PROXY jangan di dalam Next.js** — keputusan TASK-10 terkonfirmasi level protokol: pola ini sah secara industri tapi prasyaratnya (proxy riil + isolasi jaringan total upstream) adalah keputusan infrastruktur, bukan fitur CMS. Dokumentasikan sebagai pola ops (nginx + oauth2-proxy) bila suatu hari ada app yang tak bisa diubah sama sekali. **[rekomendasi]**
4. Mayoritas target legacy tetap dilayani mode existing FORM/POST/REROUTE — ketiga mode baru adalah pelengkap spektrum, bukan pengganti. **[kesimpulan]**

## 6. Risiko & keterbatasan riset

- Uji coba/PoC tidak dijalankan (riset kepustakaan); semua klaim performa/perilaku runtime di luar cakupan.
- Dua fetch sumber gagal saat riset (openid.net core spec timeout; sebagian halaman oauth2-proxy 404) — digantikan sumber setara resmi (RFC, admin guide nginx, docs oauth2-proxy yang hidup). Klaim CAS tidak dirujuk spesifik karena tak sempat diverifikasi ke sumber primernya — diperlakukan sebagai observasi.
- Kesesuaian akhir tetap bergantung inventaris riil app target per-site (data produksi belum diaudit dalam riset ini) **[A]**.

## 7. Handoff

- Untuk **TASK-10** (desain): poin §5.1–5.2; pastikan mekanisme tiket REDIRECT memakai POST-callback/form-post, bukan parameter query.
- Untuk **TASK-11** (threat model): §3.2(c) — prasyarat isolasi upstream utk PROXY; §3.1(c)/§3.3(c) — daftar kontrol wajib REDIRECT/TOKEN yang memperluas R-1/R-2 yang sudah dicatat.
- Untuk **gelombang 2**: jadikan checklist RFC 9700 (exact redirect_uri, state, PKCE bila alur kode) sebagai acceptance criteria implikasi.
