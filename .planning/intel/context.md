# Synthesized Context (DOCs)

> Source of truth: per-doc classification JSONs in `.planning/intel/classifications/` + source documents.
> Topic-keyed entries with `- source:` attribution; appended with extracted notes.
> 11 DOC-classified docs in this ingest set (0 ADR, 0 PRD). DOC-type content provides
> planning context, risk registers, test plans, and process guidance — not constraints
> or decisions.

## Master Implementation Plan
- source: docs/implementation plan/00-master-plan.md
- 6 sequential phases descending from 11 base specs, milestones M1–M6, target version 3.0.0 / schemaVersion 9.
- Execution principles: sequential phases, buildable per phase (`npm run build` + `npm run lint`), non-destructive migrations, backup before migration, no new dependencies beyond existing stack.
- Dependency graph: Phase 1 (foundation) → Phase 2 (audit trail, can parallel with Phase 3) + Phase 3 (admin portal) → Phase 4 (portal UX) → Phase 5 (SSO launch) → Phase 6 (integration and hardening).
- Effort estimate: ~9–13 days single developer (phases 2 and 3 parallel = ~2 days saved).
- Pre-deploy checklist and deployment sequence (merge, build, migrate, backfill, smoke test, env config, docker deploy). Rollback strategy: non-destructive migrations make revert safe without DB revert.
- ~25 new files, ~18 modified files across all phases.
- Risk summary table (R1–R7) with impact and mitigation pointers to risk-register.md.

## Phase 3 — Admin Portal Management (implementation plan)
- source: docs/implementation plan/phase-3-admin-portal.md
- Milestone M3, prerequisite Phase 1. Parallelizable with Phase 2.
- Task list: 3.1 API Portal Apps (GET/POST/PUT/DELETE, SuperAdmin, logAudit per action); 3.2 API Portal Users (create with app access, update, delete, assign/revoke access, reset password, activate/deactivate); 3.3 API Portal Sessions (GET list, DELETE revoke, SuperAdmin or owner); 3.4 admin page /admin/portal-apps (table + modal form); 3.5 admin page /admin/portal-users (table + expand app access + actions); 3.6 admin page /admin/portal-sessions (table + revoke + filter); 3.7 sidebar additions (3 SuperAdmin-only nav items).
- DoD: all APIs build and are SuperAdmin-only; CRUD verified; all actions logged to AuditLog; sidebar shows 3 new menus; build+lint clean.

## Phase 6 — Integration and Hardening (implementation plan)
- source: docs/implementation plan/phase-6-integration-hardening.md
- Milestone M6, prerequisite all phases 1–5.
- Task list: 6.1 backup/restore coverage for portal+audit tables (PortalApp → PortalUser → PortalUserAppAccess → PortalUserAppCredential → PortalSession → AuditLog order, FK-aware); 6.2 middleware matcher additions + rate-limit 10/min for portal-auth paths; 6.3 seed update (portal admin + portal user demo + sample app); 6.4 docker-compose env (3 new env vars); 6.5 helper scripts (make-portal-admin.ts, rotate-portal-key.ts future); 6.6 version bump (2.7.0 → 3.0.0, schemaVersion 8 → 9) + CLAUDE.md sections; 6.7 env validation final; 6.8 root nav (recommended: keep / → /site redirect, portal at /portal).
- DoD and end-to-end smoke test specified (10 steps + docker deploy test).

## Risk Register
- source: docs/implementation plan/risk-register.md
- 12 risks identified (R1–R12) with impact level (Kritis/Tinggi/Sedang/Rendah), likelihood, mitigation, and contingency.
- Critical risks: R1 DB migration failure (mitigated: backup + non-destructive + staging test); R3 credential key leak (mitigated: .env gitignored, not logged, fail-closed startup validation, contingent rotate-portal-key.ts).
- High risks: R4 retrofit breaks existing routes (mitigated: try/catch non-blocking + dual-write); R8 dual NextAuth cookie collision (mitigated: portal-auth.* prefix, test separately).
- Medium risks: R2 cross-origin SameSite strict; R6 lockout locks legitimate user (threshold 5× + 15 min duration, admin password reset unlocks); R9 popup blocker; R10 audit log bloat; R11 prisma not re-generated; R12 email reset not sent.
- Low risk: R5 backfill duplicate (idempotent script); R7 rate-limit in-memory resets on restart (accepted for single container).

## Test and Verification Plan
- source: docs/implementation plan/test-verification-plan.md
- Verification strategy: compile (`npm run build`), lint, manual unit via `npx tsx -e`, manual integration via UI + DB check, security checklist before deploy.
- Per-phase tests: Phase 1 (crypto round-trip, audit non-blocking, env fail-closed, migration verification); Phase 2 (retrofit audit per route, audit page filters/export, backfill idempotence, retention purge); Phase 3 (portal CRUD + RBAC + sessions); Phase 4–5 (login, grid, credentials, SSO launch, forgot/reset password); Phase 6 (full end-to-end smoke test, 10 steps).
- Security checklist (10 items per 08-security.md §9), including PORTAL_CREDENTIAL_KEY not in git, lockout tested, rate-limit 429, cookie prefix, API credential no plaintext, redaction confirmed, no AuditLog DELETE API.

## Design Quality Fix Plan (DQ-0..7)
- source: docs/implementation plan/design-quality-fix-plan.md
- Impeccable critique score 18/40 (Fair) with P0:1, P1:4, Minor:13. Target: >= 32/40 (Good).
- Inventories 50+ `alert()`, 15 `confirm()`, 175× inline `#dc2626`, 51× `#ef4444`, 3 different brand red systems, double font load, 33+ uppercase eyebrow labels, missing `prefers-reduced-motion`, missing `text-wrap`, unnatural `outline: 'none'` on ~20 elements.
- DQ-0 through DQ-7 phases: foundation (single token red ConfirmDialog reduced-motion) → a11y P0 → replace alert/confirm → token authority inline → strip AI-slop decoration → IA/UX copy → minor/perf → verification.
- Total effort ~9–12 days single developer; phases DQ-1/2/3/4 parallel after DQ-0 saves ~3 days.
- Areas explicitly NOT to break: SiteThemeProvider per-site color, BulkActionBar bulk delete, AnnouncementForm autosave, RichTextEditor focus, login flow, portal SSO, ToastContext, DB/API.

## Login Field Detection Implementation Plan
- source: docs/superpowers/plans/2026-08-12-portal-app-login-field-detection.md
- Task-by-task plan for "Deteksi Otomatis" button on /admin/portal-apps form.
- Architecture: `detectLoginFields(html)` pure function using parse5 (transitive, no new dep), POST /api/portal-apps/detect-fields (SuperAdmin only, SSRF-safe), client button calling API and filling form.
- 5 tasks: (1) parser + self-check test (9 cases: classic form, autocomplete priority, keyword-based, email, CSRF hidden, no password, no form, multiple forms, fallback, no-type, no-name); (2) API route with SSRF protection (http/https only, block local/private/link-local, 8s timeout, 64KB cap); (3) client button + preview + autofill; (4) verify all tests pass + tsc + lint; (5) manual E2E.
- Constraints: extraFields = Record<string,string> (object, not array), no schema change, no new dep, no JS execution, inline-style UI consistent.

## Phase 0: Design System Foundation (UI/UX rework, implementation plan)
- source: docs/superpowers/plans/2026-08-12-ui-ux-rework-phase0-design-system.md
- Phase 0 of Approach A ("tokenize then migrate"). Establishes semantic CSS-variable token system for every later rework phase.
- 6 tasks: (0) baseline verify + install @phosphor-icons/react; (1) typography — add Sora (display) + JetBrains Mono (numerals) via next/font; (2) globals.css rewrite — semantic CSS variable tokens (--surface-*, --text-*, --accent, --border) with night default + .theme-light override + backward-compat aliases (--bg-primary → --surface-1 etc.); (3) Tailwind config mapping (text-text-1, bg-surface-1, border-border families); (4) ui/ kit (Button, Card, Badge, Input, Select, Table, Dropdown in /components/ui/); (5) SiteThemeProvider extension to emit --site-primary in admin shell; (6) ThemeToggle (adminTheme persisted in localStorage, app/globals.css tree).
- Constraints: Tailwind stays v3, postcss.config.mjs NOT changed; backward-compat aliases required; preserve existing a11y (focus-visible, prefers-reduced-motion, sr-only, skip-link); night default by default (no visual regression); UI kit Tailwind-class based not inline-style.
- Verification: `git status --short` baseline, `npm run build` (stop if pre-existing failure), `npx tsc --noEmit` + `npm run lint` after each task.

## Issue Tracker (GitHub)
- source: docs/agents/issue-tracker.md
- Issues and specs live as GitHub issues. `gh` CLI for all operations.
- Conventions for create, read, list, comment, and apply/remove labels on issues.
- PRs as a triage surface: set to NO (external PRs are not treated as feature requests).
- Wayfinding operations for `/wayfinder`: map = issue labelled `wayfinder:map`; child tickets linked via sub-issues or task list; blocking via GitHub native issue dependencies (POST `/repos/{owner}/{repo}/issues/{child}/dependencies/blocked_by`); frontier query for next available work; claim with `--add-assignee @me`; resolve with comment + close + context pointer.

## Triage Labels
- source: docs/agents/triage-labels.md
- Five canonical triage labels used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
- All five match the skill conventions exactly (no remapping needed).
- When a skill mentions a triage role, use the corresponding label string from the table.

## Domain Documentation Guidance
- source: docs/agents/domain.md
- Single-context repo (most repos): CONTEXT.md at root + docs/adr/. Multi-context repo: CONTEXT-MAP.md pointing to per-context CONTEXT.md + per-context docs/adr/.
- Before exploring: read CONTEXT.md (or CONTEXT-MAP.md) and relevant ADRs. If files don't exist, proceed silently — do not flag absence or suggest creation.
- Use glossary's vocabulary (CONTEXT.md definitions). If concept not in glossary, reconsider or note gap for /domain-modeling.
- If output contradicts an existing ADR, surface it explicitly rather than silently overriding.