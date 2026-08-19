---
phase: 12-pdf-reader-inline-di-artikel-upload-dan-embed-pdf-di-richtex
reviewed: 2026-08-17T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - lib/validation-schemas.ts
  - app/api/uploads/[...path]/route.ts
  - app/api/media/route.ts
  - scripts/test-pdf-inline.ts
  - components/admin/RichTextEditor.tsx
  - components/admin/AnnouncementPreview.tsx
  - components/site/PdfInline.tsx
  - components/site/ArticleContent.tsx
  - app/site/[siteSlug]/[articleSlug]/page.tsx
  - app/globals.css
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-08-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase implements inline PDF embedding: the TipTap editor gains a `pdf` atom node (upload vs. URL dialog), the write-time sanitizer whitelists the `data-pdf`/`data-src`/`data-filename` marker attributes, `app/api/media` accepts `application/pdf`, and the public article page hydrates `div[data-pdf]` placeholders into a native PDF viewer (`components/site/PdfInline.tsx`) plus a "Lampiran" list (`components/site/ArticleContent.tsx`).

The core data path is sound and well-tested: the sanitizer's scheme filtering was verified against the installed `isomorphic-dompurify` (`javascript:` and `data:` URIs in `data-src` are stripped; any `http(s)` URL passes through), and the uploads route's path-traversal guard (segment rejection + `resolve` + separator-bounded prefix check) holds on both POSIX and Windows.

The main defects found: an authorization gap in the media upload POST (the one write path the phase touches that is *not* gated through `lib/site-access` helpers, violating a documented CLAUDE.md invariant); a broken PDF-viewer fallback chain whose promise ("degrade to the download link") is structurally unmet; and several correctness gaps in the embed round-trip and media lifecycle.

## Critical Issues

### CR-01: POST /api/media — media is written to unvalidated `siteId` with no site-access check (authorization gap)

**File:** `app/api/media/route.ts:105-204` (POST handler; `siteId` read at 115, used in `create` at 196-205)

**Issue:** The POST handler authenticates the session but never verifies the caller has any access to the `siteId` it claims. Unlike GET (which gates with `canAccessSite`) and DELETE (which checks `canAccessSite`/SuperAdmin), POST accepts `siteId` as a raw form field and creates a `MediaLibrary` row scoped to that site with zero validation. Consequences:

- An EDITOR/VIEWER of the lowest-privilege site can inject files into *any other tenant's* media library (cross-tenant write), which that tenant's admins will then see and may unknowingly embed into their announcements.
- Any authenticated user can create **shared** media (`siteId=null`) — materials that only a SuperAdmin is allowed to delete (see DELETE handler, line 245) but that any user can create. A low-priv user can pollute the global shared library.
- CLAUDE.md states: "Always gate writes through `lib/site-access.ts` helpers … Don't hand-roll permission checks." This write path is completely ungated.
- Secondary: `siteId` is not even validated as a cuid; a garbage value yields a Prisma FK error and a 500 instead of a 400.

**Fix:**
```ts
// In POST, after parsing siteId and confirming the session:
const isSuperAdmin = !!session.user?.isSuperAdmin;
if (siteId) {
    if (!session.user?.id || !(await canEditOnSite(session.user.id, siteId))) {
        return NextResponse.json({ error: "No access to this site" }, { status: 403 });
    }
    if (!z.string().cuid().safeParse(siteId).success) {
        return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
    }
} else if (!isSuperAdmin) {
    // Shared-media writes restricted to SuperAdmin keeps DELETE/GET semantics consistent
    return NextResponse.json({ error: "Only SuperAdmin can upload shared media" }, { status: 403 });
}
```
(Import `canEditOnSite` from `@/lib/site-access`.)

## Warnings

### WR-01: PdfInline fallback chain can never show its "download link" fallback — embedded inside `<iframe>`

**File:** `components/site/PdfInline.tsx:76-88`

**Issue:** The documented fallback (D-05): `<object>` → `<iframe>` → paragraph + download link. But the `<p>` and `<a>` are children of the `<iframe>`, not of the `<object>`. An iframe's fallback content only renders when the browser cannot render iframes at all — it never renders when the iframe's own load fails (X-Frame-Options denial, non-PDF resource, network error). So for the very cases the fallback exists for (blocked/non-PDF sources), the user sees an empty viewer rectangle with an empty toolbar, with no download link at all. The comment's promise ("sources degrade to the link, never an automatic new tab") is not met.

**Fix:** Move the paragraph + link out of the iframe tree so it is the object's direct fallback after the iframe, e.g.:
```tsx
<object type="application/pdf" data={src} className="pdf-viewer-body">
    <iframe src={src} title={label} className="size-full" />
    {/* object fallback content: shown when object AND nested iframe both fail */}
    <div className="px-3 py-4 text-center">
        <p>PDF tidak dapat ditampilkan inline.</p>
        <a href={src} download>Coba lagi untuk mengunduh PDF</a>
    </div>
</object>
```
(A void `<p>`/`<a>` placed after the iframe inside the object is rendered only when the object fails; verify in Chrome/Safari that the iframe failure path surfaces the fallback, otherwise swap in a tiny on-load/on-error detection on the object/iframe.)

### WR-02: Server sanitizer does not constrain `data-src` to PDF URLs — rely on client-side check only

**File:** `lib/validation-schemas.ts:31-37` (verify: script is at `scripts/test-pdf-inline.ts:77-92` and editor check at `components/admin/RichTextEditor.tsx:396-407`)

**Issue:** `parsePdfUrl` (editor) rejects any non-`http(s)` scheme and requires a `.pdf` pathname, making the *editor* safe. But the server sanitizer accepts **any** `http(s)` URL as `data-src` (verified against installed DOMPurify: `data-src="https://evil.com"` survives untouched). The public reader then hands this string to `<object data>`/`<iframe src>` (`components/site/PdfInline.tsx:76-87`) and a `window.open(src)` fallback. Content is admin-authored, so this is not direct XSS, but it means an article can iframe/embed an arbitrary external page at the PDF slot and the "Unduh" link navigates there — an abuse/phishing embed surface that should be validated at write time, not trusted from the editor alone.

**Fix:** Validate `data-src` values during sanitization — only relative `/api/uploads/...` paths or absolute `https?://…*.pdf` URLs:
```ts
const PDF_SRC_RE = /^(?:\/api\/uploads\/.*\.pdf|https?:\/\/[^ ]+\.pdf)$/i;
// in sanitizeHTML: after DOMPurify.sanitize, walk and prune any [data-pdf] whose
// data-src fails PDF_SRC_RE, or add a DOMPurify hook on data-src values.
```

### WR-03: Upload-result mark uses the insert-time position — stale after document edits during upload

**File:** `components/admin/RichTextEditor.tsx:323-389` (esp. `findInsertedPdfNodePos`/`markPdfBlock`)

**Issue:** `insertContent` inserts an optimistic block, then `findInsertedPdfNodePos` captures a *document position*. `markPdfBlock` is called after the (network) upload completes and does `editor.state.doc.nodeAt(insertPos)` + `setNodeSelection(insertPos)`. If the user typed above the block, split/joined a node, or inserted another PDF while the upload was in flight, `insertPos` is stale: the update either lands on the wrong node (guarded only by a same-type check — it can still be a *different* PDF node) or silently no-ops. In the no-op case the upload succeeded but the block keeps `data-src=""` and gets persisted as a dead embed — the PDF never appears on the article even though it is in the library. This is a silent content-loss path.

**Fix:** Relocate the node at completion time by scanning for the pdf node that still has an empty `src` and a matching `filename` *and* the earliest position at/after the (clamped) captured position; or better, give each insert a unique nonce attribute (e.g. `data-pdf-id`) and match on it in `markPdfBlock` instead of on position.

### WR-04: PDFs in the Media Library are rendered/inserted as broken `<img>` from the picker

**File:** `components/admin/RichTextEditor.tsx:1063-1078` (integration with `components/admin/MediaPickerModal.tsx`; GET/POST media support makes PDFs library rows)

**Issue:** With `mediaType="all"` and the "all" filter, `/api/media` returns PDF rows. `MediaPickerModal` treats anything not `video/*` as an image: `isVideoMedia = media.mimeType.startsWith("video/")` is `false` for `application/pdf`, so the grid renders `<img src={pdfUrl}>` (broken thumbnail) and `onSelect` emits `type: "image"`, which `RichTextEditor` feeds into `setImage({ src })` — a broken `<img>` embed in the article. The phase makes PDFs first-class uploads but the only picker path that can insert a PDF is the dedicated toolbar dialog; the library path silently produces a broken block.

**Fix:** In `MediaPickerModal.handleSelect`, detect PDF rows and route them to a `pdf` insert (e.g. `onSelect(url, "pdf")` and handle `type === "pdf"` by `insertContent({ type: 'pdf', attrs: { src: url, filename } })`); render a PDF card (icon) in the grid instead of an `<img>`.

### WR-05: DELETE /api/media removes the DB row but never the physical file — "deleted" media stays publicly served

**File:** `app/api/media/route.ts:220-262` (no `unlink` anywhere in `app/api/**`)

**Issue:** Deleting a media item drops the `MediaLibrary` row only. The file remains on disk under `public/uploads` and keeps being served at its immutable `/api/uploads/...` URL. For the newly introduced PDF documents this is a real data-lifecycle problem: a document an editor deliberately deletes stays downloadable forever (e.g., a PDF that later embeds a corrected version but the old host URL is still live, or a document removed for compliance). The file is also dropped onto the public filesystem without any database record to account for it.

**Fix:** In DELETE (after DB delete succeeds), `unlink` the file resolved from `media.filename` (respect the same `UPLOAD_DIR` boundary and folder mapping used by POST), and accept/report failure without breaking the response (log it). Sketch:
```ts
await prisma.mediaLibrary.delete({ where: { id } });
// server-owned filenames only; keep the traversal guard identical to POST folder logic
try { await unlink(join(process.cwd(), "public", "uploads", folderOf(media.mimeType, media.filename), media.filename)); } catch (e) { console.error("orphan file left:", e); }
```

### WR-06: Sanitizer whitelist fixes PDF embeds but sibling Video/YouTube blocks are still destroyed on save→reload

**File:** `lib/validation-schemas.ts:22-38`; extensions at `components/admin/RichTextEditor.tsx:50-107`

**Issue:** Verified with the installed sanitizer: `data-video` and `data-youtube-video` (and the video `controls` attribute) are **not** whitelisted, so saving strips the parse markers of the `Video` and `YouTube` atom nodes, leaving `<div><video src=…/></div>` / `<div><iframe src=…/></div>`. On re-opening an announcement these blocks are no longer matched by `parseHTML` (`div[data-video]` / `div[data-youtube-video]`) and TipTap's schema has no node for bare `<video>`/`<iframe>` → the embeds are silently dropped from the document. This phase adds the *exact* same whitelist mechanism for PDFs; Video/YouTube remain broken by the identical round-trip bug.

**Fix:** Extend `ALLOWED_ATTR` with `data-video`, `data-youtube-video`, and `controls` (and add a regression assertion in `scripts/test-pdf-inline.ts` covering the video and youtube round-trips, not only the pdf one).

## Info

### IN-01: `Pdf.renderHTML` can emit `data-src="null"` for pasted markers without `data-src`

**File:** `components/admin/RichTextEditor.tsx:141-147`

**Issue:** `mergeAttributes` passes `null` values through, so a `div[data-pdf]` pasted/crafted without `data-src` serializes as `data-src="null"`. `ArticleContent` (`components/site/ArticleContent.tsx:55`) skips only falsy `src`, so `"null"` is truthy and the reader renders a broken viewer against a relative `null` URL instead of skipping. **Fix:** in `Pdf.renderHTML` emit the attribute conditionally — `...(HTMLAttributes.src ? { 'data-src': HTMLAttributes.src } : {})` — and in `ArticleContent` skip `if (!src || src === "null")`.

### IN-02: Uploads route logs every 404 and mishandles the empty path

**File:** `app/api/uploads/[...path]/route.ts:46-49`

**Issue:** `console.error` on every missing file turns hotlink/scan traffic into log noise; and `GET /api/uploads/` passes the guard but `readFile(dir)` throws EISDIR → 500. **Fix:** use `console.debug`/no-op for 404s and return 400 when `path.length === 0`.

### IN-03: Uploads route lacks `X-Content-Type-Options: nosniff`; serves any file under `public/uploads`

**File:** `app/api/uploads/[...path]/route.ts:60-66`

**Issue:** The `application/pdf` (and legacy `image/svg+xml`) responses are served same-origin without `nosniff`. SVG same-origin is the classic stored-XSS target; the current media POST only ever writes webp/mp4/gif/pdf, so risk is limited to legacy files, but the header is cheap. **Fix:** add `"X-Content-Type-Options": "nosniff"` to the response headers.

### IN-04: Canonical link resolves to `/site/undefined/...` when no junction row has `isPrimary`

**File:** `app/site/[siteSlug]/[articleSlug]/page.tsx:74-78`

**Issue:** `announcement.sites.find((s) => s.isPrimary)?.site` is undefined for legacy/partial data (announcements created when `primarySiteId` existed on the row but no junction was marked primary). `canonicalUrl` then becomes `` `/site/undefined/${announcement.slug}` ``, emitting a broken `<link rel="canonical">` and a broken syndication-navigation link. **Fix:** fall back to the announcement's `primarySiteId`/first site, or emit no canonical link when no primary exists (`canonicalUrl = null` in that case).

---

_Reviewed: 2026-08-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
