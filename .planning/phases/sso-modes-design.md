# Desain Arsitektur Mode SSO REDIRECT / PROXY / TOKEN

Tanggal: 2026-08-26 · Agent: arak-bali-mt9w2be8 (Solution Architect) · Kontrak: TASK-10, milestone conv-sso-m3
Prasyarat terpenuhi: OPD-2 tuntas — enum `PortalSsoMode` final 7 nilai (`prisma/schema.prisma:373-382`), bukti `.planning/phases/opd2-audit.md`.

---

## 1. Problem Understanding

- **Objective:** tiga mode enum masih jatuh ke halaman "Belum Aktif" (`app/portal/app/[appSlug]/page.tsx:185-209`). Dokumen ini adalah usulan keputusan produk yang ditunda sejak ROADMAP OPD-2: perilaku per mode, kebutuhan data, potongan MVP, dekomposisi tugas, dan risiko.
- **Constraints:** tanpa migration baru dan tanpa perubahan enum; file beku OPD-1 zero-diff (`lib/portal-access.ts`, `lib/portal-layout.ts`, `lib/portal-auth.ts`, `lib/auth.ts`, `middleware.ts`); tanpa dependency baru.
- **Fakta terverifikasi:** `PortalApp` TIDAK punya kolom `metadata` — permukaan konfigurasi yang ada: `url`, `loginUrl`, `httpMethod`, `usernameField`, `passwordField`, `extraFields Json?` (`prisma/schema.prisma:609-625`). Paket `jose` tidak terinstal (`package.json`) — penandatanganan token memakai `node:crypto` stdlib.
- **Asumsi:** tidak ada aplikasi konsumen TOKEN yang disebutkan eksplisit sampai hari ini; portofolio aplikasi nyata = Oracle EBS (REROUTE), K2 WS-Federation (POST), form ASP.NET biasa (FORM).

### Keputusan sentral: dua kelas mode

Pembagian ini adalah fondasi seluruh desain — ia menentukan bentuk dispatcher, bukan sekadar daftar fitur:

| Kelas | Mode | Butuh kredensial? | Pola serah-terima |
|---|---|---|---|
| **Credential-forwarding** | FORM, REROUTE, POST, VAULT | Ya | Sudah berjalan hari ini |
| **Credential-less handoff** | REDIRECT, TOKEN | **Tidak** | Identitas portal → browser/aplikasi |
| **Ditolak di monolit** | PROXY | — | Lihat §4 |

Konsekuensi langsung: alur peluncuran saat ini menuntut kredensial SEBELUM dispatch (`page.tsx` langkah 4-8: `NoCredential` → `AccountSelector` → decrypt → audit). Untuk kelas credential-less, pemeriksaan itu harus dilewati — **dispatch mode naik ke atas langkah 4**. Ini satu refactor kecil di satu file, bukan per-mode.

---

## 2. Mode REDIRECT — hand-off langsung tanpa kredensial

### Kontrak perilaku

Portal memverifikasi sesi portal + hak akses, menulis audit, lalu 302 browser ke `app.loginUrl || app.url`. Target diautentikasi oleh mekanismenya sendiri: Windows Integrated Auth/Kerberos, whitelist IP portal/perusahaan, atau SSO di belakang IdP korporat. Kasus nyata: aplikasi intranet yang "begitu dibuka sudah masuk".

**Varian yang DITOLAK:** menyisipkan kredensial sebagai query param (`?user=..&pass=..`). Kredensial mendarat di history browser, access log aplikasi, dan header Referer — melanggar batas keamanan yang sama dengan prinsip redaksi `logAudit`. Jika suatu aplikasi hanya bisa menerima kredensial lewat parameter, mode yang tepat adalah FORM/POST/REROUTE, bukan REDIRECT.

### Perubahan kode

| File | Baru/ubah | Isi |
|---|---|---|
| `app/api/sso/redirect/route.ts` | **baru** | POST form (`appSlug`) — pola kontrak identik `reroute/post`: guard `ssoMode !== "REDIRECT"` → 404, `canAccessPortalAppBySlug` → 403, `logAudit SSO_LAUNCH`, lalu 302 ke tujuan. Tujuan HANYA dari config admin (bukan input user) → tidak ada open-redirect; tidak ada fetch server → tidak ada permukaan SSRF. |
| `components/portal/SSORedirectHandoff.tsx` | **baru** | Interstitial singkat "Mengalihkan ke {app}" + fallback link manual (UX konsisten dgn SSORerouteSubmit), auto-submit form ke `/api/sso/redirect`. |
| `app/portal/app/[appSlug]/page.tsx` | ubah | Branch "Belum Aktif" baris 185-209: REDIRECT/TOKEN keluar dari daftar itu; dispatch mode dinaikkan sebelum resolusi kredensian (§1). PROXY tetap halaman status. |

### Data/config

Tidak ada kolom baru. Semantik kolom existing: `loginUrl` = titik masuk autentikasi aplikasi (boleh = `url`). Tidak menyentuh `extraFields`.

---

## 3. Mode TOKEN — JWT handoff (blueprint, aktivasi kondisional)

### Kontrak perilaku

Portal menerbitkan JWT HS256 berumur pendek yang menegaskan identitas pengguna portal, lalu menyerahkannya ke endpoint konsumen milik aplikasi. **Validasi token adalah tanggung jawab aplikasi konsumen** — portal menyediakan kontrak klaim + kunci, bukan mengelola sesi aplikasi.

```
Browser → POST /api/sso/token (form: appSlug)
          ├─ guard ssoMode==="TOKEN", canAccessPortalAppBySlug, logAudit
          └─ terbitkan JWT (node:crypto createHmac, HS256):
             iss="portal-sja", aud=origin(app.url), sub=portalUser.id,
             nik=<NIK HRIS>, exp=iat+120, iat
          ← HTML auto-POST form (action=app.loginUrl, field: sso_token=<jwt>)
             — pola identik autoPostHandoffPage() di app/api/sso/post/route.ts:28-46
Aplikasi → validasi signature + aud + exp (+ toleransi clock ±30 dtk) → sesi lokal sendiri
```

**Keputusan kunci:**

1. **Kunci = HKDF dari `PORTAL_CREDENTIAL_KEY`**, bukan env baru. `crypto.hkdfSync("sha256", key, salt("portal-sso-token"), info, 32)` memberi pemisahan domain kriptografis tanpa menambah env wajib (mengikuti pola fail-closed `PORTAL_CREDENTIAL_KEY`). Upgrade path: env khusus `PORTAL_SSO_TOKEN_KEY` jika konsumen butuh rotasi independen — cukup ganti satu baris derivasi.
2. **Pengiriman via auto-POST form, bukan query param.** Token di query bocor ke history/log/Referer — alasan sama dengan penolakan varian REDIRECT §2.
3. **Tanpa dependency baru.** `jose` tidak terinstal dan tidak perlu: HS256 + base64url ≈ 20 baris stdlib. RS256/JWKS hanya relevan bila konsumen menuntut verifikasi public-key — tunda sampai ada konsumen nyata (lihat Open Questions).
4. **Kredensial tak dipakai** → ikut kelas credential-less §1; `sub` = identitas portal, bukan akun aplikasi. Pemetaan banyak akun aplikasi per user = ditunda.

### Perubahan kode (saat diaktifkan)

| File | Baru/ubah | Isi |
|---|---|---|
| `lib/portal-sso-token.ts` | **baru** | `deriveTokenKey()` (HKDF), `issueSsoToken()` (header/payload/signature base64url), konstanta TTL. Murni fungsi — mudah diuji tanpa HTTP. |
| `app/api/sso/token/route.ts` | **baru** | Kontrak sama dengan §2; guard `ssoMode !== "TOKEN"`; render halaman auto-POST. |
| `components/portal/SSOTokenSubmit.tsx` | **baru** | Interstitial, pola SSOPostSubmit. |
| `app/portal/app/[appSlug]/page.tsx` | ubah | Ditangani gelombang yang sama dengan REDIRECT (satu refactor dispatcher untuk dua mode). |

Data: `loginUrl` = endpoint penerima token konsumen; `aud` diturunkan dari `app.url` — tidak ada kolom baru. Single-use/replay-cache (jti) = **ditunda**; deploy saat ini satu instans, TTL 120 dtk memadai sebagai kontrol awal.

---

## 4. Mode PROXY — DITOLAK untuk implementasi di dalam Next.js

Bukan "belum sempat" — **sudah dicoba dan digugurkan dengan bukti**: route `app/portal/proxy/[appSlug]/[[...path]]/route.ts` dihapus di `c6afaf1` setelah rentetan `4655d11`, `60e293e`, `ca10809` gagal menambalnya. Kegagalannya struktural, bukan bug:

1. **OOM/502** — buffering `arrayBuffer()` atas payload Oracle besar di dalam proses Next.js.
2. **OAF MAC breakage** — penulisan ulang URL merusak tanda tangan internal Oracle.
3. **Racun TLS global** — kode lama menyetel `NODE_TLS_REJECT_UNAUTHORIZED=0` pada level proses (melumpuhkan verifikasi TLS koneksi DB/SMTP juga). Pelajaran ini sudah dikodifikasi di `relayRequest()` (`lib/portal-fetch-html.ts:315-393`): longgarkan TLS per-request saja.
4. **Rewriting HTML/JS tanpa ujung** — setiap absolutisasi path/redirect/XHR baru adalah kebocoran baru.

Kebutuhan aslinya (header-injection SSO) kini terlayani lebih aman oleh REROUTE direct-redirect + re-issue cookie domain-bagi (`sharedCookieDomain`, `PORTAL_SSO_COOKIE_DOMAIN`). **Jika suatu hari ada aplikasi yang benar-benar butuh reverse proxy**, jawabannya adalah infrastruktur terpisah (nginx/Traefik/oauth2-proxy dengan forwardAuth), bukan route handler monolit — keputusan DevOps, di luar scope portal. PROXY tetap di enum & dropdown admin; halaman launch mempertahankan status "Belum Aktif" dengan copy yang dirapikan agar admin diarahkan ke mode alternatif.

---

## 5. Rekomendasi MVP cut

| Mode | Keputusan | Alasan |
|---|---|---|
| **REDIRECT** | **Implement sekarang** (gelombang A) | Termurah (~2 file baru + 1 refactor dispatcher), nilai langsung untuk aplikasi intranet WIA/IP-trusted, nol permukaan kredensial baru. |
| **TOKEN** | Blueprint siap; **aktifkan saat ada konsumen pertama** (gelombang B kondisional) | Tanpa aplikasi konsumen, ini infrastruktur mati (ponytail #1). Seluruh desain §3 sudah final sehingga implementasi tinggal mengikuti resep. |
| **PROXY** | **Tidak dibangun** di monolit | Bukti kegagalan historis §4; jalur alternatif eksternal didokumentasikan. |

Deteksi (`classifySsoMode`, `lib/portal-sso-mode.ts`) **tidak diubah**: ia sengaja hanya merekomendasikan mode terimplementasi (keputusan OPD-2). REDIRECT/TOKEN dipilih admin manual — makanya bantuan UI di bawah wajib ikut.

---

## 6. Dekomposisi tugas siap-dispatch (lane bebas konflik)

Dispatcher `page.tsx` adalah titik gesekan satu-satunya → dimiliki SATU lane per gelombang, tidak paralel antar-lane pada file itu.

| # | Tugas | Lane | File |
|---|---|---|---|
| A1 | Refactor dispatcher: pisahkan kelas credential-less, dispatch sebelum resolusi kredensial; cabang REDIRECT | Backend (Kawa) | `app/portal/app/[appSlug]/page.tsx` |
| A2 | Route + komponen REDIRECT | Backend (Kawa) | `app/api/sso/redirect/route.ts`, `components/portal/SSORedirectHandoff.tsx` |
| A3 | Copy halaman status PROXY + helper text per-mode di form/badge portal-apps (peringatan "mode belum diuji") | UI (Hennesy) | `app/admin/portal-apps/**` — paralel aman, beda file |
| B1 | `lib/portal-sso-token.ts` + unit self-check | Backend (Oscar) | file baru saja |
| B2 | Route + komponen TOKEN + cabang dispatcher TOKEN (setelah A merge) | Backend (Oscar) | `app/api/sso/token/route.ts`, `SSOTokenSubmit.tsx`, `page.tsx` |
| QA | Gate rilis: diff review, zero-diff file beku, tsc + eslint scoped, E2E manual REDIRECT ke satu app nyata | Release (Baileys) | — |

Urutan: A1→A2→QA(parsial) berjalan bersama A3; B menunggu A merge (file dispatcher sama).

---

## 7. Risiko teknis & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Salah mode: admin memilih REDIRECT untuk app yang butuh kredensial | User mendarat di halaman login manual — "SSO rusak" persepsi | Helper text per-mode di admin (A3); interstitial REDIRECT selalu sediakan link manual; audit trail membedakan mode per launch |
| Kunci token = turunan `PORTAL_CREDENTIAL_KEY` | Kompromi kunci → identitas palsu di semua app konsumen TOKEN | TTL 120 dtk; pengiriman POST bukan query; rotasi = rotasi kunci induk (prosedur existing); upgrade path env khusus |
| Token bocor via Referer/log | Replay dalam window TTL | Auto-POST (bukan query) + `referrer-policy` global existing; dokumentasikan tuntutan HTTPS ke konsumen |
| Clock skew portal↔konsumen | Token valid ditolak | Toleransi ±30 dtk ditulis di kontrak konsumen (bagian dari deliverable B2) |
| Regresi selera membangun proxy lagi | Ulang tragedi OOM/502 | Putusan §4 direkam di dokumen ini + commit hapus `c6afaf1` sebagai rujukan; review menolak route proxy baru di monolit |
| Dispatcher refactor menyentuh alur mode existing | Regresi FORM/REROUTE/POST/VAULT | A1 murni memindah urutan pemeriksaan untuk kelas credential-less; gate E2E manual keempat mode tersebut sebelum merge |

## Open Questions (butuh input human/god — tidak memarkir kerja)

1. **Konsumen TOKEN pertama:** adakah aplikasi konkret yang akan memvalidasi JWT portal? Gelombang B menunggu jawaban ini.
2. **PII dalam klaim:** klaim `nik` (NIK HRIS) dikirim ke aplikasi konsumen — layak atau cukup `sub` + nama?
3. **PROXY eksternal:** bila suatu saat dibutuhkan, apakah infra bersedia mengoperasikan reverse proxy terpisah?

## Verifikasi desain

- Semua rute baru otomatis tercakup matcher `/api/:path*` + rate limit segmen `sso` (`middleware.ts:59,80-90`) — tanpa sentuh middleware (beku).
- Akses selalu via `canAccessPortalAppBySlug` (`lib/portal-access.ts`, beku — hanya dipakai, tidak diubah); audit selalu via `logAudit`.
- `npx tsc --noEmit` exit 0 pada saat dokumen ini di-commit (tree sehat, dokumen tidak menyentuh kode).
