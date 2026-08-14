/**
 * Self-check for lib/chart-theme.ts (getChartTheme).
 * Run with: npx tsx scripts/check-chart-theme.ts
 *
 * Exercises both branches:
 *   1. A color is passed -> primary must equal that color verbatim.
 *   2. No color passed -> in Node there is no `document`, so the guard returns
 *      the fallback hex; primary must be a non-empty string starting with "#",
 *      NOT the literal `var(--site-primary)`.
 */
import { getChartTheme } from "../lib/chart-theme";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`  ok - ${message}`);
}

console.log("check-chart-theme.ts");

// Branch 1: explicit color passed through verbatim.
{
  const t = getChartTheme("#ED1C24");
  assert(t.primary === "#ED1C24", `primary === "#ED1C24" (got "${t.primary}")`);
}

// Branch 2: no-arg fallback (Node has no document -> fallback hex, never a var()).
{
  const t = getChartTheme();
  assert(
    typeof t.primary === "string" && t.primary.length > 0 && t.primary.startsWith("#"),
    `fallback primary is a non-empty hex string (got "${t.primary}")`
  );
  assert(
    t.primary !== "var(--site-primary)",
    `fallback primary is NOT "var(--site-primary)" (got "${t.primary}")`
  );

  // Every field must be a concrete resolved string (never an unresolved var()).
  const allConcrete = (Object.values(t) as string[]).every(
    (v) => typeof v === "string" && v.length > 0 && !v.startsWith("var(")
  );
  assert(allConcrete, "all ChartTheme fields are concrete resolved colors");
}

console.log("All checks passed.");
