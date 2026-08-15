# Roadmap: Announcement Dashboard

## Overview

The announcement dashboard started as a multi-tenant CMS; its portal milestone (Phases 1–6.4, SHIPPED) added Portal Web SSO (portal users, RBAC-filtered app grid, form-based credential forwarding), a comprehensive audit trail, and a portal access evolution (groups → visibility → restricted/multi-credential → login-field detection) — all delivered in the same Next.js monolith. The active milestone (Phases 7–11, UI/UX rework, Approach A "tokenize then migrate") rebuilds the entire admin and portal surface token-native (design system → shell → content desk → data surfaces → portal & auth surfaces) with zero API/behavior regression; Phase 11 is the last remaining phase. Six competing SPEC variants discovered during ingest are preserved as explicit open decisions (OPD-1..6) below rather than resolved unilaterally.

## Milestones

- ✅ **Portal v3.0 — SSO + Audit + Access Evolution** (Phases 1–6.4) — SHIPPED (base 2026-07, iterations through 2026-08)
- 🚧 **UI/UX Rework — tokenize then migrate** (Phases 7–11) — in progress; Phase 11 (portal & auth surfaces) is the current focus

**Phase Numbering:**
- Integer phases (1, 2, 3…): Planned milestone work; numbering is continuous across milestones (never restarts)
- Decimal phases (6.1, 6.2…): Urgent insertions executed after planning (the post-base portal feature iterations) — execute between their surrounding integers
- Phase IDs use the `sequential` convention (config default; no `project_code` prefix)

## Open Decisions (from ingest conflicts — preserved, NOT resolved unilaterally)

These six competing-variant WARNINGs from `INGEST-CONFLICTS.md` remain explicit decision points. Each lists its variant sources, what the repo currently does (2026-08-15 scan), and which phase must carry the decision or verify the current implementation adheres to it.

- **OPD-1 — Grid access rule evolution (4 variants)**: `03-rbac` (grid = PortalUserAppAccess rows only) → group-based spec (union: group apps + direct override) → visibility design (ALL users see ALL active apps, hidden via toggles) → restricted+multicred (public vs restricted gated by direct/group access, then visibility filter). **Current state:** the four models shipped sequentially as Phases 6.1/6.2/6.3; the effective rule is the latest (restricted single-source in `lib/portal-access.ts` + visibility filter), with groups and direct access retained. **Action:** Phase 11 must not touch `getAccessiblePortalApps`/`getPortalLayout`; any future access change must cross-reference all four specs, latest wins.
- **OPD-2 — SSO mode enum divergence (REROUTE/VAULT)**: base enum `PortalSsoMode = FORM/REDIRECT/PROXY/TOKEN`; restricted+multicred spec references REROUTE (`/api/sso/reroute`) and VAULT (SSOCredentialVault). **Repo:** REROUTE + VAULT shipped out-of-band (components SSORerouteSubmit/SSOCredentialVault, route /api/sso/reroute) without enum values. **Decision needed:** add REROUTE/VAULT to `PortalSsoMode` in a future migration, or formally document them as out-of-band (project decision D8 marked ⚠️ Revisit).
- **OPD-3 — credential unique constraint rewrite**: base `@@unique([portalUserId, appId])` → multi-credential `@@unique([portalUserId, appId, label])` + label REQUIRED (migration backfills 'default'). **Repo:** shipped (schema verified). **Residual:** verify the actual DB constraint name at deploy (name may differ), keep one unique per migration step.
- **OPD-4 — credential API shape evolution**: base per-app single-credential GET/POST/DELETE → label-aware multi-account API with DELETE by credentialId. **Repo:** multi-credential API shipped. **Residual:** repo-wide `portalUserId_appId` usage sweep was part of the plan — re-verify in Phase 11 that no stale `findUnique({ where: { portalUserId_appId } })` remains.
- **OPD-5 — nav routes beyond base route map**: `07-pages-and-routes.md` specifies 4 portal sidebar items; rework shell nav adds `/admin/portal-groups` and `/admin/portal-audit`. **Repo:** both routes exist and are SuperAdmin-guarded; Phase 8 shell references them. **Status:** verified resolvable — no action unless a route disappears.
- **OPD-6 — "Perlu Persetujuan" status vs approval-workflow removal**: UI/UX design doc lists a pending-approval state; migration `20260605010000_drop_approval_add_revision_video` removed the workflow; the Phase 2 plan says do NOT add approval UI/schema. **Status:** Phase 9 implemented `deriveAnnouncementStatus()` (draft/scheduled/published/taken-down) — no approval state. **Carry:** design doc §5 divergence noted; restore only if a future feature re-adds ApprovalRequest.

## Phases

### M1 — Portal v3.0 (SHIPPED, collapsed)

<details>
<summary>🔒 Portal v3.0 — Phases 1–6.4 (SHIPPED — collapsed; status per repo scan, not GSD execution records)</summary>

### Phase 1: Foundation — Portal Data & Auth
**Goal**: Portal + audit schema, portal auth, crypto, audit helper, RBAC helpers, env fail-closed — the base every later portal phase builds on
**Depends on**: Nothing (first phase of M1)
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, PORT-10
**Success Criteria** (what must be TRUE):
  1. `prisma migrate deploy` adds all portal+audit tables (CREATE-only) and `version.json` reads schemaVersion 9 — existing CMS models byte-identical
  2. Crypto round-trip (encrypt→decrypt) passes via npx tsx; tag mismatch throws; missing PORTAL_CREDENTIAL_KEY kills startup (fail-closed)
  3. Portal login works (bcrypt compare, lockout 5x/15 min with ACCOUNT_LOCKED audit, `portal-auth.*` cookies, DB-revoked sessions); CMS login unaffected
**Plans**: 6 plans (per fase-1-foundation plan; file inventory verified in repo 2026-08-15)
  1. 01-01: Schema per 01-data-model (6 enums + 6 models, non-destructive) + migration + schemaVersion 9
  2. 01-02: Crypto lib/portal-crypto.ts (getKey/encrypt/decrypt round-trip)
  3. 01-03: Audit helper lib/audit.ts (SENSITIVE_KEYS redaction, non-blocking, actor denormalization)
  4. 01-04: RBAC helpers lib/portal-access.ts + validation schemas + types/next-auth.d.ts
  5. 01-05: Auth lib/portal-auth.ts (lockout, session callbacks) + route handler + CMS auth logging
  6. 01-06: Env (.env.example, instrumentation.ts fail-closed startup validation)

### Phase 2: Audit Trail (Retrofit + Halaman + Export)
**Goal**: AuditLog becomes the single source of truth for every CMS and system transaction; admins can browse and export it
**Depends on**: Phase 1
**Requirements**: PORT-06
**Success Criteria** (what must be TRUE):
  1. Every mutation route (announcements, categories, comments, users, sessions, settings, email settings, backup, update, scheduler) logs via `logAudit()`; zero `prisma.activityLog.create` remains
  2. SuperAdmin opens /admin/audit-trail, filters (actor/category/outcome/severity/entity/date/search), expands details with redacted changes, downloads CSV and JSON
  3. Backfill script is idempotent; retention purge honors AUDIT_RETENTION_DAYS (0 = nothing purged)
**Plans**: 6 plans
  1. 02-01: Retrofit announcements/categories/comments/users/sessions/settings/email/backup/update/scheduler
  2. 02-02: API /api/audit-trail (list + filters + export)
  3. 02-03: Audit page /admin/audit-trail (filters, detail, export)
  4. 02-04: Sidebar AUDIT LOG → AUDIT TRAIL + /admin/audit-logs redirect
  5. 02-05: Backfill script + dual-write window + ActivityLog.create removal
  6. 02-06: Retention purge + backup/restore portal+audit tables
**UI hint**: yes

### Phase 3: Admin Portal Management
**Goal**: SuperAdmin can manage portal apps, portal users (with access), and portal sessions from the admin CMS
**Depends on**: Phase 1 (parallel with Phase 2)
**Requirements**: PORT-07
**Success Criteria** (what must be TRUE):
  1. SuperAdmin CRUDs portal apps and portal users (create with access, reset password, activate/deactivate) and revokes portal sessions via /admin pages and their APIs, each action landing an AuditLog row
  2. Non-SuperAdmin routes are strictly 403 on both pages and APIs
  3. `POST /api/portal-users` returns 409 for duplicate emails and 400 with field errors for invalid payloads
**Plans**: 3 plans (per fase-3-admin-portal plan; verified in repo)
  1. 03-01: Portal apps API + page (table + modal)
  2. 03-02: Portal users API (create/update/delete/access/reset/status) + page
  3. 03-03: Portal sessions API + page + sidebar additions
**UI hint**: yes

### Phase 4: Portal UX
**Goal**: Portal users get a working login, grid, credential management, and password recovery experience
**Depends on**: Phase 3
**Requirements**: PORT-08
**Success Criteria** (what must be TRUE):
  1. A portal user logs in via /portal-login, sees only granted apps on /portal (search + category filter + health indicator), and gets the empty state if no access
  2. They save/update/delete credentials; the password field never prefills across sessions and is never returned by any API
  3. Forgot-password flow sends a reset-no-enumeration "link sent" response; token works once; admin reset works
  4. Unauthenticated /portal and /portal/settings redirect to /portal-login; sessions visible in /admin/portal-sessions
**Plans**: 5 plans
  1. 04-01: /portal-login page (client signIn via portal endpoint, lockout UX)
  2. 04-02: /portal layout guard + PortalHeader + grid (AppCard, category filter, search, health indicator)
  3. 04-03: Credentials page + /api/portal/credentials (save/update/delete)
  4. 04-04: Forgot/reset password
  5. 04-05: /portal/settings (change password, own sessions list/revoke)
**UI hint**: yes

### Phase 5: SSO Launch
**Goal**: Form-based SSO actually launches external apps with stored credentials — a verified, audited one-click flow
**Depends on**: Phase 4
**Requirements**: PORT-05
**Success Criteria** (what must be TRUE):
  1. Clicking an app opens a new tab with the auto-submitted form POSTing loginUrl (username/password/extraFields) — verified against an httpbin echo
  2. Failure states render (AccessDenied / NoCredential with re-save link / CorruptCredential) and each writes SSO_LAUNCH_FAILED; success writes SSO_LAUNCH and refreshes lastUsedAt
  3. Inactive/missing app renders notFound; portal session stays valid after a failed launch
**Plans**: 1 plan (per rollback note)
  1. 05-01: /portal/app/[appSlug] server page + failure components + audits (skip /api/portal/launch per recommendation — no plaintext to JS)

### Phase 6: Integration & Hardening
**Goal**: Full-stack hardening complete: backup/restore, rate limits, seed, env wiring, version bump, security checklist green end-to-end
**Depends on**: Phase 2, Phase 4, Phase 5 (all of Phases 1–5)
**Requirements**: PORT-09, PORT-11
**Success Criteria** (what must be TRUE):
  1. Backup/restore includes the 6 portal+audit tables in FK order; docker-compose wires the 3 new env vars; seed is idempotent (portal admin + demo user + sample app)
  2. Middleware rate-limits /portal-auth and /portal-login at 10 req/min; version.json = 3.0.0 / schemaVersion 9; security checklist green (no plaintext API, no audit delete, env fail-closed)
  3. The end-to-end story passes: admin creates app/user/access → portal login → grid → save creds → SSO launch → audit verify → lockout test → backup/restore
**Plans**: 6 plans (per fase-6-integration-hardening plan)
  1. 06-01: Backup/restore portal+audit tables
  2. 06-02: Middleware matcher + rate limits
  3. 06-03: Seed update (idempotent)
  4. 06-04: docker-compose env + .env.example
  5. 06-05: Helper scripts (make-portal-admin, rotate-portal-key future)
  6. 06-06: Version bump + CLAUDE.md docs + root nav decision (Option A: `/ → /site`)

### Phase 6.1: Portal Group-Based Access (INSERTED)
**Goal**: Admin-managed groups of apps replace one-by-one assignment; grid shows union of group apps + direct overrides
**Depends on**: Phase 6
**Requirements**: PORT-12
**Success Criteria** (what must be TRUE):
  1. Admin creates a group (e.g. "Accounting"), binds apps and users; user's grid = union(active group apps) ∪ direct access, deduped and sorted; no user loses pre-existing access
  2. /api/portal-groups CRUD replaces appIds transactionally, with audit rows and concise diffs
  3. Get-AccessiblePortalApps/canAccessPortalApp* public signatures unchanged; migration maps existing PortalApp.category → groups idempotently
**Plans**: 5 plans
  1. 06.1-01: Schema (PortalGroup / PortalGroupApp / PortalUserGroup, verbatim models)
  2. 06.1-02: Access rule union in lib/portal-access.ts (group path + direct override, dedup, sort)
  3. 06.1-03: API /api/portal-groups + [id] (transactional appIds replacement)
  4. 06.1-04: Admin page /admin/portal-groups + user-table group selection
  5. 06.1-05: Migration script categories → groups (idempotent, logged summary)
**UI hint**: yes

### Phase 6.2: Per-User App Visibility (INSERTED)
**Goal**: Users decide which apps appear in their grid via an onboarding wizard + per group/app toggles
**Depends on**: Phase 6.1
**Requirements**: PORT-13
**Success Criteria** (what must be TRUE):
  1. First login shows the wizard (explicit onboardingDone flag; skip = zero rows, never inferred from row count)
  2. /portal/settings toggles hide/show per group or per app instantly (PATCH single override); app-override beats group-override; new app in a hidden group stays hidden
  3. Grid shows only visible apps; visibility never affects access or credentials (settings/credential API lists still all accessible apps)
**Plans**: 8 plans (per 2026-08-11 visibility plan)
  1. 06.2-01: Schema PortalUserAppVisibility + onboardingDone + migration
  2. 06.2-02: Helpers getVisibilityProfile/saveVisibility/saveVisibilityPartial + test script
  3. 06.2-03: getAccessiblePortalApps filter (legacy flat-array shape preserved)
  4. 06.2-04: API POST/PATCH /api/portal/visibility (XOR guard)
  5. 06.2-05: OnboardingWizard UI
  6. 06.2-06: GroupedAppGrid + /portal page wiring
  7. 06.2-07: /portal/settings + VisibilitySettings + header link
  8. 06.2-08: Verification (test script, tsc, build, manual)
**UI hint**: yes

### Phase 6.3: Restricted Apps + Multi-Credential (INSERTED)
**Goal**: Restricted apps become leak-proof; users keep several accounts per app and choose at SSO
**Depends on**: Phase 6.2
**Requirements**: PORT-14
**Success Criteria** (what must be TRUE):
  1. Restricted app (isPublic=false) is invisible to unauthorized users in grid, wizard, settings, credentials, and direct URLs (server-side via canAccessPortalApp); visibility API rejects overrides for inaccessible apps (403)
  2. Credentials hold labels; migration backfills label='default'; >1 account on an app shows the picker before auto-submit; only the selected credential is decrypted and posted
  3. All stale `findUnique({ where: { portalUserId_appId } })` usages rewritten; REROUTE/VAULT out-of-band paths honor credential selection (OPD-2)
**Plans**: 4 plans (per 2026-08-12 restricted+multicred plan)
  1. 06.3-01: Schema (isPublic + label + new unique) + migration SQL
  2. 06.3-02: Access predicates (single source) + self-check script
  3. 06.3-03: Credential API (label, credentialId routing) + usage sweep
  4. 06.3-04: Credentials page multi-account UI + account picker at launch
**UI hint**: yes

### Phase 6.4: Auto Login-Field Detection (INSERTED)
**Goal**: Admins no longer type login field names by hand — the form auto-detects them
**Depends on**: Phase 6
**Requirements**: PORT-15
**Success Criteria** (what must be TRUE):
  1. The "Deteksi Otomatis" button fetches loginUrl, auto-fills usernameField/passwordField/extraFields (Record) for admin review and save
  2. SSRF-safe: only http/https, loopback/private/link-local blocked, 8s timeout, 64KB cap, errors never leak HTML; parser handles autocomplete → keyword → first-input ranking
**Plans**: 2 plans
  1. 06.4-01: lib/portal-login-detect.ts pure parser + self-check test (9 variants)
  2. 06.4-02: API /api/portal-apps/detect-fields (SuperAdmin, SSRF-safe) + client button
**UI hint**: yes

</details>

## M2 — UI/UX Rework (current milestone)

**Milestone Goal**: Every admin and portal surface token-native (design system → shell → content desk → data surfaces → portal & auth), with zero API/behavior regression; portal SSO verified stable end-to-end.

### Phase 7: Design System Foundation (rework P0)
**Goal**: The token foundation: semantic CSS variables, Tailwind mapping, and a reusable ui/ kit every later rework phase uses
**Depends on**: M1 complete (Phase 6.4)
**Requirements**: UIUX-01
**Success Criteria** (what must be TRUE):
  1. `globals.css` defines the semantic token set (--surface-*, --text-*, --accent, --border) with night default + `.theme-light` override; backward-compat aliases (--bg-primary etc.) keep legacy look unchanged
  2. New code renders from tokens + ui/ kit classes only — no raw hex, no inline-style chrome
  3. SiteThemeProvider emits --site-primary; ThemeToggle persists adminTheme light/dark in localStorage
  4. `npx tsc --noEmit` + `npm run lint` green (build/dev blocked by pre-existing env failures — see PROJECT.md); Tailwind v3 + postcss untouched; a11y wins (skip-link, reduced-motion, sr-only) intact
**Plans**: 6 (per phase-0-design-system plan)
  1. 07-01: Baseline verify + @phosphor-icons/react
  2. 07-02: Typography (Sora/Inter/JetBrains Mono via next/font)
  3. 07-03: globals.css token rewrite + legacy aliases
  4. 07-04: Tailwind config mapping
  5. 07-05: ui/ kit (Button, Card, Badge, Input, Select, Table, Dropdown)
  6. 07-06: SiteThemeProvider --site-primary + ThemeToggle
**UI hint**: yes

### Phase 8: Admin Shell
**Goal**: Users navigate the admin faster through a grouped collapsible sidebar, masthead topbar, masthead rack site switcher, and Ctrl+K palette — no behavior change
**Depends on**: Phase 7
**Requirements**: UIUX-02
**Success Criteria** (what must be TRUE):
  1. Sidebar groups (Kantor / Terbit / Saluran / Sistem) match `lib/admin-nav.ts` single source, collapse persisted per user, and include the portal entries incl. /admin/portal-groups and /admin/portal-audit (routes verified to exist — OPD-5)
  2. The masthead topbar shows breadcrumb, active site channel strip, live clock, user menu; MastheadRack shows swatch, name, slug, live post counts and re-tints accent on site switch without reload
  3. Ctrl+K command palette navigates actions/content/sites; mobile slide-over works at 375px with no horizontal overflow
  4. Focus-visible accent rings, aria-current/expanded, labeled icon buttons, keyboard order = visual order; chrome token-native (no raw hex), Phosphor icons only
**Plans**: 5 plans
- [ ] 08-01: lib/admin-nav.ts (single nav source of truth)
- [ ] 08-02: Grouped sidebar (icon-rail 64↔240px, collapse persisted)
- [ ] 08-03: MastheadTopbar + MastheadRack (breadcrumb, channel strip, clock, user menu, site switcher)
- [ ] 08-04: CommandPalette Ctrl+K
- [ ] 08-05: Responsive + a11y pass
**UI hint**: yes

### Phase 9: Content Desk
**Goal**: The daily work surfaces (dashboard, announcement ledger + editor, categories/media/comments/newsletter/email) become a coherent token-native newsroom desk
**Depends on**: Phase 8
**Requirements**: UIUX-03; OPD-6 application boundary enforced
**Success Criteria** (what must be TRUE):
  1. Status is derived, not stored: every list/editor/scheduler surface shows the same `deriveAnnouncementStatus()` result (draft/scheduled/published/taken-down, takedown-first precedence) and there is NO "Perlu Persetujuan" state anywhere (OPD-6)
  2. Publish controls (Draf / Terjadwal / Publish now) produce exactly the same API calls, DB rows, and audit entries as before the rework (regression gate)
  3. Dashboard headline tiles show deltas only when a real comparison exists; ledger filters by status/category/site/author with counts, bulk confirm, empty and skeleton states
  4. The two-pane editor (live preview on active masthead, masthead chip from the AnnouncementSite junction, sticky TipTap toolbar, mono word count/reading time) drives the same AnnouncementForm state as today
  5. Categories media picker, comments moderation desk (inline approve/reject + undo), newsletter/email token-native; tsc + scoped eslint green
**Plans**: 5 plans
  1. 09-01: Status helper deriveAnnouncementStatus + StatusPill + theme refine
  2. 09-02: Dashboard (stat tiles + ledger + SiteHealthCard/UpdateBanner restyle)
  3. 09-03: Announcement ledger (filter bar, bulk actions, empty/skeleton)
  4. 09-04: Two-pane editor (preview, toolbar, publish controls, masthead chip)
  5. 09-05: Categories / Media / Comments / Newsletter / Email restyle
**UI hint**: yes

### Phase 10: Data Surfaces
**Goal**: Charts and tables read as one system — masthead-accent chart language, KPI tiles, sortable ledger tables, timeline audit trail — data untouched
**Depends on**: Phase 9
**Requirements**: UIUX-04
**Success Criteria** (what must be TRUE):
  1. Charts use the language: trends line/area, comparisons bar, ≤1 donut, legends visible, gridlines --border, mono tooltips keyboard-reachable, no 3D — primary series re-tints with the site via --site-primary
  2. KPI tiles: large mono numbers, id-ID locale, deltas only when a real comparison exists (no invented delta query)
  3. Ledger tables sortable (aria-sort, mono numerals, hover, filter bar, per-page pagination); audit trail is a timeline ledger with filters and CSV/JSON export preserved
  4. Sites/Users admin desks token-native now; portal ledgers untouched (deferred to Phase 11); zero API/Prisma changes; one contrast max per chart
**Plans**: 4 plans (per fase-3-data-surfaces plan)
  1. 10-01: lib/chart-theme.ts getTheme (tokens, no JS theme detection) + ChartTooltip
  2. 10-02: StatTile + KPI tiles
  3. 10-03: Ledger tables standard (Sites, Users)
  4. 10-04: Audit trail timeline + global analytics comparison
**UI hint**: yes

### Phase 11: Portal & Auth Surfaces (CURRENT — ready to plan)
**Goal**: The rework closes where SSO lives: shared auth frames and the portal surfaces (login, app grid, credentials, failure states, onboarding/account pickers) plus portal admin ledgers — token-native, with portal SSO behavior proven unchanged
**Depends on**: Phase 10; SSO backend shipped in M1 (Phases 1–6.4)
**Requirements**: UIUX-05 (synthesized from ui-ux-rework-design §5; the ingest has no dedicated P4 plan doc — plan-phase must ground-truth against repo before planning)
**Success Criteria** (what must be TRUE):
  1. Portal login + shared auth frame (brand mark, app name, centered card, paper/night parity, inline invalid-credentials error) render token-native; login/lockout/session behavior identical — same cookies, same audit events, same redirects
  2. Portal grid shows grouped launch cards (logo/icon, name, description, "Buka"; hover raise, keyboard-navigable; 2/3/4 columns by breakpoint) with today's RBAC/visibility semantics; SSO launch still opens a new tab auto-submitting the form (account-picker path for multi-credential apps); failure states still render and audit
  3. Portal secondary surfaces restyled only: /portal/settings, SSOCredentialVault, CorruptCredential, NoCredential, OnboardingWizard (multi-step progress), AccountSelector, AccessDenied, PortalHeader — token classes, no raw hex/inline chrome, Phosphor icons
  4. Portal admin ledgers (portal-sessions, portal-audit, portal-users, portal-groups) restyled in the ledger family with RBAC badges; filters and CSV/JSON export unchanged
  5. Zero-regression verification: no API contract, cookie, session, or schema change (git diff against M1 baseline clean except UI files); `npx tsc --noEmit` + scoped eslint green; manual E2E (login → grid → save credential → SSO launch → failure path → lockout → audit rows) passes; OPD-1/OPD-4 rechecks pass (portal-access untouched; no stale portalUserId_appId lookups)
**Plans**: TBD (3–4 plans expected: auth frames, portal grid, secondary surfaces + ledgers, regression E2E)
**Rollback safety**: any misbehaving surface reverts component-only — the no-logic-change rule keeps behavior intact

## Progress

**Execution order:** Phases execute in numeric order (with decimals between their integers) — 1 → 2 → 3 → 4 → 5 → 6 → 6.1 → 6.2 → 6.3 → 6.4 → 7 → 8 → 9 → 10 → 11.
M1 (1–6.4) shipped; M2 (7–11) current; Phase 11 is next.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation (portal data & auth) | Portal v3.0 | 6/6 | Complete | ~2026-07 |
| 2. Audit Trail | Portal v3.0 | 6/6 | Complete | ~2026-07 |
| 3. Admin Portal | Portal v3.0 | 3/3 | Complete | ~2026-07 |
| 4. Portal UX | Portal v3.0 | 5/5 | Complete | ~2026-07 |
| 5. SSO Launch | Portal v3.0 | 1/1 | Complete | ~2026-07 |
| 6. Integration & Hardening | Portal v3.0 | 6/6 | Complete | ~2026-08 |
| 6.1 Portal Group-Based Access | Portal v3.0 | 5/5 | Complete | ~2026-08 |
| 6.2 Per-User App Visibility | Portal v3.0 | 8/8 | Complete | 2026-08-11 |
| 6.3 Restricted + Multi-Credential | Portal v3.0 | 4/4 | Complete | 2026-08-12 |
| 6.4 Auto Login-Field Detection | Portal v3.0 | 2/2 | Complete | 2026-08-12 |
| 7. Design Tokens | UI/UX Rework | 6/6 | Complete | 2026-08-12 |
| 8. Admin Shell | UI/UX Rework | 5/5 | Complete | 2026-08-13 |
| 9. Content Desk | UI/UX Rework | 5/5 | Complete | 2026-08-13 |
| 10. Data Surfaces | UI/UX Rework | 4/4 | Complete | 2026-08-14 |
| 11. Portal & Auth Surfaces | UI/UX Rework | 0/TBD | Not started | - |

> Dates approx. from plan-document dates (M1 + rework P0–P3 shipped before the GSD tracker existed). Complete = requirements verified shipped in repo by the 2026-08-15 code scan; STATE.md carries the detailed evidence.

---
*Last updated: 2026-08-15 after new-project-from-ingest (36 docs, 25 SPECs; 6 conflicting variants preserved as OPD-1..6)*