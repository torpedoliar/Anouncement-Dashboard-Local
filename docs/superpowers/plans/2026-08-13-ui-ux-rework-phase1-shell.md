# Phase 1: Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin navigation & chrome — grouped/collapsible sidebar, masthead topbar with breadcrumb + site channel strip + live clock + user menu, masthead rack replacing the plain `SiteSelector`, Ctrl+K command palette, responsive rules — all on the Phase 0 token system.

**Architecture:** The shell is a set of independent components (sidebar, topbar, rack, palette, clock) composed in `app/admin/layout.tsx`, all consuming the Phase 0 `components/ui/` kit and semantic tokens. `SiteThemeProvider` + `AdminSiteThemeProvider` mount the masthead accent. Nav data becomes a single declarative source shared by the sidebar and the command palette.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v3 (3.4.19), TypeScript, `@phosphor-icons/react` (2.1.10), existing `components/ui/` kit, NextAuth, Prisma (for rack counts).

## Global Constraints (from spec §3-4 + this repo's standing rules)

- **Design system:** all colors/typography/shadows via Phase 0 tokens (`bg-surface-*`, `text-text-*`, `border-border`, `bg-accent`, `rounded-control/card/sheet`, `shadow-lvl-*`). NO inline `style={{}}` chrome, NO raw hex in components. Existing pages may keep tokens (aliases) but the shell is token-native.
- **Masthead accent:** the active site's `primaryColor` tints accents, active nav, focus rings. It is DRIVEN by `SiteThemeProvider` (already injects `--site-primary*`), NOT re-implemented. The kit's `accent` utilities already resolve via `--site-primary` (Task 5 wiring).
- **One newsroom, many mastheads** (spec §2): the shell chrome never changes per-site; only the accent tint + channel strip content does.
- **Typography (spec §3.2):** Sora for display/masthead/headings (`font-display`), Inter body, JetBrains Mono for numerals/clock/counts (`font-mono`, `tabular-nums`).
- **Icons (spec §3.3):** Phosphor only (`@phosphor-icons/react`). `weight="regular"` for UI nav, `weight="duotone"` for masthead/brand moments. Weight 16/20/24px scale. NEVER `react-icons/fi` in new shell code.
- **Motion (spec §3.4):** 150–300ms micro-interactions, `cubic-bezier(0.16,1,0.3,1)`, transform/opacity only, exits faster than enters, `prefers-reduced-motion` honored (global reduce block already in globals.css).
- **Copy (spec §4.1):** nav group headers + labels SENTENCE CASE in Indonesian (no ALL-CAPS: "Dashboard", "Kantor", "Terbit", "Saluran", "Sistem"). Page titles sentence case.
- **Accessibility (spec §4.1):** visible focus states using masthead accent (`focus-visible:outline-2 outline-offset-2 outline-accent`), `aria-current="page"` on active nav, `aria-expanded` on expandables, labeled icon buttons, keyboard nav order matches visual order.
- **Responsive (spec §4.1):** sidebar icon-rail ~64px → expands ~240px; mobile hamburger → slide-over; no regression at 375px. Topbar condenses on mobile (title + site dot + search).
- **Verification gates on this machine:** `npx tsc --noEmit` + `npx eslint <files>` are the gates. `npm run build` FAILS pre-existing (empty NEXTAUTH_URL — do NOT fix); `npm run dev` cannot render routes (pre-existing global `localStorage.getItem is not a function` + local Postgres down). Review component code + class strings statically. Tailwind stays v3; do not touch `postcss.config.mjs`.
- **Commits:** Indonesian messages, one self-contained change per commit; commit ONLY the files the task touches.
- **No behavior changes** beyond chrome/drift fixes listed per task: routes, IA, auth, SSO, scheduler, data flow preserved.

---
## Task 1: Shared nav model + admin layout shell wiring

**Files:**
- Create: `lib/admin-nav.ts`
- Modify: `app/admin/layout.tsx`

**Interfaces:**
- Consumes: Phase 0 `AdminSiteThemeProvider` (`components/admin/AdminSiteThemeProvider.tsx`, default export, server component).
- Produces: `AdminNavItem` type + `adminNavGroups` array — the SINGLE source of nav truth consumed by the sidebar (Task 2) and the command palette (Task 4).

- [ ] **Step 1: Create the nav model (`lib/admin-nav.ts`)**

```ts
import type { Icon } from "@phosphor-icons/react";

export interface AdminNavItem {
  href: string;
  label: string;        // sentence case Indonesian ("Dashboard")
  icon: Icon;           // Phosphor icon component
  superAdminOnly?: boolean;
}

export interface AdminNavGroup {
  id: string;
  title: string;        // planner: "Kantor", "Terbit", "Saluran", "Sistem"
  items: AdminNavItem[];
}

// Phosphor icons mapped for each route (regular weight)
export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "workspace",
    title: "Kantor",
    items: [
      { href: "/admin", label: "Dashboard", icon: Icon.Home },
      { href: "/admin/announcements", label: "Pengumuman", icon: Icon.FileText },
      { href: "/admin/announcements/new", label: "Buat Baru", icon: Icon.PlusCircle },
      { href: "/admin/categories", label: "Kategori", icon: Icon.Tag },
      { href: "/admin/media", label: "Media", icon: Icon.Image },
      { href: "/admin/comments", label: "Komentar", icon: Icon.MessageCircle },
    ],
  },
  {
    id: "publish",
    title: "Terbit",
    items: [
      // Per-site content entrypoints live under Terbit, marked by masthead color
      { href: "/admin/analytics", label: "Analytics", icon: Icon.ChartLine },
    ],
  },
  {
    id: "channels",
    title: "Saluran",
    superAdminOnly: true, // groups-level flag applied to ALL items
    items: [
      { href: "/admin/sites", label: "Sites", icon: Icon.Globe },
      { href: "/admin/users", label: "Pengguna", icon: Icon.Users },
      { href: "/admin/portal-apps", label: "Portal Apps", icon: Icon.GridFour },
      { href: "/admin/portal-groups", label: "Portal Groups", icon: Icon.UsersThree },
      { href: "/admin/portal-users", label: "Portal Users", icon: Icon.UserPlus },
      { href: "/admin/portal-sessions", label: "Portal Sesi", icon: Icon.Monitor },
      { href: "/admin/portal-audit", label: "Portal Audit", icon: Icon.ShieldCheck },
      { href: "/admin/global-analytics", label: "Global Analytics", icon: Icon.PieChart },
      { href: "/admin/audit-trail", label: "Audit Trail", icon: Icon.Scroll },
    ],
  },
  {
    id: "system",
    title: "Sistem",
    items: [
      { href: "/admin/sessions", label: "Sesi", icon: Icon.Key },
      { href: "/admin/email", label: "Email", icon: Icon.Envelope },
      { href: "/admin/newsletter", label: "Newsletter", icon: Icon.PaperPlane },
      { href: "/admin/settings", label: "Pengaturan", icon: Icon.Gear },
    ],
  },
];

// Active nav item for a pathname (used by sidebar + palette)
export function findActiveAdminItem(pathname: string, groups = adminNavGroups, isSuperAdmin = false): AdminNavItem | null {
  for (const group of groups) {
    if (group.superAdminOnly && !isSuperAdmin) continue;
    for (const item of group.items) {
      if (pathname === item.href) return item;
    }
  }
  return null;
}
```

Note for implementer: use `import { Icon } from "@phosphor-icons/react"` — the actual icon names to use (`Icon.Home`, `Icon.FileText`, etc.) must be verified against `@phosphor-icons/react`. If a name differs (e.g. `Icon.UsersThree`), use the closest real Phosphor export.

- [ ] **Step 2: Typecheck the model**

Run: `npx tsc --noEmit`
Expected: PASS (fix any Phosphor icon-name mismatches).

- [ ] **Step 3: Wire `AdminSiteThemeProvider` into the admin layout**

Modify `app/admin/layout.tsx`: wrap the existing `<AdminLayout>` body (the flex container) with `<AdminSiteThemeProvider>`. Keep `NextAuthProvider` outermost. The provider is a server component; it resolves the admin's active site and drives `--site-primary`.

```tsx
return (
    <NextAuthProvider basePath="/api/auth">
        <AdminSiteThemeProvider>
            <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex' }}>
                {/* Phase 1 sidebar replaces this next task */}
                {children}
            </div>
        </AdminSiteThemeProvider>
    </NextAuthProvider>
);
```

(Other parts of layout: `AdminSidebar`, `AdminMainContent`, `UpdateBanner` stay as-is in this task — Task 2 restyles the sidebar.)

- [ ] **Step 4: Commit**

```bash
git add lib/admin-nav.ts app/admin/layout.tsx
git commit -m "feat(ui): model navigasi bersama + pasang AdminSiteThemeProvider ke shell admin"
```

---
## Task 2: Grouped, collapsible, token-native sidebar

**Files:**
- Rewrite: `components/admin/AdminSidebar.tsx`
- Modify: (none — layout already renders `<AdminSidebar>`)

**Interfaces:**
- Consumes: `adminNavGroups`, `findActiveAdminItem` (`@/lib/admin-nav`); Phosphor icons; `"use client"`.
- Produces: the sidebar nav used by every admin route. Collapse state persisted per user: `localStorage` key `adminSidebarCollapsed`.

- [ ] **Step 1: Rewrite `AdminSidebar.tsx` as a token-native component**

Replace the inline-style chrome with the Phase 0 classes. Keep its current behavior: user info + logout (`signOut`), mobile hamburger + backdrop + slide-over, active-route highlight. Changes:
- Icon rail: width `w-16` (64px) collapsed → `w-60` (240px) expanded. Toggle button glows with accent on hover/focus.
- Groups rendered from `adminNavGroups` (skip groups whose items are all hidden for non-superadmin). Group headers `text-xs text-text-3 uppercase tracking-wider` → but spec says SENTENCE case — use sentence case ("Kantor", "Terbit", "Saluran", "Sistem").
- Active item: `bg-accent/10 text-accent` + left `border-l-2 border-accent`; `aria-current="page"`.
- Icons: Phosphor, size 20 collapsible / 16 when collapsed, `weight="regular"`.
- Monospace clock: existing live clock restyled `font-mono tabular-nums text-sm`, date `text-xs text-text-3`, accent dot separator.
- Logout stays at bottom: `Button` variant `ghost` size `sm` with `SignOut` icon.
- Collapse persisted: `localStorage.setItem('adminSidebarCollapsed','1'|'0')`; init from that key (default expanded). On mobile, always expanded-as-overlay (ignore persisted collapsed).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` then `npx eslint components/admin/AdminSidebar.tsx`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add components/admin/AdminSidebar.tsx
git commit -m "feat(ui): sidebar token - grup navigasi, collapsible, ikon Phosphor, jam mono"
```

---
## Task 3: Masthead topbar (breadcrumb + channel strip + live clock + user menu)

**Files:**
- Create: `components/admin/AdminTopbar.tsx`
- Modify: `app/admin/layout.tsx` (render `<AdminTopbar>` inside main content area)

**Interfaces:**
- Consumes: `findActiveAdminItem` (`@/lib/admin-nav`) for breadcrumb; `useSiteTheme` (`@/components/SiteThemeProvider`) for the active site dot + name; Phosphor icons; `"use client"`.
- Produces: the topbar rendered at the top of every admin page (below the sidebar, above page content).

- [ ] **Step 1: Create `AdminTopbar.tsx`**

Structure (all token classes):
- Container: `sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface-0 px-4 md:px-6`.
- Left: **breadcrumb** — `findActiveAdminItem(pathname)` → render label (sentence case). When none (e.g. `/admin/sites/new`), use `pathname.split('/').pop()` title-cased. Render as `text-sm font-medium text-text-1`.
- Center: **channel strip** — from `useSiteTheme()`: a small dot `h-2 w-2 rounded-full` colored `var(--site-primary)`, site name `text-sm font-medium`, and the site slug `text-xs text-text-3 font-mono`. Hidden below `md`.
- Right: **live clock** (`font-mono tabular-nums text-sm text-text-2`), **user menu** — avatar circle (initial), name/email, and a `Dropdown` (from `components/ui/Dropdown`) with items: "Profil", "Pengaturan", separator, "Keluar" (danger, calls `signOut({ callbackUrl: '/admin-login' })`).
- The topbar must be `"use client"` (uses `usePathname` + `useSiteTheme` + clock state).

- [ ] **Step 2: Render topbar in layout**

In `AdminMainContent`, before `{children}` render `<AdminTopbar />`. Layout stays server component (`AdminTopbar` is client). Pass no props (it self-resolves).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` then `npx eslint components/admin/AdminTopbar.tsx`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminTopbar.tsx app/admin/layout.tsx
git commit -m "feat(ui): topbar masthead - breadcrumb, channel strip site aktif, jam live, user menu"
```

---
## Task 4: Ctrl+K command palette

**Files:**
- Create: `components/admin/CommandPalette.tsx`
- Modify: `app/admin/layout.tsx` (mount `<CommandPalette />` once, sibling to sidebar)

**Interfaces:**
- Consumes: `adminNavGroups` (`@/lib/admin-nav`); Phosphor icons (`MagnifyingGlass`, navigation icons); `"use client"`.
- Produces: global Ctrl+K / Cmd+K palette over actions + content + sites. Action item type shared with nothing (self-contained).

- [ ] **Step 1: Create `CommandPalette.tsx`**

Behavior (spec §4.1: "Ctrl+K: search over actions ('Buat pengumuman baru'), content (jump to an announcement), sites (switch masthead)"):
- Global key listener (`useEffect`): intercept `(e.ctrlKey || e.metaKey) && e.key === 'k'` → `e.preventDefault()`, toggle open.
- Overlay: `fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[18vh]`, `onClick` closes when clicking backdrop.
- Panel: `w-full max-w-xl rounded-sheet border border-border bg-surface-1 shadow-lvl-3 p-2`.
- Search input: Phosphor `MagnifyingGlass` size 20 + `Input` (kit) styled `border-0 bg-transparent` — full-width, placeholder "Cari aksi, konten, atau site…".
- Results list (filter by `query` lowercase `includes`):
  - **Actions:** fixed set `[{label:"Buat pengumuman baru", href:"/admin/announcements/new", icon:Icon.PlusCircle}, {label:"Buka Dashboard", href:"/admin", icon:Icon.Home}]` + each `adminNavGroups` item (label + href + icon).
  - **Content:** fetch not needed in this phase — show a placeholder row "Cari di daftar pengumuman…" linking to `/admin/announcements`.
  - **Sites:** show "Beralih site…" linking to `/admin/sites` (full rack selection lands in Task 5).
- Keyboard: `ArrowUp`/`ArrowDown` move `activeIndex`, `Enter` navigates (`router.push`), `Escape` closes. Focus trap not required (keep simple).
- Reduced motion respected (global reduce block already handles).

- [ ] **Step 2: Mount in layout**

In `app/admin/layout.tsx` add `<CommandPalette />` inside the outermost fragment (sibling of the flex container), so it overlays everything.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` then `npx eslint components/admin/CommandPalette.tsx`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add components/admin/CommandPalette.tsx app/admin/layout.tsx
git commit -m "feat(ui): command palette Ctrl+K - aksi navigasi, pencarian konten/site"
```

---
## Task 5: Masthead rack (replaces `SiteSelector`) + `/api/sites` extension

**Files:**
- Create: `components/admin/MastheadRack.tsx`
- Modify: `app/api/sites/route.ts` (GET — add `primaryColor` + live counts)
- Modify: `components/admin/AdminSidebar.tsx` (replace `<SiteSelector />` with `<MastheadRack placement="sidebar" />`)
- Delete: `components/admin/SiteSelector.tsx`

**Interfaces:**
- Consumes: existing `fetch('/api/sites')` (extended in this task); the site context cookie sync flow (`POST /api/context`); `"use client"`.
- Produces: `<MastheadRack placement="sidebar">` — each site = color swatch + name + slug + live counts (posts live/scheduled). Re-tints via `SiteThemeProvider` (accent follows the chosen site).

- [ ] **Step 1: Verify `GET /api/sites` already returns what the rack needs (NO code change expected)**

Read `app/api/sites/route.ts`. It uses `include` (NOT `select`), so all Site scalars — including `primaryColor` — are returned by default (Prisma includes scalar fields unless `select` restricts them). The `_count` already includes `announcementSites` (total syndications — our count proxy; vs live/scheduled = Phase 2 when scheduler-surfaces honesty lands). If `primaryColor` or `_count.announcementSites` is confirmed present, make NO edit and note that in the report. Only if you find it genuinely missing, add `primaryColor: true` to the root `select`/`include`.

- [ ] **Step 2: Create `MastheadRack.tsx`**

Renders the active site as a chip + a rack (grid of all sites) toggled by click. Reuses the SiteSelector session logic (fetch `/api/sites`, pick active from `localStorage.getItem('currentSiteId')` → `isDefault` → first, `POST /api/context`, reload on change). Layout:
- Trigger chip: swatch (rounded, `style={{ background: site.primaryColor || 'var(--site-primary)' }}`), site name `text-sm font-medium`, `CaretDown` icon.
- Rack panel: `grid grid-cols-1 gap-1` list; each site row: swatch 24px, name `text-sm`, slug `text-xs text-text-3 font-mono`, check icon on active. Hover `bg-surface-2`. `aria-expanded` on trigger.
- Uses Phosphor (`Globe`, `CaretDown`, `Check`, `Broadcast`).
- `placement` prop: `"sidebar"` (compact single-column) — keep one variant only (spec's shell has the rack in the topbar channel strip; the sidebar keeps the compact trigger+dropdown).

- [ ] **Step 3: Swap into sidebar, delete old selector**

In `AdminSidebar.tsx`, replace the `<SiteSelector />` import/usage block (Site Selector section) with `<MastheadRack placement="sidebar" />`. Delete `components/admin/SiteSelector.tsx`.

- [ ] **Step 4: Typecheck + lint + grep for dead imports**

Run: `npx tsc --noEmit`, `npx eslint components/admin/MastheadRack.tsx components/admin/AdminSidebar.tsx`
Run: `grep -rn "SiteSelector" app components pages` — expect NO matches (besides comments).
Expected: PASS all.

- [ ] **Step 5: Commit**

```bash
git add app/api/sites/route.ts components/admin/MastheadRack.tsx components/admin/AdminSidebar.tsx
git rm components/admin/SiteSelector.tsx
git commit -m "feat(ui): masthead rack ganti SiteSelector - swatch warna, slug, counts, tint aktif"
```

---
## Task 6: Responsive rules + final shell verification

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`, `components/admin/AdminTopbar.tsx`, `components/admin/MastheadRack.tsx`, `components/admin/AdminMainContent.tsx` (responsive class adjustments)
- Modify: (none new)

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: a fully responsive shell verified against the gates.

- [ ] **Step 1: Responsive class pass (no behavior change)**

Apply across the shell components:
- Sidebar: `hidden lg:flex` for desktop; mobile overlay + hamburger preserved (keep existing mobile open/close logic). Collapse state only affects `lg+`.
- Topbar: breadcrumb + channel strip (site dot+name). On `max-md` hide channel strip entirely (`hidden md:flex`), keep title + search + clock.
- MainContent: margin-left `lg:ml-60` when expanded, `lg:ml-16` when collapsed, `ml-0` on mobile (existing behavior preserved). Readcollapse state from `localStorage` key `adminSidebarCollapsed`.
- MastheadRack: sidebar placement full-width; ensure `min-w-0` on rows so long site names ellipsize (`truncate`).

- [ ] **Step 2: Full typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: both PASS (72 pre-existing warnings in unrelated files; zero new in `components/ui`, `components/admin/*(this phase)`, `app/admin/*`).

- [ ] **Step 3: Static shell audit (no dev server available)**

Manually review each shell component's class strings for: (a) token use (no raw hex / hardcoded colors), (b) a11y (`aria-current`, `aria-expanded`, focus-visible rings), (c) sentence-case Indonesian labels (no ALL-CAPS), (d) Phosphor only (no `react-icons/fi` in new files). List any drift in the task report.

- [ ] **Step 4: Commit**

```bash
git add components/admin components/ui app/admin/layout.tsx
git commit -m "feat(ui): aturan responsif shell + audit verifikasi fase 1"
```

---

## Self-Review (author runs this after writing)

**Spec coverage (Phase 1 scope = spec §4):**
- §4.1 Layout — grouped sidebar ✓ (Task 2, groups from Task 1), topbar breadcrumb ✓ (Task 3), channel strip ✓ (Task 3), live clock ✓ (Tasks 2-3), notifications/activity bell ✗ — deferred to Phase 2 (needs API), user menu ✓ (Task 3)
- §4.1 Command palette Ctrl+K ✓ (Task 4)
- §4.1 Site switcher → masthead rack ✓ (Task 5) — counts partial (total syndications only; live/scheduled → Phase 2)
- §4.1 Responsive ✓ (Task 6) — mobile hamburger/slide-over preserved, topbar condenses, no 375px regression
- §4.1 Accessibility ✓ (a11y rules in Global Constraints, audited in Task 6)
- §4.2 Deliverable — sidebar ✓, topbar ✓, rack ✓, palette ✓, responsive ✓
- §3.4 Motion tokens → applied as duration/curve constants in the shell (transitions in sidebar/topbar/rack); full motion pass remains Phase-specific where chrome animates.

**Placeholder scan:** no "TBD"/"implement later". Deferrals are named: content search (palette) → Phase 2; rack live/scheduled counts → Phase 2; notifications bell → Phase 2.

**Type consistency:** `adminNavGroups` / `findActiveAdminItem` defined in Task 1, consumed by Tasks 2-3. `MastheadRack` prop `placement` consistent Tasks 5-6. Palette reuses `adminNavGroups`. Phosphor names must be validated in Task 1 (single place, cross-checked tsc).
