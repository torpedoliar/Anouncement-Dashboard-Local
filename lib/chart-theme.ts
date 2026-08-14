// lib/chart-theme.ts
// Shared chart theme derived from the current site theme + masthead accent.
// recharts 3.6.0 applies color props as SVG presentation attributes, where CSS
// `var()` does NOT resolve — so we resolve tokens to concrete color strings at
// call time (inside a client component render, after the theme toggle applied).

export interface ChartTheme {
  primary: string;      // masthead accent (resolved) or fallback hex
  neutral: string;      // resolved --text-3
  grid: string;         // resolved --border
  tick: string;         // resolved --text-3
  tooltipBg: string;    // resolved --surface-1
  tooltipBorder: string;// resolved --border
}

// Note: named `resolveCssVar` (not `cssVar`) to avoid shadowing the `cssVar`
// parameter of getChartTheme below.
function resolveCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Called inside a client component render (document exists, theme toggle already applied).
export function getChartTheme(primaryColor?: string, cssVar = "--site-primary"): ChartTheme {
  return {
    primary: primaryColor || (typeof document !== "undefined"
      ? (getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || "#0a0a0a")
      : "#0a0a0a"),
    neutral: resolveCssVar("--text-3", "#52525b"),
    grid:    resolveCssVar("--border", "#27272a"),
    tick:    resolveCssVar("--text-3", "#52525b"),
    tooltipBg:    resolveCssVar("--surface-1", "#18181b"),
    tooltipBorder: resolveCssVar("--border", "#27272a"),
  };
}
