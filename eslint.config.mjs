import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // output tooling graphify — berisi artefak generate + skrip sekali-pakai
      "graphify-out/**",
    ],
  },
  // DQ-0: Warn on native alert/confirm (will upgrade to error after DQ-2)
  {
    rules: {
      "no-restricted-globals": ["error", "alert", "confirm"],
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  // Skrip node sekali-pakai (package.json tanpa "type":"module") — require() memang
  // sah di sini agar bisa dieksekusi langsung; jangan dipaksa jadi import ESM.
  {
    files: ["scripts/**/*.{js,ts,mjs,cjs}", "prisma/**/*.{js,ts}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
