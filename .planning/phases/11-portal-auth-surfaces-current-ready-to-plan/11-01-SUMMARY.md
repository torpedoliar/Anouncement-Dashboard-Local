---
phase: 11-portal-auth-surfaces
plan: 01
subsystem: auth
tags: [nextauth, react, tailwind, phosphor, portal-sso]

# Dependency graph
requires:
  - phase: 00-design-system-foundation
    provides: token set (surface/text/border/accent/danger, radius-sheet, shadow-lvl-2), ui kit (Input/Button/Card), font-display (Sora)
provides:
  - components/auth/AuthFrame.tsx — shared presentational auth frame (brand tile bg-santos-red, wordmark, eyebrow/title/subtitle, inline danger error slot, footer slot) on tokens + Phosphor
  - app/portal-login/page.tsx — token-native, signIn("portal-credentials") byte-identical, locked error mapping (server messages verbatim / CredentialsSignin → "NIK atau password salah" / generic fallback)
  - app/(auth)/admin-login/page.tsx — token-native on AuthFrame, split panel removed, signIn("credentials") + redirect /admin identical
affects: [11-portal-auth-surfaces remaining plans: portal grid, secondary surfaces, portal ledgers; any future auth surface]

# Actuals
actuals:
  tokens: 7200  # chars/4 over realized diff (28831 chars)
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []  # no new deps (UIUX-01)
  patterns:
    - "Auth surfaces = AuthFrame (presentational, no 'use client') + per-page client form; error text flows down as a prop into the danger slot"
    - "Error mapping: server messages via prefix match (lockout message carries variable minutes), NextAuth generic codes → localized message, fallback generic"
    - "Visible labels rendered by the page with contract classes (text-xs font-semibold text-text-2 mb-2); kit Input used chrome-only without its built-in label"

key-files:
  created:
    - components/auth/AuthFrame.tsx
  modified:
    - app/portal-login/page.tsx
    - app/(auth)/admin-login/page.tsx

key-decisions:
  - "Brand block (tile + wordmark) rendered centered above the card inside AuthFrame's shell (plan action 'di atas card'; design doc §7.1 sequence)"
  - "Page-level labels with UI-SPEC §1 classes instead of kit Input's built-in label (kit renders text-sm font-medium text-text-1 mb-1.5 — off-contract); kit untouched"
  - "Admin page keeps its own shell (link + AuthFrame); slight vertical scroll from the back-link row accepted as literal 'link di atas card'"
  - "Error region uses rounded-card to match the existing in-app banner pattern (AnalyticsDashboard)"

patterns-established:
  - "Login frame recipe for later auth surfaces: AuthFrame + kit Input/Button + Phosphor, zero hex/style/react-icons, 4px grid, sizes 12/14/20/24 weights 400/600 only"

requirements-completed: [UIUX-05]

coverage:
  - id: D1
    description: "Portal login frame token-native on shared AuthFrame with locked error mapping; signIn('portal-credentials', { redirect: false, callbackUrl: '/portal' }) and redirect/refresh path byte-identical"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "npx eslint components/auth/AuthFrame.tsx app/portal-login/page.tsx (exit 0)"
        status: pass
      - kind: other
        ref: "static greps: no raw hex / style={{ / react-icons / non-400-600 weights / arbitrary sizes / half-step gaps on the 3 touched files"
        status: pass
      - kind: other
        ref: "git diff -- app/portal-login/layout.tsx empty; grep 'portal-credentials' app/portal-login/page.tsx present"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin login frame token-native on AuthFrame; split-panel branding column removed; 'Kembali ke Beranda' link and footer kept; signIn('credentials', { redirect: false }) + router.push('/admin') unchanged"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "npx eslint 'app/(auth)/admin-login/page.tsx' (exit 0)"
        status: pass
      - kind: other
        ref: "static greps: no raw hex / style={{ / react-icons on the file"
        status: pass
      - kind: other
        ref: "git diff -- 'app/(auth)/layout.tsx' empty; grep '\"credentials\"' on the page present"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-08-15
status: complete
---

# Phase 11: Portal & Auth Surfaces — Plan 01 Summary

**Shared token-native AuthFrame (brand tile, wordmark, inline danger error slot) now renders both the portal and admin login frames with NextAuth behavior byte-identical — the phase's tracer recipe**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-15
- **Completed:** 2026-08-15
- **Tasks:** 2 (tracer + follow-on; both complete)
- **Files modified:** 3 (1 created, 2 restyled)

## Accomplishments

- New `components/auth/AuthFrame.tsx`: presentational shared auth frame — shell `bg-surface-0 px-5 py-10`, 48px `bg-santos-red` "S" tile + "SANTOS JAYA ABADI" wordmark, eyebrow/title/subtitle slots, inline `role="alert"` danger region (`border-danger/30 bg-danger-subtle` + WarningCircle 20), footer slot — tokens + Phosphor only.
- `/portal-login` restyled chrome-only on AuthFrame + kit Input/Button; `signIn("portal-credentials", { redirect: false, callbackUrl: "/portal" })` and `router.push("/portal")`/refresh unchanged; locked error mapping shipped (server messages via prefix pass verbatim, CredentialsSignin → "NIK atau password salah", catch → "Terjadi kesalahan. Silakan coba lagi.").
- `/admin-login` restyled on AuthFrame; split-panel gradient branding column removed (D-04); back link + footer kept; Phosphor EnvelopeSimple/LockKey leading icons; CTA "Masuk"/"Masuk..." sentence case; `signIn("credentials", { redirect: false })` + `router.push("/admin")` unchanged.
- Zero raw hex / inline styles / react-icons in the three touched files; type discipline 12/14/20/24, weights 400/600 only; 4px grid.

## Task Commits

Each task was committed atomically:

1. **Task 1: AuthFrame baru + halaman login portal token-native** - `5339ab9` (feat)
2. **Task 2: Halaman admin-login token-native di atas AuthFrame (panel split dibuang)** - `db2822f` (feat)

**Plan metadata:** no separate plan doc commit in this run (plan shipped earlier as 265907b).

## Files Created/Modified

- `components/auth/AuthFrame.tsx` - new shared presentational auth frame (shell, brand block, card, error/footer slots)
- `app/portal-login/page.tsx` - chrome only: AuthFrame + kit Input/Button, locked error mapping, signIn/push/refresh identical
- `app/(auth)/admin-login/page.tsx` - AuthFrame-based, split panel removed, signIn("credentials")/push("/admin") identical

## Decisions Made

- Brand block centered above the card (plan action "di atas card", design doc §7.1 "brand mark, app name, centered card") — shown on both login pages.
- `bg-santos-red` verified to resolve to #ED1C24 (tailwind.config.ts `santos.red`) — exactly the UI-SPEC brand red; used on the brand tile only (masthead-neutral).
- Page-level `<label htmlFor>` elements with contract classes (`text-xs font-semibold text-text-2 mb-2`) — kit Input's built-in label (text-sm/font-medium/mb-1.5) is off-contract and unconfigurable; the kit itself is untouched.
- Error region `rounded-card` (8px) matching the existing in-app banner pattern.
- Lockout message matched by prefix ("Akun terkunci. Coba lagi dalam ") because it carries a variable minute count (frozen `lib/portal-auth.ts`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Visual/theme rendering (paper/night, 375px) could not be checked: `npm run build` is broken on missing `NEXTAUTH_URL` and dev render on the localStorage shim + local Postgres (PRE-1 — documented limitation per D-08, no fix attempted). All automated gates (tsc, scoped eslint, static greps, diff gates) pass as specified by the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AuthFrame is the proven recipe for every remaining auth-adjacent surface in phase 11 (portal grid header, failure sheets reuse the same centered-sheet/shell + token vocabulary).
- Later plans can copy the error-slot and loading-slot pattern (primary CTA disabled + "Masuk...") without re-deriving.
- Visual sign-off of both frames (both themes) still owed on a working env (PRE-1).
- Remaining dirty working-tree files (CLAUDE.md, graphify-out/*, "From Server Prod/", docs/agents/, docs/superpowers/plans/) predate this plan and were left untouched/unstaged.

---
*Phase: 11-portal-auth-surfaces*
*Completed: 2026-08-15*