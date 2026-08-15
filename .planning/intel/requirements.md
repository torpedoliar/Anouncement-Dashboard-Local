# Synthesized Requirements (PRDs)

> Source of truth: per-doc classification JSONs in `.planning/intel/classifications/` + source documents.
> Schema: `## REQ-{slug}` / `- source:` / `- description:` / `- acceptance:` / `- scope:`.
> Absent fields are marked absent; nothing is inferred.

**No PRD-classified documents exist in this ingest set (0 / 36).**

- No user-story / acceptance-criteria documents were classified as PRD.
- Capability-level intent is present in SPEC docs (e.g., docs/specs/00-overview.md
  goals, docs/implementation plan/00-master-plan.md milestones M1–M6) and is captured
  in `constraints.md` / `context.md` with source attribution.
- DoD / acceptance-style gates defined inside SPEC-classified phase plans
  (docs/implementation plan/phase-1-foundation.md … phase-6, docs/superpowers/plans/*)
  are recorded as constraints, not as requirement entries.
- When `gsd-roadmapper` needs requirement IDs, derive them from the constraint
  entries below (each carries its source path).