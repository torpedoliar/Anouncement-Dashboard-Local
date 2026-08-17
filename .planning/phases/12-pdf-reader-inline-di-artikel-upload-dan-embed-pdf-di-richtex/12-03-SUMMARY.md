---
phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex
plan: 3
type: execute
status: complete
agent: orchestrator-fallback (12-03 executor did not emit SUMMARY — commits + files verified on disk)
started: 2026-08-17T12:00:00Z
completed: 2026-08-17T12:30:00Z
requirements-completed: [PDF-01]
actuals:
  files_modified: [components/site/PdfInline.tsx, components/site/ArticleContent.tsx, app/site/[siteSlug]/[articleSlug]/page.tsx, app/globals.css]
  commits: [6d56da6, c97d6e0]
---

# Plan 12-03: Reader — PdfInline + ArticleContent + Lampiran (SUMMARY)

## What shipped

- **PdfInline** (`components/site/PdfInline.tsx`, use client): native `<object type="application/pdf" data={src}>` + `<iframe>` fallback inside, Download anchor `download` (href = src, stays on page) + Fullscreen `requestFullscreen` on container with fallback open only on explicit click when API unavailable. Keyboard reachable, token-native, aria-labels Indonesian. Height via `.pdf-viewer` class `clamp(320px, 55vh, 600px)` (D-07 responsive override of SPEC 600/480, ~600 desktop / ~480 mobile).
- **globals.css** `.pdf-viewer` + `.pdf-viewer-body`: `width:100% max-width:none height:clamp(...) margin 1.5em 0 border-radius 8 overflow:hidden border 1px solid var(--border) bg var(--surface-1)` — breakout from `.prose-santos max-width 72ch` so viewer not clipped. Track A prose rules untouched (underline WCAG 1.4.1 + heading margins preserved).
- **ArticleContent** (`components/site/ArticleContent.tsx`, use client): renders `<div className="prose-santos" dangerouslySetInnerHTML={{__html: html}} ref>` + useEffect `querySelectorAll('div[data-pdf]')` → `createRoot(el).render(<PdfInline src data-src filename data-filename />)` per placeholder with unmount cleanup. Derives Lampiran list: iterate in document order, dedup by data-src keep first, skip empty src, label = data-filename || basename(data-src). Renders heading `Lampiran` list rows (FilePdf icon + label + Download anchor href = data-src, single source, no second embed). If no PDF, renders nothing.
- **Article page** (`app/site/[siteSlug]/[articleSlug]/page.tsx`): replaces raw prose div with `<ArticleContent html={announcement.content} />`; syndication + CommentSection below unchanged.

## Verification

- `npx tsc --noEmit` → 0
- `grep pdf-viewer app/globals.css` → found + `max-width: none`
- `grep ArticleContent` in page → import + `<ArticleContent html={announcement.content} />`
- `components/site/PdfInline.tsx` + `ArticleContent.tsx` exist on disk (3.8K / 4.6K)
- Manual E2E (per PRE-1; needs browserable env — local dev blocked by localStorage + Postgres): open `/site/<site>/<artikel-dengan-pdf>` anonymous → PDFs visible inline, no auto tab, Download stays, Fullscreen enlarges; resize viewport → 320–600 height; Lampiran rows href = inline src; no-PDF article → no Lampiran. CORS/X-Frame → fallback paragraph+link.

## Notes

- Executor did not emit SUMMARY (stdio hang) — orchestrator wrote this fallback after verifying 2 commits (`6d56da6`, `c97d6e0`) + files on disk + tsc 0.
- `human_judgment: true` coverage applies to rendered height / CORS fallback (needs deployed browser env).
