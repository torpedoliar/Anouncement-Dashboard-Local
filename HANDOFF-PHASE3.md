# Phase 3 Handoff — Data Surfaces

**Created:** 2026-08-14
**Status:** Plan written & committed, **not yet executed**
**Plan file:** `docs/superpowers/plans/2026-08-14-ui-ux-rework-phase3-data-surfaces.md`
**Base for Phase 3 commits:** `main` HEAD (see "Resume flow")

---

## What This Phase Does

Turns the admin data surfaces into coherent reading surfaces (spec §6):

- **Chart language** (§6.1): line/bar/donut on recharts, token/theme-native, **primary series follows the active masthead** (`--site-primary` from `useSiteTheme()`), other series neutral + one contrast. Empty/loading states.
- **KPI stat tiles** (§6.2): `StatTile` — big mono number + optional delta, 16px icon, headline reading (sparse, not boxed cards).
- **Ledger tables** (§6.3): Sites + Users desks on the sortable `Table` kit (`aria-sort`, mono numerals, filter/pagination).
- **Audit trail** (§6.4): timeline-style ledger (quantum timestamp · actor · action verb · entity · outcome), filters + export preserved.
- **Global analytics** (§6.5): per-site masthead comparison — color-dotted strip + grouped bar chart, site-accent per card.

---

## What Is Done

| Item | Status |
|---|---|
| Phase 0 (design system) | ✅ shipped |
| Phase 1 (shell) | ✅ shipped |
| Phase 2 (content desk) | ✅ shipped + merged to `main` (`1b5b836`), tsc clean, lint clean (only pre-existing warnings) |
| Phase 2 cleanup (this session) | ✅ stale `HANDOFF-PHASE2-CHECKPOINT.md` removed; plan checkboxes 37/37 marked; plan committed |
| Phase 3 plan — written | ✅ committed |
| Phase 3 execution — **not started** | ⏳ |

If the Phase 3 plan is ever re-generated, note: the 3 Explore subagents failed this session with `model not found: gpt-5.6-luna` (their default model is not available). I explored inline instead. When dispatching subagents for Phase 3, **always set an explicit `model` (e.g. `sonnet`)** or they fail at spawn.

---

## The Plan, At a Glance (7 tasks)

| Task | Files | Deliverable / commit msg |
|---|---|---|
| **T1** chart primitives | Create `components/admin/StatTile.tsx`, `components/admin/ChartTooltip.tsx`, `lib/chart-theme.ts`, `scripts/check-chart-theme.ts` | `getChartTheme()`, `StatTile`, `ChartTooltip` recharts content renderer. `feat(ui): primitif chart - tema masthead, StatTile, ChartTooltip` |
| **T2** analytics desk | Modify `components/admin/AnalyticsDashboard.tsx` | recharts masthead-aware, skeleton, StatTile summary, token chrome. `feat(ui): desk analytics - chart masthead, StatTile, state konsisten` |
| **T3** sites desk | Modify `app/admin/sites/page.tsx` (+ `[id]/page.tsx`, `[id]/settings/page.tsx`) | token-native masthead cards, honest live/scheduled, Badge health. `feat(ui): desk situs - kartu masthead token, status jujur live/terjadwal` |
| **T4** users desk | Modify `app/admin/users/page.tsx` | sortable `Table` kit, role badges, token modal. `feat(ui): ledger user - tabel kit sortable, badge role, modal token` |
| **T5** audit trail | Modify `app/admin/audit-trail/page.tsx` | timeline ledger, filter/export/pagination preserved. `feat(ui): audit trail - ledger timeline, filter/export token` |
| **T6** global analytics | Modify `app/admin/global-analytics/page.tsx` | masthead comparison + grouped bar, site-accent. `feat(ui): global analytics - perbandingan masthead, bar chart site-accent` |
| **T7** integration audit | Modify Phase 3 files + `components/ui/Table.tsx` if needed | static audit + state parity + gates. `chore(ui): audit integrasi data surfaces fase 3` |

---

## Key Context for the Next Session

### Global constraints (bind every task — copy verbatim when reviewing)
- Tokens only: `bg-surface-*`, `text-text-*`, `border-border`, `bg-accent`/`text-accent`, `rounded-control/card/sheet`, `shadow-lvl-*`, status tokens. No `style={{}}` chrome. **Exception:** DB-driven per-site/category `primaryColor`/`color` inline styles.
- Identity: masthead accent = `--site-primary` from `useSiteTheme()`; chart primary series follows it. No four hardcoded stat-tile colors.
- Icons: Phosphor top-level named imports only; **no `react-icons/fi`** in new/migrated UI. Color never alone (icon + text).
- Typography: `font-display` headings, body sans UI, `font-mono tabular-nums` for all counts/dates/views/IDs.
- Motion: `--motion-fast`/`--motion-standard`/`--motion-ease` exist in `app/globals.css`; 150–300ms, transform/opacity, reduced-motion honored.
- Accessibility: accent focus rings, keyboard filters/sort/pagination, `aria-sort`/`aria-current`, table scroll confined to `overflow-x-auto` only.
- Behavior preservation: no route/schema/auth/scheduler/access redesign. Keep `resolveAdminSiteId`, `canAccessSite`/`canEditOnSite`, existing API endpoints.

### Boundary (from spec §8 sequence)
**Phase 4** owns: portal ledgers (`app/admin/portal-sessions`, `portal-audit`, `portal-users`, `portal-groups`), auth frames, portal grid/secondary surfaces. **Do NOT touch them in Phase 3.** §6.5's "Global Analytics" is in scope; the per-portal ledgers are not.

### Current-state quick-ref (explored, verbatim shapes)
| Surface | File | Current state → what changes |
|---|---|---|
| Analytics | `components/admin/AnalyticsDashboard.tsx` (471 lines) | `react-icons/fi` (FiTrendingUp/Eye/FileText/Loader/AlertCircle), raw hex (`#dc2626`, `#171717`, `#0a0a0a`), bespoke `SummaryCard` w/ `borderLeft: 4px solid ${color}`. API `GET /api/analytics?days=N` → `{ dailyViews:{date,pageViews,uniqueVisitors}[], topArticles:{id,title,views,category?}[], categoryDistribution:{name,color,views}[], summary:{totalViews,publishedArticles,avgViewsPerArticle}, hasAnalyticsData }`. No delta source → StatTile delta omitted. |
| Global analytics | `app/admin/global-analytics/page.tsx` (~323 lines) | `react-icons/fi`, raw hex, N+1 (fetch `/api/sites`, then `/api/sites/{id}/health` per site). `SiteStats.stats = {totalAnnouncements, publishedAnnouncements, totalViews, totalCategories, totalUsers}`. SuperAdmin-only. Each site's `primaryColor` is the natural per-card accent. |
| Sites desk | `app/admin/sites/page.tsx` (~381 lines) | `react-icons/fi`, raw-hex cards. `/api/sites?includeInactive=true` already returns `_count.announcementSites/categories/userAccess` **+ `liveCount`/`scheduledCount`** (added in Phase 2 T8). `GET /api/sites/{id}/health` → `{status: good|warning|critical, metrics:{viewsLast7d,draftCount,pendingComments,scheduledPosts}}`. **Card grid stays** (health metrics would be lost as a dense table) — deliberate. |
| Users desk | `app/admin/users/page.tsx` (~524 lines) | `react-icons/fi`, bespoke table. Already uses `ConfirmDialog`. `GET /api/users` → `User[] {id,email,name,role:ADMIN|EDITOR,isSuperAdmin,createdAt,siteIds?}`. Add/edit modal → kit. `Table` kit is already sortable. |
| Audit trail | `app/admin/audit-trail/page.tsx` (~365 lines) | `react-icons/fi`, dense raw-hex `<table>`, expandable detail row (changes/metadata/errorMessage/userAgent). `GET /api/audit-trail?...` filters `actorType,category,outcome,severity,entityType,search,from,to`, pagination `page,limit=20`, `export=csv|json` → `{data:AuditLogEntry[],pagination}`. Timeline-style ledger replaces the dense log. |
| Table kit | `components/ui/Table.tsx` | **Already sortable**: `TableColumn {key, header, sortKey?}`, props `{columns, rows, sort?:{key,dir}, onSort, ariaLabel}`, `aria-sort` wired, Phoenix CaretUp/CaretDown, hover row highlight. Reuse as-is. |
| StatusPill | `components/ui/StatusPill.tsx` | `AnnouncementStatus = draft|scheduled|published|taken-down|pending-approval`, tones neutral/warning/success/danger/info, icon+text. `pending-approval` never emitted (ApprovalRequest dropped). |
| Theme | `app/globals.css` | Root = night; `html.theme-light` = paper. **No `.dark`/`.theme-dark`** — toggle just adds/removes `theme-light`. `--motion-*` defined. |
| ThemeToggle | `components/admin/AdminTopbar.tsx` | `adminTheme` localStorage, adds/removes `theme-light` on `document.documentElement`, `aria-pressed`, drained. DRY duplicate noted in T2 of prior phase (deferred minor — leave). |
| Rack counts | `app/api/sites/route.ts` | Already returns `liveCount`/`scheduledCount` via `getSiteLiveScheduledCounts()` using `deriveAnnouncementStatus`. Honest — total syndications NOT called "live". |
| `useSiteTheme()` | `components/SiteThemeProvider.tsx` | Returns `{ theme: {primaryColor, primaryColorLight, primaryColorDark, primaryColorAlpha, textOnPrimary}, siteName, siteSlug }`. `--site-primary` injected by `SiteThemeProvider`. |

### SiteHealthCard note
`components/admin/SiteHealthCard.tsx` has a dead `primaryColor` prop (deferred minor from Phase 2). It is dashboard-only; not in the Phase 3 task list — leave it unless T7's audit flags it.

---

## Resume Flow (start of new session)

```bash
cd "E:\Vibe\Dashboard SJA\announcement-dashboard"
git checkout main && git pull 2>/dev/null   # ensure main is current
```

**Option A — Inline (simplest if no subagents available):**
Use `superpowers:executing-plans` pointed at the Phase 3 plan file. The plan is self-contained (each task has exact files, code, verification, commit). Execute T1 → T7 in order. Between tasks run gates:

```bash
npx tsx scripts/check-chart-theme.ts      # after T1
npx tsc --noEmit                           # after each task
npx eslint <changed-files>                 # scoped per task
```

**Option B — Subagent-Driven (recommended, requires working subagent model):**
`superpowers:subagent-driven-development`. **CRITICAL:** dispatch every subagent with an explicit `model` (e.g. `sonnet`) — the previous default (`gpt-5.6-luna`) does not exist in this environment and all 3 explore agents failed at spawn. Per-task ledger at `.superpowers/sdd/2026-08-14-ui-ux-rework-phase3-data-surfaces/`. Wait — verify the plan's commit landed on `main` first; Base for review packages = current `main` HEAD.

**Verification gates (unchanged):** `npx tsc --noEmit` + `npx eslint <files>`. `npm run build` / route rendering still blocked by env (`NEXTAUTH_URL`, local Postgres). Do not modify `.env`, Tailwind version, or `postcss.config.mjs`.

**Commit hygiene:** Indonesian messages; `rtk git add`/`rtk git commit`; commit only task-owned files (a plan-recommended `git add` covers multiple dirs — commit only what actually changed).

---

## Out of Scope (deliberate)

| Item | Reason |
|---|---|
| Portal ledgers (`portal-sessions/audit/users/groups`), auth frames, portal grid | Phase 4 per spec §8 |
| Delta (% change) on analytics StatTiles | No previous-period comparison source in `/api/analytics` — would be invented |
| Converting Sites desk to a dense ledger table | Would drop the per-site health metrics the card grid carries |
| New chart library / state store / Prisma schema | Behavior-preservation boundary; recharts stays |
| Email template editor / approval UI / drag-drop upload | From Phase 2 — already out of scope |

---

## Standing Rules (from CLAUDE.md / Phase 1–2, repeat for convenience)

- `.env` intentionally untouched; do not fix `NEXTAUTH_URL` or other env failures.
- Tailwind stays v3; `postcss.config.mjs` unchanged.
- Multi-site is the core domain model — never assume one site per announcement; derive primary site from the junction, scope through `sites.some({siteId})`.
- Gate writes through `lib/site-access.ts` (`canEditOnSite`, `canAdminSite`, `getAccessibleSites`) — don't hand-roll.
- Audit via `logAudit()` from `lib/audit.ts` (non-blocking, never throw, auto-redacts).
- Use `@phosphor-icons/react` top-level named imports only.
- `rtk`-prefix commands for speed.
