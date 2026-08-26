# Audit Konsistensi Enum `PortalSsoMode` End-to-End (OPD-2)

Tanggal: 2026-08-26 · Agent: kawa-kawa-mt9o34u4 · Milestone: Formalisasi SSO Enum (OPD-2)

Enum `PortalSsoMode` (`prisma/schema.prisma:370-378`) memuat 7 nilai: FORM, REDIRECT,
PROXY, TOKEN, REROUTE, VAULT, POST. Migrasi lengkap: `20260722000000_add_portal_and_audit`
(FORM/REDIRECT/PROXY/TOKEN), `20260729000000_add_sso_mode_reroute`, `20260809000000_add_sso_mode_vault`,
`20260821000001_add_sso_mode_post`.

## Status per file

| File | Peran | Status |
|---|---|---|
| `lib/validation-schemas.ts:240` | Zod create; update = `.partial()` turunannya | OK — 7 nilai + default FORM |
| `app/admin/portal-apps/page.tsx` | Dropdown SSO MODE (7 opsi), submit form, tampilan badge | **GAP 1 → diperbaiki di halaman launch terkait** (lihat bawah) |
| `app/portal/app/[appSlug]/page.tsx` | Dispatcher render per mode | **GAP 1 — REDIRECT/PROXY/TOKEN jatuh diam-diam ke FORM** → fix commit `32c266c` |
| `prisma/schema.prisma` | Definisi enum | **GAP 2 — komentar REROUTE stale ("full reverse proxy")** → fix commit `c72332d` |
| `components/portal/SSOPostSubmit.tsx` | Handoff browser → `/api/sso/post` | **GAP 3 — typo komentar** → fix commit `db02919` |
| `app/api/sso/reroute/route.ts` | Guard `ssoMode !== "REROUTE"`, audit metadata | OK |
| `app/api/sso/post/route.ts` | Guard `ssoMode !== "POST"`, audit metadata | OK |
| `app/api/portal-apps/route.ts`, `[id]/route.ts` | Create/update lewat Zod schema | OK — ssoMode diteruskan via `...data` |
| `app/api/portal-apps/detect-fields/route.ts` + `lib/portal-detect-ladder.ts` + `lib/portal-sso-mode.ts` | Klasifikasi bukti → `recommendedMode` | OK — `SsoMode` sengaja sempit (FORM/POST/REROUTE/VAULT); mode future tidak direkomendasikan otomatis |
| `app/api/portal-apps/verify-login/route.ts` | Uji login per pola (Oracle/SPA/form biasa) | OK — `metadata.ssoMode:"verify"` adalah penanda audit, bukan nilai enum |
| `prisma/seed.ts` | Seed app contoh | OK — FORM |
| `app/portal/page.tsx` + `SsoErrorBanner.tsx` | Banner kegagalan REROUTE/POST (`sso_failed`, `sso_cross_domain`) | OK |
| `lib/portal-access.ts`, `portal-layout.ts`, `portal-auth.ts`, `auth.ts`, `middleware.ts` | File beku OPD-1 | Tidak disentuh (zero-diff) |

## Gap yang diperbaiki

1. **`32c266c`** — `fix(portal)`: halaman launch kini menampilkan halaman status eksplisit
   "SSO Mode X Belum Aktif" untuk REDIRECT/PROXY/TOKEN alih-alih diam-diam memakai jalur
   FORM auto-submit (degradasi senyap yang menyesatkan).
2. **`c72332d`** — `docs(schema)`: komentar enum REROUTE diselaraskan dengan implementasi
   (server-to-server login + re-issue cookie direct redirect; reverse proxy dihapus — OAM/OOM).
3. **`db02919`** — `docs(portal)`: typo komentar SSOPostSubmit.

## Yang disengaja TIDAK diubah (bukan gap)

- Mode REDIRECT/PROXY/TOKEN tetap ada di dropdown admin & zod: enum dirancang extensible
  (spec D8); menutupnya adalah keputusan produk, bukan konsistensi enum.
- `classifySsoMode` hanya menghasilkan mode terimplementasi — benar, deteksi tak boleh
  merekomendasikan mode yang belum jalan.
- `metadata.ssoMode: "verify"` di verify-login: nilai bebas pada kolom metadata JSON,
  tidak dikonsumsi sebagai enum di mana pun.

## Verifikasi

- `npx tsc --noEmit` → exit 0 (0 error).
- `npx eslint` scoped pada file TSX yang disentuh → exit 0 (0 issue).
- `npm run build/dev` sengaja tidak dijalankan (PRE-1 rusak pre-existing, sesuai instruksi task).
- `postcss.config.mjs` tidak disentuh; working tree berisi perubahan pihak lain
  (`.gitignore`, `.planning/STATE.md`) yang dibiarkan apa adanya.
