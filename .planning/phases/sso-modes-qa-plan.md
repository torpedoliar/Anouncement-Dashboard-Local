# Rencana QA — Mode SSO REDIRECT (Gelombang A)

Tanggal: 2026-08-26 · Agent: Amer (QA Automation) · Kontrak: TASK-15 (milestone conv-sso-m3)
Input: `sso-modes-threat-model.md` §1c + §4 · `sso-modes-design.md` §2 + §6 + §7 · kode acuan `app/api/sso/reroute/route.ts`, `app/api/sso/post/route.ts`, `middleware.ts`, `lib/validation-schemas.ts`.
Status: dokumen gate pra-implementasi — dieksekusi saat gelombang A (A1/A2/A3) siap diverifikasi. **God yang commit** dokumen ini saat sign-off.

---

## 0. Ruang lingkup & batasan lingkungan

| Batasan | Konsekuensi ke rencana ini |
|---|---|
| PRE-1: `npm run build`/`npm run dev` rusak pre-existing | **Bukan bagian gate.** Tidak ada E2E HTTP otomatis yang booting dev-server lokal. |
| Produksi/staging berjalan via Docker (host `192.168.2.3:3100`) | Checklist curl & UAT dijalankan **terhadap instance staging yang sudah hidup**, bukan `next dev` lokal. |
| Tidak ada test framework di repo | Pola otomatis = self-check `scripts/test-*.ts` via `npx tsx` (gaya `scripts/test-cookie-domain.ts`): assert PASS/FAIL + `process.exitCode = 1` bila gagal. |
| File beku OPD-1 (`lib/portal-access.ts`, `lib/portal-layout.ts`, `lib/portal-auth.ts`, `lib/auth.ts`, `middleware.ts`) | Zero-diff wajib — masuk gate Baileys §4. |
| Rate limit `/api/sso` = satu bucket 300/menit/IP (`middleware.ts:59` key `ip:sso`) | Loop curl harus < 300 req/menit per source IP; sanity-check 429 opsional di akhir. |

Legend level otomasi: **[AUTO]** = `npx tsx` self-check, jalan di CI/manapun · **[SEMI]** = runbook curl terhadap staging, dieksekusi & dilampirkan outputnya oleh Baileys · **[MANUAL]** = browser/human (UAT).

---

## 1. Matriks uji — 5 acceptance checks REDIRECT (threat model §1c)

### Ringkasan

| # | Acceptance check | Cara uji | Level |
|---|---|---|---|
| AC-1 | `loginUrl` host luar allowlist → launch ditolak, **nol** request keluar dari server | curl + listener netcat + query AuditLog | SEMI |
| AC-2 | `javascript:` / `data:` / userinfo / metadata-IP ditolak di create/update **dan** launch | curl admin API + curl launch + self-check skrip validator | SEMI + AUTO |
| AC-3 | Rantai redirect keluar allowlist diputus + audit FAILURE | **N/A by design** (REDIRECT tanpa fetch server-side) — lihat Temuan F-4 | — |
| AC-4 | `?next=` / `destination=` diabaikan total; tujuan hanya dari config | curl halaman + curl API + grep respons | SEMI |
| AC-5 | Tiap percobaan launch = **tepat satu** baris `SSO_LAUNCH` `metadata.ssoMode="REDIRECT"` | query `audit_logs` sebelum/sesudah trigger | SEMI |

### Persiapan umum (untuk SEMI)

```bash
BASE=http://192.168.2.3:3100                      # staging docker, parity produksi
PORTAL_COOKIE="portal-auth.session-token=<…>"     # sesi pengguna portal uji — salin dari DevTools (Application → Cookies) setelah /portal-login
ADMIN_COOKIE="<cookie sesi CMS SuperAdmin>"       # dari /admin-login — nama persis cookie lihat DevTools (prefix NextAuth)
APP_ID=$(...) ; APP_SLUG=qa-redirect              # app uji mode REDIRECT — buat via admin, hapus setelah selesai
```

App uji: `url=https://intranet-wia.santos.co.id`, `ssoMode=REDIRECT`, aktif. Jangan pakai app produksi nyata untuk jalur gagal.

---

### AC-1 — Target luar allowlist ditolak, nol egress

**Setup:** app uji kedua `qa-redirect-bad` mode REDIRECT, `url` menunjuk host yang BUKAN allowlist-nya. Karena validator A0 belum tentu ada saat pengujian, set nilainya **langsung via DB** (simulasi config-drift melampaui API):

```bash
npx tsx --eval "import prisma from './lib/prisma'; prisma.portalApp.update({where:{slug:'qa-redirect-bad'},data:{url:'http://<ip-staging>:9443/'}})"
```

Sementara itu di host staging, pasang listener yang **seharusnya tidak pernah menerima koneksi**:

```bash
nc -lvp 9443        # atau: python -m http.server 9443 lalu pantau log aksesnya
```

**Trigger + asersi:**

```bash
curl -s -o /dev/null -w 'status=%{http_code} location=%{redirect_url}\n' \
  -X POST -H "Cookie: $PORTAL_COOKIE" -d "appSlug=qa-redirect-bad" "$BASE/api/sso/redirect"
# Ekspektasi: status=302  location=…/portal?error=sso_invalid_target&app=qa-redirect-bad
```

Verifikasi lanjutan:
1. Listener 9443 **menerima nol koneksi** (guard bekerja sebelum efek jaringan apa pun — REDIRECT memang tak boleh punya fetch server-side sama sekali, jadi asersinya struktural + runtime).
2. AuditLog: tepat satu baris baru — `action=SSO_LAUNCH`, `outcome=FAILURE`, `appId` terisi, `metadata.ssoMode="REDIRECT"`, `errorMessage` generik (tanpa stack trace / URL internal penuh).

```sql
SELECT "createdAt", outcome, appId, "errorMessage", metadata
FROM audit_logs WHERE action='SSO_LAUNCH' ORDER BY "createdAt" DESC LIMIT 5;
```

**PASS:** 302 + Location banner `sso_invalid_target` ∧ 0 koneksi ke listener ∧ 1 baris audit FAILURE.
**FAIL:** status lain (200/500/403 JSON ke browser), listener menerima hit, atau baris audit hilang/ganda.

---

### AC-2 — Validator menolak URL berbahaya (create/update maupun launch)

**Bagian 1 — validasi admin API [SEMI].** Sebagai SuperAdmin (update = SuperAdmin saja, `app/api/portal-apps/[id]/route.ts:17,38`):

```bash
for payload in \
  '{"loginUrl":"javascript:alert(1)"}' \
  '{"loginUrl":"data:text/html;base64,PHNjcmlwdD4="}' \
  '{"loginUrl":"https://app.santos.co.id@evil.com/"}' \
  '{"loginUrl":"https://evil.com\\@santos.co.id/"}' \
  '{"loginUrl":"http://169.254.169.254/latest/meta-data/"}' ; do
  curl -s -o /dev/null -w '%{http_code}\n' -X PUT "$BASE/api/portal-apps/$APP_ID" \
    -H "Cookie: $ADMIN_COOKIE" -H 'Content-Type: application/json' -d "$payload"
done
# Ekspektasi SELURUHNYA: 400 (ditolak Zod/validator SEBELUM sentuh DB)
```

Asersi tambahan: `GET /api/portal-apps/$APP_ID` setelah loop → `loginUrl` tidak berubah (tak ada penulisan parsial). Status **200 untuk payload ini = FAIL langsung** (hari ini `z.string().url()` memang masih menerimanya — `validation-schemas.ts:271`; check ini yang membuktikan A0 masuk).

**Bagian 2 — validasi jalur launch [SEMI].** Set `loginUrl` berbahaya via DB pada app uji, lalu ulangi trigger AC-1 → ekspektasi identik (302 `sso_invalid_target`, 0 egress, audit FAILURE). Ini menutup celah "config lama yang lolos schema sebelum validator ada".

**Bagian 3 — self-check validator [AUTO].** Kontrak skrip baru `scripts/test-sso-url-guard.ts` (gaya `test-cookie-domain.ts`):

| Kasus | Ekspektasi |
|---|---|
| `https://intranet-wia.santos.co.id/login` | ACCEPT |
| `http://intranet-wia.santos.co.id/` (skema http) | ACCEPT (skema http(s) diizinkan; pinning host yang menjaga) |
| `javascript:alert(1)` · `data:text/html,…` · `file:///etc/passwd` | REJECT (skema non-http(s)) |
| `https://app.santos.co.id@evil.com/` | REJECT (userinfo) |
| `https://evil.com\@santos.co.id/` | REJECT |
| Host = `169.254.169.254` / `0.0.0.0` / `metadata.google.internal` | REJECT (selaras blocklist `portal-fetch-html.ts:72-75`) |
| Host IDN `https://münchen.de/` dinormalisasi → `xn--mnchen-3ya.de` | REJECT bila tak terdaftar; ACCEPT hanya setelah normalisasi exact-match |
| Port tak terdaftar pada app yang mendefinisikan port | REJECT |
| Fragment/query `#x` / `?a=b` | ACCEPT (harmless — host yang divalidasi) |

**PASS:** semua baris PASS, exit code 0.

---

### AC-3 — Rantai redirect keluar allowlist diputus

**N/A by design** (Temuan F-4): REDIRECT gelombang A tidak melakukan fetch server-side apa pun (desain §2: "tidak ada fetch server → tidak ada permukaan SSRF"), sehingga tidak ada rantai yang bisa diputus di sisi portal. Penggantinya:
1. Asersi struktural di code review: `app/api/sso/redirect/route.ts` **tidak meng-import** `fetchLoginPage`/`relayRequest`/`fetch` dan tidak melakukan permintaan jaringan keluar.
2. Redirect lanjutan **dari aplikasi target setelah serah-terima** berada di luar batas kepercayaan portal (browser ↔ app target, bukan browser ↔ portal).
3. **Klausa kebangkitan:** bila implementasi menambahkan handshake ringan/fetch server-side apa pun, check ini HIDUP kembali dan wajib diuji (hop keluar allowlist → putus + audit FAILURE) sebelum rilis — jangan lewatkan tanpa keputusan eksplisit god.

---

### AC-4 — Parameter query/form pengguna diabaikan total

```bash
# 4a. Halaman interstitial tidak boleh memuat tujuan dari query
curl -s -H "Cookie: $PORTAL_COOKIE" \
  "$BASE/portal/app/$APP_SLUG?next=https://evil.com/phish&redirect_uri=https://evil.com" \
  | grep -ci "evil.com"
# Ekspektasi: 0

# 4b. Field liar di body POST diabaikan; Location identik dengan launch bersih
CLEAN=$(curl -s -o /dev/null -w '%{redirect_url}' -X POST -H "Cookie: $PORTAL_COOKIE" \
  -d "appSlug=$APP_SLUG" "$BASE/api/sso/redirect")
DIRTY=$(curl -s -o /dev/null -w '%{redirect_url}' -X POST -H "Cookie: $PORTAL_COOKIE" \
  --data-urlencode "appSlug=$APP_SLUG" \
  --data-urlencode "destination=https://evil.com" --data-urlencode "next=https://evil.com" \
  "$BASE/api/sso/redirect")
[ "$CLEAN" = "$DIRTY" ] && echo PASS || echo "FAIL clean=$CLEAN dirty=$DIRTY"
```

Asersi code review pendamping: route hanya membaca `formData.get("appSlug")` (dan `credentialId` bila dipakai) — **tidak ada** pembacaan `searchParams`/field tujuan lain; tujuan = `app.loginUrl || app.url` dari Prisma saja.

**PASS:** grep = 0 ∧ `Location` bersih == kotor ∧ review konfirmasi tak ada sumber tujuan selain DB.
Catatan: 4b dijalankan pada app yang targetnya VALID; untuk app buruk, keduanya harus glek ke `sso_invalid_target` yang sama.

---

### AC-5 — Tepat satu baris audit per percobaan

```bash
TS0=$(date -u '+%Y-%m-%d %H:%M:%S')
# trigger 1x sukses (app valid) + 1x gagal (qa-redirect-bad), seperti AC-1/AC-4
```

```sql
SELECT outcome, "errorMessage", metadata FROM audit_logs
WHERE action='SSO_LAUNCH' AND "createdAt" > '$TS0' ORDER BY "createdAt";
-- Ekspektasi: 2 baris — 1 SUCCESS + 1 FAILURE,
-- keduanya metadata->>'ssoMode' = 'REDIRECT', appId terisi (KPI /admin/portal-audit),
-- metadata SUKSES tanpa nilai rahasia (mode ini tak pegang kredensial — pastikan begitu).
```

**PASS:** jumlah baris == jumlah percobaan, `ssoMode="REDIRECT"` di semua baris.
**Ambigu bila:** halaman `page.tsx` masih menulis baris `SSO_LAUNCH`-nya sendiri (existing langkah 7, `page.tsx:115-126`, tanpa `ssoMode` di metadata) — lihat **Temuan F-3**, butuh putusan kepemilikan baris di A1 sebelum check ini bisa dinilai tegas.

---

## 2. Checklist regresi dispatcher — 4 mode existing + PROXY (desain §7 baris terakhir)

Dijalankan **di staging, urut, oleh Baileys** setelah A1 merge (refactor `page.tsx` adalah satu-satunya titik gesekan — desain §6). Semua via browser dengan pengguna portal uji yang punya kredensial tersimpan.

| Mode | Langkah verifikasi | Wajib tetap (perilaku pra-refactor) |
|---|---|---|
| **FORM** | Klik app FORM dgn form login ASP.NET biasa → interstitial auto-submit muncul → submit → mendarat di app (login berhasil). App dgn token volatil (`__VIEWSTATE`) masih ke-refresh (`refreshVolatileFields`, `page.tsx:138-141`). | Interstitial & alur kredensial tak berubah; multi-akun masih menampilkan `AccountSelector`; `lastUsedAt` ter-update. |
| **REROUTE** | (a) Launch Oracle EBS dari host berdomain bersama → cookie Oracle di-re-issue → landing OANEWHOMEPAGE tanpa login ulang. (b) Dari host tanpa domain bersama (IP) → banner `/portal?error=sso_cross_domain`. | Kedua cabang persis perilaku hari ini (`reroute/route.ts:142-164`); audit FAILURE cabang (b) tetap ada. |
| **POST** | Launch app K2 WS-Federation → halaman auto-POST federasi dirender (`autoPostHandoffPage`) → browser mengirim sendiri → sesi K2 aktif. Uji juga app satu-domain dgn cabang cookie-reissue. | Handoff `FEDERATION_AUTOPOST` vs `COOKIE_REISSUE` tercatat di metadata audit; gagal prefetch → banner `sso_failed`. |
| **VAULT** | Klik app VAULT → kredensial tampil untuk disalin; **tidak ada** POST ke `/api/sso/*` (cek Network tab). | Tampilan vault & audit launch tak berubah. |
| **PROXY** | Klik app PROXY → tetap halaman status (copy baru hasil A3 boleh lebih rapi). `grep -ri "proxy" app/api/` → kosong (tidak bangkit route proxy baru — desain §4). | Tidak ada regressi ke halaman lama "Belum Aktif" yang menyesatkan; arahan ke mode alternatif tampil. |
| **Umum/guard** | (a) Pengguna tanpa akses → `AccessDenied` di halaman, `403` JSON di API. (b) Belum login `/portal/app/x` → 404. (c) App nonaktif → 404. (d) Admin picker/badge masih 7 mode (hasil audit TASK-02). | Urutan guard 401→404→403 konsisten dgn pola reroute/post (`reroute/route.ts:25-42`). |

**PASS:** seluruh baris berperilaku identik pra-refactor; satu saja yang meleset = FAIL gelombang A (dispatcher adalah permukaan regresi nomor satu — desain §7).

---

## 3. Checklist integrasi validator URL (kontrol lintas-mode, threat model §4.1)

1. **Create/update admin menolak skema berbahaya** — runbook AC-2 bagian 1. Create oleh role CMS ADMIN (bukan SuperAdmin) juga diuji 1× (`app/api/portal-apps/route.ts:15`): payload valid → 201, payload `javascript:` → 400.
2. **Launch selalu dari config** — asersi code review (AC-4): satu-satunya sumber tujuan adalah baris `PortalApp` dari Prisma; parameter pengguna (`appSlug`, opsional `credentialId`) tidak pernah ikut membentuk URL tujuan.
3. **Validator satu implementasi** — grep: `lib/portal-url-guard.ts` (atau nama finalnya) dipakai oleh `lib/validation-schemas.ts` (create/update) DAN route REDIRECT; tidak ada salinan logika host/skema inline di route.
4. **Verify-login tidak pecah** — `verifyLoginSchema` (`validation-schemas.ts:290-295`) adalah permukaan admin yang sah memprobes URL arbitrer (residual SSRF admin, di luar scope — threat model §5): minimal dapat guard skema http(s), **jangan** sampai kena allowlist per-app (tak ada konteks app di sana). Pastikan fitur "uji login" admin masih jalan setelah wiring.
5. **UI admin** — select/badge tetap 7 nilai enum; helper text per-mode (A3) tampil; peringatan "mode belum diuji" utk mode non-gelombang-A tidak menghalangi simpan.

---

## 4. Gate rilis Baileys + sisa UAT manual human

### Urutan eksekusi gate (semua harus hijau sebelum keputusan)

1. **Diff hygiene**: `git diff --stat c446132..HEAD -- lib/portal-access.ts lib/portal-layout.ts lib/portal-auth.ts lib/auth.ts middleware.ts` → **kosong** (beku OPD-1).
2. **`npx tsc --noEmit`** exit 0.
3. **ESLint scoped** pada seluruh file yang berubah dalam gelombang A → 0 issue.
4. **Self-check [AUTO]**: `npx tsx scripts/test-sso-url-guard.ts` (baru, AC-2 bagian 3) ALL PASS; regresi skrip existing tetap ALL PASS: `test-sso-mode.ts`, `test-cookie-domain.ts`, `test-sso-relay.ts`.
5. **Code review diff vs kontrak desain §2** + seluruh Temuan (§6) sudah punya putusan: khususnya F-1/F-2 (allowlist + lane A0) dan F-3 (kepemilikan baris audit). Asersi struktural AC-3 (tanpa fetch server-side) dan AC-4 (sumber tujuan) diverifikasi di sini.
6. **Runbook curl [SEMI]** AC-1, AC-2, AC-4, AC-5 di staging — output mentah dilampirkan ke laporan rilis.
7. **Checklist regresi dispatcher [MANUAL]** §2 dijalankan penuh di staging.
8. **Audit KPI**: query AC-5 + spot-check halaman `/admin/portal-audit` memfilter appId baris REDIRECT.
9. **Keputusan GO / NO-GO** + daftar risiko residual tertulis (template: PASS / PASS WITH RISK / BLOCKED / FAIL).

### Sisa UAT manual human (setelah GO, tidak memblockir gate)

- **REDIRECT nyata ke 1 app intranet WIA** (Windows Integrated Auth / IP-trusted): klik app dari portal → mendarat **sudah login** tanpa prompt kredensial — satu-satunya bukti nilai fitur.
- Interstitial: auto-submit jalan mulus, fallback link manual + `<noscript>` berfungsi, tanpa error JS console.
- Cross-browser minimal Edge + Chrome (pengguna intranet), termasuk akses via `192.168.2.3:3100` (host IP) dan via hostname domain bersama bila ada.
- Konfirmasi produk: app intranet mana kandidat gelombang REDIRECT pertama; jawaban Open Questions desain §(TOKEN consumer) tetap menunggu human.

---

## 5. Kontrak artefak uji baru

| Artefak | Isi minima | Pemilik |
|---|---|---|
| `scripts/test-sso-url-guard.ts` | Tabel kasus AC-2 bagian 3, gaya `test-cookie-domain.ts` (assert + `exitCode=1`), tanpa jaringan, tanpa DB | Lane A0 (Kawa) — dibuat bersama validator |
| Lampiran output runbook curl | Transkrip AC-1/2/4/5 + dua query audit | Baileys saat gate |
| Hasil checklist §2 | Tabel dicentang + catatan penyimpangan | Baileys saat gate |

---

## 6. Temuan — kontradiksi desain vs threat model (ditemukan saat menyusun rencana; jangan tunggu)

- **F-1 · Allowlist REDIRECT tidak ada di desain (BLOCKER utk AC-1/AC-2-launch).** Threat model §1b.1 mensyaratkan allowlist host per-app pada resolver pusat; desain §2 justru menyatakan "tujuan HANYA dari config admin → tidak ada open-redirect" dan "tidak ada kolom baru". Config-admin-saja menutup R-1 (open redirect dari query) tapi **tidak** menutup R-2 (config salah/kompromi = SSRF/open-redirect) — threat model sendiri menyebut config *trusted-but-error-prone*. Akibatnya acceptance check §1c.1 tidak bisa lulus: tak ada allowlist untuk dibandingkan. Opsi resolusi: (a) **derivasi deterministik tanpa kolom baru** — host tujuan harus exact-match `host(app.url)` (kompatibel dgn constraint desain; app dgn `loginUrl` beda-host butuh registrasi pengecualian eksplisit), atau (b) kolom allowlist baru (butuh pelonggaran constraint "tanpa kolom baru" oleh god). Rekomendasi saya: (a) untuk gelombang A.
- **F-2 · Validator URL pusat tidak masuk breakdown tugas desain §6** (A1/A2/A3/B1/B2 — tidak ada lane utk `lib/portal-url-guard.ts` + wiring `validation-schemas.ts`), padahal keputusan gate threat model §5 menjadikannya syarat "APPROVED WITH RISK" untuk REDIRECT. Tanpa lane itu, rilis gelombang A maksimal **PASS WITH RISK dgn AC-1/AC-2 DEFERRED** — saya rekomendasikan menambah **lane A0** (owner Kawa, file `lib/portal-url-guard.ts` + `lib/validation-schemas.ts` + wiring di route REDIRECT; bebas konflik dgn lane lain) daripada merilis gate security tanpa gigi.
- **F-3 · Potensi baris audit ganda.** `page.tsx:115-126` menulis `SSO_LAUNCH` (SUCCESS, tanpa `ssoMode` di metadata) untuk SEMUA mode saat halaman dirender; route REDIRECT baru juga akan menulis satu baris. Untuk kelas credential-less, halaman idealnya **tidak** menulis baris (rute satu-satunya penulis — selaras reroute/post yang menulis di rute). Putusan kecil di A1; tanpa itu AC-5 "tepat satu baris" ambigu (baris halaman tak ber-`ssoMode` lolos secara harfiah tapi menduplikasi jejak).
- **F-4 · AC-3 N/A by design.** Desain REDIRECT tanpa fetch server-side membuat "rantai redirect diputus" tak berobjek di sisi portal; diganti asersi struktural + klausa kebangkitan (§1 AC-3). Konsisten dgn §1b.3 threat model yang berkondisi ("bila mode ini sempat memicu fetch server-side").
- **F-5 · Anti-pattern error 500.** Route REDIRECT wajib memakai pesan generik (pola `post/route.ts:227`), BUKAN `details: err.message` (`reroute/route.ts:204`). Catatan: kebocoran di reroute itu sendiri masih terbuka hari ini — milik perbaikan terpisah, di luar scope gelombang A.
- **F-6 · Verify-login/detect-fields tetap permukaan SSRF admin pre-existing** (threat model §5 residual): wiring validator jangan memecah fungsinya; guard skema http(s) boleh, allowlist per-app jangan (§3 butir 4).
- **F-7 · Bucket rate-limit `/api/sso` tetap gabung** 300/menit/IP (middleware beku) — untuk REDIRECT yang murah ini acceptable; dicatat sebagai utang terukur bila TOKEN (gelombang B) aktif (threat model §4.5: butuh limit per-user ala `checkVerifyLimit`).

---

## 7. Risiko residual (terdokumentasi, tidak memblockir)

1. Staging ≠ host produksi dalam nuansa host/IP — checklist curl dijalankan di staging docker; UAT WIA akhirnya tetap di produksi.
2. Derivasi allowlist `host(app.url)` (bila F-1 opsi a dipilih) menolak app sah yang `loginUrl`-nya beda host dari `url` — mitigasi: mekanisme pengecualian eksplisit + helper text admin (A3); daftar app terdampak dicek via query `loginUrl` ≠ host `url` sebelum rilis.
3. PRE-1 menutup E2E otomatis lokal — kompensasi: self-check unit + runbook semi-otomatis; PRE-1 sendiri tetap di luar gate sesuai kontrak.
4. AC-5 bergantung putusan F-3; bila A1 tunda putusan, check dinilai "PASS WITH AMBIGUITY" dan dicatat sebagai risiko, bukan diam-diam dilewati.
