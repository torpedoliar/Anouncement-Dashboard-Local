# UI/UX Rework — Phase 0: Design System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the semantic token system, new typography, Phosphor icons, and the base `ui/` kit that every later phase (shell, content desk, data surfaces, portal/auth) consumes. Everything else in the rework depends on this phase.

**Architecture:** Rewrite `app/globals.css` around semantic CSS-variable tokens (night-edition default, paper-edition via `.theme-light`), map those tokens into the Tailwind v3 config, install the new font + icon stack, build a small token-driven `ui/` kit, and extend the site-theme mechanism so the per-site masthead color drives `--site-primary` inside the admin shell. Deliberately **keeps all existing inline-style components working** via backward-compat aliases — this is "tokenize then migrate", not a one-shot rewrite.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v3 (3.4.19 — do NOT switch to v4), `@phosphor-icons/react`, `next/font` (Sora + JetBrains Mono), existing `SiteThemeProvider`.

## Global Constraints

- **Tailwind stays v3.** `postcss.config.mjs` uses `@tailwindcss/postcss` (v4 plugin) but `globals.css` uses v3 `@tailwind base` directives and `tailwindcss@3.4.19` is installed. **Do NOT change `postcss.config.mjs` or the CSS directives in Phase 0** — that is a pre-existing inconsistency, out of scope. If `npm run build` fails on a clean baseline (Task 0), stop and report it; don't "fix" Tailwind here.
- **Backward-compat aliases are mandatory.** Every existing component uses inline `style={{}}` referencing `var(--brand-red)`, `var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-tertiary)`, `var(--bg-card)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--text-tertiary)`, `var(--border-color)`, `var(--border-strong)`, `var(--color-success/error/warning/info)`. These variables MUST keep resolving (as aliases to the new tokens) at the end of Phase 0, or the sidebar/confirm-dialog/etc. break visually.
- **Preserve accessibility wins:** the `:focus-visible` outline, global `prefers-reduced-motion` reduce block, `.sr-only`, and `.skip-link` must survive the CSS rewrite unchanged in behavior.
- **Theme default is night.** The app currently runs `.dark` on `<html>` with a black UI. Phase 0 defines default tokens on `:root` as **night** values and exposes paper values under `html.theme-light`. No visual regression; the light theme is made *possible* now and toggled later (Phase 1 shell).
- UI strings & commit messages in **Bahasa Indonesia**.
- New dependency: `@phosphor-icons/react` (explicitly specified in the spec Section 3.3). No other new dependencies.
- UI kit components are Tailwind-class based (token utilities), NOT inline-style. Place under `components/ui/`.
- After each task, run `npm run lint` (or `npx eslint <files>`) and `npx tsc --noEmit`; fix only errors you introduced.

---

### Task 0: Baseline verify + install the icon package

**Files:**
- Modify: `package.json` (add `@phosphor-icons/react`)

**Interfaces:**
- Consumes: nothing.
- Produces: a clean, compiling baseline and `@phosphor-icons/react` available to import.

- [ ] **Step 1: Confirm we're on a clean git baseline**

```bash
git status --short
```
Expected: if the working tree is dirty with unrelated changes, note them and proceed without touching them. Do not commit unrelated changes.

- [ ] **Step 2: Verify the app builds today**

```bash
npm run build
```
Expected: build succeeds. If it **fails on a clean baseline** (especially any Tailwind/postcss error), STOP and report the pre-existing failure to the user — do not attempt to fix Tailwind within this plan.

- [ ] **Step 3: Install Phosphor**

```bash
npm install @phosphor-icons/react
```
Expected: `@phosphor-icons/react` added to `package.json` dependencies. Confirm the exact installed version and note it (used in imports).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @phosphor-icons/react untuk design system"
```

---

### Task 1: Typography — Sora (display) + JetBrains Mono (numerals)

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `next/font/google` (already used for Inter/Montserrat).
- Produces: CSS variables `--font-sora` and `--font-mono`; Tailwind-ready font families used in Task 3.

- [ ] **Step 1: Add the two fonts to layout.tsx**

In `app/layout.tsx`, replace the current font imports and definitions (lines 1–17) with:

```tsx
import { Inter, Montserrat, Sora, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

// Masthead / display / headings — the newsroom voice (spec §3.2)
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700"],
});

// Numbers / IDs / clocks / counts / timestamps (spec §3.2)
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});
```

- [ ] **Step 2: Add the variables to `<body>`**

In the same file, change the body `className` to include the two new variables:

```tsx
<body
  className={`${inter.variable} ${montserrat.variable} ${sora.variable} ${mono.variable} font-sans bg-dark-primary text-light-primary antialiased min-h-screen`}
  suppressHydrationWarning
>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(ui): font Sora (display) + JetBrains Mono (numerik) via next/font"
```

---

### Task 2: globals.css — semantic token rewrite (night default, paper via .theme-light)

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing (this is the source of truth).
- Produces: CSS variables consumed by Tailwind config (Task 3), the `ui/` kit (Task 4), and every existing inline-style component (via aliases). After this task, `var(--surface-1)`, `var(--text-2)`, `var(--border)`, `var(--accent)`, `var(--color-success)` etc. must resolve.

- [ ] **Step 1: Replace the `:root` variable block (global.css lines 7–42) with the token set**

Keep the existing structure but redefine `:root` as **night** tokens and add an `html.theme-light` block for **paper**. The legacy `--brand-red`/`--bg-*`/`--text-*`/`--border-color`/`--color-*` names must remain as aliases so existing inline styles keep working.

```css
:root {
  /* ---- Masthead accent (site-primary injected by SiteThemeProvider) ---- */
  --site-primary: #ED1C24;
  --site-primary-light: #FF3B42;
  --site-primary-dark: #C41920;
  --site-primary-alpha: rgba(237, 28, 36, 0.1);
  --site-text-on-primary: #FFFFFF;

  /* ---- Brand red — source of truth: tailwind.config.ts santos.red ---- */
  --brand-red: #ED1C24;
  --brand-red-dark: #C41920;
  --brand-red-light: #FF3B42;
  --brand-red-alpha: rgba(237, 28, 36, 0.1);

  /* ---- Semantic surfaces (NIGHT edition — default) ---- */
  --surface-0: #09090B;
  --surface-1: #111113;
  --surface-2: #18181B;
  --surface-3: #27272A;
  --border: #27272A;

  /* ---- Text (NIGHT) ---- */
  --text-1: #FAFAFA;
  --text-2: #A1A1AA;
  --text-3: #71717A;

  /* ---- Accent (default brand red, overridden by --site-primary) ---- */
  --accent: var(--brand-red);

  /* ---- Semantics / status ---- */
  --color-success: #22c55e;
  --color-success-subtle: rgba(34, 197, 94, 0.12);
  --color-warning: #eab308;
  --color-warning-subtle: rgba(234, 179, 8, 0.12);
  --color-danger: #ef4444;
  --color-danger-subtle: rgba(239, 68, 68, 0.12);
  --color-info: #60a5fa;
  --color-info-subtle: rgba(96, 165, 250, 0.12);

  /* ---- Radius scale (spec §3.1) ---- */
  --radius-control: 6px;
  --radius-card: 8px;
  --radius-sheet: 12px;
  --radius-accent: 2px;

  /* ---- Shadows tinted to background hue (no pure-black drop shadows in light) ---- */
  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-2: 0 4px 12px -2px rgba(0, 0, 0, 0.5);
  --shadow-3: 0 12px 32px -8px rgba(0, 0, 0, 0.6);

  /* ---- Legacy aliases (backward compat — remove after full migration) ---- */
  --santos-red: var(--brand-red);
  --santos-red-dark: var(--brand-red-dark);
  --santos-red-light: var(--brand-red-light);
  /* backgrounds */
  --bg-primary: var(--surface-0);
  --bg-secondary: var(--surface-1);
  --bg-tertiary: var(--surface-2);
  --bg-card: var(--surface-1);
  --bg-hover: var(--surface-2);
  /* text */
  --text-primary: var(--text-1);
  --text-secondary: var(--text-2);
  --text-muted: var(--text-3);
  --text-tertiary: var(--text-3);
  /* borders */
  --border-color: var(--border);
  --border-strong: var(--surface-3);
}

/* ---- PAPER edition (light). App defaults to night; this is opt-in via <html class="theme-light"> ---- */
html.theme-light {
  --surface-0: #F7F6F3;
  --surface-1: #FFFFFF;
  --surface-2: #EDEBE6;
  --surface-3: #E4E1DA;
  --border: #E0DDD5;
  --text-1: #1C1917;
  --text-2: #57534E;
  --text-3: #8A857E;
  --accent: var(--brand-red);
  --shadow-1: 0 1px 2px rgba(28, 25, 23, 0.06);
  --shadow-2: 0 4px 12px -2px rgba(28, 25, 23, 0.08);
  --shadow-3: 0 12px 32px -8px rgba(28, 25, 23, 0.12);
}
```

> **Why night is on `:root`:** the app's `<html>` already carries `className="dark"` and the body uses `bg-dark-primary`. Keeping the night values as the default means zero visual change at the end of Phase 0. The `.theme-light` block is the *capability*; toggling it on is Phase 1's job.

- [ ] **Step 2: Update `body` + headings to use the display font and tokens**

Replace the `body` rule (lines 50–60) and the heading rule (lines 62–73) so headings use Sora and the body uses the token surfaces:

```css
body {
  background-color: var(--surface-0);
  color: var(--text-1);
  font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
}

/* Headings — Sora (display) */
h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--font-sora), var(--font-montserrat), system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

/* Mono helper for numerals / clocks / counts */
.mono {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Point the focus ring + scrollbar at the accent token**

The `:focus-visible` rule (line ~253) and scrollbar/selection rules reference `var(--brand-red)`. Switch them to `var(--accent)` so the masthead tint applies:

```css
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

::selection {
  background: var(--accent);
  color: var(--site-text-on-primary);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
```

Leave `.skip-link`, `.sr-only`, the `prefers-reduced-motion` block, `.animate-*`, `.prose-santos`, `.line-clamp-*`, and the toast slide/`spin` keyframes exactly as they are.

- [ ] **Step 4: Verify the build + no style regression**

Run: `npm run build`
Expected: succeeds. Then start `npm run dev` and open the admin dashboard + the public site homepage. Confirm the page still renders dark and the sidebar/logo are unchanged (aliases are working).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): token semantik (night default, paper via .theme-light) + alias backward-compat"
```

---

### Task 3: Tailwind config mapped to tokens

**Files:**
- Modify: `tailwind.config.ts`

**Interfaces:**
- Consumes: the CSS variables from Task 2.
- Produces: Tailwind utilities `bg-surface-0..3`, `text-text-1..3`, `border-border`, `bg-accent`, `text-accent`, `border-accent`, status colors (`bg-success`, `text-success`, …), display/mono font families, and token radius/shadows. Consumed by the kit (Task 4) and all later phases.

- [ ] **Step 1: Replace the theme `extend` block**

In `tailwind.config.ts`, replace the whole `theme.extend` object (lines 10–52) with:

```ts
  theme: {
    extend: {
      colors: {
        // Semantic surfaces (spec §3.1) — mapped from CSS vars
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        text: {
          1: "var(--text-1)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
        border: {
          DEFAULT: "var(--border)",
        },
        // Masthead accent — follows --site-primary
        accent: {
          DEFAULT: "var(--accent)",
          subtle: "var(--site-primary-alpha)",
        },
        // Semantic status
        success: {
          DEFAULT: "var(--color-success)",
          subtle: "var(--color-success-subtle)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          subtle: "var(--color-warning-subtle)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          subtle: "var(--color-danger-subtle)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          subtle: "var(--color-info-subtle)",
        },
        // Keep existing palettes for backward compat until migrated
        santos: {
          red: "#ED1C24",
          "red-dark": "#C41920",
          "red-light": "#FF3B42",
        },
        dark: {
          primary: "#0A0A0A",
          secondary: "#1A1A1A",
          tertiary: "#2A2A2A",
          card: "#141414",
        },
        light: {
          primary: "#FFFFFF",
          secondary: "#A0A0A0",
          tertiary: "#6B7280",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Montserrat", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-montserrat)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        sheet: "var(--radius-sheet)",
        accent: "var(--radius-accent)",
      },
      boxShadow: {
        "lvl-1": "var(--shadow-1)",
        "lvl-2": "var(--shadow-2)",
        "lvl-3": "var(--shadow-3)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
```

> **Note on `border-border`:** Tailwind v3 needs the color key `border` with a `DEFAULT` to emit `border-border`. The utility `border border-border` (width + color) — the existing components use inline styles so they're unaffected; new kit code uses `border border-border`.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: no new errors. (The `border` color key may trigger a Tailwind warning about overlapping the `borderWidth` namespace — this is benign; confirm the build emits the utilities.)

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(ui): map token semantik ke utilitas Tailwind (surface/text/accent/status)"
```

---

### Task 4: Base `ui/` kit (Button, Card, Badge, StatusPill, Input, Select, Table, Dropdown)

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/StatusPill.tsx`
- Create: `components/ui/Input.tsx`
- Create: `components/ui/Select.tsx`
- Create: `components/ui/Table.tsx`
- Create: `components/ui/Dropdown.tsx`

**Interfaces:**
- Consumes: Tailwind token utilities from Task 3; `@phosphor-icons/react`.
- Produces: the primitive API consumed by every later phase. All components are client-agnostic (`"use client"` only where they hold state: Select, Dropdown, Table sort). Full prop contracts below.

**Component contract (used by later tasks — keep these names/props exact):**

- `Button`: props `{ variant?: "primary"|"secondary"|"ghost"|"danger"; size?: "sm"|"md"; iconLeft?: ReactNode; iconRight?: ReactNode; children; ...rest }`. Primary = `bg-accent text-white`, secondary = `border border-border`, ghost = transparent, danger = `bg-danger text-white`. Sizes: sm `h-8 px-3 text-13`, md `h-10 px-4 text-14`. Rounded `rounded-control`. Focus-visible ring. `disabled` → `opacity-50 cursor-not-allowed`.
- `Card`: props `{ children; className?; ...rest }`. `bg-surface-1 border border-border rounded-card shadow-lvl-1`. `as` support not needed.
- `Badge`: props `{ tone?: "neutral"|"success"|"warning"|"danger"|"info"; children; className? }`. Neutral = `bg-surface-2 text-text-2`, others use the `*-subtle` bg + `text-<tone>` text.
- `StatusPill`: props `{ status: "draft"|"scheduled"|"published"|"taken-down"|"pending-approval"; label?: string }`. **Presentational only** — maps status → tone + icon + Indonesian default label. The derivation logic (`deriveAnnouncementStatus`, spec §5.1) lands in Phase 2; this component just renders.
- `Input`: props `{ label?; error?; hint?; ...inputProps }`. Label above, error below in `text-danger`, hint in `text-text-3`. `h-10 rounded-control border border-border bg-surface-1 px-3`.
- `Select`: stateful. props `{ label?; options: {value:string;label:string}[]; value; onChange; ...rest }`.
- `Table`: props `{ columns: { key:string; header:ReactNode; sortKey?:string }[]; rows: ReactNode[][]; sort?: {key?:string; dir?:"asc"|"desc"}; onSort?:(key:string)=>void; ariaLabel? }`. Sparse borders, `aria-sort` on sortable headers, hover row highlight. Sorting state is managed by the caller (Phase 3 adds the ledger); here it renders headers + provides the sort toggle affordance.
- `Dropdown`: stateful. props `{ trigger: ReactNode; items: {label:string; onSelect:()=>void; icon?:ReactNode; danger?:boolean}[]; align?: "left"|"right" }`.

- [ ] **Step 1: Write `Button.tsx`**

```tsx
"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const variants: Record<string, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-border bg-surface-1 text-text-1 hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text-1",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<string, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
```

- [ ] **Step 2: Write `Card.tsx`**

```tsx
import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface-1 border border-border rounded-card shadow-lvl-1 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Write `Badge.tsx`**

```tsx
import { HTMLAttributes, ReactNode } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}

const tones: Record<string, string> = {
  neutral: "bg-surface-2 text-text-2",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
};

export default function Badge({ tone = "neutral", children, className = "", ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Write `StatusPill.tsx`** (presentational; derivation is Phase 2)

```tsx
"use client";

import { Badge } from "@/components/ui/Badge";
import { PencilSimple, Clock, Broadcast, Square, Flag } from "@phosphor-icons/react";

export type AnnouncementStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "taken-down"
  | "pending-approval";

const STATUS_META: Record<AnnouncementStatus, { tone: BadgeTone; label: string; icon: ReactNode }> = {
  draft: { tone: "neutral", label: "Draf", icon: <PencilSimple size={12} /> },
  scheduled: { tone: "warning", label: "Terjadwal", icon: <Clock size={12} /> },
  published: { tone: "success", label: "Terbit", icon: <Broadcast size={12} /> },
  "taken-down": { tone: "neutral", label: "Diturunkan", icon: <Square size={12} /> },
  "pending-approval": { tone: "info", label: "Perlu Persetujuan", icon: <Flag size={12} /> },
};

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export default function StatusPill({
  status,
  label,
}: {
  status: AnnouncementStatus;
  label?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={label ?? meta.label}>
      {meta.icon}
      {label ?? meta.label}
    </Badge>
  );
}
```

> **Ordering note:** `Badge` is defined in Step 3 of this task. Import order within the kit is fine as long as all files are created in the same task before the typecheck step.

- [ ] **Step 5: Write `Input.tsx`**

```tsx
"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({ label, error, hint, className = "", ...rest }: InputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-text-1">{label}</span>
      )}
      <input
        className={`h-10 w-full rounded-control border bg-surface-1 px-3 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-text-3">{hint}</span>
      ) : null}
    </label>
  );
}
```

- [ ] **Step 6: Write `Select.tsx`**

```tsx
"use client";

import { SelectHTMLAttributes } from "react";
import { CaretDown } from "@phosphor-icons/react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, options, className = "", ...rest }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-text-1">{label}</span>}
      <div className="relative">
        <select
          className={`h-10 w-full appearance-none rounded-control border border-border bg-surface-1 px-3 pr-9 text-sm text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${className}`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <CaretDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-3"
        />
      </div>
    </label>
  );
}
```

- [ ] **Step 7: Write `Table.tsx`** (sortable headers; sort state owned by caller)

```tsx
"use client";

import { CaretUp, CaretDown } from "@phosphor-icons/react";

export interface TableColumn {
  key: string;
  header: React.ReactNode;
  sortKey?: string;
}

interface TableProps {
  columns: TableColumn[];
  rows: React.ReactNode[][];
  sort?: { key?: string; dir?: "asc" | "desc" };
  onSort?: (key: string) => void;
  ariaLabel?: string;
}

export default function Table({ columns, rows, sort, onSort, ariaLabel }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label={ariaLabel}>
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const isSorted = sort?.key === col.sortKey;
              const isSortable = !!col.sortKey && !!onSort;
              return (
                <th
                  key={col.key}
                  aria-sort={isSorted ? (sort?.dir === "asc" ? "ascending" : "descending") : "none"}
                  className="px-4 py-3 text-left text-xs font-medium text-text-3"
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.sortKey!)}
                      className="inline-flex items-center gap-1 hover:text-text-1"
                    >
                      {col.header}
                      {isSorted ? (
                        sort?.dir === "asc" ? (
                          <CaretUp size={12} />
                        ) : (
                          <CaretDown size={12} />
                        )
                      ) : null}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2/60">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-text-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8: Write `Dropdown.tsx`** (stateful, outside-click close)

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface DropdownItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export default function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-20 mt-1 min-w-44 rounded-control border border-border bg-surface-1 p-1 shadow-lvl-2 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-sm ${
                item.danger ? "text-danger hover:bg-danger-subtle" : "text-text-1 hover:bg-surface-2"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Typecheck + lint the kit**

Run: `npx tsc --noEmit`
Run: `npx eslint components/ui`
Expected: no new errors. Fix any import-name mismatches (e.g. Phosphor icon names differ from Feather — verify `Broadcast`, `Square`, `PencilSimple`, `CaretUp/Down`, `CaretDown` all exist in `@phosphor-icons/react`).

- [ ] **Step 10: Sanity-render the kit (dev server)**

Run `npm run dev`, then temporarily drop a kit sample into any admin page (e.g. render a `<Button>`, `<Badge>`, `<StatusPill status="published" />`, a 2-col `<Table>`, and a `<Dropdown>`) to confirm the tokens resolve (accent follows the site color, status colors correct). Inspect visually, then **remove the sample** before committing.

- [ ] **Step 11: Commit**

```bash
git add components/ui
git commit -m "feat(ui): kit primitif (Button, Card, Badge, StatusPill, Input, Select, Table, Dropdown)"
```

---

### Task 5: Extend site theming to the admin shell

**Files:**
- Create: `components/admin/AdminSiteThemeProvider.tsx`

**Interfaces:**
- Consumes: `resolveAdminSiteId` (`lib/site-context.ts`), `prisma` (`@/lib/prisma`), existing `SiteThemeProvider` (`components/SiteThemeProvider.tsx`).
- Produces: a server component `<AdminSiteThemeProvider>{children}</AdminSiteThemeProvider>` that resolves the active site and drives `--site-primary` in the admin shell. Phase 1 wraps the admin layout in it.

- [ ] **Step 1: Confirm the Prisma accessor for a site's primaryColor**

Check `prisma/schema.prisma` `model Site` for the exact field name of the per-site color. The existing `SiteSelector` uses `site.primaryColor` (from `/api/sites`), so the column is `primaryColor`. Confirm the Prisma field name before writing the query.

- [ ] **Step 2: Write `AdminSiteThemeProvider.tsx`** (server component)

```tsx
import { ReactNode } from "react";
import { resolveAdminSiteId } from "@/lib/site-context";
import prisma from "@/lib/prisma";
import SiteThemeProvider from "@/components/SiteThemeProvider";

export default async function AdminSiteThemeProvider({ children }: { children: ReactNode }) {
  const siteId = await resolveAdminSiteId();
  let primaryColor = "#ED1C24";
  let siteName = "Site";
  let siteSlug = "";

  if (siteId) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { name: true, slug: true, primaryColor: true },
    });
    if (site) {
      primaryColor = site.primaryColor || primaryColor;
      siteName = site.name;
      siteSlug = site.slug;
    }
  }

  return (
    <SiteThemeProvider primaryColor={primaryColor} siteName={siteName} siteSlug={siteSlug}>
      {children}
    </SiteThemeProvider>
  );
}
```

> `SiteThemeProvider` is already `"use client"` and injects the `--site-primary` CSS vars glob-aly via `<style jsx global>`. This server wrapper just feeds it the admin's active site. No color logic is duplicated — adjustBrightness/getContrastColor stay where they are.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. Confirm `prisma.site.findUnique` compiles against the actual schema (the `select` field names must match).

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminSiteThemeProvider.tsx
git commit -m "feat(ui): provider tema admin — masthead site aktif drive --site-primary di shell"
```

---

### Task 6: Phase 0 final verification

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Full typecheck + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean (no new errors).

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Visual regression pass (dev server)**

Run `npm run dev` and visually confirm against the pre-rework screenshots:
- Admin dashboard, sidebar, confirm dialog, site selector — **unchanged** (aliases working, night default).
- Focus ring follows the accent; the existing red focus ring is preserved (default accent = brand red).
- A sample StatusPill/Button/Badge (if left in) resolves tokens correctly.

- [ ] **Step 4: Confirm light-theme capability without enabling it**

Open DevTools, add `theme-light` to `<html>` (hardcode temporarily or via console `document.documentElement.classList.add('theme-light')`) and confirm the paper surfaces render. Then remove it. This proves both themes are wired without flipping the app.

- [ ] **Step 5: Commit any stragglers + tag the phase**

```bash
git add -A
git commit -m "feat(ui): fase 0 design system foundation — verifikasi e2e (token, font, icons, kit, masthead admin)"
```

---

## Self-Review

**Spec coverage (Phase 0 scope = spec §3):**
- §3.1 token architecture (paper/night, radius, spacing, shadows) → Task 2 (tokens) + Task 3 (Tailwind mapping).
- §3.2 typography (Sora display, Inter body kept, JetBrains Mono numerals) → Task 1.
- §3.3 icons (Phosphor, weight regular/duotone) → Task 0 (install) + kit uses Phosphor (Task 4).
- §3.4 motion tokens → the 150–300ms `transition-colors duration-150` + existing keyframes; full motion token pass is Phase 1 (shell chrome). Noted as a deferral, not a gap.
- §3.5 dark/light parity → both token sets defined (night default + `.theme-light`), contrast values from spec table.
- §3.6 deliverable (globals.css, Tailwind mapping, ui/ kit, SiteThemeProvider extended for admin) → Tasks 2, 3, 4, 5.

**Placeholder scan:** no "TBD"/"implement later". Every step has concrete code. The only intentional deferrals are named: motion token pass → Phase 1; `deriveAnnouncementStatus` → Phase 2; sortable-ledger logic → Phase 3.

**Type consistency:**
- `StatusPill` status union `"draft"|"scheduled"|"published"|"taken-down"|"pending-approval"` matches the spec §5.1 derived-state table exactly. Phase 2's `deriveAnnouncementStatus()` will return one of these five strings.
- Kit prop names (`variant`, `tone`, `status`, `columns`/`rows`/`sort`/`onSort`) are stable contracts for Phases 1–4.
- `AdminSiteThemeProvider` consumes `resolveAdminSiteId` + `prisma.site.findUnique({ select: { name, slug, primaryColor } })` — the `primaryColor` field must be confirmed in Task 5 Step 1 against the real schema.

**Deliberate simplifications (`ponytail:`):**
- Phase 0 defaults to **night** to avoid a full-app visual flip; `.theme-light` is built but un-toggled. Toggle lands with Phase 1 shell.
- Kit `Table` renders sort headers but sorting state is caller-owned (the sortable *ledger* is Phase 3). Keeps Phase 0 focused on primitives.
- `StatusPill` is presentational; the honest derivation logic is Phase 2. This keeps the pill honest without pulling announcement queries into the foundation.
- The Tailwind v3/v4 postcss mismatch is explicitly **not** fixed here (Global Constraints) — it's a pre-existing inconsistency; if sett-ling it is wanted, that's a separate task.