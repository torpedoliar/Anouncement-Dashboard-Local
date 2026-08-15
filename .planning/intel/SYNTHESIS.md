# Synthesis Summary

> Entry point for `gsd-roadmapper`. Produced by GSD doc-synthesizer.
> MODE: new · PRECEDENCE: ADR > SPEC > PRD > DOC (no per-doc overrides)

## Documents consumed

| Type    | Count | Coverage                                         |
|---------|-------|---------------------------------------------------|
| ADR     | 0     | (0 / 36) — Keputusan utama D1–D8 are draft SPEC |
| SPEC    | **25**| Base specs (00–10), implementation plans (phase 1,2,4,5), group-based access, feature specs (visibility, restricted+multicred, login-field-detection), UI/UX rework (design + phase 1–3) |
| PRD     | 0     | (0 / 36) — capability intent captured in SPEC constraints |
| DOC     | **11**| Master plan, phase 3/6 plans, risk register, test plan, design-quality plan, login-field-detection plan, phase 0 design system, issue-tracker, triage-labels, domain |
| UNKNOWN | 0     | —                                                |
| LOCKED  | 0     | —                                                |
| **Total** | **36**| |

## Synthesized intel files

| File                     | Entries | Path                                     |
|--------------------------|---------|------------------------------------------|
| decisions.md             | 0 ADRs  | `.planning/intel/decisions.md`           |
| requirements.md          | 0 PRDs  | `.planning/intel/requirements.md`        |
| constraints.md           | 25 SPECs| `.planning/intel/constraints.md`         |
| context.md               | 11 DOCs | `.planning/intel/context.md`            |
| **SYNTHESIS.md**         | —       | `.planning/intel/SYNTHESIS.md` (this)    |

## Constraints by type (25 SPECs)

| Type           | Count | Key documents                                   |
|----------------|-------|-------------------------------------------------|
| api-contract   | 5     | 05-audit-trail, 06-api-reference, phase-2, phase-4, login-field-detection |
| schema         | 7     | 01-data-model, phase-1, group-based, visibility-design, visibility-plan, restricted-design, restricted-plan |
| nfr            | 8     | 03-rbac, 08-security, 09-implementation-phases, 10-changelog-and-env, ui-ux-rework-design, phase1-shell, phase2-content-desk, phase3-data-surfaces |
| protocol       | 5     | 00-overview, 02-auth, 04-sso, 07-pages-and-routes, phase-5-sso-launch |

## Conflict summary

| Bucket                | Count | Description                                      |
|-----------------------|-------|--------------------------------------------------|
| BLOCKERS              | 0     | No LOCKED ADRs, no UNKNOWN docs, no blocking cycles |
| WARNINGS (variants)   | 6     | Grid access rule evolution (4 specs); SSO enum divergence (REROUTE/VAULT); credential unique constraint rewrite; credential API shape evolution; nav routes not in base spec; approval-removal conflict between UI/UX design and Phase 2 impl plan |
| INFO auto-resolved    | 3     | Citation-only cycles (3 SCCs); no ADR-vs-SPEC (0 ADRs); equal-precedence supersession noted |

## Pointers

- **Conflict detail**: `.planning/INGEST-CONFLICTS.md`
- **Decisions**: `.planning/intel/decisions.md`
- **Requirements**: `.planning/intel/requirements.md`
- **Constraints**: `.planning/intel/constraints.md`
- **Context**: `.planning/intel/context.md`

## For gsd-roadmapper

- All domain facts (schema names, enum values, env vars, route paths, RBAC rules, token values, design-phase boundaries) are in constraints.md with source attribution.
- Use `REQ-{slug}` IDs from constraints.md entries (each SPEC entry is a functional requirement cluster).
- 6 WARNING-level competing variants need user resolution before routing. The grid-access-evolution (4 documents) is the most consequential — affects getAccessiblePortalApps core logic.
- The approval-workflow-removal conflict (design spec vs implementation plan) may change the announcement status model. Derive status per deriveAnnouncementStatus() in lib/announcement-status.ts, not from the design spec diagram.