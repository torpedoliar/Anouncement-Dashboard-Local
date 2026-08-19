# Phase 2 Handoff — Content Desk

**Created:** 2026-08-13
**Status:** Plan written, not yet executed
**Entry point:** `docs/superpowers/plans/2026-08-13-ui-ux-rework-phase2-content-desk.md`

---

## What This Phase Does

Turns the admin content workflow into a coherent "newsroom desk":

- Truthful announcement status language (draft / terjadwal / terbit / diturunkan) derived from `isPublished`, `scheduledAt`, `takedownAt` — no new schema, no approval model (that was removed).
- Masthead-aware dashboard: stat tiles accent follows the active site's `--site-primary`, not hardcoded colors.
- Announcement ledger: `StatusPill`-driven rows, real filters (status / keyword / category / site / author), bulk actions kit-ized, skeleton + empty states.
- Two-pane composer: fields left, live read-only preview right, sticky TipTap toolbar, word count, site syndication context.
- Categories, media gallery + lightbox picker, comments moderation ledger, newsletter subscriber ledger, email settings desk — all token-native.
- Deferred Phase 1 items absorbed here: motion-token custom properties, light/dark toggle in topbar, palette content/site search, masthead rack live+scheduled counts.

---

## What Is Done

| Item | Status |
|---|---|
| Phase 1 (shell) — shipped | ✅ commits `98a0982` → `e2a6748` |
| Phase 2 plan — written | ✅ `docs/superpowers/plans/2026-08-13-ui-ux-rework-phase2-content-desk.md` |
| Phase 2 execution — **not started** | ⏳ |

The Phase 1 SDD ledger is at `.superpowers/sdd/2026-08-13-ui-ux-rework-phase1-shell/progress.md`.

---

## Key Context for the Next Session

### Tech/runtime constraints (unchanged from Phase 1)
- **Next.js 15 / React 19 / Tailwind v3 / TypeScript** — do not touch Tailwind version or `postcss.config.mjs`.
- **`npm run build` fails** pre-existing (empty `NEXTAUTH_URL`). Gate with `npx tsc --noEmit` + `npx eslint <files>`. `npm run dev` also cannot render routes (local Postgres down, `localStorage` error in test env).
- **Icons:** `@phosphor-icons/react` (top-level named imports only, not `dist/csr/...`). `react-icons/fi` banned in new/migrated UI.
- **Tokens:** Phase 0 design system is live. Use `bg-surface-*`, `text-text-*`, `border-border`, `bg-accent`, `text-accent`, `rounded-control/card/sheet`, `shadow-lvl-*`. No raw hex chrome, no `style={{}}` chrome in new UI.
- **Masthead accent:** `useSiteTheme()` → `{ theme: {primaryColor,...}, siteName, siteSlug }`. `--site-primary` is injected by `SiteThemeProvider`. Do not re-implement.
- **Site context:** `localStorage` key `currentSiteId` + `POST /api/context` → `window.location.reload()`. `resolveAdminSiteId()` / `canAccessSite` / `canEditOnSite` gate writes.
- **Audit:** `logAudit()` from `lib/audit.ts` — non-blocking, auto-redacts secrets.
- **Commits:** Indonesian messages; commit only files the task touches.

### Schema / data model facts (do not change)
- `Announcement` has `isPublished`, `scheduledAt`, `takedownAt`, `wordCount`, `sites` (junction), `category`, optional `author`.
- `ApprovalRequest` model was **dropped** by migration `20260605010000_drop_approval_add_revision_video`. Do not add approval UI or schema. `StatusPill`'s `pending-approval` type stays in the union but is never emitted by the new helper.
- `Comment` has self-relation `parentId`/`replies` — threading exists in Prisma but is **not returned** by the current API; render flat ledger unless the API starts including replies.
- `MediaLibrary` fields: `id, filename, url, mimeType, size, alt?, uploadedAt, siteId?`.
- No new Prisma schema changes, no auth/SSO/scheduler changes.

### Current-state quick-ref (explored in this session)

| Surface | File | Current state |
|---|---|---|
| Announcement list | `components/admin/AnnouncementsList.tsx` | Server-fetched; status is `isPublished` ternary; category filters are dead spans; selection + `BulkActionBar` works |
| Bulk actions | `components/admin/BulkActionBar.tsx` | Publish/unpublish/delete via `POST /api/announcements/bulk`; `ConfirmDialog` on delete |
| Editor | `components/admin/AnnouncementForm.tsx` | Single form for new/edit; 2fr/1fr grid already exists but no preview pane; autosave draft on edit |
| Rich text | `components/admin/RichTextEditor.tsx` | TipTap, custom YouTube/Video nodes, toolbar groups; no BubbleMenu, no word count |
| Site picker | `components/admin/SiteSyndicationPicker.tsx` | Multi-site card grid with primary/hero/pin flags |
| Categories | `app/admin/categories/page.tsx` | Grouped by site; inline create/edit; color swatch + count + actions; no filters/search |
| Media list | `app/admin/media/page.tsx` | Grid, upload via file input, delete, copy URL, preview modal; no pagination (fetches 100) |
| Media picker | `components/admin/MediaPickerModal.tsx` | Local/Stock tabs, type filter, search debounce, single selection, stock download, incremental load |
| Comments | `app/admin/comments/page.tsx` | Card list, status select, inline approve/reject/spam, delete, pagination; no threading display |
| Newsletter | `app/admin/newsletter/page.tsx` | Inline `<table>`, client-side search, active-only filter, CSV export, pagination |
| Email | `app/admin/email/page.tsx` | SMTP + sender settings form; GET/PUT/POST; no templates |
| Dashboard | `app/admin/page.tsx` | Hardcoded stat card colors (`#dc2626`, `#22c55e`, `#eab308`, `#3b82f6`); recent list uses `!isPublished` badge; site health card present but unused |
| Tokens | `app/globals.css` | `:root` has night tokens; `html.theme-light` has paper tokens; no `theme-dark`; no motion custom properties; no light/dark toggle |
| UI kit | `components/ui/` | `StatusPill`, `Badge`, `Table`, `Button`, `Input`, `Select`, `Card`, `Dropdown`, `ConfirmDialog` — all default exports; `StatusPill` currently unused by the list |

---

## How to Resume

```bash
cd "E:\Vibe\Dashboard SJA\announcement-dashboard"
# Read the plan
cat docs/superpowers/plans/2026-08-13-ui-ux-rework-phase2-content-desk.md

# SDD workspace for Phase 2 (create when execution starts)
# → .superpowers/sdd/2026-08-13-ui-ux-rework-phase2-content-desk/
# Ledger will be created there by the SDD skill.
```

**Recommended path:** invoke `superpowers:subagent-driven-development`, point it at the plan file, and execute task-by-task with the standard implementer → reviewer → fix-loop cycle. The plan is written to be self-contained; no additional context is required beyond this handoff.

If starting inline (no subagent), use `superpowers:executing-plans` instead.

---

## What Was Deliberately Out of Scope

| Item | Reason |
|---|---|
| Approval workflow UI | Schema/model removed; no data source |
| Email template editor | Route has no template API |
| Bulk scheduling | Not in API contract |
| Drag/drop upload | Not in current behavior |
| New Prisma migrations / auth / scheduler changes | Behavior preservation boundary |
| Portal surfaces | Phase 4 per the spec sequence |
| Analytics charts / KPI tiles / ledger tables / audit timeline | Phase 3 per the spec sequence |

---

## Standing Rules (from CLAUDE.md — repeat here for convenience)

- `.env` intentionally untouched; do not fix `NEXTAUTH_URL` or other env failures.
- Tailwind stays v3; `postcss.config.mjs` unchanged.
- Verification gates: `npx tsc --noEmit` + `npx eslint <files>` only.
- Commit messages in Indonesian; one self-contained commit per task.
- RTK-prefix commands for speed (`rtk git add`, `rtk git commit`, etc.).
