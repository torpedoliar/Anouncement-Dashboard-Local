## Conflict Detection Report

### BLOCKERS (0)

No BLOCKER-level conflicts found.

- 0 LOCKED ADRs in ingest set → no LOCKED-vs-LOCKED contradictions.
- 0 ADRs total → no unlock ADR vs locked-CONTEXT.md (MODE=new).
- 0 UNKNOWN/low-confidence classifications in the 36-doc set.
- 3 cross-reference cycles were detected via Tarjan's SCC algorithm (see INFO section below). They are citation-only cycles between independently authored peer SPEC documents. Extraction from each doc proceeds independently — synthesis cannot loop. Recorded as INFO, not BLOCKER.

### WARNINGS (6)

[WARNING] Grid access rule evolution — 4 overlapping SPECs disagree on access semantics
  Found: docs/specs/03-rbac.md defines grid = apps where PortalUserAppAccess row exists (admin-managed, per-user binding)
  Found: docs/implementation plan/Specs & Implementation Plan — Portal Group-Based Access.md defines access = union of (active groups' apps) + (direct PortalUserAppAccess override)
  Found: docs/superpowers/specs/2026-08-11-portal-user-app-visibility-design.md defines ALL users see ALL active apps (no per-user restriction), then user hides via PortalUserAppVisibility on/off toggles
  Found: docs/superpowers/specs/2026-08-12-portal-app-restricted-multicred.md defines access = public apps (all users) + restricted apps (gated by group/direct access), then visibility filters
  Impact: Four different models for which apps appear in /portal grid — row-gated, union-of-group, default-all-with-hide, and public-vs-restricted. These are sequential design revisions; the base spec and earliest doc (03-rbac) is superseded by the later design docs.
  → Choose which model to implement. Cross-reference all four before coding getAccessiblePortalApps. The restricted-multicred spec (latest dated 2026-08-12) adds isPublic and single-source access rule.

[WARNING] SSO mode enum values diverging — REROUTE/VAULT not in base enum
  Found: docs/specs/04-sso-credential-forwarding.md defines PortalSsoMode enum = [FORM, REDIRECT, PROXY, TOKEN] as extensible
  Found: docs/superpowers/specs/2026-08-12-portal-app-restricted-multicred.md references REROUTE mode (SSO route /api/sso/reroute) and VAULT mode (SSOCredentialVault component)
  Impact: SSO launch implementation references modes not defined in the source-technology model. Base spec's extensibility note ("future modes") accommodates this, but the actual enum values and route implementations are not reflected in the base enum.
  → Either add REROUTE and VAULT to the PortalSsoMode enum before migration, or keep them as out-of-band implementations documented only in the design specs.

[WARNING] PortalUserAppCredential unique constraint changes — schema conflict
  Found: docs/specs/01-data-model.md defines @@unique([portalUserId, appId]) on PortalUserAppCredential (one credential per user+app)
  Found: docs/superpowers/specs/2026-08-12-portal-app-restricted-multicred.md changes to @@unique([portalUserId, appId, label]) and makes label REQUIRED (default "default" in migration)
  Impact: Every findUnique({ where: { portalUserId_appId } }), upsert, and credential API call must be rewritten. Migration must backfill existing rows with label='default'.
  → Apply the restricted-multicred schema change as a later migration, after base credential API is live. Write only one unique constraint at each migration step.

[WARNING] Credential API shape diverges between base spec and multi-credential design
  Found: docs/specs/04-sso-credential-forwarding.md defines credential API as per-app GET/POST/DELETE (one credential per (user, app))
  Found: docs/superpowers/plans/2026-08-12-portal-app-restricted-multicred.md extends to multi-account with label, credential count indicator, per-credential DELETE by credentialId
  Impact: API contract and UI must evolve from single-credential to multi-credential. The GET response shape, POST request body (add label), and DELETE target change.
  → Implement base single-credential API per 04-sso first, then extend with label-support and credential-id routing per restricted-multicred plan.

[WARNING] UI/UX rework nav groups add routes not in base spec
  Found: docs/specs/07-pages-and-routes.md defines sidebar as 4 items within isSuperAdmin block (Portal Apps, Portal Users, Portal Sesi, Audit Trail)
  Found: docs/superpowers/plans/2026-08-13-ui-ux-rework-phase1-shell.md defines nav groups Kantor/Terbit/Saluran/Sistem, with /admin/portal-groups and /admin/portal-audit routes added to sidebar
  Impact: /admin/portal-groups (group-based access) and /admin/portal-audit (renamed?) are new routes not in the base route map 07-pages-and-routes. The nav model in shell implementation responds to feature-creep from group-based access spec.
  → Ensure those routes exist before shell nav references them. The Phase 1 shell will reference routes that may not yet be implemented.

[WARNING] UI/UX design mentions "Perlu Persetujuan" status — approval workflow was removed by migration
  Found: docs/superpowers/specs/2026-08-12-ui-ux-rework-design.md (Section 5) lists "Perlu Persetujuan" as an announcement status state, referencing pending ApprovalRequest
  Found: docs/superpowers/plans/2026-08-13-ui-ux-rework-phase2-content-desk.md states the approval workflow was REMOVED by migration 20260605010000_drop_approval_add_revision_video. Phase 2 plan explicitly says "do NOT add approval UI or schema" and "existing pending-approval presentation union remains untouched unless later feature restores its data source"
  Impact: The design spec assumes a pending-approval state that no longer exists in the codebase. The implementation plan deliberately drops it. This creates a discontinuity between design intention and executable plan.
  → Align the design spec (ui-ux-rework-design.md) to remove "Perlu Persetujuan" from the status model, or restore the approval workflow as a separate feature before Phase 2 runs.

### INFO (3)

[INFO] Cross-reference citation cycles — no extraction looping
  Found: Tarjan SCC detection found 3 strongly-connected components in the cross-ref graph of 36 nodes:
    - SCC {docs/specs/01-data-model.md, docs/specs/05-audit-trail.md}: data model defines AuditLog model, audit spec references data model
    - SCC {docs/specs/02-authentication-and-sessions.md, docs/specs/04-sso-credential-forwarding.md, docs/specs/08-security.md}: auth/SSO/security refer to each other's threat models and flows
    - SCC {docs/specs/00-overview.md, docs/specs/10-changelog-and-env.md}: overview references implementation scope, changelog references overview
  Rationale: All cycles are citation-only references between independently authored peer SPEC documents. Each doc contains distinct content (schema definitions, protocol flows, threat models, env config) — extraction from each proceeds independently with no redundancy. Synthesis cannot produce loops.
  Resolution: Noted for transparency. All 7 documents in the cycles are extracted in constraints.md with full content.

[INFO] No ADR-vs-SPEC conflicts in ingest set
  Note: No ADRs exist in the 36-doc ingest set. The "Keputusan utama" table (D1–D8) in docs/specs/00-overview.md is a decision summary inside a draft SPEC, not standalone ADRs — nothing is locked. All SPEC/DOC constraints have equal SPEC-precedence standing. No auto-resolved ADR-over-SPEC entries.

[INFO] All 36 documents have equal precedence (precedence: null)
  Note: No per-doc precedence overrides exist in any classification. Default ordering ADR > SPEC > PRD > DOC applies. Since 0 ADRs and 0 PRDs exist, the 25 SPEC docs and 11 DOC docs all carry equal precedence weight. Where later SPECs supersede earlier ones on the same topic, both variants are preserved in the intel (competing-variants WARNINGs above) rather than one being auto-resolved over the other. Auto-resolved entries (ADR beating lower-precedence sources) do not apply here.