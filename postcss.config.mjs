/**
 * Tailwind CSS v3 pipeline.
 *
 * PENTING: proyek ini memakai tailwindcss v3 (`tailwind.config.ts` format v3 +
 * direktif `@tailwind base/components/utilities` di `app/globals.css`).
 * Plugin `@tailwindcss/postcss` adalah plugin Tailwind v4 — kalau dipakai di sini
 * engine v4 jalan TANPA theme default, sehingga utilitas berbasis skala
 * (px-4, text-sm, gap-2, rounded-card, bg-surface-1, w-64, ...) tidak pernah
 * di-emit dan seluruh UI tampil tanpa style. Jangan diganti ke v4 tanpa
 * migrasi penuh globals.css + tailwind.config.ts.
 */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
