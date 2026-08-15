# Requirements: Announcement Dashboard

**Defined:** 2026-08-15 (from 36-doc ingest; 0 ADR / 0 PRD — requirement clusters derived from the 25 SPEC-classified constraints per `intel/SYNTHESIS.md` + `intel/constraints.md`; SPEC+implementation-plan pairs are folded into a single anchor requirement; `UIUX-05` is synthesized from the UI/UX design spec §5 and is flagged as such)
**Core Value:** Multi-tenant announcement CMS keeps working while its admin + portal UI is rebuilt token-native; portal SSO (login, sessions, credential forwarding, audit) stays stable and verifiable

**Requirement format:** each entry is falsifiable pass/fail with explicit boundaries. Status: `[x]` = verified shipped in repo (2026-08-15 code scan), `[ ]` = pending.

## v1 Requirements

### Portal SSO & Audit Trail (base v3.0 series — Phases 1–6)

- [x] **PORT-01 — Portal SSO + audit capabilities, additive only**: Portal Web SSO (separate login, RBAC-filtered app grid, SSO via user-stored credentials), separate portal RBAC, and comprehensive Audit Trail added to the existing multi-tenant CMS without removing existing functions.
  **Acceptance (PASS):** a new portal user can log in, see only granted apps, and launch an app via stored credentials, while every existing CMS feature (routes, data, API responses, scheduler) is unchanged. **Boundary:** out = future SSO modes REDIRECT/PROXY/TOKEN, PORTAL_ADMIN delegation, portal email, health probes, self-registration. *(source: 00-overview, Keputusan utama D1–D8)*
- [x] **PORT-02 — non-destructive portal + audit schema v9**: `prisma/schema.prisma` gains PortalUser, PortalApp, PortalUserAppAccess, PortalUserAppCredential, PortalSession, AuditLog + 6 enums with zero changes to existing models.
  **Acceptance (PASS):** migration SQL contains only CREATE TABLE / CREATE TYPE / CREATE INDEX (no DROP, no ALTER on existing tables); `version.json` schemaVersion = 9, version = 3.0.0; `activity_logs` retained. *(source: 01-data-model + fase-1 plan)*
- [x] **PORT-03 — portal auth with DB-backed revocation, lockout, password flows**: separate NextAuth instance (`lib/portal-auth.ts`, cookie prefix `portal-auth.*`, maxAge 12 h), CredentialsProvider order email → isActive → lockedUntil → bcrypt compare; lockout 5 failures / 15 min; forgot / change / admin-reset password.
  **Acceptance (PASS):** 5th+ rapid wrong password attempt is blocked with ACCOUNT_LOCKED audit row (SECURITY/FAILURE); success resets counters; revoking a session in `/admin/portal-sessions` terminates it at next token refresh; cookie prefix never collides with `next-auth.*`; missing `PORTAL_CREDENTIAL_KEY` fails app startup (instrumentation.ts throws). *(source: 02-authentication-and-sessions)*
- [x] **PORT-04 — three-layer portal RBAC + access/credential separation**: SuperAdmin Layer 1 manages portal apps/users/access/sessions/audit from /admin; PortalUser Layer 3 sees only granted apps, SSO-if-access, own credential CRUD, own sessions; all gates server-side through `lib/portal-access.ts` helpers.
  **Acceptance (PASS):** non-SuperAdmin gets 403 on all `/admin/portal-*` and `/admin/audit-trail` pages/APIs; user without access sees no card and no app URL; admin never sees credential plaintext (Access vs Credential separation). *(source: 03-rbac)*
- [x] **PORT-05 — form-based SSO credential forwarding**: credentials encrypted AES-256-GCM at rest (blob = base64(iv+tag+ciphertext)), decrypted only in memory at launch; launch = server-rendered auto-submit form (method/action/usernameField/passwordField/extraFields from PortalApp config, target _blank); failure UX and audits.
  **Acceptance (PASS):** after saving a credential, clicking the app opens a new tab that POSTs to loginUrl with the fields; states no-access / no-credential / corrupt-credential render and each logs SSO_LAUNCH_FAILED; SSO_LAUNCH success row recorded; lastUsedAt updates. **Boundary:** FORM mode only; login outcome undetectable cross-origin (health indicator best-effort). *(source: 04-sso-credential-forwarding)*
- [x] **PORT-06 — audit trail as single source of truth**: `lib/audit.ts` `logAudit()` centralizes all events; recursive case-insensitive redaction of SENSITIVE_KEYS; non-blocking (never fails the main transaction); all CMS mutation routes + scheduler retrofitted; `/admin/audit-trail` with filters, expandable detail, CSV/JSON export; retention purge (AUDIT_RETENTION_DAYS, 0 = forever); idempotent backfill; no ActivityLog.create remains.
  **Acceptance (PASS):** create/update/delete/bulk announcement, comment moderation, user mgmt, settings, backup/restore, scheduler run, portal auth events each produce AuditLog rows with denormalized actor; a `grep -r "activityLog.write" app lib` returns nothing; export CSV matches the filtered view; AUDIT_RETENTION_DAYS=0 purges nothing. *(source: 05-audit-trail + fase-2 plan)*
- [x] **PORT-07 — Admin portal CRUD, assignments, sessions**: SuperAdmin-only APIs and pages for portal apps (CRUD), portal users (create w/ access, update, delete, assign/revoke access, reset password, activate/deactivate), portal sessions (list, revoke SuperAdmin-or-owner); every mutation audited via logAudit.
  **Acceptance (PASS):** create app → create user with access → login as user works; each action has its AuditLog row (PORTAL_APP_CREATED, ACCESS_GRANTED, PORTAL_USER_CREATED, PORTAL_SESSION_REVOKED, ...); 403 for non-SuperAdmin; 409 duplicate email. *(source: 06-api-reference + phase-3 plan)*
- [x] **PORT-08 — portal pages, routes, middleware**: /portal-login (client, lockout UX, forgot link), /portal layout guard (server redirect), /portal grid (server, force-dynamic, filter + search + health indicator + empty state), /portal/credentials (client, password never prefilled, ?app= auto-scroll), /portal/forgot-password + /portal/reset-password (?token=), /portal/settings (optional; change password, own sessions); middleware matcher + rate limit 10/min on /portal-auth and /portal-login.
  **Acceptance (PASS):** unauthenticated /portal redirects to /portal-login; POST credentials API requires portal session + canAccessPortalApp; response never includes plaintext; password input empty on page load; rapid requests to /portal-auth paths get 429. *(source: 07-pages-and-routes)*
- [x] **PORT-09 — security conformance**: fail-closed startup env validation; AES-256-GCM at rest with separate key, decrypt only at SSO launch; redaction examples (password, passwordHash, credentialBlob, token, secret, sessionToken, resetToken, smtpPass); portal brute-force = account lockout 5x/15min + per-IP rate limits; httpOnly/sameSite=lax/Lax; no AuditLog DELETE endpoint.
  **Acceptance (PASS):** starting the app with missing/invalid PORTAL_CREDENTIAL_KEY throws FATAL; credential APIs reveal no plaintext for any user; /api/audit-trail accepts no DELETE; secret scanning of commit history shows no .env. *(source: 08-security)*
- [x] **PORT-10 — phased rollout mandate**: portal + audit shipped in six sequential buildable phases (foundation → audit-trail → admin-portal → portal-ux → sso-launch → integration-hardening), each gated by build + lint + manual test.
  **Acceptance (PASS):** the phase-1..6 file inventory (09-implementation-phases: ~25 new files, ~18 modified) exists in the repo; final smoke test story (admin creates app/user/access → portal login → grid → save creds → SSO launch → audit verify → lockout → backup/restore) passes today. *(source: 09-implementation-phases + 00-master-plan)*
- [x] **PORT-11 — changelog, env & infra**: version.json (3.0.0, schemaVersion 9, release notes), .env.example + docker-compose env (PORTAL_CREDENTIAL_KEY, AUDIT_RETENTION_DAYS, PORTAL_SESSION_MAX_AGE), idempotent seed (portal admin, demo user, sample app), helper scripts (make-portal-admin, backfill-audit-log), CLAUDE.md portal/audit sections.
  **Acceptance (PASS):** `docker-compose up --build` + `migrate deploy` boots with the three env vars; `npx tsx scripts/backfill-audit-log.ts` is idempotent (verified by re-run producing 0 new rows); seed re-runs produce duplicates. *(source: 10-changelog-and-env + phase-6 plan)*

### Portal Access Evolution (post-base iterations, shipped via inserted phases)

- [x] **PORT-12 — group-based access**: PortalGroup / PortalGroupApp / PortalUserGroup models (verbatim naming), effective access = union(active groups' apps) ∪ (direct PortalUserAppAccess override), dedup by app.id, sort displayOrder+name; /api/portal-groups CRUD (transactional appIds replacement); admin page /admin/portal-groups; migration from PortalApp.category groups (idempotent); user assignment by groups.
  **Acceptance (PASS):** user with group access sees group apps without direct rows; direct override still shows (no one loses access); inactive group contributes nothing; grid and /portal/app/[slug] both honor it via canAccessPortalAppBySlug. *(source: Specs & Implementation Plan — Portal Group-Based Access)*
- [x] **PORT-13 — per-user app visibility**: PortalUserAppVisibility + PortalUser.onboardingDone; no row → shown; group row false → whole group hidden; app row false → hidden; app row true overrides hidden group; onboarding wizard only when !onboardingDone (skip = zero rows; never infer from row count); /portal/settings toggles PATCH; getAccessiblePortalApps preserves legacy flat-array return shape.
  **Acceptance (PASS):** after "Lewati", next login skips wizard; hiding a group hides its apps; `GET /api/portal/credentials` still lists ALL accessible apps including hidden (documented as correct); new app in a hidden group stays hidden; no N+1 (single-query profile). *(source: 2026-08-11 visibility design + plan)*
- [x] **PORT-14 — restricted apps + multi-credential**: PortalApp.isPublic (default true); restricted apps visible only with direct/group access — enforced in getAccessiblePortalApps, getPortalLayout, canAccessPortalApp/BySlug (no app-name leak in grid, wizard, settings, creds or URLs); PortalUserAppCredential.label + @@unique([portalUserId, appId, label]) replaces old unique (backfill label='default'); >1 credential → account picker on SSO launch, only chosen credential posted; delete by credentialId; all old portalUserId_appId findUnique/upsert updated.
  **Acceptance (PASS):** restricted app is invisible to unauthorized user on every surface incl. direct URL; 2 accounts force the picker and the chosen account's values POST; migration re-run safe; self-check predicates (public+admin, public+user, restricted+direct, restricted+active group, restricted+inactive group → access/deny) pass. Also REROUTE/VAULT SSO handling shipped out-of-band (see OPD-2). *(source: 2026-08-12 restricted+multicred design + plan)*
- [x] **PORT-15 — auto login-field detection**: "Deteksi Otomatis" button on portal-app admin form; pure parser ranks autocomplete → name/id keywords → first non-password input; POST /api/portal-apps/detect-fields (SuperAdmin only, SSRF-safe: http/https, block localhost/private/link-local, 8s timeout, 64KB cap, no HTML leak in errors).
  **Acceptance (PASS):** sample login form with autocomplete=username + password returns both fields and static hidden inputs as Record<string,string>; localhost URL challenge is denied with a short message; detected values prefill the form for admin review. *(source: 2026-08-12 login-field-detection design)*

### UI/UX Rework (Approach A phases 0–4)

- [x] **UIUX-01 — design system foundation (P0)**: semantic CSS-variable token system (:root night default, .theme-light override, backward-compat aliases --bg-primary → --surface-* etc.), Tailwind v3 mapping, ui/ kit (Button, Card, Badge, Input, Select, Table, Dropdown, StatusPill, ConfirmDialog), SiteThemeProvider emits --site-primary, ThemeToggle persists adminTheme in localStorage, Sora/Inter/JetBrains Mono via next/font, motion tokens, preserved a11y wins (skip-link, reduced-motion, focus-visible, sr-only).
  **Acceptance (PASS):** default render is visually unchanged (night default) without toggling; a component built with tokens renders with no raw hex; tsc + lint clean; postcss.config.mjs untouched; Tailwind v3. *(source: 2026-08-12 ui-ux-rework-design + phase-0 plan)*
- [x] **UIUX-02 — admin shell (P1)**: grouped sidenav (Kantor / Terbit / Saluran / Sistem) with icon-rail 64↔240px collapse persisted per user; masthead topbar (breadcrumb, site channel strip, live clock, user menu); masthead rack replacing plain SiteSelector (swatch, name, slug, live post counts, re-tint on site switch); Ctrl+K command palette (actions, content jump, site switch); responsive slide-over at 375px; a11y (focus-visible accent, aria-current, aria-expanded, labeled buttons, keyboard order = visual); JellChrome never changes per site.
  **Acceptance (PASS):** sidebar groups exactly match lib/admin-nav.ts single source; nav includes existing /admin/portal-groups and /admin/portal-audit routes; switching sites re-tints accent without reload; no inline raw hex in new chrome components; collapsed state persists per user. *(source: 2026-08-13 phase-1-shell; conflicts note: routes beyond 07-pages-and-routes existed and verified)*
- [x] **UIUX-03 — content desk (P2)**: masthead-aware dashboard (headline stat tiles with real deltas only; recent announcements as ledger rows); announcement ledger (status/category/site/author filter bar, bulk actions with confirm, empty state "nothing on the desk", skeleton rows); status derived not stored — deriveAnnouncementStatus() in lib/announcement-status.ts (draft/scheduled/published/taken-down, takedown wins, then scheduled, then published; NO "Perlu Persetujuan" state — approval schema dropped); two-pane editor (live preview on active masthead, TipTap sticky toolbar, masthead chip from AnnouncementSite junction, publish controls Draf/Terjadwal/Ribat now + primary-site selector, word count + reading time mono); categories ledger; media gallery picker; comments moderation desk with undo; newsletter/email restyled.
  **Acceptance (PASS):** a scheduled-then-takedown announcement shows derived status correctly across list/editor/scheduler surfaces; publish/schedule workflow produces exactly the same API calls and DB rows as pre-rework; no raw hex in touched surfaces; no approval UI or schema anywhere. *(source: 2026-08-13 phase-2-content-desk; approval-boundary per conflicts OPD-6)*
- [x] **UIUX-04 — data surfaces (P3)**: recharts chart language (trends line/area; comparisons horizontal bar; proportions ≤1 donut; legends, --border gridlines, mono tooltips keyboard-reachable; no 3D/decorative gradients); KPI stat tiles (large mono id-ID, delta only when a real comparison query exists); sortable ledger tables (aria-sort, mono numerals, hover, filter bar, per-page pagination, use Table kit); audit trail timeline ledger (mono timestamp, actor, action, entity; filters + export preserved); Sites/Users admin desks token-native; portal ledgers explicitly deferred to UIUX-05.
  **Acceptance (PASS):** on primary-site switch, chart primary series re-tints via --site-primary (tokens, no JS theme detection); stat tiles render toLocaleString("id-ID"); no invented delta queries (no extra API calls); /admin/global-analytics comparison uses masthead accent + one contrast series. *(source: 2026-08-13 phase-3-data-surfaces)*
- [ ] **UIUX-05 — portal & auth surfaces (P4)**: shared auth frame (brand mark, app name, centered card, paper/night, masthead-neutral default brand red, inline invalid-credentials error) applied to portal/admin login; portal app grid = launch cards (logo/icon, name, description, "Buka"; hover raise, keyboard-navigable; 2/3/4 columns by breakpoint); portal secondary surfaces restyled only (settings, SSOCredentialVault, CorruptCredential, NoCredential, OnboardingWizard multi-step progress, AccountSelector, AccessDenied, PortalHeader); portal admin ledgers restyled with RBAC badges (portal-sessions, portal-audit, portal-users, portal-groups); SSO launch keeps form forwarding with zero behavior change.
  **Acceptance (PASS):** after restyle, portal login → grid (grouped, filtered) → save credential → SSO launch auto-submits in new tab (account-picker path for multi-credential apps) works identically; all portal surfaces token-native (no hex, no inline chrome in new code); API contracts, cookies, sessions, and audit behavior all unchanged; manual e2e + tsc + scoped eslint green. **Boundary:** restyle only — do not touch portal-auth/portal-crypto/portal-access logic, visibility/credential API shapes, rate limiting. *(SYNTHESIZED from ui-ux-rework-design §5 — this spec has no standalone plan doc in the ingest set; flag for plan-phase to ground truth against repo before executing)*

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

| ID | Requirement | Deferred reason |
|----|-------------|-----------------|
| SSO-02 | REDIRECT/PROXY/TOKEN SSO modes (OIDC/OAuth2/SAML) | enum extensible, future (see OPD-2 for REROUTE/VAULT status) |
| RBAC-02 | PORTAL_ADMIN delegation without SuperAdmin | future (role currently a no-op) |
| NOTF-01 | Portal email notifications (beyond reset), app health probes, self-registration | out-of-scope list of 00-overview |
| RATE-02 | Redis/distributed rate limiting | single-container in-memory accepted |
| LAND-01 | Landing page at `/` (design Option B) | Option A shipped (`/ → /site`) |
| APPR-01 | Approval workflow restoration | schema dropped by migration 20260605010000; status derived |
| VIS-02 | who-hides-what audit, admin visibility control, custom group order, pin, staged wizard | YAGNI list in visibility design |
| DETECT-02 | detect auto-trigger on typing, detect from app.url, full-JS login pages | YAGNI in login-field detection |

## Out of Scope

| Feature | Reason |
|---------|--------|
| Split portal SSO into a separate service | Target runtime: Next.js 15 monolith, one repo |
| Approval workflow UI/schema ("Perlu Persetujuan") | migration `20260605010000_drop_approval_add_revision_video` removed it; status derived |
| New chart library / state store / data model | recharts already installed; design mandates zero new deps |
| Visual changes to public-facing site surfaces | rework depth: shell + data surfaces + portal/auth; routes/IA preserved |
| Tailwind upgrade / postcss changes | stay v3; `postcss.config.mjs` untouched |
| Fixing pre-existing build/dev failures (empty NEXTAUTH_URL, localStorage) | verification gates = tsc/eslint + manual; build failure is pre-existing |
| New dependencies (cheerio/jsdom, etc.) | login detection uses parse5 (already transitive) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PORT-01 | Phase 1 | Complete |
| PORT-02 | Phase 1 | Complete |
| PORT-03 | Phase 1 | Complete |
| PORT-04 | Phase 1 | Complete |
| PORT-05 | Phase 5 | Complete |
| PORT-06 | Phase 2 | Complete |
| PORT-07 | Phase 3 | Complete |
| PORT-08 | Phase 4 | Complete |
| PORT-09 | Phase 6 | Complete |
| PORT-10 | Phase 1 | Complete |
| PORT-11 | Phase 6 | Complete |
| PORT-12 | Phase 6.1 | Complete |
| PORT-13 | Phase 6.2 | Complete |
| PORT-14 | Phase 6.3 | Complete |
| PORT-15 | Phase 6.4 | Complete |
| UIUX-01 | Phase 7 | Complete |
| UIUX-02 | Phase 8 | Complete |
| UIUX-03 | Phase 9 | Complete |
| UIUX-04 | Phase 10 | Complete |
| UIUX-05 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-15 (derived from intel/constraints.md — 25 SPEC clusters compressed into 20 anchor requirements; UIUX-05 synthesized from ui-ux-rework-design §5)*
*Last updated: 2026-08-15 after roadmap creation*