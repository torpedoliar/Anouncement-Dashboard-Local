# Synthesized Decisions (ADRs)

> Source of truth: per-doc classification JSONs in `.planning/intel/classifications/` + source documents.
> Schema: `## {title}` / `- source:` / `- status: locked|proposed` / `- decision:` / `- scope:`.
> Absent fields are marked absent; nothing is inferred.

**No ADR-classified documents exist in this ingest set (0 / 36).**

- No `docs/adr/` files were ingested.
- `00-overview.md` contains a "Keputusan utama" table (D1–D8) — explicitly a decision
  summary inside a draft SPEC, not standalone ADRs; the classifier notes nothing is locked.
  Those decisions are captured as protocol constraints in `constraints.md` (source:
  docs/specs/00-overview.md) rather than as decisions entries.
- Consequently: no locked decisions, no LOCKED-vs-LOCKED contradictions, and
  nothing for `gsd-roadmapper` to treat as immutable. All constraints below are
  SPEC/DOC precedence and may be overridden by future ADRs.