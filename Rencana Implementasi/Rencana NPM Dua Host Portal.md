# Rencana Implementasi — NPM + Dua Host Portal (Same-Domain DNS utk REROUTE)

Tanggal: 2026-08-10
Status: **TUNGGU TIM JARINGAN** (DNS belum live) — kode config sudah siap, tinggal eksekusi.

## Tujuan
1. Portal bisa diakses dari **2 host**: `https://portal.santos.co.id` (via NPM) **dan** `http://192.168.2.3:3100` (port langsung).
2. Login jalan di **kedua** host (NextAuth auto-detect per-request via `AUTH_TRUST_HOST`).
3. Fondasi same-domain untuk nanti REROUTE Oracle (portal + `appsprod.santos.co.id` satu TLD `.santos.co.id`).

---

## Blokir Utama: DNS (Tim Jaringan) — GATE
**Belum dikerjakan.** Ini prasyarat mutlak, bukan kode.

- Daftarkan **A record** internal: `portal.santos.co.id  →  192.168.2.3`
- (Opsional, bila butuh HTTPS internal) pastikan cert AD CS untuk `portal.santos.co.id` dari `Prosedur Generate SSL AD CS.md`.

> Tanpa DNS ini, semua langkah di bawah tidak bisa di-test via domain. IP `192.168.2.3:3100` bisa di-test sekarang.

---

## 1. Kode / Config (SUDAH DILAKUKAN)

### `docker-compose.yml` (service `web`)
```yaml
- NEXTAUTH_URL=
- AUTH_TRUST_HOST=true
```
Alasan (diverifikasi dari source `next-auth@4.24.13`):
- `detectOrigin()` di `node_modules/next-auth/utils/detect-origin.js`:
  ```js
  if (process.env.VERCEL ?? process.env.AUTH_TRUST_HOST) return `${protocol}://${forwardedHost}`;
  return process.env.NEXTAUTH_URL;   // ← tanpa AUTH_TRUST_HOST, SELALU pakai NEXTAUTH_URL
  ```
  `NEXTAUTH_URL` cuma 1 string → tidak bisa 2 URL. `AUTH_TRUST_HOST=true` + `NEXTAUTH_URL` kosong → detect host/proto dari tiap request.
- `secureCookie` (`core/lib/cookie.js`) ikut `x-forwarded-proto` → NPM harus kirim `X-Forwarded-Proto`.

### `.env` (dev lokal)
```env
NEXTAUTH_URL=
AUTH_TRUST_HOST=true
```

### `docker-compose.npm.yml`
- `extra_hosts: web:host-gateway` (agar NPM bisa resolve service `web` dari jaringan eksternal).

---

## 2. Konfigurasi NPM (Manual di NPM Admin `:81` )

> Ini **manual** di UI NPM — bukan file. Tidak ada file konfigurasi terpusat.

Buat **satu Proxy Host**:

| Field | Isi |
|---|---|
| Domain | `portal.santos.co.id` |
| Scheme | `http` |
| Forward Hostname | `web` (:warning: nama service docker) |
| Forward Port | `3000` (port internal, BUKAN 3100) |
| WebSockets | **ON** |
| SSL | cert AD CS internal (bukan Let's Encrypt krn domain internal) |

**Custom Nginx Config** (tab Advanced) — WAJIB, karena NPM tidak set `X-Forwarded-Proto` secara default:
```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Host $host;
```

---

## 3. Urutan Verifikasi (setelah DNS live)

1. **Rebuild web**: `docker compose -f docker-compose.yml up -d --build web` (apply `AUTH_TRUST_HOST`).
2. **Start NPM**: `docker compose -f docker-compose.npm.yml up -d`.
3. **Test A — domain**: buka `https://portal.santos.co.id` → login → cek cookie `portal-auth.session-token` di DevTools (harus `Secure`).
4. **Test B — IP**: buka `http://192.168.2.3:3100` → login → cek cookie `portal-auth.session-token` (harus TIDAK `Secure`).
5. **(Kunci) Test REROUTE**: buka `https://portal.santos.co.id` → klik app Oracle → cek login Oracle sukses & cookie `JSESSIONID` dari domain `.santos.co.id`.

---

## 4. Catatan Penting

- **Dua host = dua session terpisah.** Cookie `portal-auth.*` `path:"/"` + beda host → tidak saling berbagi. Login di IP ≠ login di domain. Ini **wajar** untuk cara B.
- **REROUTE hanya jalan via `https://portal.santos.co.id`.** Via IP `192.168.2.3:3100`, cookie `portal_proxy_*` domain `192.168.2.3` → Oracle tidak kirim. (Dokumentasi di `route.ts:149-151`.)
- **`docker-compose.npm.yml` `version:` obsolete** — harmless, tapi bisa dihapus baris 1 utk bersih.
- **Konfigurasi REROUTE-redirect (mode baru) masih TUNGGU** — belum ditulis, hanya setelah DNS live & test A/B lulus. Ini fix permanen yang menghindari OAF MAC (login server-to-server → inject cookie `Domain=.santos.co.id` → redirect ke URL Oracle asli, tanpa proxy).

## File yang berubah
- `docker-compose.yml` — `NEXTAUTH_URL=` kosong + `AUTH_TRUST_HOST=true`
- `.env` — disamakan
- `docker-compose.npm.yml` — `extra_hosts: web:host-gateway`