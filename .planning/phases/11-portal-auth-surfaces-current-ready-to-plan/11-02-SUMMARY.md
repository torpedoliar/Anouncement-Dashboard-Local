---
phase: 11-portal-auth-surfaces
plan: 02
subsystem: ui
tags: [portal, react, tailwind, phosphor, nextauth, tokens]

# Dependency graph
requires:
  - phase: 00-design-system-foundation
    provides: token set (surface-0..3/text-1..3/border/accent+subtle/success/warning), ui kit (Card/Button), font-display (Sora), font-mono, radius-control/card/sheet, shadow-lvl-1/2
  - phase: 11-portal-auth-surfaces (11-01)
    provides: AuthFrame recipe (token-only chrome, Phosphor named imports, 4px grid, sizes/weights discipline) + portal-login/auth wiring
provides:
  - app/portal/layout.tsx — token shell (min-h-screen bg-surface-0 text-text-1); session guard redirect("/portal-login") + NextAuthProvider basePath byte-identical
  - components/portal/PortalHeader.tsx — sticky token topbar (border-b border-border bg-surface-1, h-14), wordmark "PORTAL" accent, nav Aplikasi/Kredensial/Pengaturan (SquaresFour/Key/GearSix 16, aria-current, bg-accent-subtle text-accent active), Keluar kit Button secondary sm + SignOut 16 → signOut({ callbackUrl: "/portal-login" }), mobile List/X toggle + slide-down panel rows min-h-11
  - app/portal/page.tsx — token header (eyebrow PORTAL SSO text-accent tracked + H1 "Aplikasi Saya" font-display text-2xl) and locked empty card ("Belum ada aplikasi" + "Buka Pengaturan" → /portal/settings); data pipeline (getServerSession → getPortalLayout → wizard gate → getAccessiblePortalApps → groupBy credential → gridGroups) byte-identical
  - components/portal/GroupedAppGrid.tsx — RESTRUCTURED per D-01: category chip row ("Semua" + per g.name, aria-pressed, client-side state, no fetch/URL), responsive grid grid-cols-1 sm:2 lg:3 xl:4, server sort preserved, group-scoped empty card "Belum ada aplikasi di grup ini."
  - components/portal/AppCard.tsx — kit launch card (Card p-6, hover raise + focus-within outline-accent, logo 40px rounded-card / initial tile bg-surface-3 text-text-2, name truncate text-sm font-semibold, category text-xs text-text-3, description line-clamp-2, health row CheckCircle/WarningCircle + mono digit, CTA "Buka" / "Simpan Kredensial", hrefs + target _blank rel noopener noreferrer intact)
affects: [11-portal-auth-surfaces remaining plans: SSO launch/failure surfaces, credentials vault, settings, onboarding, ledger desks]

# Actuals
actuals:
  tokens: 6100  # chars/4 over realized diff (~24400 chars, 3 commits)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []  # no new deps — @phosphor-icons/react already present
  patterns:
    - "Portal chrome recipe = token-only: zero inline style objects, zero raw hex, zero react-icons; Phosphor named imports only (16 px nav/health icons, 24 px empty tile)"
    - "Card (non-interactive) + single focusable CTA link inside: keyboard order = visual order; focus-visible ring on CTA, focus-within outline on card"
    - "Empty-card pattern duplicated at page level and grid level (files_modified locked — no new shared component): 56 px tinted tile (bg-surface-2, rounded-2xl) + SquaresFour 24 + font-display heading + text-sm body + primary link to /portal/settings"
    - "Category chips = client-side state in GroupedAppGrid ('use client' added); groups data untouched server-side; aria-pressed + role=group"

key-files:
  created: []
  modified:
    - app/portal/layout.tsx
    - components/portal/PortalHeader.tsx
    - app/portal/page.tsx
    - components/portal/GroupedAppGrid.tsx
    - components/portal/AppCard.tsx

key-decisions:
  - "Wordmark uses default text-base size (16 px, inherited) per UI-SPEC §2 literal ('font-display font-semibold text-text-1') — no explicit size class; Montserrat→Sora via font-display mapping"
  - "Group headings kept per section in filtered and 'Semua' views — chips filter sections, they don't remove document structure (section h2 descends from original component)"
  - "Filtered-empty card in GroupedAppGrid is defensive (unreachable today: page filters empty groups before rendering) — renders only when groups.length === 0 or chip matches no group; copy locked per UI-SPEC ('Belum ada aplikasi di grup ini.')"
  - "Mono digit applied to the count span only ('{N} akun tersimpan'), digit + copy on the same success/warning color, per must-have 'mono digit'"
  - "CTA links use the admin established Link-as-primary-button classes (h-10 rounded-control bg-accent … focus-visible outline) — kit Button is a <button>, navigation stays <Link>"

patterns-established:
  - "Portal presentation layer recipe: token shell + sticky header + chip-filtered responsive grid on frozen server pipeline (OPD-1); all state client-side, all semantics server-side"

requirements-completed: [UIUX-05]

coverage:
  - id: D1
    description: "Portal shell token-native (min-h-screen bg-surface-0 text-text-1); session guard redirect('/portal-login'), NextAuthProvider basePath, PortalHeader render untouched; sticky topbar with desktop nav + mobile slide-down panel, no horizontal scroll at 375 px"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "npx eslint app/portal/layout.tsx components/portal/PortalHeader.tsx (0 errors)"
        status: pass
      - kind: other
        ref: "static greps: 0 hex / 0 style={{ / 0 react-icons on both files; redirect('/portal-login') + signOut({ callbackUrl: '/portal-login' }) present"
        status: pass
      - kind: other
        ref: "npm run build — attempted; blocked by environment: next/font cannot fetch Google fonts (fonts.gstatic.com 404 from sandbox) in untouched app/layout.tsx (cc892fb); webpack stops at font loader, no portal-module errors reached"
        status: unknown
  - id: D2
    description: "Grid restructured per D-01: category chips ('Semua' + per group name, aria-pressed, client-side, no URL/fetch), responsive 1/2/3/4-col grid, server order preserved; empty states with locked copy and 'Buka Pengaturan' → /portal/settings"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "npx eslint app/portal/page.tsx components/portal/GroupedAppGrid.tsx (0 errors)"
        status: pass
      - kind: other
        ref: "greps: getAccessiblePortalApps (3) + groupBy (1) + needsOnboarding (2) present; GridApp/GridGroup interfaces unchanged (git show HEAD diff)"
        status: pass
      - kind: other
        ref: "git diff app/portal/page.tsx — presentation-only (imports + header + empty block); pipeline lines byte-identical"
        status: pass
    human_judgment: false
  - id: D3
    description: "AppCard kit launch card: Card p-6 + hover raise + focus-within outline; 40 px logo/initial tile, truncate/line-clamp-2 replacing manual substring, health row mono digit success/warning, CTA Buka (_blank noopener noreferrer) / Simpan Kredensial unchanged hrefs"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
      - kind: other
        ref: "npx eslint components/portal/AppCard.tsx (0 errors; 1 pre-existing @next/next/no-img-element warning carried from old implementation)"
        status: pass
      - kind: other
        ref: "static greps: 0 hex / 0 style={{ / 0 react-icons; target='_blank' + rel='noopener noreferrer' + /portal/credentials?app= present"
        status: pass
    human_judgment: false