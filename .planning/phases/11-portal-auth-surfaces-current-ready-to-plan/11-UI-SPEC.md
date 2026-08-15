---
phase: 11
slug: portal-auth-surfaces
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-15
---

# Phase 11 — UI Design Contract (Portal & Auth Surfaces)

> Visual and interaction contract for the final UI/UX rework phase (UIUX-05 / design doc §7).
> Source decisions: `11-CONTEXT.md` (D-01..D-08), `11-SPEC.md` (R1–R5), ROADMAP (OPD-1/OPD-4), design doc §3 (tokens) + §7 (portal & auth).
> Pre-populated from locked upstream decisions — no open questions were required.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — custom token system built in Phase 7 (UIUX-01), NOT shadcn; do NOT initialize shadcn |
| Preset | not applicable |
| Component library | Existing `components/ui/` kit: Card, Badge, Button (primary/secondary/ghost/danger, sm/md), Input, Select, Table (sortable, aria-sort), StatusPill, Dropdown, ConfirmDialog — reuse, do not fork |
| Icon library | `@phosphor-icons/react` — REPLACE every `react-icons/fi` import in touched files; weight `regular` for UI, `duotone` for auth brand mark; sizes 16px nav / 20px actions / 24px empty states |
| Font | Sora display (`font-display`), Inter body (`font-sans`), JetBrains Mono numerals (`font-mono tabular-nums`) — via `next/font`, already configured |

New components allowed (presentational only): `components/auth/AuthFrame.tsx` (shared auth card), category chip row inside `GroupedAppGrid`. Everything else restyles existing components in place.

---

## Spacing Scale

Declared values (multiples of 4, from design §3.1 radius/spacing + tokens). Half-step utilities (`gap-1.5`, `px-3.5`, `py-1.5`, `mb-1.5`, `gap-2.5`, `py-2.5`) are NOT used on any touched surface — everything sits on the 4px grid (4/8/12/16/24/32/48/64):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps in rows, chip dot spacing |
| sm | 8px | Component-internal gaps (badge, icon+label), input padding |
| md | 16px | Default element spacing (card gaps, chip gaps, form field gap) |
| lg | 24px | Card padding, section gaps, filter bar gaps |
| xl | 32px | Page section padding (`/portal`, credentials, settings use `p-8`) |
| 2xl | 48px | Empty-state card padding (`p-12`, ledger standard) |
| 3xl | 64px | Page-break spacing (not used this phase — cards/ledgers max out at 2xl) |

Exceptions:
- Auth card inner padding `p-10` (40px) + shell `px-5 py-10` — preserves the shipped centered-card dimensions (current 40px); on the 4-grid.
- PortalHeader mobile menu rows `min-h-11` (44px touch target); icon-only buttons ≥ 36px.
- Page content max-widths stay as shipped: `/portal` 1200px (`max-w-[1200px]`), credentials 800px, wizard 900px.

---

## Typography

Design §3.2 nominal scale (12/13/14/16/20/24/32/40) — this phase declares **exactly 4 sizes (12/14/20/24) with exactly 2 weights (400 + 600)**. Intermediate points fold to the nearest declared size; no arbitrary-size utilities, no 500/700 weights anywhere in touched files (brand wordmark folded 700 → 600, so no exceptions need registering).

| Role | Size | Weight | Line Height | Notes |
|------|------|--------|-------------|-------|
| Body | 14px | 400 | 1.6 | Cards, tables, forms, wizard body (design §3.2 body line-height 1.6); AppCard name (14px semibold) and description (14px) |
| Caption / Label | 12px | 600 | 1.4 | Field labels, chips, badges, health rows, table headers 12px/600/`text-text-3` (kit), footnotes, hint rows, eyebrows (uppercase + `tracking-[0.2em]`) |
| Heading | 20px | 600 | 1.2, `tracking-tight` | Card titles, page titles `text-xl`, wizard title, auth card h1 (24px → 20px), failure-state titles |
| Display | 24px | 600 | 1.2 | Hero titles "Aplikasi Saya" / "Kredensial" (`text-2xl`), admin desk hero titles |
| Mono numerals | 12px | 400 | `font-mono tabular-nums` | Credential counts, ledger timestamps/IDs/counts/deltas, result counts, account sub-lines |

Size mapping applied throughout the surface inventory (checker pass): 11px eyebrow → 12px; 13px labels/chips/footnotes/hints → 12px; 13px descriptions → 14px; 15px AppCard name → 14px semibold; 24px auth h1 → 20px (Heading); 24–28px Display → 24px only for the two hero titles (28px folded into 24px per the nom-scale fold rule). No `text-[11px]`/`text-[13px]`/`text-[15px]` arbitrary utilities remain.
Weight rule: `font-normal` (400) + `font-semibold` (600) only — no `font-medium` (500), no `font-bold` (700), including the auth brand wordmark and the white "S" monogram on the `bg-santos-red` tile (folded to 600).

Paragraphs below 16px labels use `text-text-2`/`text-text-3` for hierarchy; never pure black/white hex.

---

## Color

60/30/10 from tokens (`app/globals.css` + `tailwind.config.ts`). Both themes (night default, paper `.theme-light`) come from the same token set — parity required on every surface.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--surface-0` (night #09090B / paper #F7F6F3) | Auth frame shell, `/portal` shell (`min-h-screen bg-surface-0`) |
| Secondary (30%) | `--surface-1` (#111113/#FFFFFF) + `--surface-2` (#18181B/#EDEBE6) | Auth card, PortalHeader, launch cards, ledger table rows, inactive chips; `hover:bg-surface-2` for rows/chips |
| Accent (10%) | `--accent` (→ `--site-primary`, fallback `--brand-red` #ED1C24); auth frames masthead-neutral → `bg-santos-red hover:bg-santos-red-dark` explicitly | Reserved ONLY for: auth submit CTA + "Buka" launch CTA (primary Buttons), active category chip, active PortalHeader nav item (`bg-accent-subtle text-accent`), focus-visible rings (global `outline-accent`), brand wordmark accent glyph |
| Destructive | `--color-danger` #ef4444 (button `bg-danger`, badge tone danger) | Destructive actions only: delete credential, revoke session, remove access |
| Status | `--color-success` / `--color-warning` / `--color-info` (+ `-subtle` bgs, + `/30` borders) | Success: "N akun tersimpan" health, active badges; Warning: "Belum ada akun", CorruptCredential/NoCredential tiles, lockout message; Info: EDITOR role badge |

Accent reserved for the specific list above — never "all interactive elements". Secondary CTAs / inactive states use `border-border bg-surface-1 text-text-1 hover:bg-surface-2` (kit secondary). No raw hex anywhere in touched files (only DB-data `primaryColor` is exempt; portal surfaces have none — so strictly zero hex).

---

## Copywriting Contract

Indonesian UI strings preserved (restyle only; behavior frozen). Sentence case — no ALL-CAPS labels (legacy "MASUK"/"MEMPROSES..." become "Masuk"/"Masuk...").

| Element | Copy |
|---------|------|
| Primary CTA — auth (both frames) | **Masuk** (loading: "Masuk...") |
| Primary CTA — launch card | **Buka** (when `credentialCount > 0`); secondary **Simpan Kredensial** (when 0) |
| Secondary CTAs | **Simpan** / **Menyimpan...** (wizard, vault), **Lewati** (onboarding only), **Keluar** (header), **Batal** (selector/dialogs), **Kembali ke Beranda** (admin auth, kept), **Kembali ke Portal** (AccessDenied, kept) |
| Empty state — grid (0 accessible apps) | Heading: **Belum ada aplikasi** — Body: **Tidak ada aplikasi yang dapat ditampilkan saat ini. Atur visibilitas lewat Pengaturan.** — Action: **Buka Pengaturan** → `/portal/settings`. *(Resolves SPEC R2-empty ⚠ + CONTEXT D-02 copy)* |
| Empty state — grid after chip filter | **Belum ada aplikasi di grup ini.** (same empty card, group-scoped) |
| Empty state — ledgers (5 desks) | **Belum ada {data}.** (e.g. "Belum ada sesi.", "Belum ada pengguna." — mirrors Phase 10 users desk: `p-12 text-center text-text-3`) |
| Error state — auth inline | Portal: "NIK atau password salah" (mapped from `result.error`); keep server messages verbatim: "Password salah", "NIK tidak ditemukan", "Akun dinonaktifkan. Hubungi administrator.", "Akun terkunci. Coba lagi dalam N menit." Fallback (catch): "Terjadi kesalahan. Silakan coba lagi." Admin: "Kredensial tidak valid" (existing). Rendered inline on the card (danger region + icon), never a blank-page toast |
| Error state — generic (both frames) | **Terjadi kesalahan. Silakan coba lagi.** |
| Destructive confirmation | **Hapus Kredensial?** / **Cabut Sesi?** — body: **Tindakan ini tidak dapat dibatalkan.** via kit ConfirmDialog (primary `danger`); existing dialog copy kept wherever it exists |
| SSO failure states (kept, restyled) | **Kredensial Belum Disimpan** + "Anda belum menyimpan kredensial untuk {appName}" + **Simpan Kredensial**; **Kredensial Rusak** + "Kredensial untuk {appName} tidak dapat dibaca. Silakan simpan ulang untuk melanjutkan." + **Simpan Ulang Kredensial**; **Akses Ditolak** + "Anda tidak punya akses ke {appName}" |
| Account selector | **Pilih Akun** — "Aplikasi {appName} memiliki lebih dari satu akun tersimpan. Pilih akun yang ingin digunakan." |
| Onboarding wizard | "Pilih Aplikasi Anda" / "Pengaturan Aplikasi"; body "Tentukan aplikasi yang ingin ditampilkan di beranda. Semua aktif secara default." (onboarding) / "Pilih aplikasi yang tampil di beranda Anda, lalu klik Simpan untuk menyimpan." (settings) |
| Vault hints (kept) | "Kredensial tersimpan (mode Vault)", "Buka Halaman Login {app.name}" |

---

## UI Considerations

Applicable state considerations resolved: 10 covered, 1 backstop, 1 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | portal grid, 0 accessible apps | ✅ covered | Empty card renders "Belum ada aplikasi" copy + "Buka Pengaturan" action (locked above); `SquaresFour` icon 24px in tinted tile |
| empty | grid after category-chip filter | ✅ covered | Same empty card, group-scoped copy "Belum ada aplikasi di grup ini." |
| empty | ledger desks (sessions/users/groups/apps/audit) | ✅ covered | Phase 10 standard `rounded-card border border-border p-12 text-center shadow-lvl-1` + "Belum ada {data}." |
| empty | SSOCredentialVault / credentials list | ✅ covered | "Belum ada aplikasi yang di-assign ke Anda." (existing copy) restyled to icon-tile empty card |
| zero-one-many | launch card credential count | ✅ covered | Health row preserved: 0 → warning "Belum ada akun" + secondary CTA; 1 → "1 akun tersimpan"; N → "N akun tersimpan" (mono digit via `font-mono tabular-nums`) |
| loading | auth submit, wizard save, vault save | ✅ covered | Primary CTA disabled + label swap ("Masuk...", "Menyimpan..."); disabled opacity per kit |
| loading | ledger fetch | ✅ covered | Phase 10 skeleton-rows pattern (`animate-pulse` surface-2 rows matching Table columns) as in users desk |
| error | auth invalid / lockout / inactive | ✅ covered | Inline danger region on the auth card (above submit), `border-danger/30 bg-danger-subtle` + `WarningCircle` 20px; lockout message verbatim from `lib/portal-auth.ts` |
| error | corrupt / missing credential at launch | ✅ covered | CorruptCredential / NoCredential sheets render + audit unchanged; each carries re-save CTA |
| overflow | 375px viewport | ✅ covered | Auth card `max-w-[400px] px-5` shell; portal grid 1-col at base breakpoint; ledger tables wrapped in kit `overflow-x-auto`; PortalHeader collapses to List toggle + slide-down menu (no horizontal scroll) |
| long-text | static-content app name / description | 🧪 backstop | App name `truncate` on one line, description `line-clamp-2` (spec dismissed encoding edge — names rendered as-is with CSS ellipsis); held-out visual test at 375px with a long-name app |
| unclassified | design §7.3 "multi-step" wizard vs single-screen shipped wizard | ⚠ unresolved | Repo `OnboardingWizard` is a single-screen checklist posting one `POST /api/portal/visibility` replace (PORT-13 frozen). Planner treats as assumption: restyle the single screen (Cards + accent checkboxes + Simpan/Lewati); do NOT invent step navigation — that would change the visibility POST contract |

---

## Surface Inventory & Interaction Contract

Frozen behavior (zero-regression — MUST NOT change, restyle only): cookie names, NextAuth instances (`next-auth.*` / `portal-auth.*`), redirects, audit events, lockout rules, `getAccessiblePortalApps`/`getPortalLayout` (OPD-1), visibility API shapes, credential API shapes, ledger filter/export URL construction and pagination shapes (byte-identical), SSO form auto-submit fields. Files NOT to touch: `lib/portal-access.ts`, `lib/portal-crypto.ts`, `lib/portal-auth.ts`, `lib/auth.ts`, `lib/site-access.ts`, `middleware.ts`, schema.

### 1. Auth frames (R1) — shared `components/auth/AuthFrame.tsx` + both login pages
- **AuthFrame** (new, presentational): shell `flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10`; card `w-full max-w-[400px] rounded-sheet border border-border bg-surface-1 p-10 shadow-lvl-2`; brand block centered: 48px `bg-santos-red` tile (white "S", `font-display` 600 — legacy mark preserved; weight folded 700 → 600) + wordmark "SANTOS JAYA ABADI" `font-display` 600 `tracking-[0.1em]`; optional eyebrow kicker (12px, 0.2em tracking, accent color); title (`font-display` 20px, 600); subtitle `text-sm text-text-2`; children = form; error region slot (danger, inline, above submit — see Copywriting). Props: `eyebrow`, `title`, `subtitle?`, `error`, `children`.
- **portal-login** (`app/portal-login/page.tsx`): AuthFrame eyebrow "PORTAL SSO", title "Masuk ke Portal"; fields NIK HRIS + Password (kit Input, visible labels `text-xs font-semibold text-text-2 mb-2`); inline error mapping: `result.error` → "NIK atau password salah" on `CredentialsSignin`-type errors, server Indonesian messages kept verbatim, catch → generic fallback; submit = kit Button primary full-width "Masuk"/"Masuk..."; footnote `text-text-3 text-xs` "Lupa password? Hubungi Admin HRIS."; `signIn("portal-credentials", { redirect: false, callbackUrl: "/portal" })` handler UNCHANGED.
- **admin-login** (`app/(auth)/admin-login/page.tsx`): DROP the split-panel left branding column (D-04 "no split panels"); all branding moves into AuthFrame; keep "Kembali ke Beranda" back link (ghost, `ArrowLeft` 16) above card; title "Masuk ke Admin", subtitle "Gunakan kredensial admin untuk mengakses dashboard"; email field (`EnvelopeSimple` 16 leading icon), password (`LockKey`); error = "Kredensial tidak valid" (existing); CTA "Masuk"/"Masuk..." sentence case; footer "© 2024 PT. Santos Jaya Abadi" `text-text-3 text-xs` centered under card; `signIn("credentials", ...)` handler UNCHANGED.

### 2. Portal shell — layout + PortalHeader (R3)
- `app/portal/layout.tsx`: shell `min-h-screen bg-surface-0 text-text-1` (replaces `#0a0a0a` inline); auth guard `redirect("/portal-login")` UNCHANGED.
- **PortalHeader**: `sticky top-0 z-40 border-b border-border bg-surface-1`; inner `flex h-14 items-center justify-between px-4 sm:px-6`; logo wordmark `font-display font-semibold text-text-1` with "PORTAL" in `text-accent`; nav (Aplikasi `SquaresFour`, Kredensial `Key`, Pengaturan `GearSix` — phosphor 16px): item `inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm font-semibold`, active `bg-accent-subtle text-accent`, inactive `text-text-2 hover:bg-surface-2 hover:text-text-1`; desktop nav `hidden sm:flex`, user name `text-sm text-text-2` (hidden on mobile); Keluar = kit Button secondary sm + `SignOut` 16 → `signOut({ callbackUrl: "/portal-login" })` UNCHANGED; mobile List/X toggle `sm:hidden`, slide-down panel `absolute inset-x-0 top-14 border-b border-border bg-surface-1 p-2` with rows `min-h-11 rounded-control`.

### 3. Portal grid — page + GroupedAppGrid + AppCard (R2, D-01/D-03)
- `app/portal/page.tsx`: restyle header block — eyebrow "PORTAL SSO" (`text-accent text-xs` 0.2em tracked, `duotone` not needed), H1 "Aplikasi Saya" `font-display text-2xl font-semibold`; data pipeline (`getPortalLayout` → wizard gate → `getAccessiblePortalApps` → credential count groupBy → `gridGroups`) 100% UNCHANGED; empty-state block moves into the shared empty-card pattern.
- **GroupedAppGrid** (RESTRUCTURED, D-01): props stay `GridGroup[]` + `GridApp`/`GridGroup` interfaces untouched; internal presentation: category chip row — "Semua" + one chip per group name (group *names* derive from `groups`, NOT from `PortalApp.category`) — chip = `rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-150`, inactive `border-border bg-surface-1 text-text-2 hover:bg-surface-2 hover:text-text-1`, active `border-accent/40 bg-accent-subtle text-accent`; `aria-pressed` on each chip (filter semantics); selection is client-side state (no fetch, no URL change). Grid below: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (breakpoint choice within design's 2/3/4; base 1-col keeps 375px overflow-free). Filtered-to-empty → empty card (see UI Considerations). Sorting of apps within a group: keep server order (displayOrder/name), no client re-sort.
- **AppCard** (D-03, visual layer only; prop contract unchanged): kit Card `p-6` wrapped in `group transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lvl-2` + `focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent` (card is non-interactive; single focusable = the CTA link, keyboard order = visual order); header row: logo 40px `rounded-card object-cover` or initial tile `bg-surface-3 text-text-2` (`name.charAt(0)`), name `text-sm font-semibold text-text-1 truncate`, category `text-xs text-text-3`; description `text-sm text-text-2 line-clamp-2`; health row `text-xs`: `credentialCount > 0` → `CheckCircle` success + "{N} akun tersimpan" (mono digit), else `WarningCircle` warning + "Belum ada akun"; CTA: `credentialCount > 0` → primary "**Buka**" (Link styled as kit primary: `block w-full rounded-control bg-accent py-2 text-center text-sm font-semibold text-white hover:opacity-90` → `/portal/app/{slug}` `target="_blank" rel="noopener noreferrer"`) else secondary "**Simpan Kredensial**" (Link secondary classes → `/portal/credentials?app={slug}`). Accessibility: img `alt={name}`, CTA link text `text-sm` (Body size, meets the contrast/large-text threshold), focus ring visible.

### 4. SSO launch & failure surfaces (R3, R5)
- **SSOAutoSubmit / SSORerouteSubmit**: restyle the interstitial sheet (icon tile + "Mengalihkan ke {app.name}..." + animate-spin loader); the opening auto-submit FORM (fields, target `_blank`, POST action) UNTOUCHED — no JS change.
- **NoCredential / CorruptCredential / AccessDenied**: shared centered-sheet layout (shell `flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10`; content `text-center max-w-[400px]`): 56px `rounded-sheet` tinted tile (`bg-warning-subtle border-warning/30` for No/Corrupt, `bg-danger-subtle border-danger/30` for AccessDenied — color carries meaning; icon 24px `WarningCircle`/`WarningTriangle`/`ShieldWarning`); title `font-display text-xl font-semibold`; body `text-sm text-text-2` (line-height 1.6 per Body row — inherited from globals.css); CTA kit primary/secondary; links + audit calls UNCHANGED.
- **AccountSelector**: centered sheet; title "Pilih Akun" `font-display text-xl`; account rows `flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-1 px-4 py-3 text-sm hover:bg-surface-2`, selected row `border-accent/40 bg-accent-subtle` + `Check` 16 in accent; label `font-semibold text-text-1` + sub `font-mono tabular-nums text-xs text-text-3`; "Batal" ghost; selection dispatch UNCHANGED.
- **OnboardingWizard**: layout `p-8 max-w-[900px] mx-auto`; title `font-display text-xl`; body `text-sm text-text-2`; each group = kit Card `p-4` with header `flex items-center gap-2 font-semibold text-text-1` + native checkbox with `accent-accent` color class (single-screen flow UNCHANGED — see UI Considerations ⚠); app rows `pl-7 py-1 text-sm text-text-2`; group-with-no-apps row "Tidak ada aplikasi dalam grup ini." `text-xs text-text-3`; footer: Simpan (primary) + Lewati (secondary, onboarding only); `submit(skip)` POST body + redirect UNCHANGED.
- **SSOCredentialVault + `/portal/credentials`**: page header (eyebrow "PORTAL SSO", H1 "Kredensial" `font-display text-2xl`, sub `text-sm text-text-2`); app section header card: logo 56px `rounded-sheet object-cover` + name `font-display text-xl font-semibold` + `LockKey` 12 hint "Kredensial tersimpan (mode Vault)" `text-xs text-text-3`; account rows in kit Cards: label Badge/`text-xs` header, username + password rows in `rounded-control border border-border bg-surface-0` mono inputs (`font-mono tabular-nums`), ghost icon buttons Copy/`Check`(success on copied)/`Eye`/`EyeSlash`; password NEVER prefilled on load (behavior kept); "Buka Halaman Login {app.name}" ghost Link + `ExternalLink` 16; delete = `Trash` danger ghost → kit ConfirmDialog ("Hapus Kredensial?"); Phosphor swap: `FiCopy→Copy, FiCheck→Check, FiEye→Eye, FiEyeOff→EyeSlash, FiExternalLink→ExternalLink, FiLock→LockKey, FiKey→Key, FiSave→FloppyDisk, FiTrash2→Trash, FiPlus→Plus, FiChevronDown→CaretDown`; `?app=` auto-scroll behavior kept.
- **`/portal/settings`** (incl. `VisibilitySettings`): page shell restyle (Card sections: change password, own sessions list with revoke + ConfirmDialog, visibility toggles = wizard settings mode reuse); data wiring unchanged.

### 5. Portal admin ledgers (R4, D-06/D-07) — 5 desks, Table-kit family
Mirror the Phase 10 users desk structure (`app/admin/users/page.tsx`) byte-for-byte in behavior, token-native in chrome: page header (title `font-display`, result count `font-mono text-xs text-text-3`); filter bar (kit Input search + Select(s) + export buttons ghost `DownloadSimple`; **URL construction of filters/CSV/JSON export and pagination params UNCHANGED**); sortable `Table` kit (`TableColumn.sortKey`, `aria-sort` comes from kit, sort state local); numeric cells `font-mono tabular-nums text-text-2`; timestamps `font-mono tabular-nums text-xs text-text-3`; row hover highlight (kit); pagination with per-page counts (same shape as users desk); empty state as Phase 10 standard.
- **RBAC role badges** (icon+label, NEVER raw strings — design §7.5): reuse the users-desk `roleBadge` pattern extended for the four labels: SUPER ADMIN → tone `danger` + `Lightning` 12; ADMIN → tone `danger` + `ShieldCheck` 12; EDITOR → tone `info` + `CircleUser` 12; VIEWER → tone `neutral` + `Eye` 12. App `isPublic` badge: "Publik" `success` / "Terbatas" `neutral` (+ `LockKey` for restricted).
- **portal-sessions**: status Badge (aktif `success` / dicabut `neutral`), expiry mono, revoke = danger ghost + ConfirmDialog "Cabut Sesi?".
- **portal-audit**: stay a Table — NO timeline rail (D-07, deferred); outcome Badges mirrored from admin audit desk (success/danger/warning tones per outcome).
- **portal-users**: status Badge aktif/nonaktif (success/neutral), role badges, mono access counts.
- **portal-apps / portal-groups**: isPublic badge (apps), member counts mono, group names + app counts (groups).

### 6. Motion & interaction rules (all surfaces)
`--motion-fast` 150ms / `--motion-standard` 300ms, `ease` curve from tokens; transform/opacity only (`transition-transform`, `transition-colors`, `transition-opacity`); hover raise on launch cards only (150ms); exits faster than enters; global `prefers-reduced-motion` block already in globals.css — nothing new to add. All icon-only buttons get `aria-label`; inputs have visible labels; `:focus-visible` rings come from the kit (`outline-accent`).

### 7. Verification gates (SPEC R5 / CONTEXT D-08 — recap)
- `npx tsc --noEmit` exit 0 after every task; scoped `npx eslint <touched files>` 0 errors.
- Static grep on touched files: 0 `react-icons`, 0 raw hex, 0 `style={{` chrome; tokens + Phosphor only.
- OPD-1: `git diff` empty on `lib/portal-access.ts`; `getAccessiblePortalApps` not in touched files. OPD-4: no stale `portalUserId_appId` compound lookup introduced.
- Screenshots of both themes on every surface = bonus when an env can render (PRE-1); otherwise document the limitation in the verification report.
- Manual E2E checklist (login → grid → save credential → SSO launch → failure path → lockout → audit rows) documented with per-step sign-off.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required — shadcn not initialized (custom Phase 7 token system locked by UIUX-01; `components.json` absent) |
| Third-party | none | N/A — no third-party registries; no blocks fetched. Evidence: no `npx shadcn` usage anywhere in repo/plan — 2026-08-15 |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending