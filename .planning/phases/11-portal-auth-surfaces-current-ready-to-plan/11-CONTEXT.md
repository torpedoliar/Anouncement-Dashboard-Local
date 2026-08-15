# Phase 11: Portal & Auth Surfaces - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The final phase of the UI/UX rework (M2): the portal authentication frames (portal + admin login), the portal app grid, portal secondary surfaces (header, credentials vault, onboarding, account selector, failure states), and the five portal admin ledgers go token-native with zero behavioral regression to portal SSO (cookies, sessions, RBAC/access, audit events, redirects all unchanged).
</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `11-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `11-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** Portal login frame, admin login frame, portal grid (presentation only), SSO launch UI surfaces, portal secondary surfaces, portal admin ledgers (portal-sessions/audit/users/groups/apps), token migration + Phosphor icons in all touched files.
**Out of scope (from SPEC.md):** Any access/cookie/session/schema/API change (OPD-1 frozen helpers), portal self-registration/delegation/email/health, approval workflow, new SSO modes (OPD-2), password reset flows beyond the auth frame, admin data surfaces re-restyle.
</spec_lock>

<decisions>
## Implementation Decisions

### Portal Grid Presentation
- **D-01:** Portal app grid is RESTRUCTURED (not in-place restyle): grouping via category chips + responsive grid (per breakpoint 2/3/4 columns), token-native. Access semantics stay 100% frozen (`getAccessiblePortalApps`/`getPortalLayout` untouched — OPD-1); only presentation structure changes. — **Reversibility:** reversible — presentation-only; any grouping regression reverts component-only.
- **D-02:** Grid empty state: token-native "tidak ada aplikasi" card with icon (planned; exact copy decided at implementation).
- **D-03:** GroupedAppGrid/AppCard keep data props contract; visual layer replaced with kit `Card` + tokens + Phosphor; grouped launch behavior in new tab preserved, account-picker path for multi-credential apps preserved.

### Auth Frames
- **D-04:** Both `portal-login` and `admin-login` get the centered-card auth frame: brand mark + app name + centered card + inline invalid-credentials error, paper/night parity. No split panels.
- **D-05:** Auth behavior (cookie names, NextAuth portal instance, redirects, audit events) identical — restyle-only.

### Portal Admin Ledgers
- **D-06:** All five portal admin desks (portal-apps, portal-sessions, portal-audit, portal-users, portal-groups) join the ledger family using the existing `Table` kit (sortable, mono numerals, aria-sort, filter bar, pagination). Filters, CSV/JSON export URL construction, and pagination shapes are byte-identical; RBAC role labels icon+text (SUPER ADMIN / ADMIN / EDITOR / VIEWER as existing).
- **D-07:** No timeline rail variant for these desks — uniform Table-kit family. (Portal-audit stays a table too; hybrid timeline defer.)

### Verification / Evidence
- **D-08:** Gates = `npx tsc --noEmit` + scoped eslint + static grep (no raw hex, no `style={{}}`, no `react-icons`), as in prior phases. Visual evidence = screenshots when an environment can render server (dev/build env currently broken per PRE-1); if environment is unavailable during the phase, document the limitation in the verification report instead of forcing it. No modification of `.env`/`postcss`/Tailwind.

### Claude's Discretion
- Card composition details (icon square, spacing, hover raise), skeleton shapes, breakpoint choice within 2/3/4 allowed — planner decides.
- Secondary-surface micro-copy (Indonesian) where not spec'd.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & spec (locked)
- `.planning/phases/11-portal-auth-surfaces-current-ready-to-plan/11-SPEC.md` — Locked requirements, boundaries, acceptance, edge/prohibition tables.
- `.planning/ROADMAP.md` — Phase 11 entry: goal, success criteria, OPD-1..6.
- `.planning/INGEST-CONFLICTS.md` — 6 competing variants preserved (access model, enum, credential unique/API, nav routes, approval); OPD notes.

### Design source
- `docs/superpowers/specs/2026-08-12-ui-ux-rework-design.md` §5 — UI/UX rework design, §5 portal surfaces / auth frames.
- `docs/implementation plan/phase-4-portal-ux.md` — Legacy portal-ux implementation plan (scope overlap with this phase; matches score).
- `docs/specs/07-pages-and-routes.md` — base route map, portal routes and admin portal routes.

### Portal access/SSO semantics (behavior to preserve)
- `docs/specs/04-sso-credential-forwarding.md` — SSO flow, credentials, enum.
- `docs/superpowers/specs/2026-08-11-portal-user-app-visibility-design.md` — grid visibility model / hide-toggle.
- `docs/superpowers/specs/2026-08-12-portal-app-restricted-multicred.md` — restricted apps, multi-credential/account selector.

> No ADRs exist — decisions D1–D8 are SPEC-sourced (PROJECT.md).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/portal/`: GroupedAppGrid, AppCard, PortalHeader, SSOCredentialVault, OnboardingWizard, AccountSelector, AccessDenied, NoCredential, CorruptCredential, SSOAutoSubmit, SSORerouteSubmit, VisibilitySettings — all existing and functional.
- `lib/portal-access.ts` / `lib/portal-layout.ts` — frozen access/layout logic (OPD-1); portal grid data props come from here.
- `lib/portal-auth.ts` — NextAuth portal instance; `lib/portal-crypto.ts` — AES-256-GCM vault.
- `app/portal-login/layout.tsx` + `page.tsx`; `app/admin-login/page.tsx`; `app/portal/{page,layout,app,credentials,settings}/...`.
- `components/ui/` kit: Card, Badge, Button, Input, Select, Table (sortable), StatusPill, Dropdown, ConfirmDialog — shared ledger family (Phases 2–4 built on it).
- Tokens: `app/globals.css` (night/paper, --site-primary accent); Phosphor icons installed.

### Established Patterns
- Ledger desks in admin (users/audit trail) already use the Table kit — mirror their column/badge/filter structure for the five portal desks.
- Token-only class rules; no inline hex / style chrome except DB-data (site primaryColor) — portal surfaces have no such data drive, so strictly zero inline styles.
- Indonesian UI strings; commit messages in Indonesian.

### Integration Points
- Access/visibility semantics enter via `getAccessiblePortalApps` call sites (app/portal/page.tsx, GroupedAppGrid) — restructure must keep the same fetch + filter pipeline.
- SSO launch entry points: `SSOAutoSubmit` (form auto-submit new tab), account picker at launch; failure states surface via `NoCredential` / `CorruptCredential` components.
</code_context>

<specifics>
## Specific Ideas

- Cards: category chip grouping + responsive grid (2/3/4 cols) requested explicitly; centered card login with brand + inline error requested explicitly.
- Verification fallback: gates are the default; screenshot evidence is bonus when envs allow.
- No new capabilities: restructure scope, no capability addition (guardrail observed).
</specifics>

<deferred>
## Deferred Ideas

- Deferred: Hybrid timeline rail for portal-audit (user chose the Table-kit family; if later desired, consider a timeline variant desk, own mini-phase).
- Deferred: Admin login as standalone full restyle split-panel — no, user chose centered card for both; split layout not active.
- Deferred (from OPD-2): REROUTE/VAULT enum officialization on data upper layer.
</deferred>

---

*Phase: 11-portal-primary-auth-surfaces*
*Context gathered: 2026-08-15*