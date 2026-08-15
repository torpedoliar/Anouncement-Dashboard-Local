---
phase: 11-portal-auth-surfaces
plan: 03
subsystem: ui
tags: [portal, react, tailwind, phosphor, sso, tokens]

# Dependency graph
requires:
  - phase: 00-design-system-foundation
    provides: token set (surface-0..3/text-1..3/border/accent+subtle/success/warning/danger+subtle, radius-control/card/sheet, shadow-lvl-1/2), ui kit (Card/Button/Input/ConfirmDialog), font-display (Sora), font-mono
  - phase: 11-portal-auth-surfaces (11-01)
    provides: AuthFrame shell recipe (flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10; eyebrow uppercase tracking-[0.2em] text-accent; font-display titles) + warning/danger tinted banner pattern (border-warning/30 bg-warning-subtle)
  - phase: 11-portal-auth-surfaces (11-02)
    provides: page header recipe (eyebrow PORTAL SSO + H1 font-display text-2xl), empty-card pattern (max-w-[400px] rounded-sheet p-10 + 56px tile + icon 24), CTA Link-as-button classes, icon/token vocabulary for portal
provides:
  - components/portal/AccessDenied.tsx, NoCredential.tsx, CorruptCredential.tsx — shared centered-sheet failure family (shell flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10; content text-center max-w-[400px]; 56px rounded-sheet tinted tile: No/Corrupt bg-warning-subtle border-warning/30 + WarningCircle 24 / Warning 24, AccessDenied bg-danger-subtle border-danger/30 + ShieldWarning 24; title font-display text-xl font-semibold; body text-sm text-text-2; CTA hrefs identical)
  - components/portal/AccountSelector.tsx — centered sheet (w-full max-w-[400px]), rows flex justify-between rounded-control border-border bg-surface-1 px-4 py-3 + label font-semibold + sub mono text-xs, href ?credentialId= mechanism kept, Batal ghost Link → /portal (permitted addition)
  - components/portal/SSOAutoSubmit.tsx, SSORerouteSubmit.tsx — token interstitial sheet (max-w-[400px] rounded-sheet p-8 shadow-lvl-2; 56px logo tile; title SSO ke {name}/(Reroute); status copy verbatim; animate-spin border-border border-t-accent spinner replacing inline keyframes; CheckCircle success); hidden auto-submit forms BYTE-IDENTICAL (id sso-form / sso-reroute-form, method/action/field names+values; form style attr → className="hidden"), 1.5s submit timer unchanged
  - components/portal/SSOCredentialVault.tsx — sheet header (logo 56px rounded-sheet + LockKey 12 hint); mono inputs rounded-control bg-surface-0 (password tracking mask preserved); 42px ghost icon buttons (Copy/Check/Eye/EyeSlash, aria-labels); window.open noopener,noreferrer + execCommand copy fallback UNCHANGED; no delete
  - components/portal/OnboardingWizard.tsx — single-screen restyle (assumption ⚠ applied: no step nav invented): mx-auto max-w-[900px] p-8; kit Card p-4 per group + native checkbox accent-accent; app rows pl-7 py-1; empty group text-xs; Simpan primary / Lewati secondary (onboarding only); POST visibility body + redirect byte-identical
  - components/portal/VisibilitySettings.tsx — pass-through verified (zero diff)
  - app/portal/settings/page.tsx — token shell + eyebrow PORTAL SSO + H1 Pengaturan; no new sections (assumption applied)
  - app/portal/credentials/page.tsx — header (H1 Kredensial + sub verbatim); kit Card accordion (CaretDown rotate transition-transform duration-200); account rows rounded-control bg-surface-0 + mono Terakhir dipakai; danger-ghost Trash 16 → kit ConfirmDialog (copy existing); add form kIT Input/Button (password never prefilled); empty state Key 24 tile; API URLs/payloads unchanged; ? app= auto-expand kept
affects: [11-portal-auth-surfaces remaining plans: portal admin-ledgers desks]

# Actuals
actuals:
  tokens: 9100  # chars/4 over realized diff (~36400 chars removed+added across 3 commits)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []  # no new deps — @phosphor-icons/react already present (2.1.10)
  patterns:
    - "Failure/secondary sheets = family shell (flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10) + 56px rounded-sheet tinted tile (bg-warning-subtle/bg-danger-subtle + border-*/30) + font-display text-xl title + text-sm text-text-2 body + kit-style CTA link (Link-as-button, kit Button is <button>)"
    - "Spinner = Tailwind animate-spin on a token ring (h-4 w-4 rounded-full border-2 border-border border-t-accent), replacing inline keyframes; form visibility = class 'hidden' (style={{display:'none'}} would fail the no-inline-style gate)"
    - "Frozen-body proof = keyword-filtered git diff: diff lines containing frozen tokens (method=/action=/type=\"hidden\", groupIdsOff/appIdsOff/appIdsOn/skip, window.location.href, /api/portal/credentials) print nothing"
    - "Phosphor 2.1.10 renamed icons: FiExternalLink → ArrowSquareOut, FiAlertTriangle → Warning — the plan's Fi→Phosphor mapping table deviated where the icon name no longer exists"

key-files:
  created: []  # no new files
  modified:
    - components/portal/AccessDenied.tsx
    - components/portal/NoCredential.tsx
    - components/portal/CorruptCredential.tsx
    - components/portal/AccountSelector.tsx
    - components/portal/SSOAutoSubmit.tsx
    - components/portal/SSORerouteSubmit.tsx
    - components/portal/SSOCredentialVault.tsx
    - components/portal/OnboardingWizard.tsx
    - components/portal/VisibilitySettings.tsx (verified, zero diff — pass-through confirmed)
    - app/portal/settings/page.tsx
    - app/portal/credentials/page.tsx

key-decisions:
  - "Phosphor 2.1.10 does not export WarningTriangle/ExternalLink — used Warning (triangle glyph = FiAlertTriangle) and ArrowSquareOut (= FiExternalLink); iconographic intent preserved"
  - "AccountSelector sub-line renders the credential id (mono text-xs) — the only sub-datum in the props; id already exposed in the row's ?credentialId= URL; label-only exposure per T-11-11 stands"
  - "Centered sheet text-center for failure states, left-aligned for AccountSelector (rows are data rows)"
  - "CorruptCredential keeps both body sentences (existing copy preserved; UI-SPEC's single sentence is the minimum, not exhaustive); first sentence text-text-2, second (detail) text-text-3 with strong text-text-1"
  - "Legacy unicode ✓/⚠ glyphs in the accordion health line replaced by color + mono-digit discipline (AppCard 11-02 pattern); strings 'N akun tersimpan'/'Belum ada akun' kept"
  - "Credentials H1 'Kredensial' per UI-SPEC (legacy 'Kelola Kredensial' dropped by contract)"

patterns-established:
  - "Portal secondary surface recipe: family shell + tinted icon tile + font-display title + text-sm body + kit CTA (Link) for failure states; sheets with paths for interstitials; wizard = Card checklist (accent checkboxes) with byte-identical POST body; credentials = kit Card accordion + kit Input/ConfirmDialog, empty form state"

requirements-completed: [UIUX-05]

coverage:
  - id: D1
    description: "Centered-sheet family (AccessDenied/NoCredential/CorruptCredential) + AccountSelector token-native; copy, hrefs (?portal/credentials?app= / ?portal), credentialId selection unchanged"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "npx tsc --noEmit exit 0"
      - kind: other
        ref: "scoped eslint 4 files: 0 errors"
      - kind: other
        ref: "static greps 0 hex / 0 style={{ / 0 react-icons / 0 half-step, credentialId= present (2)"
        status: pass
  - id: D2
    description: "Interstitials + vault token-native; hidden forms byte-identical; 1.5s timer, window.open noopener, execCommand fallback untouched; no delete"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "form-field counts 5/4 matched plan measured; diff-filtered lines method=/action=/type=hidden EMPTY; formRef.current.submit() ×2 present"
        status: pass
      - kind: other
        ref: "tsc exit 0, eslint 0 errors, greps empty on 3 files"
        status: pass
  - id: D3
    description: "Wizard/settings/credentials token-native; single-screen kept; visibility/credential API contracts + password-never-prefilled + ?app= auto-expand unchanged"
    requirement: UIUX-05
    verification:
      - kind: other
        ref: "groupIdsOff ×2, /api/portal/visibility ×1, window.location.href ×1, /api/portal/credentials ×3; password value only from empty form state; diff-filtered body lines empty"
        status: pass
      - kind: other
        ref: "tsc exit 0, eslint 0 (errors), greps 0"
        status: pass
    human_judgment: false

# Metrics
duration: 2h 20min
completed: 2026-08-16
status: complete
---

# Phase 11: Portal & Auth Surfaces — Plan 03 Summary

**All 11 portal SSO secondary surfaces restyled token-native with zero chrome — failure sheets, interstitials, vault, wizard, settings, and credentials — while the SSO auto-submit forms, 1.5s timers, clipboard fallback, visibility POST body, and credential API contracts stay provably frozen**

## Performance

- **Duration:** 2h 20 min
- **Started:** 2026-08-16
- **Completed:** 2026-08-16
- **Tasks:** 3 (failure family; interstitials+vault; wizard/settings/credentials)
- **Commits:** 3 (`31500e5`, `1055948`, `903dbe5`)

## What shipped

1. **Centered-sheet family** — AccessDenied/NoCredential/CorruptCredential share the shell (flex min-h-screen center, bg-surface-0, tile 56 rounded-sheet tinted per status: warning-subtle for the two credential failures, danger for denial; icon 24 WarningCircle/Warning/ShieldWarning), title/body/CTA hooks per copy contract; hrefs identical. AccountSelector is now a centered sheet (was p-32 top-aligned) with mono credential-id sub-line + the permitted Batal ghost to /portal.

2. **Interstitials + vault** — SSOAutoSubmit/SSORerouteSubmit token sheets with animate-spin token spinner replacing the inline keyframes; the hidden forms (id sso-form / sso-reroute-form, method, action, field names/values, extraFields map, conditional credentialId) are byte-identical incl. the 1500ms timer. Vault has mono copy inputs, 42px ghost copy/reveal buttons, preserved window.open noopener,noreferrer and the execCommand fallback; no delete capability introduced.

3. **Wizard/settings/credentials** — wizard single-screen card+checkbox restyle with the frozen POST replace; settings page shell + eyebrow; credentials page accordion kit-cards + form/ConfirmDialog + empty state; every fetch URL/payload and auto-expand behavior unchanged; password fields never prefilled.

## Files changed

11 files; `VisibilitySettings.tsx` was verified pass-through (zero diff). See task report for per-file detail.

## Verification

- `npx tsc --noEmit` exit 0
- scoped eslint on all 11 files: 0 errors (3 pre-existing no-img warnings)
- static grep 11 files: 0 raw hex / 0 `style={{` / 0 react-icons / 0 half-step spacing
- form-identity diff (lines holding `method=`/`action=`/`type="hidden"`) EMPTY for both interstitials
- `formRef.current.submit()` ×2; `groupIdsOff` ×2; `window.location.href` ×1; `/api/portal/credentials` ×3
- OPD-1: frozen libs diff empty; OPD-4: no stale compound lookups
- Screenshots not taken (PRE-1: dev/build env broken — documented limitation)

## Assumptions applied

- ⚠ Wizard stays single-screen (no step navigation invented — visibility POST contact unchanged).
- Settings carries only visibility toggles (no change-password/own-sessions added).

## Deviation note (technical only)

Phosphor 2.1.10 renamed two icons used in the plan mapping: warning triangle is `Warning` (plan said WarningTriangle), external-link is `ArrowSquareOut` (plan said ExternalLink). Iconographic intent identical; only the icon names deviate from the plan's mapping table (technical, 404-type renames).

---
*Phase: 11-portal-auth-surfaces*
*Completed: 2026-08-16*