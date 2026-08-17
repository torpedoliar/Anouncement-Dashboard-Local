---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: milestone
current_phase: 11
current_phase_name: Portal & Auth Surfaces
status: planning
stopped_at: Phase 12 context gathered
last_updated: "2026-08-17T09:32:34.250Z"
last_activity: 2026-08-15
last_activity_desc: plan-phase 11 attempted at subagent level; stopped at the CONTEXT gate + Agent-tool gap (see Blockers). Needs a top-level run.
progress:
  total_phases: 16
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-15)

**Core value:** Multi-tenant announcement CMS keeps working — same routes, same API contracts, same portal SSO behavior — while its entire admin and portal surface is rebuilt token-native with zero regressions.
**Current focus:** Phase 11 — Portal & Auth Surfaces (UI/UX rework P4, the last phase of M2)

## Current Position

Phase: 11 of 11 (Portal & Auth Surfaces)
Plan: 0 of TBD (not planned yet)
Status: Approved — ready to plan
Last activity: 2026-08-15 — plan-phase 11 attempted at subagent level; stopped at the CONTEXT gate + Agent-tool gap (see Blockers). Needs a top-level run.

Progress: [████████░░] 80% (4/5 phases of the active milestone complete; phase-based estimate)

## Performance Metrics

**Velocity:**

- GSD-tracked plans completed: 0 (M1 and rework P0–P3 shipped before the GSD tracker existed; completion verified by repo scan, not execution records)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1–6.4 (M1) | shipped | — | — |
| 7–10 (rework) | shipped | — | — |
| 11 (current) | TBD | — | — |

## Accumulated Context

### Decisions

- **Approach A "tokenize then migrate"** locked for the rework (design doc approved 2026-08-12); P0–P3 shipped token-native (evidence: tokens in `app/globals.css`, `components/ui/` kit, token-class `AdminSidebar`/`StatTile`, `lib/{admin-nav,announcement-status,chart-theme}.ts`).
- **Six open decision points** from ingest conflicts preserved in ROADMAP.md (OPD-1..6) — do NOT pick winners unilaterally. Phase 11 must respect OPD-1 (never touch `getAccessiblePortalApps`/`getPortalLayout`), OPD-4 (sweep for stale `portalUserId_appId`), OPD-2 (REROUTE/VAULT out-of-band enum question stays open).
- **Announcement status is derived, not stored** (`deriveAnnouncementStatus()`: takedown wins → scheduled → published → draft). NO "Perlu Persetujuan" state — approval schema was dropped (migration `20260605010000_drop_approval_add_revision_video`).
- M1 D1–D8 are SPEC-sourced decisions, NOT locked ADRs (none exist in repo) — recorded in PROJECT.md.

### Pending Todos

None (capture via /gsd-add-todo when ideas arise).

### Blockers/Concerns

- **PRE-1 — Verification environment**: `npm run build` fails pre-existing (empty `NEXTAUTH_URL` — do NOT fix); `npm run dev` cannot render (pre-existing `localStorage is not a function` + local Postgres down). Gates = `npx tsc --noEmit` + scoped eslint + static review + manual E2E. Do not touch `postcss.config.mjs`; Tailwind stays v3.
- **PRE-2 — No plan doc for Phase 11**: ✅ RESOLVED 2026-08-15 — `phases/11-portal-auth-surfaces-current-ready-to-plan/11-SPEC.md` exists (ambiguity 0.11 ≤ 0.20 gate; 5 locked requirements; 10 acceptance checkboxes; edge-coverage + prohibition tables; interview log). Ground truth is in the spec; its declared next step is `/gsd-discuss-phase 11` (CONTEXT.md does NOT exist yet).
- **PRE-4 — Plan-phase 11 needs top-level runtime**: initiated from a subagent context — `gsd-tools query init.plan-phase 11` returns phase_found=true, has_context=false, has_research=false, plan_count=0, research+checker enabled, text_mode=false. No Agent tool in that runtime (`gsd-tools agent` only supports `classify-failure`), so gsd-planner/gsd-plan-checker cannot be spawned; role separation forbids inline planning. Required: run `/gsd-plan-phase 11 [--skip-research]` at top level (Agent available), first deciding the has_context=false gate (discuss-first vs continue).
- **PRE-3 — Completion evidence is repo-inferred**: M1 + P0–P3 have no GSD execution records; verify any doubt at execution time rather than trusting status columns.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| SSO modes | REDIRECT/PROXY/TOKEN; REROUTE/VAULT enum values (OPD-2) | Future | 2026-08-15 |
| Portal features | PORTAL_ADMIN delegation, email notif, health probes, self-registration | Out of scope (00-overview) | 2026-08-15 |
| Approval | Restore ApprovalRequest workflow | Only if re-added as future feature (OPD-6) | 2026-08-15 |
| Rate limit | Redis/distributed | Accepted in-memory, future | 2026-08-15 |

## Session Continuity

Last session: 2026-08-17T09:32:34.238Z
Stopped at: Phase 12 context gathered
Resume file: .planning/phases/12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex/12-CONTEXT.md

---
*Next action: `/gsd-plan-phase 11` (Portal & Auth Surfaces) — run at TOP LEVEL (Agent tool required for researcher/planner/checker spawns)*

### Roadmap Evolution

- Phase 12 added: PDF Reader Inline di Artikel — upload dan embed PDF di RichTextEditor, tampil inline tanpa download/tab baru (2026-08-17, graphify audit pre-check)
