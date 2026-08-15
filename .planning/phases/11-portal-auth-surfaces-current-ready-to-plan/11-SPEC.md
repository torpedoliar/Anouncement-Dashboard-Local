# Phase 11: Portal & Auth Surfaces — Specification

**Created:** 2026-08-15
**Ambiguity score:** 0.11 (gate: ≤ 0.20)
**Requirements:** 5 locked

## Goal

The portal authentication and app surfaces — login frame, app grid, credential/secondary surfaces, and portal admin ledgers — move from bespoke raw-hex/`react-icons/fi` chrome to the Phase 0 token system, including the admin login frame, with portal SSO behavior proven unchanged end-to-end.

## Background

Phase 0–3 shipped the admin shell + content + data surfaces token-native (evidence: tokens in `app/globals.css`, `components/ui/` kit, token-class `AdminSidebar`/`StatTile`). The portal side was deliberately excluded until now (spec §8 boundary from HANDOFF-PHASE3). Today the portal surfaces (`/portal-login`, `/portal` grid, secondary surfaces, portal admin ledgers) still render with raw hex, inline `style` chrome, and `react-icons/fi` — the last non-token area of the app.

SSO backend is shipped and functional (Phases 1–6.4, verified by repo scan): `lib/portal-auth.ts` (NextAuth portal instance), `lib/portal-crypto.ts` (AES-256-GCM), `lib/portal-access.ts` (RBAC helpers `canAccessPortalApp`/`getAccessiblePortalApps`), audit via `lib/audit.ts`, routes `/portal-login` → `/portal` → `/portal/app/[slug]`.

State blockers: PRE-1 (`npm run build` broken on missing `NEXTAUTH_URL`; dev render broken by `localStorage` shim + local Postgres down — do NOT fix, gates = tsc/eslint/static/screenshot/manual E2E), PRE-2 (ingest has no dedicated P4 plan doc — UIUX-05 synthesized from `ui-ux-rework-design.md` §5 — plan-phase grounds truth against the repo), OPD-1..6 (six open decision points from ingest; see ROADMAP).

## Requirements

1. **Portal + admin auth frames token-native**: The portal login frame and the admin login frame render token-native with zero chrome, while login/lockout/session behavior stays identical.
   - Current: `/portal-login` and `/admin-login` are plain/raw-chrome frames; portal auth works via `portal-auth.*` cookies, DB-backed revocation, lockout rules
   - Target: Both frames restyled on tokens (`bg-surface-*`, `text-text-*`, `border-border`, `bg-accent`, `rounded-sheet`, `shadow-lvl-*`), Phosphor icons, brand mark + app name + centered card + inline invalid-credentials error; same cookIe names, same audit events, same redirects
   - Acceptance: Diff shows only UI files and no route/cookie/audit/redirect change; frames render in both paper/night themes (screenshot checked); invalid-credentials inline error present; lockout message present

2. **Portal grid — grouped launch cards**: The app grid shows grouped launch cards with logo/icon, name, description, "Buka" action; hover raise, keyboard-navigable, responsive 2/3/4 columns by breakpoint.
   - Current: grid renders from `getAccessiblePortalApps()` (frozen — do NOT touch `lib/portal-access.ts`; OPD-1); today's RBAC/visibility semantics are the single source of truth
   - Target: token-native cards keep identical visibility semantics; SSO launch still opens a new tab auto-submitting the stored-credential form; multi-credential apps use the account-picker path; failure states (NoCredential / CorruptCredential) still render and audit
   - Acceptance: tsc+eslint green; grid empty state ("tidak ada aplikasi" est.) renders for a portal user with zero accessible apps (edge-probe R2-empty); hover+, keyboard Enter launches; screenshot at 375px no overflow; launch in new tab with auto-submit preserved

3. **Portal secondary surfaces**: `PortalHeader`, `/portal/settings`, `SSOCredentialVault`, `OnboardingWizard` (multi-step progress), `AccountSelector`, `AccessDenied`, `CorruptCredential`, `NoCredential` restyled token-class only.
   - Current: these render raw chrome/`react-icons/fi` in places
   - Target: every surface uses token classes, `font-display`/mono discipline, Phosphor icons; no raw hex, no inline style chrome; interactive tokens only under `overflow-x-auto`
   - Acceptance: grep of the touched files finds zero `react-icons/fi`, zero raw hex outside DB`primaryColor` data (none expected here), zero `style={{` chrome; screenshots of both themes

4. **Portal admin ledgers**: portal-sessions, portal-audit, portal-users, portal-groups desks restyle in the ledger family (Timestar sheet tables with `aria-sort`, mono numerals, filter bar, pagination with counts) plus RBAC role badges icon+text.
   - No new routes, no API filters/export changes (existing CSV/JSON export, pagination).
   - Acceptance: same filter/export parameter sets byte-identical; table rows keyboard-sortable; badges carry icon+label; screenshot.

5. **Zero-regression**: No API/cookie/session/schema/portal-access change; git diff vs main baseline contains only UI files; OPD-1 (portal-access frozen) and OPD-4 (sweep stale `portalUserId_appId`) rechecks pass; `npx tsc --noEmit` + scoped eslint green; manual E2E (portal login → grid → store credential → SSO launch → failure path → lockout → audit rows) done on a working env and passes.
   - Acceptance: verification badge shows tsc 0 −, eslint scoped 0 issue, and screenshots; a manual E2E checklist documented with result — every step expecting red/green pass

## Boundaries

**In scope:**
- Portal login frame (`/portal-login` + auth card components)
- Admin login frame (`/admin-login`) restyle only
- Portal grid (cards, grouping, empty state) — presentation only, `getAccessiblePortalApps()` untouched (OPD-1)
- SSO launch UI surfaces: layout, account picker, failure/denied screens (rendering + audit calls unchanged)
- Portal secondary surfaces: settings, credential vault, onboarding progress, header
- Portal admin ledgers: portal-sessions, portal-audit, portal-users, portal-groups (kit tables, badges, filters, export, pagination unchanged)
- Token migration + Phosphor icons everywhere in the touched files

**Out of scope:**
- Any change to portals security, cookie storage, session semantics, session revocation, access rules — OPD-1 says not touched; anything requiring an enum/API change is OPD-2/P2+, this phase only restyles
- Portal user self-registration, PORTAL_ADMIN delegation, email notification, health probes — 00-overview deferred
- Approval workflow re-introduction ("Perlu Persetujuan" status was removed; do NOT add approval UI/schema) 
- New SSO modes (REDIRECT/PROXY/TOKEN, REROUTE/VAULT beyond existing out-of-band implementation) — enum change deferred (OPD-2)
- SSOCRUD: password reset flows outside the auth frame, PortalUser group admin pages — separate
- Admin CMS data surfaces (Phase 10, done) — no regression, but not restyled again

## Constraints

- **Gates:** `npx tsc --noEmit`, scoped `npx eslint <touched files>`, static grep (react-icons → 0, raw hex → 0, style chrome → 0), browser screenshot on both themes; `npm run build` / dev server NOT required (broken permanently, PRE-1)
- No modifications to `.env`, `next.config`, `postcss.config.mjs`, Tailwind version or schema module
- Should strict tokens: `bg-surface-*`, `text-text-*`, `border-border`, `accent`, `rounded-*`, `shadow-lvl-*`, font families, status/ semantic tokens (success/warning/danger) — Phosphor icons only
- Do NOT touch `lib/portal-access.ts` (OPD-1), `lib/portal-crypto.ts`, `lib/portal-auth.ts`, `lib/site-access.ts`, `middleware.ts` (outside scope)
- Motion: `--motion-*` tokens where motion exists; `prefers-reduced-motion` honored; 150–300ms transform/opacity
- Accessibility: visible focus rings (global already), `aria-label` on icon-only buttons, labels for inputs, table widgets keyboard-navigable via native elements
- E2E manual checklist must be documented in the plan

## Acceptance Criteria

- [ ] All portal + admin auth frames render token-native with identical cookies/audit/redirect behavior (no code diff outside the touched UI files)
- [ ] Grid empty state + 1 app + N apps (2/3/4 col breakpoints) render with zero overflow at 375px, launch opens in new tab, account picker appears for multi-credential from a fresh session
- [ ] The 5 portal ledgers keep exactly the same API contract (filter params, export CSV/JSON, pagination shape) — verified by byte-compare of URL construction
- [ ] Grep of all touched files: 0 `react-icons`, 0 raw hex, 0 `style={{` chrome; tokens + Phosphor everywhere
- [ ] `npx tsc --noEmit` exit 0 after every task
- [ ] `npx eslint <touched files>` contains 0 errors with only pre-existing warnings
- [ ] `npx tsx scripts/check-chart-theme.ts` still passes if chart-theme touched (should not need)
- [ ] OPD-1 recheck: `git diff` on `lib/portal-access.ts` is empty; `getAccessiblePortalApps` not in touched-file list
- [ ] OPD-4 recheck: grep of touched code for stale `portalUserId_appId` compound lookup: none introduced
- [ ] E2E manual checklist passes on a configured env (documented in final review just .md; each step sign-off)

## Edge Coverage

**Coverage:** 5/6 applicable edges resolved · 1 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| empty (grid with zero accessible apps) | R2 | ✅ covered | acceptance: "grid empty state token-native renders for user with 0 accessible apps" |
| encoding (app name length / display) | R2 | ⛔ dismissed | names drawn as-is with CSS ellipsis; no byte/grapheme logic in UI |
| unclassified (auth frames) | R1 | ✅ covered | paper/night parity + invalid-credentials edge existing in R1 acceptance |
| unclassified (secondary surfaces) | R3 | ✅ covered | 0-chrome grep is the check; NoCredential vs CorruptCredential both in R3 acceptance |
| unclassified (ledgers) | R4 | ✅ covered | export byte-compare acceptance; 0-result page paper |
| idempotency | R5 | ⛔ dismissed | E2E is a manual checklist (not an automated op); same env rows |
| concurrency | R5 | ⛔ dismissed | no concurrent mutation in visual-only restyle |
| zero-app grid | R2 | ⚠ UNRESOLVED | visual only; planner treats empty-grid copy as assumption placeholder — confirm exact wording during plan phase |

## Prohibitions (must-NOT)

**Coverage:** 3/3 applicable prohibitions resolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT modify `lib/portal-access.ts` / `lib/portal-crypto.ts` / `lib/portal-auth.ts` / `lib/auth.ts` / `lib/site-access.ts` / `middleware.ts` | R5 | resolved | verification: judgment — git-diff empty on those files is the check |
| MUST NOT introduce raw HTML `<img>` without `alt` / no `react-icons`/hex in touched files | R3, R5 | resolved | verification: judgment — grep audit in plan + ta; eslint jsx-a11y pre-existing |
| MUST NOT alter cookie names, session schema, or audit taxonomy (aktion/entityType enums) | R5 | resolved | verification: judgment — diff-based + manual E2E |

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      | ROADMAP+criteria locked             |
| Boundary Clarity   | 0.90  | 0.70 | ✓      | admin+portal frames, OPD-2 excluded |
| Constraint Clarity | 0.88  | 0.65 | ✓      | frozen access, frozen behaviors     |
| Acceptance Criteria| 0.88  | 0.70 | ✓      | 10 checkboxes + screenshots         |
| **Ambiguity**      | 0.11  | ≤0.20| ✓      |                                      |

## Interview Log

| Round | Perspective     | Question summary                  | Decision locked                       |
|-------|-----------------|-----------------------------------|---------------------------------------|
| 1     | Researcher     | Plan-P4 scope from handoff §8     | Portal ledgers, auth frames, grid, secondary surfaces |
| 1     | Researcher     | Boundary admin vs portal?        | Need explicit the admin login frame — open |
| 2     | Boundary Keeper| OPD-1 / access helpers touchable? | Access 100% frozen; restyle only      |
| 2     | Boundary Keeper| Verification visual?              | Screenshot + gates (tsc/eslint), dev/env broken excluded |
| 2     | Boundary Keeper| Auth frames scope                  | Admin + portal login frames both in scope |
| 3     | Simplifier     | Ledger family uniformity          | Table kit + mono numerals; no new deps |

---

*Phase: 11-portal-auth-surfaces*
*Spec created: 2026-08-15*
*Next step: /gsd-discuss-phase 11 — implementation decisions (how to build what's specified above)*