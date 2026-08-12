# SJA Announcement Dashboard — Full UI/UX Rework Design

**Date:** 2026-08-12
**Status:** Approved (design sections 1–5 signed off)
**Approach:** A — "Tokenize then migrate" (design system first, then workstream-by-workstream migration)

---

## 1. Context & Current State

The app is a multi-tenant announcement CMS (Santos Jaya Abadi / Kapal Api): Next.js 15 App Router, React 19, PostgreSQL via Prisma 5, NextAuth, Tailwind v3, TipTap, recharts. It has an admin panel for editors/super-admins (`/admin/*`) and a portal SSO layer (`/portal`, `/portal-login`) with form-based credential forwarding.

**Audit findings (current fingerprint):**
- Flat pure-black theme (`#000000` bg, `#0a0a0a`/`#1a1a1a` cards) with one generic brand red (`#ED1C24`)
- No design tokens in active use — components use inline `style={{}}` (the `AdminSidebar` is ~100% inline)
- Typography: Inter (body) + Montserrat (headings); icons: `react-icons/fi` (Feather)
- Mixed radius values (4/6/8px) inline
- ALL-CAPS nav labels in the sidebar
- **Per-site `primaryColor` + `SiteThemeProvider` exist but are used only on the public site — the admin ignores them**
- A live clock already exists in the sidebar but is underpowered as a design element
- Accessibility wins present: skip-link, global `prefers-reduced-motion` reduce block, `:focus-visible` red outline, `sr-only`

## 2. Identity Model

**"One newsroom, many mastheads."** The app is a publishing house.

- **The Newsroom (app-wide):** the stable shell — calm, professional, paper (light) or night edition (dark).
- **The Masthead (per-site):** the active `Site`'s identity — its `primaryColor`, name, slug. Tints accents, active nav, focus rings, charts, and the masthead bar. Switching sites re-tints the room; the shell never changes.
- **The Byline (per-user):** user identity, roles, session, audit trail.

**Audience:** internal editors (need speed + legibility) AND client-facing demos (need premium + on-brand). Both themes carry this.

**Depth:** visual + shell overhaul. Routes, data flow, and information architecture are preserved. The upgrade is chrome, shell, and a shared design system — not new behaviors.

## 3. Design System (Foundation)

### 3.1 Token architecture

Semantic CSS variables mapped into Tailwind. Both themes defined from the same token set.

```
:root / .theme-light   — paper tokens
.dark / .theme-dark    — night tokens
--site-primary         — masthead accent, injected by SiteThemeProvider
```

| Token | Paper (light) | Night (dark) |
|---|---|---|
| `--surface-0` | `#F7F6F3` | `#09090B` |
| `--surface-1` | `#FFFFFF` | `#111113` |
| `--surface-2` | `#EDEBE6` | `#18181B` |
| `--surface-3` | `#E4E1DA` | `#27272A` |
| `--border` | `#E0DDD5` | `#27272A` |
| `--text-1` | `#1C1917` | `#FAFAFA` |
| `--text-2` | `#57534E` | `#A1A1AA` |
| `--text-3` | `#8A857E` | `#71717A` |
| `--accent` | `#ED1C24` default, overridden by `--site-primary` | same |

Plus: semantic status tokens (`success`/`warning`/`danger`/`info`), one radius scale (controls 6px, cards 8px, sheets 12px, accent bars 2px), spacing scale (4/8/16/24/32/48), shadows tinted to background hue (no pure-black drop shadows in light mode).

### 3.2 Typography

| Role | Font |
|---|---|
| Display / masthead / headings | **Sora** (or Space Grotesk), 600–700 |
| Body / UI | **Inter** (keep) |
| Numbers / IDs / clocks / counts / timestamps | **JetBrains Mono** (or Fira Code), `tabular-nums` |

Loaded via `next/font`. One type scale (12/13/14/16/20/24/32/40). Headings `tracking-tight`, body line-height 1.6.

### 3.3 Icons

Swap `react-icons/fi` → **Phosphor** (`@phosphor-icons/react`). One family. `weight="regular"` for UI, `weight="duotone"` for masthead/brand moments. Sizes: 16px nav / 20px actions / 24px empty states.

### 3.4 Motion tokens

150–300ms micro-interactions, `cubic-bezier(0.16, 1, 0.3, 1)`, transform/opacity only, exits faster than enters, `prefers-reduced-motion` honored globally.

### 3.5 Dark/light parity

Both themes from the same token set, contrast-tested independently (AA: body ≥4.5:1, large ≥3:1). Masthead color keeps identity in both modes.

### 3.6 Deliverable

- `app/globals.css` rewritten around semantic tokens
- Tailwind config mapped to tokens (`bg-surface-1`, `text-text-2`, `border-border`, accent = `--site-primary`)
- Tiny `ui/` kit: Button, Card, Badge, Input, Select, Table, Dropdown
- `SiteThemeProvider` extended to drive `--site-primary` in the admin shell (not just the public site)

## 4. Navigation & Shell

### 4.1 Layout

- **Left sidebar** — icon rail (~64px) expanding to ~240px, grouped by workstream:
  - **Kantor (Workspace):** Dashboard, Announcements, Categories, Media, Comments
  - **Terbit (Publish):** per-site content work, marked by the active masthead color
  - **Saluran (Channels):** Sites, Users, Portal (Apps/Groups/Users/Sessions/Audit), Global Analytics
  - **Sistem (System):** Sessions, Email, Newsletter, Settings, Audit Trail
  - Group headers, sentence case (no ALL-CAPS). Collapse persisted per user.
- **Topbar (masthead bar):** page title + breadcrumb; global search (Ctrl+K); the **channel strip** (active site dot + name); live clock (promoted to a design element); notifications/activity bell; user menu (avatar, roles, logout).
- **Command palette (Ctrl+K):** search over actions ("Buat pengumuman baru"), content (jump to an announcement), sites (switch masthead). Keyboard-driven, both themes, reduced-motion aware.
- **Site switcher (masthead rack):** replaces the plain `SiteSelector` dropdown — each site shows color swatch, name, slug, and live counts (posts live/scheduled). Switching re-tints via the Section 3 token and reloads context (same mechanics as today).
- **Responsive:** mobile hamburger → sidebar slide-over; topbar condenses to title + site dot + search. No regression at 375px.
- **Accessibility:** visible focus states using masthead accent, skip link (exists), `aria-current`, `aria-expanded`, labeled icon buttons, keyboard nav order matches visual order.

### 4.2 Deliverable

- Restyled `AdminSidebar` (grouped, sentence case, Phosphor, token-driven, collapse)
- New `Topbar` (breadcrumb + channel strip + search + clock + user menu)
- `SiteSelector` → masthead rack with counts
- Ctrl+K command palette
- Responsive collapse rules at `sm/md/lg`

## 5. Content & Editing Workflow

### 5.1 Announcement list (the "news desk")

- **Ledger list** (not a card wall): rows with status pill, title, category, primary site, author, word count, updated time.
- **Status pills as a publishing language** (color + icon, never color alone):

| State | Color | Icon |
|---|---|---|
| Draf | neutral | ✎ |
| Terjadwal | amber | clock |
| Terbit | success | broadcast |
| Diturunkan | neutral/subtle | square |
| Perlu Persetujuan | blue | flag |

- **Filter bar:** status, category, site, author + keyword search + result counts.
- **Bulk actions:** select → batch publish/schedule/delete (with confirm). Restyled `BulkActionBar`.
- **Empty state:** editorial "nothing on the desk" + "Buat pengumuman" action.
- **Loading:** skeleton rows matching the ledger shape.

### 5.2 Announcement editor (the "desk")

- Two-pane composer: fields left, live **preview pane** right (desktop) showing the announcement on the active masthead.
- TipTap toolbar restyled to the kit (sticky, grouped: format / insert / align); bubble menu matches.
- **Masthead context:** shows which site(s) the announcement publishes to (`AnnouncementSite` junction), primary site's color chip.
- Publish controls at top: Draf / Terjadwal (pick `scheduledAt`) / Terbit now + primary-site selector; approval-needed banner when `ApprovalRequest` pending.
- Word count + reading time as a small mono stat line.

### 5.3 Categories & Media

- **Categories:** same ledger style as announcements (rows: slug, count, actions).
- **Media:** gallery grid (restyled `MediaPickerModal`) — thumbnails with selection checkmarks, upload dropzone, empty state; picker feels like a lightbox, not a file dialog.

### 5.4 Comments moderation

- Moderation desk: status filter (pending/approved/spam), inline approve/reject with undo-able toasts, nested threading restyled.

### 5.5 Newsletter / Email

- Template list + editor restyled to the kit; email settings match.

### 5.6 States

- Form errors below fields, inline validation on blur, disabled at reduced opacity, toasts auto-dismiss + undo for destructive bulk actions.

### 5.7 Deliverable

- `AnnouncementsList` → news-desk ledger + filter bar + status pills + bulk bar
- `AnnouncementForm` → two-pane composer + preview + masthead chip + publish controls
- Status pill component added to `ui/`
- Categories list, Media picker, Comments moderation, Newsletter/Email restyled
- Consistent empty/loading/error across all

## 6. Analytics & Data Surfaces

### 6.1 Chart language (recharts)

- Trends → line/area; comparisons → bar; proportions → 1 donut max. No 3D, no decorative gradients.
- **Active masthead accent = primary series color** (`--site-primary`); other series neutral (`#52525B`-ish) with one contrast series.
- Legends always visible near the chart. Gridlines `--border`. Tooltips styled to shell, mono numerals, keyboard-reachable.
- Empty state ("Belum ada data untuk rentang ini" + range picker), loading skeleton.

### 6.2 KPI stat tiles

- **Headline stats:** big mono number + delta, label, 16px icon. Reading like a newspaper headline. Sparse dividers, not card boxes.
- Delta `+12%` vs previous period with up/down icon; negative in danger color (with icon).

### 6.3 Data tables (Sites, Users, Portal, Audit, Global Analytics)

- **Ledger tables** — same family as the news desk: clean rows, sparse borders, sortable columns with `aria-sort`, mono numerals in numeric columns, hover row highlight.
- Filter bar (keyword, status, role, site). Pagination restyled; per-page counts.
- Virtualize/paginate at 50+ rows.

### 6.4 Audit trail

- Timeline-style ledger (not a dense log): each row = timestamp (mono), actor, action verb, affected entity. Filter by actor/type/date. Export preserved.

### 6.5 Global Analytics (multi-site)

- **Masthead comparison:** each site's headline stats in a compact color-dotted strip + grouped bar chart across sites.

### 6.6 Deliverable

- Chart components (LineArea, Bar, Donut) on recharts, token-driven, site-accent aware
- KPI `StatTile` (big mono number + delta)
- Sortable ledger `Table` kit component
- Audit trail → timeline ledger
- Global Analytics → masthead comparison
- Consistent empty/loading/error

## 7. Portal & Auth Screens

### 7.1 Auth screens (the "press room" doors)

- Shared auth frame: brand mark, app name, centered card on paper/night shell. Masthead-neutral, uses default brand red accent.
- Same token system → inherits both themes. Existing flows/session/validation preserved (chrome only).
- Error/loading states on the auth card (inline invalid-credentials, not a toast on a blank page).

### 7.2 Portal app grid (the "channel rack")

- Each portal app as a **launch card**: app logo/icon, name, description, "Buka" affordance. Each app is a channel you can enter.
- Restyled to the kit, paper/night aware, hover raise, keyboard-navigable, focus states. SSO launch uses existing form-forwarding (no behavior change).
- Grid density responsive: 2/3/4 columns by breakpoint.

### 7.3 Portal sessions & audit

- Sessions ledger (table kit), audit timeline (same family as admin audit trail).

### 7.4 Portal users & groups

- Ledger tables. Permission/RBAC display as readable badges, not raw strings.

### 7.5 Deliverable

- Auth frame (admin-login, portal-login)
- Portal app grid launch cards
- Portal sessions/audit/users/groups ledgers

## 8. Sequence (Approach A)

1. **Phase 0 — Design system foundation:** tokens, globals.css, Tailwind mapping, `ui/` kit, SiteThemeProvider extension. Everything else depends on this.
2. **Phase 1 — Shell:** sidebar, topbar, masthead rack, command palette, responsive.
3. **Phase 2 — Content desk:** announcement list + editor, status pills, categories, media, comments, newsletter/email.
4. **Phase 3 — Data surfaces:** charts, KPI stat tiles, ledger tables, audit trail, global analytics.
5. **Phase 4 — Portal & auth:** auth frames, portal grid, portal ledgers.

Each phase is a self-contained shippable slice. No long dark period; every step is testable.

## 9. Non-Goals (preserved)

- Route slugs and information architecture
- Indonesian UI language
- Brand red as the default accent (the site tint is an extension, not a replacement)
- Existing accessibility wins (skip link, reduced-motion, focus-visible, sr-only)
- Data model, auth, SSO, scheduler, audit logic — no behavior changes