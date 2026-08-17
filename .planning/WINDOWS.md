---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-17T11:38:51.918Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 12 | unrun-verify | app/api/media/route.ts |  | Backstop E2E (POST a.pdf -> 201, GET /api/uploads/documents/*.pdf -> application/pdf) not runnable per PRE-1 (local Postgres down, dev cannot render); deferred to browserable/deployed env. Contract covered deterministically by scripts/test-pdf-inline.ts. | open |  | 2026-08-17T11:38:51.918Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "12",
    "file": "app/api/media/route.ts",
    "line": null,
    "description": "Backstop E2E (POST a.pdf -> 201, GET /api/uploads/documents/*.pdf -> application/pdf) not runnable per PRE-1 (local Postgres down, dev cannot render); deferred to browserable/deployed env. Contract covered deterministically by scripts/test-pdf-inline.ts.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-17T11:38:51.918Z",
    "resolved_at": null
  }
]
````
