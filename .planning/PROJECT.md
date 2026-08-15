# Announcement Dashboard

## What This Is

The Announcement Dashboard is a multi-tenant announcement CMS ("one newsroom, many mastheads") with a Portal Web SSO layer and a comprehensive audit trail, all in one Next.js 15 monolith. Editors and site admins publish per-site announcements, while portal users get SSO access to third-party apps via stored, encrypted credentials — every mutation on either side lands in a single AuditLog. The current cross-cutting milestone is a token-native UI/UX rework (design system → shell → content desk → data surfaces → portal & auth surfaces) that must not change any API or behavior.

## Core Value

The multi-tenant announcement CMS keeps working — same routes, same API contracts, same portal SSO behavior — while its entire admin and portal surface is rebuilt token-native ("tokenize then migrate") with zero regressions. Portal SSO (login, sessions, credential forwarding, audit) must stay stable and verifiable at every step.

## Business Context

- **Customer**: Internal SJA newsroom editors (speed + legibility) and client-facing demos (premium, on-brand via masthead accents)
- **Revenue model**: Internal platform; demos serve the client relationship, not direct sales
- **Success metric**: UI/UX rework P0–P4 shipped token-native with zero API/behavior regressions; portal SSO stable and verifiable
- **Strategy notes**: Design identity doc: `docs/superpowers/specs/2026-08-12-ui-ux-rework-design.md` (Approach A — "tokenize then migrate")

## Requirements

### Validated

- [x] Portal SSO: portal users (PortalUser), separate NextAuth instance (`portal-auth.*` cookies, DB-backed revocation), login + lockout (5x/15min), forgot/reset password — shipped
- [x] Portal RBAC: SuperAdmin-managed apps/users/access; PortalUser sees only granted apps; access vs credential separation — shipped
- [x] SSO form-based credential forwarding: AES-256-GCM at-rest credentials, auto-submit to `loginUrl`, failure UX states — shipped
- [x] Audit trail: `logAudit()` single source of truth, all mutation routes retrofitted, AdminTrail page + CSV/JSON export, retention purge, idempotent backfill — shipped
- [x] Portal access evolution: group-based access (PortalGroup), per-user visibility (onboarding wizard + toggles), restricted apps + multi-credential (isPublic/label), auto login-field detection — shipped
- [x] UI/UX rework P0–P3: design tokens, UI kit, admin shell, content desk, data surfaces — shipped token-native (roadmap Phases 7–10)
- [x] UI/UX rework P4: portal & auth surfaces token-native restyle and final verification — shipped target of the current milestone

### Active

- [ ] Portal & Auth Surfaces (rework P4): shared auth frame, portal app grid launch cards, portal secondary surfaces (settings, credentials vault, onboarding wizard, account selector, failure states), portal admin ledgers — all token-native with zero SSO behavior regression (Phase 11)

### Out of Scope

- [ ] SSO modes REDIRECT/PROXY/TOKEN (OIDC/OAuth2/SAML) — future; BASE enum extensible (see OPD-2 for REROUTE/VAULT out-of-band status)
- [ ] PORTAL_ADMIN delegation without SuperAdmin — future (PortalUser.role currently behaves as PORTAL_USER)
- [ ] Portal email notifications, app health probes, portal self-registration — future
- [ ] Distributed rate limiting (Redis) — single Docker container today, in-memory middleware is accepted
- [ ] Landing page at `/` (design Option B) — root stays `/ → /site`; portal reachable explicitly
- [ ] Approval workflow ("Perlu Persetujuan") — schema removed by migration `20260605010000_drop_approval_add_revision_video`; status derived, never stored
- [ ] Visibility feature creep: admin visibility control, hide-audit, custom group order, pin feature, staged tour — YAGNI (design doc)
- [ ] Login-field detection: auto-trigger on typing, detect from `app.url` (loginUrl only), full-JS login pages, persisting detection results — YAGNI

## Context

- Single repo `announcement-dashboard`; current version line 3.0.0 (version.json schemaVersion 9). Portal SSO + audit already live in code: `lib/portal-{auth,crypto,access}.ts`, `lib/audit.ts`, portal routes, admin portal pages.
- Rework P0–P3 is shipped in code (tokens in `app/globals.css`, `components/ui/` kit, `components/admin/*` token-native, `lib/{admin-nav,announcement-status,chart-theme}.ts`). Completion evidence = repo state; there are no GSD execution records for either milestone yet.
- Docs: 36-doc ingest set (25 SPEC + 11 DOC) in `.planning/intel/`; 6 WARNING-level competing variants preserved as open decisions (OPD-1..6) in ROADMAP.md.
- Constraints docs: `docs/specs/00–10`, `docs/implementation plan/*`, `docs/superpowers/{specs,plans}/*`; issue tracker & triage labels documented in `docs/agents/`.
- **Verification environment constraint (from rework P1 plan):** `npm run build` currently FAILS pre-existing (empty `NEXTAUTH_URL` — do NOT fix), `npm run dev` cannot render (pre-existing global `localStorage is not a function` + local Postgres down). Gates = `npx tsc --noEmit` + scoped `eslint` + static review + manual E2E checks. Do not touch `postcss.config.mjs`; Tailwind stays v3.
- UI strings and commit messages are in Indonesian (Bahasa Indonesia).

## Constraints

- **Runtime**: Next.js 15 App Router + React 19 single monolith; do NOT split portal SSO into a separate service
- **Stack**: Prisma 5 + PostgreSQL, NextAuth (JWT, DB-backed revocation), Tailwind v3, Zod, TipTap; no new dependencies beyond existing stack (node:crypto, bcryptjs, parse5 transitive for login-field detection)
- **Schema**: non-destructive migrations only (CREATE TABLE/CREATE TYPE, no DROP); `prisma:generate` after schema changes; bump `schemaVersion` in `version.json` with every migration
- **UI**: token-native only (semantic CSS vars → Tailwind mapping: `bg-surface-*`, `text-text-*`, `border-border`, `accent = --site-primary`); no raw hex, no inline-style chrome in new code; Phosphor icons only (never react-icons/fi in new shell code); fonts Sora/Inter/JetBrains Mono (tabular-nums); motion 150–300ms `cubic-bezier(0.16,1,0.3,1)` transform/opacity with reduced-motion honored; dark/light parity with AA contrast
- **Behavior**: UI phases must NOT change routes, data model, API contracts, auth, SSO, scheduler, or access rules; announcement status must come from `deriveAnnouncementStatus()` in `lib/announcement-status.ts`, never from the design-spec diagram
- **Security**: `PORTAL_CREDENTIAL_KEY` mandatory (64 hex / 32 bytes), fail-closed at startup; credentials AES-256-GCM, decrypted in memory only at SSO launch, never returned by API; audit (`logAudit()`) non-blocking, never gates the main transaction, auto-redacts sensitive keys; no AuditLog DELETE API; DB-backed session revocation
- **Performance**: pagination via `validatePagination`, `force-dynamic` on portal server pages, avoid N+1 (single left-join health indicator)
- **Config**: granularity `standard`; phase ID convention `sequential`

## Key Decisions

All entries SPEC/DOC-sourced — there are NO locked ADRs in this repo (the "Keputusan utama" D1–D8 table lives inside draft SPEC 00-overview). Treat as constraints only, not immutable.

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| D1: Portal users separate from CMS users (PortalUser vs User) | strict separation, no risk to admin auth | ✓ Good — shipped (portal-auth.* cookies distinct) |
| D2: SSO via form-based credential forwarding | works cross-origin without callbacks; no new deps | ✓ Good — shipped |
| D3: Credentials AES-256-GCM per (user, app), keyed by PORTAL_CREDENTIAL_KEY | at-rest protection; decrypted only at launch | ✓ Good — shipped |
| D4: New single AuditLog table | ActivityLog.userId NOT NULL can't record system/portal events | ✓ Good — shipped |
| D5: ActivityLog retained + backfilled for 1 (legacy compat) | don't break existing data | ✓ Good — shipped |
| D6: No new dependencies (crypto/bcryptjs/auth/zod/prisma only) | supply-chain minimalism | ✓ Good — shipped |
| D7: Portal managed by Super Admin CMS (/admin panel) | single supervision surface | ✓ Good — shipped |
| D8: SSO mode FORM first; enum extensible (REDIRECT/PROXY/TOKEN future) | MVP sequencing | ⚠️ Revisit — REROUTE/VAULT implemented out-of-band; see OPD-2 |
| A1: UI/UX rework Approach A "tokenize then migrate", 5 phases (0–4) | design system first, workstream migration, no long dark period | ✓ Good — P0–P3 shipped |
| A2: Announcement status is derived, not stored; no "Perlu Persetujuan" | approval schema was dropped by migration `20260605010000` | ✓ Good — `deriveAnnouncementStatus()` shipped (OPD-6) |
| Open decisions OPD-1..6 (ingest conflicts) | 6 competing SPEC variants preserved, do NOT pick winners unilaterally | — Pending — carried in ROADMAP.md §Open Decisions; each links to the phase that must resolve it |

---
*Last updated: 2026-08-15 after new-project-from-ingest (36 docs synthesized)*