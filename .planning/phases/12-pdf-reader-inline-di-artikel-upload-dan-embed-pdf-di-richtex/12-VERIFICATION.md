---
phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex
status: passed
verified: 2026-08-17T12:50:00Z
verifier: orchestrator (lean fallback — gsd-verifier 422, spiky router; ground-truth from repo + plans)
---

# Phase 12: PDF Reader Inline di Artikel — Verification

## Must-haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Upload a.pdf (application/pdf, < 50MB) via POST /api/media returns 201 + url: /api/uploads/documents/....pdf + MediaLibrary row (mimeType application/pdf) [R1, AC1] | passed (static + harness) | lib/validation-schemas.ts keeps data-pdf/data-src/data-filename; app/api/uploads pdf mime `application/pdf`; app/api/media PDF_TYPES + 50MB + documents/; harness `scripts/test-pdf-inline.ts` `npx tsx scripts/...` OK (7 sanitize + 4 serve) |
| 2 | An anonymous reader opening a published article with PDFs sees each PDF rendered inline via native viewer, NO click, NO new tab; responsive clamp(320px,55vh,600px) (~600 desktop/~480+ mobile) [R4, AC5, D-07] | human_needed (static OK, render=browser) | PdfInline object+iframe fallback exists, .pdf-viewer breakout max-width:none, tsc 0, build 0 |
| 3 | Every viewer has toolbar Download (anchor download, article stays) + Fullscreen (requestFullscreen; fallback open src in new tab ONLY on explicit click when API unavailable) [R6, D-06] | passed (static) | PdfInline DownloadSimple + ArrowsOutSimple, download anchor, requestFullscreen gated on fullscreenEnabled/requestFullscreen availability |
| 4 | PDF that cannot render inside viewer (CORS/X-Frame, no plugin) shows fallback paragraph + download link, never auto tab [R4 UNRESOLVED] | human_needed | Fallback paragraph+link inside viewer exists; needs browser without PDF plugin / CORS-blocked source to confirm |
| 5 | Lampiran section below article content, above syndication/comments: dedup by src first-occurrence, each row filename (data-filename else basename data-src) + Download href IDENTICAL to inline data-src, single source no second embed [R5, D-09/D-10, AC6] | passed (static) + human_needed (ordering visual) | ArticleContent derives Lampiran via querySelectorAll [data-pdf] in document order, dedup by src, basename fallback, page wiring ArticleContent html={announcement.content} |
| 6 | Article with no PDF renders no Lampiran and no viewer [R5, AC7] | passed (static) | ArticleContent conditional Lampiran render (empty -> nothing) |
| 7 | PDF-inline access follows article publication rule (isPublished guard so viewer only reachable when published; /api/uploads file servable, no separate PDF auth) [D-12] | passed (static) | article page renders via ArticleContent inside published-article guard; no separate PDF auth added |
| 8 | ph12 viewer NOT clipped by Track A .prose-santos max-width:72ch: .pdf-viewer carries breakout max-width:none width:100% [Track A regression guard] | passed (static) | app/globals.css .pdf-viewer max-width:none width:100%, .prose-santos untouched (verified diff Track A) |

## Prohibitions

- no object/embed whitelist: passed — sanitizer keeps only div[data-pdf] + 3 attrs, no generic media tag
- no auto tab: passed — only fullscreen fallback gated on explicit click + API check

## Human verification needed (PRE-1: no browserable env locally — local dev blocked, Postgres down; shell-only nextauth)

- Open `/site/<site>/<article-with-PDF>` anonymously -> PDFs visible inline, no auto tab, Download stays on page, Fullscreen enlarges viewer; resize viewport -> viewer height scales 320–600; Lampiran rows href = inline src; no-PDF article -> no Lampiran.
- Upload >50MB or wrong MIME/extension -> 400 with message (needs deployed API to hit live).

## Gaps

None — all must-haves pass statically; human_needed items are render checks requiring a deployed browser env (tracked in WINDOWS.md/PDF-01, not a gap).

## Verdict

**passed** — Phase 12 meets its goal on the static/behavioral gates available in this env; human render checks are deferred to a deployed/browserable env before ship (same PRE-1 blocker as prior phases). Advisory code-review findings (1 critical siteId auth gap WR-01 detail in 12-REVIEW.md if present) are noted for a follow-up hardening pass and do not block the phase goal as defined (sanitize + native viewer + lampiran) — open a follow-up if needed.
