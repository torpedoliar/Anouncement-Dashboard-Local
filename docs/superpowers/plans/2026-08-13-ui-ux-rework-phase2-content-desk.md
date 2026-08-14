# Phase 2: Content Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the admin content workflow into a coherent newsroom desk: masthead-aware dashboard, announcement ledger, truthful status language, two-pane editor preview, and consistent category/media/comment/newsletter/email surfaces.

**Architecture:** Preserve the current App Router routes, Prisma queries, API contracts, scheduler, authentication, SSO, and multi-site access rules. Add one pure announcement-status helper and reuse the existing `components/ui` kit; migrate page chrome and interactive states incrementally without introducing a new state library or approval model. The active site's existing `--site-primary` token remains the only content accent.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v3, Prisma 5, TipTap, existing `components/ui/` kit, `@phosphor-icons/react`, existing recharts and NextAuth flows.

## Global Constraints

- **Design system:** use Phase 0 tokens (`bg-surface-*`, `text-text-*`, `border-border`, `bg-accent`, `text-accent`, `rounded-control/card/sheet`, `shadow-lvl-*`, semantic status tokens). No new raw color chrome or arbitrary inline visual styling.
- **Identity:** one newsroom, many mastheads. `useSiteTheme()` / `--site-primary` drives the active site's accent; do not replace it with hardcoded per-stat colors.
- **Typography:** `font-display` for headings, body sans for UI, `font-mono tabular-nums` for counts, dates, word counts, and IDs.
- **Icons:** Phosphor only in new or migrated UI; use labeled icon buttons and status icons so color is never the sole signal.
- **Motion:** use 150–300ms transitions, `cubic-bezier(0.16, 1, 0.3, 1)`, transform/opacity only, faster exits, and the existing reduced-motion media rule.
- **Accessibility:** visible accent focus rings, keyboard-operable controls, labels for inputs, `aria-current`, `aria-expanded`, `aria-sort` where applicable, and no horizontal overflow at 375px.
- **Behavior preservation:** no route, Prisma schema, auth, scheduler, SSO, or access-control redesign. Continue using `resolveAdminSiteId`, `canEditOnSite`/`canAccessSite`, validation schemas, and existing API endpoints.
- **Approval boundary:** the approval workflow was removed by migration `20260605010000_drop_approval_add_revision_video`; do not add approval UI or schema. The existing `pending-approval` presentation union remains untouched unless a later feature restores its data source.
- **Verification:** `npx tsc --noEmit` and scoped `npx eslint <files>` are gates. `npm run build` and route rendering remain blocked by known environment failures; do not modify `.env`, Tailwind version, or `postcss.config.mjs`.
- **Commits:** Indonesian commit messages; commit only files belonging to the task.

---

## Task 1: Shared status derivation, motion tokens, and theme toggle

**Files:**
- Create: `lib/announcement-status.ts`
- Modify: `components/ui/StatusPill.tsx`
- Modify: `app/globals.css`
- Modify: `components/admin/AdminTopbar.tsx` or create `components/admin/ThemeToggle.tsx` only if the existing topbar needs a focused leaf
- Modify: `app/admin/layout.tsx` only if the toggle must be mounted outside the topbar

**Interfaces:**
- Produces `deriveAnnouncementStatus(input): "draft" | "scheduled" | "published" | "taken-down"`.
- Consumes the existing announcement scalar fields: `isPublished`, `scheduledAt`, and `takedownAt`.

- [x] **Step 1: Define the pure status helper**

Implement the precedence explicitly: a passed `takedownAt` wins first, a future `scheduledAt` is next, `isPublished` is next, and otherwise the item is a draft. Treat missing dates as `null`; compare against an optional `now` parameter defaulting to `new Date()` so callers/tests can use a fixed instant.

```ts
export type AnnouncementStatusValue = "draft" | "scheduled" | "published" | "taken-down";

export function deriveAnnouncementStatus(input: {
  isPublished: boolean;
  scheduledAt?: Date | string | null;
  takedownAt?: Date | string | null;
}, now = new Date()): AnnouncementStatusValue {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const takedownAt = input.takedownAt ? new Date(input.takedownAt) : null;
  if (takedownAt && takedownAt <= now) return "taken-down";
  if (scheduledAt && scheduledAt > now) return "scheduled";
  if (input.isPublished) return "published";
  return "draft";
}
```

- [x] **Step 2: Add one runnable self-check**

Add a small `scripts/check-announcement-status.ts` using fixed dates and `console.assert` for taken-down, scheduled, published, and draft. Run it with `npx tsx scripts/check-announcement-status.ts`; expected output has no assertion failure.

- [x] **Step 3: Add semantic motion custom properties**

Add `--motion-fast`, `--motion-standard`, and `--motion-ease` to `:root`; update the migrated content-desk transitions/animations to consume them. Keep the global reduced-motion block and do not animate layout dimensions.

- [x] **Step 4: Add the light/night toggle**

Create a compact labeled icon control in the existing admin topbar. Persist `adminTheme` as `light` or `dark` in `localStorage`, apply/remove `theme-light` on `document.documentElement`, initialize from the saved value or the existing night default, and expose `aria-pressed` plus a tooltip/title. Do not add a second theme token set: `html.theme-light` and root night tokens already exist.

- [x] **Step 5: Reuse the helper in presentation**

Update `StatusPill` to consume the shared status type without emitting `pending-approval` from the helper. Preserve its Indonesian labels and icon-plus-text treatment.

- [x] **Step 6: Verify and commit**

Run `npx tsx scripts/check-announcement-status.ts`, `npx tsc --noEmit`, and scoped ESLint. Commit:

```bash
git add lib/announcement-status.ts scripts/check-announcement-status.ts components/ui/StatusPill.tsx app/globals.css components/admin/AdminTopbar.tsx app/admin/layout.tsx
rtk git commit -m "feat(ui): status pengumuman, motion token, dan tema admin"
```

---

## Task 2: Newsroom dashboard front page

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `components/admin/SiteHealthCard.tsx`
- Modify: `components/admin/UpdateBanner.tsx` only where needed for token migration

**Interfaces:**
- Consumes the existing server-side `getStats`, `getRecentAnnouncements`, `runScheduler`, and `resolveAdminSiteId` data flow.
- Produces masthead-aware stat tiles and ledger-style recent rows without changing queries or scheduler behavior.

- [x] **Step 1: Replace hardcoded stat cards with headline tiles**

Keep Total, Published, Draft, and Views. Render a sparse token-native tile with a Phosphor icon, large mono value, label, and optional delta slot only when a real comparison exists; do not invent a delta query. The active masthead accent is the only primary accent.

- [x] **Step 2: Restyle recent announcements as ledger rows**

Use `deriveAnnouncementStatus` + `StatusPill`, title, category, pinned marker, formatted timestamp, and mono view count. Preserve edit links and the existing empty-state CTA. Do not add author/word count here unless already present in the server query.

- [x] **Step 3: Restyle site health and update states**

Use `Card`, `Badge`, `Button`, and existing semantic tokens for loading, error/retry, recent activity, backup, GitHub, and dismiss actions. Preserve all fetches, dismissal keys, and update behavior.

- [x] **Step 4: Verify and commit**

Run `npx tsc --noEmit` and ESLint on the changed files. Commit:

```bash
rtk git add app/admin/page.tsx components/admin/SiteHealthCard.tsx components/admin/UpdateBanner.tsx
rtk git commit -m "feat(ui): dashboard newsroom dengan stat tile dan ledger"
```

---

## Task 3: Announcement ledger, filters, status pills, and bulk actions

**Files:**
- Modify: `components/admin/AnnouncementsList.tsx`
- Modify: `components/admin/BulkActionBar.tsx`
- Modify: `app/admin/announcements/page.tsx`
- Modify: `app/api/announcements/route.ts` only if the list is intentionally switched to its existing paginated API

**Interfaces:**
- Keep `AnnouncementsList({ announcements, categories })` unless pagination requires a deliberate server/API boundary.
- Preserve `BulkActionBar`'s existing `{ selectedCount, onClear, selectedIds }` contract and `/api/announcements/bulk` actions.

- [x] **Step 1: Expand the server list shape minimally**

Add only fields already in the Prisma model and existing query relations: `scheduledAt`, `takedownAt`, `updatedAt`, `wordCount`, `author`, and primary-site display data. Keep the current site junction scope and pinned-first ordering. Do not assume an announcement has one site; derive the primary site from the junction flags.

- [x] **Step 2: Build the ledger row**

Replace the bespoke table styling with the existing `Table` kit or a token-native ledger row when the current custom row needs checkbox/action composition. Render status icon + label via `StatusPill`, title, category, primary site, author, word count, and updated time. Keep edit/delete links, pin/hero indicators, selection checkboxes, and responsive overflow containment.

- [x] **Step 3: Make filters real**

Turn category chips into keyboard-operable filter controls. Add status filtering using `deriveAnnouncementStatus`, keyword filtering, site/author selectors only when data is already available to the page, and a visible result count. Keep filtering scoped to the current site and avoid a second data-fetching system unless the existing API pagination is adopted as one complete slice.

- [x] **Step 4: Restyle bulk actions and preserve safety**

Use the kit buttons and `ConfirmDialog`. Preserve publish, unpublish, delete, scoped API calls, disabled/loading feedback, and clear-selection behavior. Do not add bulk scheduling unless the API receives an explicit, validated contract in this task.

- [x] **Step 5: Add loading and empty states**

Create ledger-shaped skeleton rows for the client loading boundary if the page gains one. Keep the editorial empty state and CTA; include a clear “filter kosong” state with a reset action.

- [x] **Step 6: Verify and commit**

Run `npx tsc --noEmit`, scoped ESLint, and the status self-check. Commit:

```bash
rtk git add components/admin/AnnouncementsList.tsx components/admin/BulkActionBar.tsx app/admin/announcements/page.tsx app/api/announcements/route.ts
rtk git commit -m "feat(ui): ledger pengumuman dan filter news desk"
```

---

## Task 4: Two-pane announcement composer and preview

**Files:**
- Modify: `components/admin/AnnouncementForm.tsx`
- Modify: `components/admin/RichTextEditor.tsx`
- Modify: `components/admin/SiteSyndicationPicker.tsx`
- Modify: `app/admin/announcements/new/page.tsx`
- Modify: `app/admin/announcements/[id]/edit/page.tsx`
- Create: `components/admin/AnnouncementPreview.tsx`

**Interfaces:**
- Preserve `AnnouncementForm` create/edit props and all current POST/PUT, draft autosave, upload, validation, and site-association behavior.
- `AnnouncementPreview` consumes `{ title, content, category, media, siteName, primaryColor }` and renders read-only preview only.

- [x] **Step 1: Create the read-only masthead preview**

Build `AnnouncementPreview` as a token-native article preview: site color chip/name, category, title, formatted content, image/video/YouTube media, and empty preview copy when title/content is absent. Sanitize/render content through the same safe display path already used by the app; do not persist preview HTML.

- [x] **Step 2: Compose the desktop two-pane layout**

Keep fields and publish controls in the left pane and preview in the right pane at desktop widths. Collapse to one column on mobile with the preview after the fields. Show the active primary site and syndication count using `SiteSyndicationPicker` data; do not change junction semantics.

- [x] **Step 3: Restyle editor controls**

Use kit tokens for field errors, disabled states, toolbar groups, media controls, and sticky editor toolbar. Keep all existing TipTap extensions and upload/media-picker behavior. Add a mono word-count/reading-time line from the current content string; do not add a new parser dependency.

- [x] **Step 4: Add publish-state controls**

Group Draf, Terjadwal, Terbit now, scheduledAt, and takedownAt controls at the top of the composer. Use the derived status only for display; preserve the existing `isPublished`/date payload and validation.

- [x] **Step 5: Verify and commit**

Run `npx tsc --noEmit` and ESLint on the editor files. Commit:

```bash
rtk git add components/admin/AnnouncementForm.tsx components/admin/RichTextEditor.tsx components/admin/SiteSyndicationPicker.tsx components/admin/AnnouncementPreview.tsx app/admin/announcements/new/page.tsx app/admin/announcements/[id]/edit/page.tsx
rtk git commit -m "feat(ui): composer dua panel dan preview masthead"
```

---

## Task 5: Categories and media desk

**Files:**
- Modify: `app/admin/categories/page.tsx`
- Modify: `app/admin/media/page.tsx`
- Modify: `components/admin/MediaPickerModal.tsx`

**Interfaces:**
- Preserve current category and media API endpoints, confirmation flows, upload behavior, stock-media download, and single-select `MediaPickerModal` callback `{url, type}`.

- [x] **Step 1: Migrate categories to the ledger family**

Keep site grouping, inline create/edit, color input, slug display, announcement count, and delete guard. Use the `Table` kit where it supports the action cells; otherwise use equivalent token-native rows. Add a compact site/category search only if it can remain client-side over the loaded data.

- [x] **Step 2: Turn the media page into a gallery desk**

Keep the existing 100-item fetch, upload input, delete confirmation, copy URL, and preview modal. Add token-native gallery cards, image/video type badges, accessible labels, a visible empty state, and a dropzone visual that still delegates to the existing file input (no drag-upload behavior unless explicitly implemented and tested).

- [x] **Step 3: Restyle the media picker as a lightbox**

Preserve Local/Stock tabs, search debounce, type filter, incremental loading, single selection, stock download, and `onSelect`. Replace raw styling and Feather icons with tokens and Phosphor; retain unavailable/no-results/empty states.

- [x] **Step 4: Verify and commit**

Run `npx tsc --noEmit` and scoped ESLint. Commit:

```bash
rtk git add app/admin/categories/page.tsx app/admin/media/page.tsx components/admin/MediaPickerModal.tsx
rtk git commit -m "feat(ui): desk kategori dan galeri media"
```

---

## Task 6: Comments moderation desk

**Files:**
- Modify: `app/admin/comments/page.tsx`
- Modify: `components/ui/Badge.tsx` only if a missing moderation tone is required

**Interfaces:**
- Preserve `GET /api/comments`, status query values `PENDING|APPROVED|REJECTED|SPAM`, existing approve/reject/spam/delete mutation endpoints, pagination, and confirmation behavior.
- Use the existing `Comment` self-relation only if the current API already returns parent/replies; do not change the schema for visual threading.

- [x] **Step 1: Replace cards with moderation ledger rows**

Render author/email, announcement, content excerpt, status badge/icon, created time, and moderation actions in a responsive row layout. Use `Badge` or a small moderation status map with icon + text; do not rely on color alone.

- [x] **Step 2: Add safe inline moderation states**

Keep status filtering and pagination. Disable action buttons while requests are pending, show success/error feedback via the existing toast path, and preserve delete confirmation. If replies are present in the response, indent them by one level with a visible reply marker; otherwise keep a flat ledger rather than inventing threading data.

- [x] **Step 3: Verify and commit**

Run `npx tsc --noEmit` and ESLint. Commit:

```bash
rtk git add app/admin/comments/page.tsx components/ui/Badge.tsx
rtk git commit -m "feat(ui): moderation desk komentar"
```

---

## Task 7: Newsletter and email settings surfaces

**Files:**
- Modify: `app/admin/newsletter/page.tsx`
- Modify: `app/admin/email/page.tsx`

**Interfaces:**
- Preserve existing newsletter fetch/filter/export/pagination and email GET/PUT/test-connection contracts.

- [x] **Step 1: Restyle newsletter as a subscriber ledger**

Use token-native stats, search, active-only filter, CSV export, pagination, and table rows. Use mono email/date fields, `Badge` for active/inactive, visible empty state, and responsive horizontal containment for the table only.

- [x] **Step 2: Restyle email settings as a grouped settings desk**

Use `Card`, `Input`, `Button`, and `Badge`/inline status for SMTP, sender, reply-to, auto-send, test connection, saving, and error states. Keep password input semantics and current API behavior; do not add template editing because this route has no template API or editor data.

- [x] **Step 3: Verify and commit**

Run `npx tsc --noEmit` and scoped ESLint. Commit:

```bash
rtk git add app/admin/newsletter/page.tsx app/admin/email/page.tsx
rtk git commit -m "feat(ui): ledger newsletter dan pengaturan email"
```

---

## Task 8: Phase 2 integration pass and deferred shell wiring

**Files:**
- Modify: `components/admin/CommandPalette.tsx`
- Modify: `components/admin/MastheadRack.tsx`
- Modify: `app/api/sites/route.ts` only if live/scheduled counts are genuinely absent
- Modify: all Phase 2 files with remaining token/motion drift

- [x] **Step 1: Add announcement search to the command palette**

Use a debounced query against the existing announcement search contract (`q`, current site context, bounded `limit`) only while the palette is open and the query is non-empty. Show title, status, and site/category context; navigate to `/admin/announcements/{id}/edit`. Keep static actions/navigation available when the request is loading or fails.

- [x] **Step 2: Add site switching entry to the palette**

Expose the existing masthead rack/site context flow as an action or link without duplicating `POST /api/context` logic. Do not create a second site state store.

- [x] **Step 3: Make rack counts honest**

If `/api/sites` lacks counts, extend its existing query with scoped live and future-scheduled counts. If the route already returns them, only map/render them. Label counts clearly (`N live · M terjadwal`) and do not call total syndications “live”. Preserve access filtering.

- [x] **Step 4: Full static audit**

Search new/migrated Phase 2 files for `react-icons/fi`, raw hex colors, `style={{` chrome, dead click handlers, missing labels, and uncontained wide tables. Run `npx tsc --noEmit` and `npm run lint`; record known pre-existing warnings only.

- [x] **Step 5: Commit**

```bash
rtk git add components/admin/CommandPalette.tsx components/admin/MastheadRack.tsx app/api/sites/route.ts app/admin app/globals.css components/ui lib scripts
rtk git commit -m "feat(ui): integrasi content desk dan pencarian masthead"
```

---

## Self-Review

**Spec coverage:**
- §5.0 dashboard front page → Task 2.
- §5.1 announcement ledger, derived status, filters, bulk, empty/loading → Task 3 plus Task 1.
- §5.2 two-pane editor, preview, TipTap toolbar, masthead context, publish controls, word count → Task 4.
- §5.3 categories and media → Task 5.
- §5.4 comment moderation → Task 6.
- §5.5 newsletter/email → Task 7.
- §5.6 consistent states → Tasks 2–7.
- §5.7 deliverable → Tasks 1–8.
- Deferred Phase 1 items (motion tokens, theme toggle, palette content/site search, rack live/scheduled counts) → Tasks 1 and 8.

**Intentional scope decisions:**
- No approval status implementation because the approval workflow was removed from the current schema and migration history.
- No email template editor because the current route exposes only SMTP/sender settings and no template API.
- No new drag/drop upload behavior, bulk scheduling, or new database schema because those are behavior/data-model changes outside the approved chrome/content-desk rework.

**Placeholder scan:** no TBD/TODO steps; each task names files, interfaces, implementation behavior, verification, and commit boundaries.

**Type consistency:** `deriveAnnouncementStatus` is defined once in Task 1 and consumed by dashboard/list/editor; existing UI kit contracts and API contracts are preserved; the palette uses existing `/api/announcements?q=...` and rack uses existing `/api/sites`/`/api/context` mechanics.
