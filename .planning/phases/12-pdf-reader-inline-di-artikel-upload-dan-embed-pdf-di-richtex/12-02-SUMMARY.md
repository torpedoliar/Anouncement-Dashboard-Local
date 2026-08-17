---
phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex
plan: 2
subsystem: ui
tags: [tiptap, richtex, pdf, toolbar, dompurify, preview, optimistic-upload, atom-node]

# Dependency graph
requires:
  - phase: 12-01
    provides: sanitizeHTML keeps div[data-pdf]+data-src/data-filename (ALLOWED_ATTR +3, ALLOW_DATA_ATTR false), /api/media PDF branch (documents/, 50MB, double MIME+ext validation)
provides:
  - TipTap Pdf atom node emitting EXACTLY div + data-pdf/data-src/data-filename; parse+render round-trip proven by node harness (data-src restored on reload)
  - One FilePdf toolbar button with two-option dropdown: Upload PDF vs Sisipkan via URL (D-01)
  - Optimistic named block inserted first; src updated in place on POST 201; red block + toast on failure (D-02/D-03)
  - External https?://.../*.pdf embeds without a MediaLibrary row; non-http(s)/non-.pdf rejected client-side (R3, T-12-02-URLSCHEME)
  - Multi-block: each block an independent draggable/removable atom, no hard cap (D-04); selected-state delete mini-toolbar
  - Admin AnnouncementPreview renders named PDF placeholder rows; preview sanitizer keeps the 3 data attrs explicitly (ADD_ATTR) and still strips onerror/js payloads
affects: [12-03 (consumes the stored div[data-pdf] markup — inline viewer + Lampiran, shipped in the parallel wave), gsd-verify-work, verifier]

# Actuals (#2632) — pairs with the plan's `estimate` (28000 chars tokens-scale). Realized diff ~25.5KB across the 2 files.
actuals:
  tokens: 6400    # chars/4 over the realized diff (git diff HEAD~3..HEAD | wc -c = 25519)
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []  # no new dependencies — FilePdf/UploadSimple from installed @phosphor-icons/react v2.1.10
  patterns:
    - "Explicit per-attribute parseHTML for data-* attrs (key src -> getAttribute('data-src')): TipTap's default parse reads getAttribute(attrName) which nulls the attrs on reload and would drop the URL on re-save (fixed pre-GREEN review; same pattern as CustomImage.data-align)"
    - "DOMPurify ADD_ATTR (not ALLOWED_ATTR) to extend the html profile: verified in dompurify 3.3.x _parseConfig that USE_PROFILES wipes ALLOWED_ATTR wholesale (ALLOWED_ATTR = []; addToSet ATTR profiles) — ADD_ATTR is the only knob that survives it"
    - "Optimistic block position = selection.from - 1 captured synchronously right after insertContent (insertContentAt ends with Selection.near(doc.resolve(end), -1), cursor lands after the atom); guarded by a doc-scan fallback for the same filename with empty src"
    - "In-place block update via setNodeSelection(pos) + updateAttributes (verified in @tiptap/core updateAttributes: merges { ...node.attrs, ...attributes } for non-empty selections) — no node churn, filename preserved"
    - "Placeholder visuals are 100% CSS (dashed token box, ::before content: attr(data-filename)) so the editor node collapses byte-exact to the saved markup"

key-files:
  created: []
  modified:
    - components/admin/RichTextEditor.tsx     # Pdf node, FilePdf dropdown, optimistic upload, URL dialog, delete mini-toolbar, jsx-global styles
    - components/admin/AnnouncementPreview.tsx # explicit sanitizer attrs + pdfBlocks placeholder rows

key-decisions:
  - "Pdf node emits exactly data-pdf/data-src/data-filename in the steady state; a failed upload renders a transient data-pdf-error (red border + 'Gagal unggah: <file>') that the 12-01 server sanitizer strips at save — sanitized persistence unchanged (T-12-02-OPTIMISTIC accepted)"
  - "External URL dialog rejects non-http(s) schemes and non-.pdf paths client-side via URL parsing; the authoritative gate remains the 12-01 sanitizer URI regex — defense in depth (T-12-02-URLSCHEME)"
  - "Preview sanitizer explicit allowance via ADD_ATTR: ['data-pdf','data-src','data-filename'] — empirically proven 5/5 assertions: placeholders kept, onerror/script/javascript: payloads stripped, normal content attrs untouched (no regression)"
  - "No generic media/embed tag added on either sanitizer (preview or server) — only the 3 marker attrs, per the 12-01 minimal-surface decision"
  - "Upload size cap 50MB client-side mirrors the 12-01 server MAX_PDF_SIZE; validation requires BOTH application/pdf MIME and .pdf extension (CLAUDE.md double-validation rule)"

requirements-completed: [PDF-01]  # completed in 12-01 (data path); 12-02 delivers the editor side of the same requirement. Traceability updates owned by orchestrator.

coverage:
  - id: D-01
    description: "ONE FilePdf toolbar button opening a two-option dropdown (Upload PDF / Sisipkan via URL)"
    requirement: PDF-01
    verification:
      - kind: other
        ref: "static source assert (single toolbar FilePdf button + showPdfMenu dropdown with 2 items) + npx tsc/eslint green"
        status: pass
    human_judgment: true
    rationale: "Visual toggle behavior is part of the PRE-1 backstop manual gate (browserable env required)"
  - id: D-02
    description: "Optimistic named div[data-pdf] block on upload; src updated in place on POST 201 (same node, filename kept); failure marks block red (data-pdf-error) + toast with server message"
    requirement: PDF-01
    verification:
      - kind: other
        ref: "static source asserts (insertContent before fetch, markPdfBlock via setNodeSelection+updateAttributes, error branch) + tsc/eslint green"
        status: pass
    human_judgment: true
    rationale: "Live 201 wiring exercised only in a browserable env (PRE-1 backstop; local Postgres down, dev cannot render)"
  - id: D-03
    description: "Filename = file basename (upload: file.name; URL: pathname last segment) shown on the block; URL path must end .pdf"
    requirement: PDF-01
    verification:
      - kind: other
        ref: "static source asserts (filename attrs, parsePdfUrl pathname endsWith .pdf) + node harness re-render includes data-filename"
        status: pass
    human_judgment: false
  - id: R2
    description: "Saved content persists div[data-pdf]+data-src+data-filename and survives sanitizeHTML (12-01) unstripped"
    requirement: PDF-01
    verification:
      - kind: unit
        ref: "node harness (generateJSON/generateHTML over the real node def): re-render is exactly <div data-pdf data-src=... data-filename=...></div> — ROUNDTRIP_OK; preview sanitizer harness 5/5 keeps the attrs"
        status: pass
    human_judgment: false
  - id: R3
    description: "External .pdf URL inserts without creating a MediaLibrary row; javascript:/data: schemes rejected client-side"
    requirement: PDF-01
    verification:
      - kind: unit
        ref: "node assertion: parsePdfUrl rejects javascript:/data:/file: schemes (protocol check) — inline checks in harness; static source follows the URL branch with no /api/media call"
        status: pass
    human_judgment: false
  - id: D-04
    description: "Multiple PDF blocks per article, each independent (drag-reorderable, deletable), no hard cap"
    requirement: PDF-01
    verification:
      - kind: other
        ref: "static source assert (block atom true + draggable true; no count guard anywhere; deletePdf via deleteSelection)"
        status: pass
    human_judgment: true
    rationale: "Actual drag/reorder feel is part of the PRE-1 backstop manual gate"

# Metrics
duration: 35min
completed: 2026-08-17
status: complete
---

# Phase 12 Plan 2: TipTap PDF blocks + FilePdf toolbar summary

**The editor now embeds one or many PDFs per article via one FilePdf button (Upload PDF → optimistic block updated in place on 201; Sisipkan via URL → https://.../file.pdf) as draggable atom blocks persisted as exactly `div[data-pdf data-src data-filename]`, and the admin preview renders each as a named placeholder without ever stripping the markup.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-17T11:58:28Z
- **Completed:** 2026-08-17T12:33:00Z
- **Tasks:** 2 completed / 2 total
- **Files modified:** 2

## Accomplishments

- **Pdf TipTap atom node** (block, draggable, group `block`) cloned from the Video pattern: `parseHTML` matches `div[data-pdf]`; `renderHTML` emits exactly the 12-01-whitelisted shape `div + data-pdf/data-src/data-filename`. A transient `data-pdf-error` attr (only while an upload is failing) renders red; the 12-01 server sanitizer strips it at save so persisted markup never carries it. Styling lives entirely in the jsx-global CSS block (dashed token box, `::before { content: "PDF — " attr(data-filename) }`, `Gagal unggah:` variant, `ProseMirror-selectednode` outline) — no presentational DOM in renderHTML.
- **One FilePdf toolbar button** with a two-option dropdown (D-01): `Upload PDF` opens a hidden input `accept="application/pdf"`; `Sisipkan via URL` opens a token-native modal validated with `new URL()` (http/https only, pathname must end `.pdf`) — R3: no upload, no MediaLibrary row; javascript:/data: rejected client-side (T-12-02-URLSCHEME, defense in depth over the server URI regex).
- **Optimistic upload** (D-02/D-03): the named block is inserted FIRST (`src:''`), position captured as `selection.from - 1` with a doc-scan fallback; `POST /api/media` 201 → `setNodeSelection(pos).updateAttributes('pdf', { src: data.url })` (merge semantics verified in @tiptap/core) updates the same block; failure → `{ error: true }` red block + toast with the server message. Client pre-validates `application/pdf` + `.pdf` + ≤50MB with Indonesian error strings.
- **Multiple blocks / delete** (D-04): no cap; each block is an independent atom; selecting shows a mini-toolbar (`PDF: <filename>` + `Hapus PDF` → `deleteSelection`).
- **AnnouncementPreview** renders one token-native placeholder row per unique `data-src` (FilePdf icon + filename + caption `PDF — pratinjau di halaman artikel`); empty-src optimistic blocks are skipped (never crash); no `div[data-pdf]` → no extra section. Sanitizer options now explicitly carry the 3 marker attrs via `ADD_ATTR` — the profile-safe knob (verified in dompurify source that `USE_PROFILES` wipes `ALLOWED_ATTR`) — while only MVP-supported: 5/5 node assertions (placeholder kept; onerror/script/javascript: stripped; normal attrs untouched).
- **Round-trip harness** (node, jsdom via isomorphic-dompurify's dep, `generateJSON`/`generateHTML` over a verbatim copy of the node definition): `ROUNDTRIP_OK` — reload restores `data-src`/`data-filename` and re-render emits precisely the 3 whitelisted attrs.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): TipTap Pdf block + FilePdf toolbar (upload + external URL, optimistic, delete)** — `69d5005` (feat(12-02): TipTap Pdf block + FilePdf toolbar (upload & URL embed))
2. **Task 2: AnnouncementPreview renders PDF placeholders (data-pdf preserved)** — `2d3a8b8` (feat(12-02): AnnouncementPreview renders PDF placeholders, keeps data-pdf)
3. **Rule 1 follow-up: Pdf node parseHTML reads data-src/data-filename on reload** — `17a42ce` (fix(12-02): Pdf node parseHTML reads data-src/data-filename on reload)

## Files Created/Modified

- `components/admin/RichTextEditor.tsx` - Pdf node (addAttributes with explicit data-attr parseHTML + conditional error renderHTML; parseHTML `div[data-pdf]`; renderHTML 3-attr), Pdf registered in `extensions`, PDF selection tracking in onSelectionUpdate/onTransaction, `findInsertedPdfNodePos`/`markPdfBlock`/`handlePdfUpload`/`parsePdfUrl`/`insertPdfUrl`/`deletePdf`, FilePdf dropdown in toolbar, PDF mini-toolbar, hidden `accept="application/pdf"` input, jsx-global placeholder CSS, `Sisipkan PDF via URL` modal (Indonesian strings, Phosphor icons, token-native styles)
- `components/admin/AnnouncementPreview.tsx` - `PDF_MARKER_ATTRS` + `ADD_ATTR` sanitizer options, `extractPdfBlocks` (unique data-src, filename fallback to URL basename, empty-src skipped), pdfBlocks placeholder rows with FilePdf icon

## Decisions Made

- Kept renderHTML at the 3 whitelisted attrs + transient error attr; placeholder visuals via pure CSS so saved markup stays byte-exact (T-12-02-RENDER).
- Used `ADD_ATTR` instead of `ALLOWED_ATTR` in the preview sanitizer after reading dompurify 3.3.x `_parseConfig` — `USE_PROFILES` resets the attr list, `ADD_ATTR` extends it.
- Client-side URL validation via `new URL()` protocol + `.pdf` pathname check; server sanitizer remains the final gate (defense in depth, T-12-02-URLSCHEME).
- Round-trip correctness: explicit per-attribute `parseHTML` for `src`/`filename` (avoids TipTap default-parse nulling on reload).
- Upload mirrors 12-01 contract: `/api/media` `file` field, 50MB cap, filename from `file.name`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pdf node would lose data-src/data-filename on article reload + re-save**
- **Found during:** Task 1 (pre-commit review, then empirically proven with the node harness)
- **Issue:** TipTap's default attribute parse is `node.getAttribute(attrName)` — for `src`/`filename` keys it reads plain `src`/`filename` attributes. Stored markup carries `data-src`/`data-filename`, so re-parsing a saved article nulled both attrs; a subsequent save would emit a markup with empty/dropped URL — persisting data loss after the first re-edit.
- **Fix:** explicit `parseHTML: element => element.getAttribute('data-src')` (and `data-filename`) on both attributes — same pattern as `CustomImage.data-align`.
- **Files modified:** components/admin/RichTextEditor.tsx
- **Commit:** `17a42ce`
- **Verification:** node harness `generateJSON` over `<div data-pdf data-src="https://x.com/a.pdf" data-filename="a.pdf">` → attrs restored; `generateHTML` → identical 3-attr markup (`ROUNDTRIP_OK`).

No other deviations — the plan executed as written. The `data-pdf-error` transient attr is the plan's own D-02 mechanism, not a deviation.

## Issues Encountered

- Two pre-existing eslint warnings remain untouched (out-of-scope per scope boundary): `handleImageUpload`/`handleVideoUpload` missing `showToast` dep (RichTextEditor 267/307), and `no-img-element` on the legacy media `<img>` in AnnouncementPreview 175. My new code adds zero warnings.
- Pre-existing latent defect in the **Video** node (same default-parse trap: `src` attr never restored from its markup on reload) — out of scope (pre-existing, unrelated file section); deferred via this SUMMARY for a future plan (see Next Phase Readiness).
- The manual verification portions (live drag/reorder/save in a browser, live `POST a.pdf → 201` wiring) could not run: per PRE-1 the local Postgres is down and dev cannot render. Same held-out backstop treatment as 12-01.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **12-03 (reader)** was already shipped in the parallel wave and consumes exactly the markup this plan produces (`div[data-pdf data-src data-filename]` in `announcement.content`); the node harness proves the editor emits that shape and preview is conformant (D-11 precedent).
- **Blockers/concerns:** PRE-1 verification environment still stands — editor interaction (drag/reorder/save) and live 201 wiring need a browserable/deployed env before ship (backstop gate). The Video node's latent round-trip defect is a candidate for a small follow-up fix (same explicit parseHTML pattern) in a later plan.

---
*Phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex*
*Completed: 2026-08-17*

## Self-Check: PASSED

- Files verified present on disk: `components/admin/RichTextEditor.tsx` (1075 lines), `components/admin/AnnouncementPreview.tsx` (214 lines), this SUMMARY
- Commits verified in git log: `69d5005` (Task 1 tracer), `2d3a8b8` (Task 2), `17a42ce` (Rule 1 fix)
- Automated gates: `npx tsc --noEmit` exit 0 (both files), `npx eslint components/admin/RichTextEditor.tsx components/admin/AnnouncementPreview.tsx` exit 0 (only the 3 pre-existing warnings)
- Node harnesses (temp files, removed after run): preview sanitizer 5/5 PASS; Pdf parse/render `ROUNDTRIP_OK`
- Only the 2 planned files changed across the 3 commits (+428/-2); no tracked deletions; no stray untracked files left by this plan