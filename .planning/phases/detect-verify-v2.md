# Desain Perbaikan Deteksi Otomatis + Uji Login Portal-App (v2)

Tanggal: 2026-08-27 · Agent: johnnie-walker-mtaw80st (JOHNNIE WALKER, Solution Architect) · Kontrak: TASK-19 (conv-detect-v2)
Prasyarat: enum `PortalSsoMode` final 7 nilai (`prisma/schema.prisma:370-378`), SSO REDIRECT sudah aktif end-to-end.

---

## 1. PROBLEM

1. **Deteksi tidak menjangkau SPA murni + API JSON.** Kasus nyata `http://192.168.2.3:8443` (FastAPI + React `<div id="root">`): lapis HTTP menemukan `<div id="root">`, lapis browser me-render SPA, tapi klasifikasi jatuh ke VAULT tanpa bukti tambahan — admin hanya bisa copy-paste manual, padahal API JSON-nya sebenarnya teruji.
2. **Uji login memakai konfigurasi tersimpan, bukan konfigurasi form.** `verifyLoginSchema` (`validation-schemas.ts:296`) hanya punya `url/appId/usernameField/passwordField/testUsername/testPassword`. Route selalu memanggil `fetchLoginPage(url)` lalu deteksi ulang, **mengabaikan** pilihan mode/field/extraFields di form. Keluhan "ganti mode tidak bisa diuji tanpa save" benar secara struktural.

## 2. KEPUTUSAN USER (final, dari kontrak)

- Target: mayoritas website umum — SPA yang render-nya via JS, port non-standar, redirect-loop, TLS self-signed internal. Bukan "semua situs literal".
- Uji login WAJIB memakai konfigurasi form saat ini (mode + usernameField + passwordField + URL) walau **belum di-Save**, plus catatan "menggunakan konfigurasi belum disimpan".
- SPA cukup **perilaku benar** (halaman hidup / kontrak API terbaca) — kredensial SPA tidak diwajibkan teruji server-side.

## 3. KEPUTUSAN A — Verifikasi memakai konfigurasi form (payload penuh)

**Keputusan:** perpanjang `verifyLoginSchema` (bukan bikin route baru) — klien mengirim **snapshot form saat ini** sebagai payload; DB (`appId`) TIDAK dipakai sebagai sumber utama karena konfigurasinya bisa basi.

Detail:
- Tambah field: `ssoMode` (enum 7), `httpMethod` ("POST"/"GET"), `extraFields` (object opsional); `testUsername`/`testPassword` tetap.
- `ssoMode` **menentukan engine** yang dijalankan route (tabel di bawah), bukan sekadar label.
- `extraFields` dari form **hanya dikirim bila non-volatile**. Token volatil (`__VIEWSTATE`, `__RequestVerificationToken`, `csrf*`, …) selalu diambil ulang dari halaman saat runtime (pakai kembali `VOLATILE_RE` di `lib/portal-fetch-html.ts`), bukan dari nilai tersimpan.
- Field FORM: field dari form **didahulukan** — tidak lagi tertimpa oleh auto-detect. Hanya bila kosong → pakai hasil deteksi halaman.
- **Belum disimpan:** UI menampilkan label "menggunakan konfigurasi belum disimpan" bila form berbeda dari `editingApp`. Saat sukses, `loginVerifiedAt` tetap di-set — artinya "konfigurasi form saat ini teruji", bukan "baris DB teruji" (lihat Risiko).

**Dispatcher per-mode (di dalam route):**

| Mode (dari form) | Engine/jaringan | Apa yang diuji |
|---|---|---|
| `FORM` | Relay form-encoded seperti sekarang (cookie jar + token segar dari `fresh`), memakai field config; `httpMethod` ikut. | Kredensial: sukses/ditolak/handoff |
| `POST` | Sama dengan FORM (POST relay + cookie jar); dibedakan untuk pasangan token+cookie | Kredensial server-side |
| `REROUTE` | Engine Oracle XHR: POST + `X-Service: AuthenticateUser` ke `finalUrl`, parse `parseOracleAuthResponse` — dipicu jika mode=REROUTE ATAU halaman terbukti Oracle | Kredensial server-side |
| `VAULT` | **Hanya uji jangkauan** — fetch URL (follow secure, deteksi loop) → "reachable" vs loop/unreachable. TIDAK mengirim kredensial (keputusan user #3) | Perilaku halaman: hidup |
| `REDIRECT` | Sama: reachability (REDIRECT = credential-less handoff; tanpa tes kredensial) | Halaman reachable/loop/unreachable |
| `PROXY` / `TOKEN` | **Tidak ada uji** — respons 422 informatif "mode belum aktif" | — |
| (opsional) JSON | Bila mode `VAULT` dan API contract terdeteksi + admin pilih "Uji JSON" | Kontrak API + respon kredensial |

Catatan audit: `logAudit` metadata `ssoMode` diisi nilai aktual dari request (bukan literal `"verify"` seperti sekarang) agar jejak akurat.

## 4. KEPUTUSAN B — Lapis ke-3: probe OpenAPI / JSON API

**Hasil deteksi yang diusulkan** (kasus NCM): mode **tetap `VAULT`** — TIDAK ada mode enum baru.

1. **Kapan dijalankan:** setelah lapis HTTP dan BROWSER keduanya gagal menemukan `passwordField`, **dan** halaman terlihat seperti SPA (`looksLikeClientRenderedApp` — `<div id="root">`, script≥3, tanpa `<form>`).
2. **Probe (GET, same-origin, cap kecil):** `GET {origin}/openapi.json` → cari operasi `POST` yang menerima `{username,password}` di `requestBody`; simpan `apiContract={path,method:"POST",params:["username","password"]}`. Opsional kembali ke `swagger.json` bila 404. **Tidak pernah POST** ke endpoint tanpa instruksi admin; tidak menyentuh host lain.
3. **Output ladder/detect baru:**
   ```
   apiLayer:     "OPENAPI" | "NONE"
   apiContracts: [ { method:"POST", path:"/api/v1/auth/login", params:["username","password"] } ]  // bila ada
   ```
   Detect tetap merekomendasikan **VAULT**, TAMBAH signal: `"Kontrak API JSON terdeteksi: POST /api/…/auth/login — tombol Uji JSON tersedia"`.
4. **"Uji JSON" (opsional, via tombol di UI):** POST JSON `{username,password}` sesuai `apiContract.params` — boleh tanpa kredensial asli, hanya uji bentuk body. `2xx` → "API menerima format"; `401` → "API hidup, kredensial ditolak"; respons lain → "tak terduga". Ini suplemen verifikasi, bukan jalur SSO.

## 5. KEPUTUSAN C — TLS self-signed internal

- Lapis **HTTP** sudah menangani: fallback `httpsGetFollowHops` memakai `rejectUnauthorized:false` per-request (bukan `NODE_TLS_REJECT_UNAUTHORIZED=0` global) — tetap.
- Lapis **BROWSER**: tambah env browserless `CHROME_FLAGS="--ignore-certificate-errors"` di `docker-compose.yml:65-75`, agar Chromium menerima target internal self-signed.
- `relayRequest` (REROUTE/JSON/POST) sudah `allowInsecureTLS:true` per-call — biarkan.

## 6. Kontrak API baru — verify-login

`POST /api/portal-apps/verify-login`
```json
{
  "url": "https://…",
  "appId": "... (opsional)",
  "ssoMode": "FORM",
  "httpMethod": "POST",
  "usernameField": "username",
  "passwordField": "password",
  "extraFields": { "login": "submit" },       // opsional; volatil dibuang
  "testUsername": "…",
  "testPassword": "…",
  "jsonApi": { "path": "/api/v1/auth/login" } // opsional; hanya saat admin pilih "Uji JSON"
}
```
Response: `{ ok, message, handoff, verifyMode, apiProbe?: {ok,status,note} }`.

## 7. Acceptance criteria (testable)

1. Field form ≠ tersimpan → klik "Uji Login" memakai field dari form (bukan auto-detect); response memakai `verifyMode == ssoMode` dari form.
2. Mode `VAULT`: halaman hidup → `{ok:true, verifyMode:"VAULT", message:"halaman reachable; kredensial tidak diuji"}`; mati/loop → `{ok:false, loop…}`.
3. Mode `REROUTE`: page Oracle (regex `AppsLocalLogin`/`AuthenticateUser`) → jenis XHR dipakai; page non-Oracle → tetap jalur form biasa (tidak gagal).
4. Detect SPA (dummy `openapi.json` di origin): `apiLayer:"OPENAPI"`, `apiContracts` terisi, `recommendedMode:"VAULT"`. Tanpa spec → `apiLayer:"NONE"`, tetap VAULT.
5. JSON probe: hanya path relatif (awal `/`), tanpa host; respons `{ok,status,note}` tidak memuat cred/secret ke audit.
6. TLS: `https:` self-signed di fetch berhasil tanpa `NODE_TLS_REJECT_UNAUTHORIZED=0`; BROWSER layer berjalan.
7. Rate-limit: `checkVerifyLimit` tetap 5/10min per admin, berlaku termasuk panggilan JSON probe.
8. Setiap pemanggilan verify mengembalikan `verifyMode` yang jelas + fallback (mis. `VAULT` tanpa API contract) — tidak ada sukses palsu.

## 8. Lane ownership (implementasi)

| Owner | File | Isi |
|---|---|---|
| **Ryan** (API/lib) | `lib/portal-api-probe.ts` (**baru**) | Probe OpenAPI → `apiContracts`/`apiLayer` |
| | `lib/portal-detect-ladder.ts` | Tambah lapis 3 (probe) + ekspos `apiLayer`/`apiContracts` |
| | `lib/portal-sso-mode.ts` | Evidence + signal/teks VAULT bila ada API contract |
| | `lib/validation-schemas.ts` | Extend `verifyLoginSchema`: `ssoMode`/`httpMethod`/`extraFields`/`jsonApi` |
| | `app/api/portal-apps/verify-login/route.ts` | Dispatcher mode + audit `ssoMode` aktual |
| | `app/api/portal-apps/detect-fields/route.ts` | Ekspos `apiLayer`/`apiContracts` di response |
| | `docker-compose.yml` | Browserless `CHROME_FLAGS` + restart |
| **Hennesy** (UI) | `app/admin/portal-apps/page.tsx` | handleVerifyLogin kirim payload penuh + label "belum disimpan" + tombol "Uji JSON" + tampil `apiProbe` |

## 9. Risiko / trade-off

- **Trade-off persist:** `loginVerifiedAt` tetap di-set walau config belum di-save — artinya "form ini teruji". Mitigasi: label UI yang eksplisit + dorong admin untuk save segera setelah uji.
- **False-positive probe:** hanya `openapi.json`/`swagger.json` same-origin; body dibatasi; tidak ada POST yang melampaui instruksi.
- **SSRF:** probe & JSON hanya **same-origin** + path relatif; tanpa input URL admin untuk probe; permukaan SSRF tidak berubah (sudah ada di fetch layer).
- **Mode belum aktif (PROXY/TOKEN):** verifikasi tetap informatif tanpa menjalankan kredensial — diagnosis, bukan aksi.

## 10. Implementasi plan

1. `lib/portal-api-probe.ts` + lapis 3 ladder — **Ryan**
2. Perpanjang `verifyLoginSchema` + dispatcher verify (FORM/POST/REROUTE/VAULT/REDIRECT/PROXY/TOKEN + JSON) — **Ryan**
3. Ekspos `apiLayer` di `detect-fields`; update audit metadata — **Ryan**
4. docker-compose `CHROME_FLAGS` + restart browserless — **Ryan**
5. UI payload-penuh + label belum disimpan + tombol Uji JSON — **Hennesy** (saat di-hire-kembali)
6. Manual QA per acceptance criteria §7 — **god / Ryan**

## ARCHITECTURE DECISION
APPROVED WITH CONDITIONS — (a) `verifyLoginSchema` diperpanjang; (b) 7-enum TETAP, VAULT=default untuk SPA; (c) probe same-origin saja; (d) Uji JSON opsional/perilaku; (e) tanpa migration & tanpa mode baru.