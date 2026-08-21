---
name: portal-sso-detection-ladder
description: Deteksi login berlapis (HTTP → browser → uji login) yang membuktikan konfigurasi SSO benar, menyimpan buktinya, dan menangkap kegagalan senyap
---

# Portal SSO: Deteksi Berlapis & Verifikasi

## Ringkasan

Deteksi login saat ini menebak sekali dari HTML statis, lalu membuang semua yang
dipelajarinya. Akibatnya empat masalah yang dilaporkan pengguna:

1. Deteksi meleset pada aplikasi tertentu, harus dibetulkan manual berulang.
2. SSO gagal diam-diam saat dipakai user; admin tidak tahu penyebabnya.
3. Aplikasi yang form login-nya dirakit JavaScript selalu jatuh ke `VAULT`.
4. Admin menebak-nebak saat setup aplikasi baru; salah baru ketahuan setelah user komplain.

Keempatnya berakar pada satu hal yang sama: **deteksi tidak pernah membuktikan
tebakannya benar, dan tidak pernah mengingat apa pun.**

Spec ini mengubah deteksi menjadi berlapis dan **membuktikan dirinya sendiri**:
HTTP → browser headless → uji login sungguhan. Hasilnya disimpan sebagai bukti,
sehingga portal bisa memberi tahu admin ketika aplikasi berubah — sebelum user mengeluh.

## Hubungan dengan Spec Sebelumnya

Menggantikan dua keputusan YAGNI di
`2026-08-12-portal-app-login-field-detection.md`:

| Keputusan lama | Sekarang | Alasan berubah |
|---|---|---|
| "Menyimpan hasil deteksi ke DB (kerja sekali-pakai)" | Disimpan | Tanpa disimpan, kegagalan senyap tidak mungkin dideteksi. Ini penyebab keluhan #2. |
| "Dukungan aplikasi yang di-render JS penuh" — tidak dibuat | Dibuat, lewat container terpisah | Terbukti nyata di lapangan (keluhan #3); tanpa ini SPA permanen mentok di `VAULT`. |

Keputusan lama lain tetap berlaku: SSRF harden, batas ukuran respons, admin-only.

## Konteks yang Ada

Sudah terbangun dan terverifikasi (commit `7fb3298`):

- `lib/portal-fetch-html.ts` — `fetchLoginPage` dengan `CookieJar` antar-hop,
  batas hop, deteksi loop; `relayRequest` (satu request, TLS longgar per-request).
- `lib/portal-login-detect.ts` — `detectLoginFields(html)`: skoring heuristik →
  `usernameField`, `passwordField`, `formAction`, `extraFields`, `confidence`, `warnings`.
- `lib/portal-sso-mode.ts` — `classifySsoMode(evidence)` → `{ mode, reason, signals, warnings }`.
  Sudah menghasilkan `signals` yang **belum pernah disimpan**.
- `lib/portal-sso-relay.ts` — `relayLogin` (ikuti rantai pasca-login, temukan handoff
  federasi), `classifyRedirect`, `sharedCookieDomain`.
- `lib/portal-health.ts` — `checkAppHealth` per app, dipicu oportunistik tiap 5 menit.
- `lib/audit.ts` — `logAudit` sudah mencatat tiap `SSO_LAUNCH` beserta `outcome`.
- `app/api/portal-apps/detect-fields/route.ts` — endpoint deteksi, mengembalikan
  `detectionSignals` ke client tetapi **tidak menyimpannya**.
- `app/admin/portal-apps/page.tsx` — tombol "Deteksi", mengisi form dari hasil.

## Bagian 1 — Lapisan Deteksi

Deteksi berhenti di lapis pertama yang berhasil.

| Lapis | Mekanisme | Sasaran |
|---|---|---|
| 1 `HTTP` | `fetchLoginPage` + `detectLoginFields` (sudah ada) | Aplikasi klasik: K2, WebForms, ASP.NET MVC |
| 2 `BROWSER` | Render di container Chromium, ambil DOM setelah JS jalan | SPA, form dirakit JS, login dalam iframe |
| 3 `VERIFY` | `relayLogin` dengan kredensial uji sekali pakai | Membuktikan mode & field benar-benar bekerja |

**Lapis 2 hanya jalan bila lapis 1 tidak menemukan `passwordField`.** Aplikasi normal
tidak membayar ongkos browser sama sekali.

**Degradasi jujur.** Bila container browser tidak tersedia, lapis 2 dilewati dan hasilnya
menyebutkan itu apa adanya ("halaman perlu JavaScript, tetapi layanan render tidak
tersedia") — bukan menyamarkannya sebagai "form tidak ditemukan".

### Lapis 2: layanan render

Chromium berjalan sebagai service Docker terpisah; portal memanggilnya lewat HTTP.
Image portal tetap ramping, dan browser yang mati tidak menjatuhkan deteksi HTTP.

- Env baru: `PORTAL_BROWSER_URL` (mis. `http://browserless:3000`). Kosong = lapis 2 mati.
- Kontrak: portal mengirim URL target, menerima **HTML hasil render** + daftar cookie.
- Timeout ketat (10 detik) dan satu percobaan; deteksi tidak boleh menggantung UI admin.
- Hasil render masuk ke `detectLoginFields` dan `classifySsoMode` yang **sama** —
  lapis 2 hanya mengganti cara memperoleh HTML, bukan cara menafsirkannya.

### Lapis 3: uji login

- Admin memasukkan sepasang kredensial uji milik aplikasi tersebut.
- Portal menjalankan alur `POST` sungguhan lewat `relayLogin`.
- **Kredensial tidak disimpan**: dipakai sekali di memori, lalu dibuang. Tidak masuk DB,
  tidak masuk log, tidak masuk audit (`logAudit` sudah meredaksi kunci sensitif).
- Hasil dipetakan ke pesan yang bisa ditindaklanjuti:

| Hasil `relayLogin` | Arti bagi admin |
|---|---|
| `ok` + `handoff` | Konfigurasi terbukti; mode `POST` benar |
| `ok` tanpa `handoff` | Login berhasil; cek apakah domain cookie memungkinkan (lihat `sharedCookieDomain`) |
| `!ok`, form login lagi | Kredensial uji salah, ATAU field username/password tertukar |
| `!ok`, tujuan `REJECTED` | Kredensial ditolak aplikasi |

## Bagian 2 — Menyimpan Hasil Deteksi

Tambahan field pada `PortalApp` (`prisma/schema.prisma`):

| Field | Tipe | Isi |
|---|---|---|
| `detectionConfidence` | `Int?` | Skor dari `detectLoginFields` (mis. 2010 untuk K2) |
| `detectionSignals` | `Json?` | `signals` dari `classifySsoMode` — bukti keputusan mode |
| `detectionLayer` | `String?` | `HTTP` \| `BROWSER` \| `MANUAL` |
| `detectedAt` | `DateTime?` | Kapan deteksi terakhir dijalankan |
| `loginVerifiedAt` | `DateTime?` | Kapan uji login terakhir **berhasil** |
| `loginVerifyError` | `String?` | Sebab kegagalan uji terakhir |
| `detectedFingerprint` | `String?` | Hash struktur form login |

### Fingerprint

Hash SHA-256 dari gabungan yang stabil-terhadap-token tapi peka-terhadap-struktur:

```
usernameField | passwordField | formAction (path saja, tanpa query) | nama-nama extraFields (urut)
```

**Nilai token sengaja dikecualikan** — nilainya berubah tiap akses (sudah terbukti:
`__RequestVerificationToken` berbeda setiap request), jadi memasukkannya membuat
fingerprint berubah terus dan tidak berguna. Query pada `formAction` juga dikecualikan
karena K2 menyisipkan timestamp `wct` dan GUID sesi di situ.

Yang tertangkap fingerprint: nama field berubah, form action pindah path, token
bertambah/hilang — yakni justru perubahan yang merusak SSO.

## Bagian 3 — Alur Admin & Kegagalan Senyap

### Setup aplikasi baru

Tombol tunggal "Deteksi" menjadi dua langkah eksplisit:

1. **Deteksi** — jalankan lapis 1, naik ke lapis 2 bila perlu. Hasilnya bukan hanya nama
   field, tetapi **kartu bukti**: mode yang disarankan, alasannya, sinyal yang dipakai,
   dan lapis mana yang berhasil.
2. **Uji Login** — opsional tetapi didorong. Admin mengisi kredensial uji; portal benar-benar
   login dan melaporkan hasilnya sesuai tabel Lapis 3.

Ini menjawab keluhan #4: admin tidak lagi menebak, karena konfigurasi dibuktikan
sebelum disimpan.

### Menangkap kegagalan senyap

Dua mekanisme, keduanya memanfaatkan yang sudah ada:

**a. Fingerprint drift.** `checkAppHealth` (sudah jalan tiap 5 menit) sekalian menghitung
ulang fingerprint. Bila berbeda dari `detectedFingerprint`:
- tulis `AuditLog` dengan `severity: WARNING`, action `APP_LOGIN_FORM_CHANGED`;
- tandai aplikasi di `/admin/portal-apps`: *"Struktur form login berubah sejak
  konfigurasi terakhir — deteksi ulang disarankan."*

Aplikasi ketahuan rusak sebelum user memakainya. Ini inti jawaban keluhan #2.

**b. Pola kegagalan SSO.** `logAudit` sudah merekam tiap `SSO_LAUNCH` dengan `outcome`.
Data ini **sudah terisi sekarang tetapi belum pernah dibaca balik**. Tambahkan panel di
`/admin/portal-apps`: aplikasi dengan kegagalan berturut-turut ≥ 3 ditandai merah,
dengan pesan kegagalan terakhir. Tidak ada mesin baru — hanya query agregat.

## Perubahan File

**Create:**
- `lib/portal-browser-render.ts` — klien layanan render: `renderLoginPage(url)` →
  `{ html, cookies } | null` (null = layanan tidak tersedia). Timeout 10s.
- `lib/portal-detect-ladder.ts` — orkestrasi lapis 1→2: `detectWithLadder(url)` →
  hasil deteksi + `detectionLayer` + verdict mode.
- `lib/portal-fingerprint.ts` — `computeLoginFingerprint(detected)` → hash.
- `app/api/portal-apps/verify-login/route.ts` — POST `{ url, ssoMode, usernameField,
  passwordField, testUsername, testPassword }` → hasil uji. Admin-only.
- `scripts/test-fingerprint.ts` — self-check: fingerprint stabil terhadap perubahan
  nilai token, berubah terhadap perubahan nama field.
- `scripts/test-detect-ladder.ts` — self-check: lapis 2 dilewati bila lapis 1 berhasil;
  degradasi jujur bila layanan render mati.
- `prisma/migrations/<ts>_add_portal_detection_evidence/migration.sql`

**Modify:**
- `prisma/schema.prisma` — tujuh field pada `PortalApp`; `version.json` `schemaVersion` naik.
- `app/api/portal-apps/detect-fields/route.ts` — pakai `detectWithLadder`, kembalikan
  `detectionLayer`.
- `app/api/portal-apps/route.ts` + `[id]/route.ts` — simpan bukti deteksi saat create/update.
- `lib/validation-schemas.ts` — skema body `verify-login`; field bukti pada skema PortalApp.
- `lib/portal-health.ts` — hitung fingerprint, bandingkan, tulis audit bila berubah.
- `app/admin/portal-apps/page.tsx` — kartu bukti, tombol "Uji Login", badge drift,
  badge pola kegagalan.
- `docker-compose.yml` — service browser + `PORTAL_BROWSER_URL`.
- `.env.example` — `PORTAL_BROWSER_URL` (opsional; kosong = lapis 2 mati).

## Keamanan

- Endpoint `verify-login` **admin-only**, mewarisi SSRF harden `fetchLoginPage`.
- Kredensial uji tidak disimpan, tidak dicatat. `logAudit` untuk uji ini merekam
  **hasil** saja (berhasil/gagal + sebab), tanpa nilai kredensial.
- Layanan render menerima URL dari admin saja; tidak boleh diekspos ke jaringan publik
  (bind ke jaringan internal compose).
- Rate limit pada `verify-login`: uji login menembak aplikasi eksternal dengan kredensial;
  batasi agar tidak bisa dipakai sebagai alat penebak password. Batas: 5 percobaan per
  admin per 10 menit.

## Batasan Jujur

- Fingerprint hanya menangkap perubahan **struktur**, bukan perubahan perilaku server
  (mis. aplikasi mulai menolak login dari luar tanpa mengubah formnya).
- Verifikasi ulang otomatis **tidak bisa benar-benar login**, karena kredensial uji tidak
  disimpan. Ia hanya membandingkan fingerprint. Bila verifikasi berkala yang sungguh-sungguh
  login diinginkan, itu menuntut penyimpanan satu akun uji terenkripsi — keputusan terpisah,
  di luar spec ini.
- Lapis 2 tidak menyelesaikan login yang menuntut interaksi manusia (CAPTCHA, OTP, MFA).
  Aplikasi seperti itu tetap `VAULT`, dan sekarang **dinyatakan alasannya**.
- Uji login memakai kredensial nyata terhadap aplikasi produksi; kegagalan berulang bisa
  memicu lockout di aplikasi target. Rate limit di atas mengurangi, tidak menghilangkan.

## Tidak Dibuat (YAGNI)

- Rekam-ulang lalu lintas login (record & replay) — permukaan risiko besar, manfaat
  sebagian besar sudah dicakup lapis 3.
- Deteksi ulang otomatis penuh tanpa persetujuan admin — drift hanya memberi tahu,
  tidak menulis ulang konfigurasi sendiri.
- Menyimpan akun uji untuk verifikasi berkala (lihat Batasan).
- Dukungan CAPTCHA/OTP/MFA.
- Panel analitik deteksi lintas-waktu; cukup status terakhir + audit.
