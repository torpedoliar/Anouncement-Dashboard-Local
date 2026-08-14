# Phase 3: Data Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin data surfaces into coherent reading surfaces: a token/theme-native chart language (masthead-accent aware), KPI stat tiles, sortable ledger tables on the Sites/Users desk, a timeline-style audit trail, and a site-accent global-analytics comparison — all reusing the Phase 0/2 design system.

**Architecture:** Preserve every existing API contract, Prisma query, auth, and access rule. Replace bespoke inline-chrome + `react-icons/fi` rendering with the existing `components/ui` kit, Phase 0 tokens, and Phosphor icons; make the chart's primary series follow the active masthead (`--site-primary` from `useSiteTheme()`), with other series neutral and one contrast series. No new chart library, no new data model, no state store. Reuse the already-sortable `Table` kit and the `deriveAnnouncementStatus` helper.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v3, Prisma 5, recharts (already installed), `components/ui/` kit, `@phosphor-icons/react`.

## Global Constraints

- **Design system:** use Phase 0 tokens (`bg-surface-*`, `text-text-*`, `border-border`, `bg-accent`/`text-accent`, `rounded-control/card/sheet`, `shadow-lvl-*`, semantic status tokens). No new raw color chrome, no `style={{}}` chrome in new/migrated UI. The one exception: DB-driven per-site/category `primaryColor`/`color` inline styles (data, not chrome).
- **Identity:** one newsroom, many mastheads. `useSiteTheme()` → `--site-primary` drives the active masthead accent. Chart primary series = masthead accent; other series neutral (`#52525B`-ish family via tokens or the `--text-3`/`--surface-3` family), one contrast series max. Do not re-hardcode the four stat-tile colors.
- **Chart language (spec §6.1):** trends → line/area; comparisons → bar; proportions → 1 donut max. No 3D, no decorative gradients. Legends always visible near the chart. Gridlines `--border` / `border-border`. Tooltips styled to the shell with mono numerals and keyboard reachability. Empty state ("Belum ada data untuk rentang ini" + range picker) and loading skeleton.
- **KPI tiles (spec §6.2):** big mono number + optional delta, label, 16px icon, sparse layout (headline tiles, not boxed cards). Delta `+12%` vs previous period with up/down icon; negative delta in danger tone (with icon). Only include a delta when a real comparison source exists — do not invent a delta query.
- **Ledger tables (spec §6.3):** same family as the news desk. Clean rows, sparse borders, sortable columns with `aria-sort`, mono numerals in numeric columns, hover row highlight. Filter bar (keyword/status/role), pagination with per-page counts. Use the existing `Table` kit (`TableColumn { key, header, sortKey? }` + `sort`/`onSort`).
- **Audit trail (spec §6.4):** timeline-style ledger, not a dense log: each row = mono timestamp, actor, action verb, affected entity. Filter by actor/type/date. Export preserved.
- **Typography:** `font-display` headings, body sans UI, `font-mono tabular-nums` for all counts, dates, timestamps, views, and IDs.
- **Icons:** Phosphor only in new/migrated UI (top-level named imports). Replace `react-icons/fi` everywhere touched. Color is never the sole signal — icon + text.
- **Motion:** 150–300ms, `cubic-bezier(0.16, 1, 0.3, 1)`, transform/opacity only, `prefers-reduced-motion` honored. Use `--motion-standard`/`--motion-fast` where already defined.
- **Accessibility:** visible accent focus rings, keyboard-operable filters/sort/pagination, labels for inputs, `aria-sort`, `aria-current`, no horizontal overflow at 375px (table scroll confined to an `overflow-x-auto` wrapper only).
- **Behavior preservation:** no route, Prisma schema, auth, scheduler, SSO, or access-control redesign. Keep `resolveAdminSiteId`, `canAccessSite`/`canEditOnSite`, existing API endpoints, and existing query contracts.
- **Boundary (sequence):** portal ledgers (portal-sessions, portal-audit, portal-users, portal-groups), auth frames, and portal app grid are **Phase 4** — do not touch them here. The "Sites, Users" ledger tables in this plan are the **admin** desks only.
- **Verification:** `npx tsc --noEmit` and scoped `npx eslint <files>` are gates. Do not modify `.env`, Tailwind version, or `postcss.config.mjs`.
- **Commits:** Indonesian commit messages; commit only files belonging to the task.

---

## Task 1: Shared chart primitives — masthead accent, StatTile, token-native recharts wrapper

**Files:**
- Create: `components/admin/ChartTooltip.tsx`
- Create: `components/admin/StatTile.tsx`
- Modify: `app/globals.css` only if a chart-neutral series token is missing (prefer reusing `--text-3` / `--surface-3`)
- Create/modify: `lib/chart-theme.ts` — small helper returning `{ primary, grid, tick, tooltipBg, tooltipBorder }` derived from the current theme + masthead accent

**Interfaces:**
- Consumes: `useSiteTheme()` from `@/components/SiteThemeProvider` → `{ theme: { primaryColor, ... }, siteName }`; existing tokens `--site-primary`, `--motion-*`.
- Produces:
  - `StatTile({ icon: PhosphorIcon, label, value, delta?, deltaTone? })` — headline tile: 16px icon, mono big number, optional delta line with `CaretUp`/`CaretDown` icon and success/danger tone.
  - `ChartTooltip` — a recharts-compatible `content` renderer ({ active, payload, label }) styled to the shell (surface-1 bg, border-border, mono values), keyboard-reachable/native.
  - `getChartTheme()` → `{ primary, grid, tick, tooltipBg, tooltipBorder, neutral }` where `primary` = masthead `primaryColor` (fallback `var(--site-primary)`), `grid`/`tick` = border/text tokens, `neutral` = a `--text-3`-family value.
- Later tasks (2-fold) consume `StatTile`, `ChartTooltip`, and `getChartTheme()`.

- [ ] **Step 1: Create `getChartTheme()` helper**

```ts
// lib/chart-theme.ts
export interface ChartTheme {
  primary: string;      // masthead accent / --site-primary
  neutral: string;      // secondary series, --text-3 family
  grid: string;         // gridline color, --border
  tick: string;         // axis text, --text-3
  tooltipBg: string;    // surface-1
  tooltipBorder: string;// --border
}
export function getChartTheme(primaryColor?: string, cssVar = "var(--site-primary)"): ChartTheme {
  return {
    primary: primaryColor || cssVar,
    neutral: "var(--text-3)",
    grid: "var(--border)",
    tick: "var(--text-3)",
    tooltipBg: "var(--surface-1)",
    tooltipBorder: "var(--border)",
  };
}
```

`ponytail:` one function returning token vars — the browser resolves them per theme (light/night) at paint time, so no JS theme detection needed.

- [ ] **Step 2: Create `StatTile`**

```tsx
"use client";
import { CaretUp, CaretDown } from "@phosphor-icons/react";

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  delta?: number;                 // optional, percent or abs vs previous period
  deltaTone?: "success" | "danger";
}

export default function StatTile({ icon: Icon, label, value, delta, deltaTone = "success" }: StatTileProps) {
  const up = (delta ?? 0) >= 0;
  const shownTone = deltaTone === "danger" ? (up ? "danger" : "success") : up ? "success" : "danger";
  return (
    <div className="border-b border-border pb-4">
      <div className="flex items-center gap-2 text-text-3">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide">{label}</span>
      </div>
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-text-1">{Number(value).toLocaleString("id-ID")}</p>
      {typeof delta === "number" && (
        <p className={`mt-0.5 inline-flex items-center gap-1 font-mono text-xs tabular-nums ${up ? "text-success" : "text-danger"}`}>
          {up ? <CaretUp size={12} aria-hidden="true" /> : <CaretDown size={12} aria-hidden="true" />}
          {up ? "+" : ""}{delta}%
        </p>
      )}
    </div>
  );
}
```

`ponytail:` accepting raw `delta` (caller computes the previous-period comparison) — no internal period math.

- [ ] **Step 3: Create `ChartTooltip` (recharts content renderer)**

```tsx
"use client";
/* Recharts <Tooltip content={<ChartTooltip />} /> — styled to the shell, mono values. */
export default function ChartTooltip({ active, payload, label, valueFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sheet border border-border bg-surface-1 px-3 py-2 shadow-lvl-2">
      {label != null && <p className="mb-1 text-xs text-text-3">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-mono text-sm tabular-nums text-text-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.payload?.fill }} aria-hidden="true" />
          <span className="text-text-3">{p.name}:</span>
          {(valueFormatter ? valueFormatter(p.value) : p.value?.toLocaleString("id-ID"))}
        </p>
      ))}
    </div>
  );
}
```

`ponytail:` free-form `any` on recharts callback props is idiomatic — the library's own types are cumber-some; scoped, near-axis code only.

- [ ] **Step 4: Add a runnable self-check for the theme helper**

Create `scripts/check-chart-theme.ts` asserting `getChartTheme("#ED1C24").primary === "#ED1C24"` and that fallback uses `var(--site-primary)` when no color is passed. Run with `npx tsx scripts/check-chart-theme.ts`; expected: no assertion failure.

- [ ] **Step 5: Verify and commit**

Run `npx tsx scripts/check-chart-theme.ts`, `npx tsc --noEmit`, scoped ESLint on the new files. Commit:

```bash
git add lib/chart-theme.ts scripts/check-chart-theme.ts components/admin/StatTile.tsx components/admin/ChartTooltip.tsx
rtk git commit -m "feat(ui): primitif chart - tema masthead, StatTile, ChartTooltip"
```

---

## Task 2: Analytics desk — masthead-aware charts, KPI tiles, consistent states

**Files:**
- Modify: `components/admin/AnalyticsDashboard.tsx` (full rework of the 471-line client component)
- Modify: `app/admin/analytics/page.tsx` only if a wrapper/layout change is needed (likely none)

**Interfaces:**
- Consumes: the existing `GET /api/analytics?days=N` response shape — `{ dailyViews: {date,pageViews,uniqueVisitors}[], topArticles: {id,title,views,category?}[], categoryDistribution: {name,color,views}[], summary: {totalViews,publishedArticles,avgViewsPerArticle}, hasAnalyticsData }`.
- Consumes from Task 1: `StatTile`, `ChartTooltip`, `getChartTheme()`, and `useSiteTheme()`.
- Produces: the reworked analytics desk — no API or schema changes.

- [ ] **Step 1: Replace Feather imports + raw hex summary cards with StatTile**

Remove `react-icons/fi` (`FiTrendingUp/FiEye/FiFileText/FiLoader/FiAlertCircle`) → Phosphor (`TrendUp`, `Eye`, `FileText`, `CircleNotch` for loader, `Warning` for the notice). Replace the three bespoke `SummaryCard`s (raw hex `#0a0a0a`, `borderLeft: 4px solid ${color}`) with `StatTile` next to the section — Total Views, Artikel Published, Rata-rata Views. `delta` omitted (no comparison source in the API). No four hardcoded colors: the StatTile layout is neutral; the masthead accent enters only via the charts (Task 2 step 3).

- [ ] **Step 2: Migrate inline `style={{}}` chrome + loader/notice/empty to tokens**

- Loading → skeleton chart blocks (`animate-pulse` on rounded-sheet `bg-surface-2` shapes matching each chart's height) instead of the `FiLoader` spinner.
- Estimasi notice (`!data.hasAnalyticsData`) → a token-native `Badge`/inline alert using `text-warning` + `Warning` icon + `bg-warning/10` + `border-warning/30`.
- Section headers → `font-display` + `text-text-1`; chart card shells → `bg-surface-1 border border-border rounded-card`.
- `EmptyChartMessage` → tokenized (`bg-surface-1 border-border`, `text-text-3`), keep the "Belum ada data …" copy, keep the `days` range picker as the `Select` kit (7/30/90).

- [ ] **Step 3: Make charts masthead-aware via `getChartTheme()` and Phosphor-clean**

- Call `useSiteTheme()` → `theme.primaryColor`; build `const ct = getChartTheme(theme.primaryColor)`.
- Line (Views Harian): `<Line dataKey="pageViews" stroke={ct.primary} strokeWidth={2} dot={{ fill: ct.primary, ... }} />`; grid `stroke={ct.grid}`; axes `stroke={ct.tick}`; `<Tooltip content={<ChartTooltip />} />` (drop the raw `#171717` contentStyle).
- Bar (Top 10 Artikel): `fill={ct.primary}` for the bars; same grid/axis/tooltip treatment.
- Pie (Distribusi Kategori): keep each category's own `entry.color` (`Cell fill={entry.color}`) — this is legit DB data color, not chrome. Keep the single-donut rule.
- Artikel Terpopuler list → token-native rows (`bg-surface-1 border border-border rounded-card`), ranking square accent only for index 0 using `--site-primary`, `font-mono tabular-nums` for the view count.

- [ ] **Step 4: Verify and commit**

Run `npx tsc --noEmit` and scoped ESLint on `AnalyticsDashboard.tsx`. Commit:

```bash
git add components/admin/AnalyticsDashboard.tsx
rtk git commit -m "feat(ui): desk analytics - chart masthead, StatTile, state konsisten"
```

---

## Task 3: Sites desk — ledger cards into token-native masthead cards + honest health status

**Files:**
- Modify: `app/admin/sites/page.tsx`
- Modify: `app/admin/sites/[id]/page.tsx` and `app/admin/sites/[id]/settings/page.tsx` only where the chrome (header/cards/buttons) needs token migration to stay consistent

**Interfaces:**
- Consumes: existing `GET /api/sites?includeInactive=true` (already returns `_count.announcementSites/categories/userAccess` + `liveCount`/`scheduledCount`) and `GET /api/sites/{id}/health` (`{ status: good|warning|critical, metrics: {viewsLast7d, draftCount, pendingComments, scheduledPosts} }`).
- Produces: token-native site cards; no API change. Rack counts honest (live/scheduled) already live in `/api/sites`.

- [ ] **Step 1: Replace Feather + raw hex card chrome with kit + tokens**

Drop `react-icons/fi` (`FiGlobe/FiPlus/FiSettings/FiEdit2/FiExternalLink/FiUsers/FiFileText/FiFolder/FiCheckCircle/FiAlertCircle/FiAlertTriangle`) → Phosphor equivalents (`Globe`, `Plus`, `GearSix`, `PencilSimple`, `ArrowSquareOut`, `Users`, `FileText`, `Folder`, `CheckCircle`, `WarningCircle`, `Warning`). Replace `style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid rgba(255,255,255,0.1)" }}` cards with `Card`/`bg-surface-1 border-border rounded-card`. Headers → `font-display`, sentence case (e.g. "Site Management" stays, but strip the raw `28px` weight inline chrome → `text-2xl font-semibold`). "Create New Site" → `Button` kit primary.

- [ ] **Step 2: Tokenize per-site health status (icon + text, not color alone)**

`getStatusIcon`/`getStatusColor` raw hex → use the semantic status `Badge`/tone (success/warning/danger) with a Phosphor status icon, keeping text label (`Sehat`/`Perhatian`/`Kritis` or existing `good/warning/critical`). Grid stat cells → `font-mono tabular-nums`; labels `text-text-3`. Keep the per-site `primaryColor` swatch inline (DB color). Add live/scheduled honesty line near the masthead swatch: `{liveCount} live · {scheduledCount} terjadwal` from `_count` (already present — do not re-derive).

- [ ] **Step 3: Verify and commit**

Run `npx tsc --noEmit`, scoped ESLint. Commit:

```bash
git add app/admin/sites/page.tsx app/admin/sites/[id]/page.tsx app/admin/sites/[id]/settings/page.tsx
rtk git commit -m "feat(ui): desk situs - kartu masthead token, status jujur live/terjadwal"
```

---

## Task 4: Users desk — sortable ledger with the Table kit + role badges

**Files:**
- Modify: `app/admin/users/page.tsx`

**Interfaces:**
- Consumes: existing `GET /api/users` → `User[] { id, email, name, role: ADMIN|EDITOR, isSuperAdmin, createdAt, siteIds? }`, `GET /api/sites`, and existing POST/PUT/DELETE `/api/users` + `/api/users/{id}` contracts. The add/edit modal and `ConfirmDialog` delete flow are preserved.
- Produces: token-native users ledger using the sortable `Table` kit.

- [ ] **Step 1: Replace the bespoke table with the `Table` kit**

Map the existing columns to `TableColumn[]`: Nama (`sortKey: "name"`), Email, Role (`sortKey: "role"`), Situs, Dibuat (`sortKey: "createdAt"`), Aksi (non-sortable). Build client-side sort state (`useState<{key,dir}>`) feeding `sort`/`onSort`; default sort by `createdAt desc`. Render role via a `Badge` (SUPER ADMIN / ADMIN / EDITOR) with the existing icon + label (icon + text, not color alone). Site access chips → token-native (`bg-surface-2 border-border`). Numeric/date cells → `font-mono tabular-nums`.

- [ ] **Step 2: Ensure empty/loading states and action cells**

Keep `Loading...` → ledger-shaped skeleton rows (`animate-pulse`); keep empty state. Edit/delete icon buttons → Phosphor (`PencilSimple`/`Trash`), `cursor-pointer`, `hover:bg-surface-2`, `aria-label`. Restyle the add/edit **modal** (`showModal`) to kit (`Input`, `Select`, `Button`, site checkboxes) — tokens + `bg-accent` for the submit CTA. Preserve all POST/PUT/DELETE behavior and `ConfirmDialog`.

- [ ] **Step 3: Verify and commit**

Run `npx tsc --noEmit`, scoped ESLint. Commit:

```bash
git add app/admin/users/page.tsx
rtk git commit -m "feat(ui): ledger user - tabel kit sortable, badge role, modal token"
```

---

## Task 5: Audit trail — timeline ledger (§6.4)

**Files:**
- Modify: `app/admin/audit-trail/page.tsx`

**Interfaces:**
- Consumes: existing `GET /api/audit-trail?...` (filters `actorType, category, outcome, severity, entityType, search, from, to`, pagination `page, limit`, `export=csv|json`) → `{ data: AuditLogEntry[], pagination }`. `AuditLogEntry`: `{ id, actorType, actorId, actorEmail, actorName, category, action, entityType, entityId, outcome, errorMessage, changes, metadata, ipAddress, userAgent, severity, createdAt }`.
- Produces: a timeline-style ledger preserving filter/sort/export/pagination and the expandable detail row.

- [ ] **Step 1: Rebuild as a timeline ledger (not a dense inline-table log)**

Replace the `react-icons/fi` + raw-hex dense `<table>` with a timeline layout: a vertical rail (`border-l border-border`) with a mono timestamp per entry; each row shows actor (`Badge` by `actorType`, + `actorName`) · action verb (`Badge` neutral) · entity (`entityType` + truncated `entityId` mono) · outcome (`Badge` success/danger) · severity (Warning/Error → phosphor `Warning`/`WarningCircle` + tone, INFO → subtle). The expandable detail (`expandedId`) keeps the JSON `changes`/`metadata`/`errorMessage`/`userAgent` in a `pre` on `bg-surface-1 border-border`.

- [ ] **Step 2: Keep filters, export, pagination — token-native**

Migrate the filter selects to the `Select` kit (Semua Actor, Kategori, Outcome, Severity, Entity), search + `from`/`to` date inputs to `Input` kit, Reset to a ghost `Button`. Keep CSV/JSON export as ghost `Button`s (`DownloadSimple`). Pagination → kit buttons with mono page count. Loading → timeline skeleton rows; empty → "Belum ada audit log" with an icon, token-native.

- [ ] **Step 3: Verify and commit**

Run `npx tsc --noEmit`, scoped ESLint. Commit:

```bash
git add app/admin/audit-trail/page.tsx
rtk git commit -m "feat(ui): audit trail - ledger timeline, filter/export token"
```

---

## Task 6: Global analytics — site-accent comparison (§6.5)

**Files:**
- Modify: `app/admin/global-analytics/page.tsx`

**Interfaces:**
- Consumes: existing `GET /api/sites` (SuperAdmin - all sites, with `primaryColor`) + per-site `GET /api/sites/{id}/health` (`metrics.totalAnnouncements/publishedAnnouncements/totalViews/totalCategories`, and `userAccess` where present). The N+1 fetch pattern is preserved (no API change).
- Produces: a masthead-comparison strip + grouped bar chart across sites, token-native.

- [ ] **Step 1: Replace Feather + raw hex global stat cards**

Drop `react-icons/fi` (FiArrowLeft/FiGlobe/FiFileText/FiUsers/FiEye/FiTrendingUp/FiBarChart2/FiRefreshCw/FiPieChart) → Phosphor (`ArrowLeft`, `Globe`, `FileText`, `Users`, `Eye`, `TrendUp`, `ChartBar`, `ArrowClockwise`, `ChartPie`). Global stat cards → `StatTile` layout (Sites, Articles, Total Views, Categories, Users), accents neutral; `Comment` the fact that this page is SuperAdmin/cross-site so `--site-primary` is not the singular accent here — use each site's `primaryColor` per-card. Back button + Refresh → ghost `Button` (`ArrowLeft`, `ArrowClockwise`).

- [ ] **Step 2: Masthead comparison — color-dotted strip + grouped bar chart**

Per the spec §6.5: a compact color-dotted strip per site (swatch `primaryColor`, name, `/site/{slug}`, mono headline numbers) + a grouped bar chart across sites (site accent = `primaryColor` per bar; `<BarChart>` with `<Bar>` per metric, or a single vertical comparison). Use `getChartTheme()` for grid/tick/tooltip, each `<Cell>`/`<Bar>` filled with the site's `primaryColor`. Keep the card link → `/admin/sites/{id}` with `hover` raise. Tokenize card shells (`bg-surface-1 border-border rounded-card`). Empty state (`tidak ada situs`) token-native.

- [ ] **Step 3: Verify and commit**

Run `npx tsc --noEmit`, scoped ESLint. Commit:

```bash
git add app/admin/global-analytics/page.tsx
rtk git commit -m "feat(ui): global analytics - perbandingan masthead, bar chart site-accent"
```

---

## Task 7: Phase 3 integration pass + static audit

**Files:**
- Modify: all Phase 3 files for remaining token/motion drift
- Modify: `components/ui/Table.tsx` only if a confirmed gap (e.g. missing empty-state slot) appears during ledgers

**Interfaces:**
- Consumes: nothing new. Cleans up residuals.

- [ ] **Step 1: Static audit of Phase 3 files**

Grep new/migrated Phase 3 files for `react-icons/fi`, raw hex colors (outside `primaryColor`/`color`/DB data), `style={{` chrome, dead handlers, missing labels, and uncontained wide tables (`overflow-x-auto` only around the table). Fix each hit.

- [ ] **Step 2: Add empty/loading/error parity check**

Confirm every Phase 3 surface (analytics, sites, users, audit-trail, global-analytics) has: a loading skeleton, an empty state with a clear message, and no color-only signals (every status has icon + text). Add any missing ones.

- [ ] **Step 3: Full gates**

Run `npx tsx scripts/check-chart-theme.ts`, `npx tsc --noEmit`, and `npm run lint`. Record known pre-existing warnings only (portal `<img>`, `SiteHero` unused vars, `SiteHealthCard` `primaryColor` dead prop).

- [ ] **Step 4: Commit**

```bash
git add components/admin/AnalyticsDashboard.tsx app/admin/sites app/admin/users app/admin/audit-trail app/admin/global-analytics components/ui/Table.tsx lib scripts
rtk git commit -m "chore(ui): audit integrasi data surfaces fase 3"
```

---

## Self-Review

**Spec coverage:**
- §6.1 chart language (line/bar/donut, masthead accent, legends/tooltips, empty+loading) → Tasks 1–2, 6.
- §6.2 KPI stat tiles (big mono number + delta, mailbox headline reading, danger delta) → Task 1 (`StatTile`) + Task 2.
- §6.3 ledger tables (Sites, Users; sortable `aria-sort`, mono numerals, filter/pagination) → Tasks 3–4 (admin desks), reusing the `Table` kit.
- §6.4 audit trail timeline ledger + actor/type/date filter + export → Task 5.
- §6.5 Global Analytics masthead comparison (color-dotted strip + grouped bar) → Task 6.
- §6.6 deliverable (chart components, StatTile, sortable Table, audit timeline, global comparison, consistent states) → Tasks 1–7.
- Deferred Phase 1/2 residuals (motion tokens, theme toggle) are already complete in Phase 2 — not re-opened.

**Intentional scope decisions:**
- No delta queries invented (StatTile `delta` optional; analytics API has no previous-period source — omitted).
- Portal ledgers (portal-sessions/audit/users/groups), auth frames, portal grid are **Phase 4** per the spec sequence — excluded.
- Sites stays a card grid, not a ledger table: §6.3 lists several desks but the Sites desk's existing card-with-health layout is preserved and tokenized (changing it to a dense table would drop the health metrics). Deliberate.
- No new chart library, state store, or data model. Recharts stays.

**Placeholder scan:** no TBD/TODO; each task names files, interfaces, behaviors, verification, commit boundaries.

**Type consistency:** `getChartTheme()`, `StatTile`, and `ChartTooltip` are defined once in Task 1 and consumed by Tasks 2 and 6; existing `TableColumn`/`sort`/`onSort` and API shapes are preserved.
