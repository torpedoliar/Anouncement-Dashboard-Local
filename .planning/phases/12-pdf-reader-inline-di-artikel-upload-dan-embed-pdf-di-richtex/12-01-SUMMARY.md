---
phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex
plan: 1
subsystem: api
tags: [pdf, sanitizer, dompurify, upload, nextjs, prisma, traversal-guard]

# Dependency graph
requires:
  - phase: 00-foundation
    provides: sanitizeHTML (lib/validation-schemas.ts), /api/media upload branch pattern, /api/uploads traversal guard
provides:
  - sanitizeHTML keeps the TipTap PDF placeholder (div + data-pdf/data-src/data-filename) with the stored-XSS surface unchanged
  - /api/uploads serves .pdf as application/pdf under the intact path-traversal guard
  - POST /api/media accepts validated PDFs (double MIME+ext check, 50MB cap) into documents/ with a MediaLibrary row, no schema change
  - scripts/test-pdf-inline.ts node/runnable harness proving the sanitize+serve contract (no DB/env/network)
affects: [12-02 (TipTap PDF extension + toolbar), 12-03 (inline viewer + lampiran + sanitizer/render integration), gsd-verify-work, verifier]

# Actuals (#2632) — pairs with the plan's `estimate` (24000 chars tokens-scale). Realized diff was small and surgical.
actuals:
  tokens: 1500    # chars/4 over the realized diff (~6.0KB across 4 files)
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []  # no new dependencies this plan (isomorphic-dompurify, zod, sharp already present)
  patterns:
    - "Data-attr whitelist: ALLOWED_ATTR gains exactly data-pdf/data-src/data-filename while ALLOW_DATA_ATTR stays false — DOMPurify default URI regex still strips javascript:/data: URIs"
    - "Server-side double validation for uploads: claimed MIME AND filename extension must both match (never trust MIME alone)"
    - "Static-in-file harness: a node/tsx gate that reads the served route source to assert contract invariants without a DB or dev server"

key-files:
  created:
    - scripts/test-pdf-inline.ts  # runnable sanitize+serve contract harness
  modified:
    - lib/validation-schemas.ts      # sanitizeHTML ALLOWED_ATTR +3 data attrs
    - app/api/uploads/[...path]/route.ts  # MIME_TYPES pdf -> application/pdf
    - app/api/media/route.ts          # PDF upload branch (documents/, 50MB, MediaLibrary)

key-decisions:
  - "Whitelist only the three marker data attrs (data-pdf/data-src/data-filename) with ALLOW_DATA_ATTR: false — proven empirically to preserve the attrs while the default URI regex strips javascript:/data: payloads; no generic media tag was added to ALLOWED_TAGS"
  - "PDF accepted only when file.type === application/pdf AND filename ends .pdf (double validation per SPEC prohibitions, never trust MIME alone)"
  - "PDF branch stores the raw buffer unmodified (sharp must not run for PDFs) into public/uploads/documents/ with pdf_<ts>_<rand>.pdf naming; MediaLibrary alt falls back to the submitted file name"
  - "Serve-half of the harness is a static read of the uploads route source (no network) so the deterministic gate covers both sanitize and serve; live 201 <=> GET application/pdf remains the PRE-1 backstop manual gate"
  - "Tracer gate treated as autonomous (plan autonomous:true, wave 1): tracer <verify> (harness + tsc) re-run end-to-end after GREEN and passed before expanding to Task 2"

patterns-established:
  - "Harness-first TDD gate for data-path contracts: scripts/test-pdf-inline.ts exits non-zero on any failed assertion (throw), printing PDF-INLINE SANITIZE/SERVE OK on success"

requirements-completed: [PDF-01]  # MUST-NOT store PDF blob / must-NOT change, confirmed: no migration, no schema change; PDF persists only as URL in announcement.content + optional MediaLibrary row

coverage:
  - id: D1
    description: "sanitizeHTML keeps the div PDF placeholder (data-pdf + data-src + data-filename) and strips every XSS payload (img onerror, object/video javascript: URIs, data-src javascript:/data: schemes)"
    requirement: PDF-01
    verification:
      - kind: unit
        ref: "npx tsx scripts/test-pdf-inline.ts (sanitize half, 7 assertions) — exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "uploads route serves .pdf as application/pdf under the intact traversal guard (.. / . / NUL segments + resolve/separator prefix check unchanged); no schema/migration touched"
    requirement: PDF-01
    verification:
      - kind: unit
        ref: "scripts/test-pdf-inline.ts serve half (4 static assertions) — exit 0"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit — exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /api/media accepts application/pdf + .pdf files (<=50MB) -> 201 with url /api/uploads/documents/<file> and a MediaLibrary row (mimeType application/pdf); rejects wrong-MIME/non-.pdf/oversize with 400"
    requirement: PDF-01
    verification:
      - kind: other
        ref: "static source asserts (MAX_PDF_SIZE, documents folder, double validation) + npx tsc --noEmit + npx eslint app/api/media/route.ts — both exit 0"
        status: pass
    human_judgment: true
    rationale: "Live 201 <=> GET application/pdf E2E is a held-out BACKSTOP gate per PRE-1 (local Postgres down, dev cannot render) — must be verified on a browserable/deployed env before ship; the deterministic contract is covered by the harness."

# Metrics
duration: 20min
completed: 2026-08-17
status: complete
---

# Phase 12 Plan 1: PDF data path summary

**sanitizeHTML now keeps div[data-pdf] placeholders with XSS surface unchanged, /api/uploads serves .pdf as application/pdf under the intact traversal guard, and POST /api/media accepts validated PDFs (documents/, 50MB) — proven by a runnable no-DB harness**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-17T11:15:00Z
- **Completed:** 2026-08-17T11:35:00Z
- **Tasks:** 2 completed / 2 total
- **Files modified:** 4

## Accomplishments

- `sanitizeHTML` whitelists exactly the three PDF placeholder marker attributes (`data-pdf`, `data-src`, `data-filename`) while `ALLOW_DATA_ATTR` stays `false` — DOMPurify's default URI regex still strips `javascript:` and `data:text/html;base64,...` payloads, and no generic media tag was added to `ALLOWED_TAGS`. Stored-XSS surface on the public article page is unchanged (harness proves it: 7 sanitize assertions green).
- `app/api/uploads/[...path]/route.ts` adds `pdf -> application/pdf` to `MIME_TYPES`. The traversal guard (reject `..` / `.` / NUL segment, `resolve` + separator-bounded prefix check) is byte-for-byte unchanged; the harness asserts its presence statically.
- `POST /api/media` gains a PDF branch: `PDF_TYPES`/`MAX_PDF_SIZE` (50MB) constants, **double validation** (`file.type === "application/pdf"` AND filename ends `.pdf`), wrong-format 400 enumerating image/video/pdf, oversize 400 "Maksimal 50MB untuk PDF", raw buffer into `public/uploads/documents/` as `pdf_<ts>_<rand>.pdf`, MediaLibrary row with `mimeType: application/pdf`, `url /api/uploads/documents/<file>`, `alt` fallback to file name, `siteId` per caller. GET list semantics and the media type filter are untouched; no schema/migration change.
- `scripts/test-pdf-inline.ts` — deterministic, node-runnable self-check harness (RED->GREEN) with exported per-behavior assertions; exits non-zero on any failure.

## Task Commits

Each task was committed atomically:

1. **Task 1: Data path PDF: sanitizeHTML + serve MIME + self-check harness** — RED `6905f99` (test: add failing sanitize/serve harness), GREEN `c10dd66` (feat: allow div[data-pdf] in sanitizer, serve pdf as application/pdf)
2. **Task 2: Upload PDF via /api/media (documents/, 50MB, MediaLibrary)** — `2917ef5` (feat: accept validated PDF uploads in /api/media)

## Files Created/Modified

- `scripts/test-pdf-inline.ts` - runnable contract harness (sanitize 7 assertions + serve 4 static assertions), exits non-zero on failure
- `lib/validation-schemas.ts` - `sanitizeHTML` `ALLOWED_ATTR` += `data-pdf`, `data-src`, `data-filename`; `ALLOW_DATA_ATTR` stays false; no new tags
- `app/api/uploads/[...path]/route.ts` - `MIME_TYPES` += `pdf: "application/pdf"`; guard untouched
- `app/api/media/route.ts` - constants `PDF_TYPES`/`MAX_PDF_SIZE`; POST double-validation, documents/ folder, raw publish_ buffer branch, MediaLibrary create, alt fallback to file.name

## Decisions Made

- Whitelist exactly the three marker data attrs with `ALLOW_DATA_ATTR: false` (DOMPurify default URI regex untouched) — smallest possible sanitizer surface that still lets `div[data-pdf]` persist.
- Double validation for PDF uploads (claimed MIME + filename extension), never trust the client MIME alone per SPEC C7.
- PDFs store the raw buffer (sharp must not run for PDFs), `pdf_<ts>_<rand>.pdf` scheme matching the existing random-suffix pattern.
- Serve-half of the harness is a static read of the route source (no network), making the deterministic gate cover both halves; the live 201 <=> GET backstop stays manual (PRE-1).
- Tracer gate handled as autonomous-wave (plan `autonomous: true`, wave 1): tracer `<verify>` re-run end-to-end after GREEN and passed before expanding to Task 2.

## Deviations from Plan

None - plan executed exactly as written. (All four `must_haves` truths and both artifact sets satisfied; only the 4 listed files changed.)

## Issues Encountered

- The live E2E backstop (`POST a.pdf -> 201`, `GET -> application/pdf`) could not be exercised: per PRE-1 the local Postgres is down and `npm run dev` cannot render. This is the plan-designated backstop gate, held out for a browserable or deployed env — recorded in the windows ledger as `unrun-verify`.
- No code issues required deviation-rule fixes. A shell-grep quoting artifact during static assertion checks was re-run correctly (not a plan defect).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 12-02** (TipTap `Pdf` extension): the editor can now emit `div[data-pdf data-src data-filename]` and know it survives on-write sanitization; the upload path it will call is live.
- **Ready for 12-03** (inline viewer + Lampiran): the stored HTML contract (`data-pdf`) and the serving contract (`application/pdf` at `/api/uploads/documents/*.pdf` under the public-article accessibility model) are proven; `ArticleContent` hydration can mount viewers per placeholder.
- **Blockers/concerns:** PRE-1 verification environment (no DB/dev) still stands — 12-03's viewer work will need the same manual/backstop treatment for visual checks. Sanitizer loosening was deliberately minimal; any future phase wanting richer placeholders should extend the explicit attr whitelist, never flip `ALLOW_DATA_ATTR`.

---
*Phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex*
*Completed: 2026-08-17*

## Self-Check: PASSED

- `scripts/test-pdf-inline.ts` verified: `FOUND`
- `lib/validation-schemas.ts` + `app/api/uploads/[...path]/route.ts` + `app/api/media/route.ts` modified, all committed
- Commits verified in git log: `6905f99` (RED test), `c10dd66` (GREEN feat), `2917ef5` (Task 2 feat)
- TDD gate sequence present: test commit precedes feat commits
- `.planning/phases/12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex/12-01-SUMMARY.md` itself verified present
