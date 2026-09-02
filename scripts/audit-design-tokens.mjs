/**
 * Audit statis token desain.
 *
 * Ada dua kelas bug di proyek ini yang tidak tertangkap TypeScript, ESLint,
 * maupun `next build` — semuanya gagal dalam diam:
 *
 *   1. `var(--nama-yang-tidak-ada)`. CSS mengabaikan properti tanpa keluhan.
 *      Kejadian nyata: panel modal halaman komentar mewarnai latar lewat alias
 *      yang tidak pernah didefinisikan, jadi panelnya transparan.
 *
 *   2. Utilitas Tailwind yang menunjuk kunci token yang tidak ada, atau meminta
 *      modifier alpha pada warna yang tidak bisa menerimanya. Tailwind tidak
 *      meng-emit apa pun. Kejadian nyata: `shadow-1` (skalanya `shadow-lvl-1`)
 *      dan 36 kelas ber-`/N` seperti `bg-accent/10` dan `hover:bg-surface-2/60`
 *      yang tidak pernah menghasilkan satu baris CSS.
 *
 * Pendekatan audit ini empiris, bukan menebak aturan Tailwind: CSS benar-benar
 * dikompilasi, lalu setiap utilitas design-system yang dipakai di kode
 * dicocokkan ke hasil kompilasi.
 *
 * Jalankan: node scripts/audit-design-tokens.mjs
 * Keluar dengan kode 1 kalau ada temuan, jadi bisa dipakai sebagai gerbang CI.
 */
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const ROOT = process.cwd();
const GLOBALS = path.join(ROOT, "app", "globals.css");
const SCAN_DIRS = ["app", "components", "contexts", "hooks", "lib"];
const SCAN_EXT = new Set([".ts", ".tsx", ".css"]);

/** Keluarga warna/token milik design system yang wajib diverifikasi. */
const TOKEN_FAMILIES = [
  "surface-0", "surface-1", "surface-2", "surface-3",
  "text-1", "text-2", "text-3",
  "border", "border-strong",
  "accent", "accent-subtle",
  "success", "success-subtle",
  "warning", "warning-subtle",
  "danger", "danger-subtle",
  "info", "info-subtle",
];

/** Prefix utilitas yang bisa memakai keluarga di atas. */
const COLOR_PREFIXES = [
  "bg", "text", "border", "border-t", "border-b", "border-l", "border-r",
  "ring", "outline", "fill", "stroke", "divide", "from", "via", "to",
  "decoration", "placeholder", "caret", "shadow", "accent",
];

/** Utilitas non-warna yang juga terikat token. */
const STANDALONE = [
  "shadow-lvl-1", "shadow-lvl-2", "shadow-lvl-3",
  "rounded-control", "rounded-card", "rounded-sheet", "rounded-accent",
  "font-display", "font-mono", "font-serif",
  "z-dropdown", "z-sticky", "z-scrim", "z-sidebar", "z-drawer-toggle",
  "z-modal-scrim", "z-modal", "z-toast", "z-tooltip",
];

/**
 * Kelas shell admin yang didefinisikan manual di globals.css (bukan utilitas
 * Tailwind). Ikut diverifikasi karena kalau salah tulis, geometri sidebar/konten
 * diam-diam hilang — persis mode kegagalan yang audit ini cegah.
 */
const SHELL_CLASSES = [
  "admin-shell",
  "admin-sidebar",
  "admin-main",
  "admin-rail-hide",
  "admin-rail-center",
  "admin-rail-stack",
];

// ---------------------------------------------------------------------------
// 1. Kumpulkan nama variabel CSS yang benar-benar didefinisikan
// ---------------------------------------------------------------------------
const globalsCss = fs.readFileSync(GLOBALS, "utf8");
const definedVars = new Set(
  [...globalsCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1])
);

/** Variabel yang disuntikkan runtime, bukan dideklarasikan di globals.css. */
const runtimeVars = new Set([
  "--font-inter", "--font-serif", "--font-sora", "--font-mono",
  // Disuntikkan SiteThemeProvider lewat <style jsx global>.
  "--site-primary", "--site-primary-light", "--site-primary-dark",
  "--site-primary-alpha", "--site-primary-rgb", "--site-text-on-primary",
]);

// ---------------------------------------------------------------------------
// 2. Kumpulkan berkas & kandidat kelas
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = SCAN_DIRS
  .filter((d) => fs.existsSync(path.join(ROOT, d)))
  .flatMap((d) => walk(path.join(ROOT, d)));

/** Kandidat utilitas token: `[varian:]prefix-keluarga[/alpha]`. */
const tokenUtilityPattern = new RegExp(
  String.raw`(?<![\w-/])((?:[a-z-]+:)*)(?:(${COLOR_PREFIXES.join("|")})-(${TOKEN_FAMILIES.join("|")})|(${[...STANDALONE, ...SHELL_CLASSES].join("|")}))(/\d{1,3})?(?![\w-])`,
  "g"
);

const undefinedVars = [];
const badShadows = [];
/** Map<kelas, Array<{rel,line}>> */
const usedUtilities = new Map();

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    // Lewati baris komentar supaya catatan penjelasan tidak ikut terdeteksi.
    const trimmed = line.trim();
    const isComment =
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("{/*");
    if (isComment) return;

    for (const match of line.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
      const name = match[1];
      if (!definedVars.has(name) && !runtimeVars.has(name)) {
        undefinedVars.push({ rel, line: index + 1, name, text: trimmed });
      }
    }

    // Skala shadow proyek ini bernama lvl-1/lvl-2/lvl-3. `shadow-1` dst.
    // menunjuk kunci yang tidak ada dan dibuang Tailwind tanpa peringatan.
    for (const match of line.matchAll(/(?<![\w-])shadow-(\d+)(?![\w-])/g)) {
      badShadows.push({
        rel,
        line: index + 1,
        found: `shadow-${match[1]}`,
        suggest: `shadow-lvl-${match[1]}`,
      });
    }

    for (const match of line.matchAll(tokenUtilityPattern)) {
      const [, variants = "", prefix, family, standalone, alpha = ""] = match;
      const base = standalone ?? `${prefix}-${family}`;
      usedUtilities.set(`${variants}${base}${alpha}`, [
        ...(usedUtilities.get(`${variants}${base}${alpha}`) ?? []),
        { rel, line: index + 1 },
      ]);
    }
  });
}

// ---------------------------------------------------------------------------
// 3. Kompilasi CSS sungguhan, lalu cek kehadiran tiap kelas
// ---------------------------------------------------------------------------
const { css } = await postcss([tailwindcss]).process(globalsCss, { from: GLOBALS });

/** Selektor CSS meng-escape ':' dan '/' dengan backslash. */
function toSelector(utility) {
  return "." + utility.replace(/([:/.])/g, "\\$1");
}

const deadUtilities = [];
for (const [utility, locations] of usedUtilities) {
  if (!css.includes(toSelector(utility))) {
    deadUtilities.push({ utility, locations });
  }
}

// ---------------------------------------------------------------------------
// 4. Laporan
// ---------------------------------------------------------------------------
let failed = false;

if (undefinedVars.length) {
  failed = true;
  console.log(`\n[GAGAL] ${undefinedVars.length} referensi var(--...) tanpa definisi:`);
  for (const item of undefinedVars) {
    console.log(`  ${item.rel}:${item.line}  ${item.name}`);
    console.log(`      ${item.text.slice(0, 130)}`);
  }
}

if (badShadows.length) {
  failed = true;
  console.log(`\n[GAGAL] ${badShadows.length} utilitas shadow menunjuk kunci tak ada:`);
  for (const item of badShadows) {
    console.log(`  ${item.rel}:${item.line}  ${item.found} -> ${item.suggest}`);
  }
}

if (deadUtilities.length) {
  failed = true;
  console.log(
    `\n[GAGAL] ${deadUtilities.length} utilitas token dipakai tapi TIDAK meng-emit CSS:`
  );
  for (const { utility, locations } of deadUtilities) {
    console.log(`  ${utility}`);
    for (const loc of locations.slice(0, 6)) {
      console.log(`      ${loc.rel}:${loc.line}`);
    }
    if (locations.length > 6) console.log(`      ... +${locations.length - 6} lagi`);
  }
}

if (!failed) {
  console.log(
    `[OK] ${files.length} berkas dipindai, ${usedUtilities.size} utilitas token diverifikasi ` +
    `terhadap ${css.length.toLocaleString("id-ID")} byte CSS hasil kompilasi. ` +
    `Semua var(--...) terdefinisi.`
  );
}

process.exit(failed ? 1 : 0);
