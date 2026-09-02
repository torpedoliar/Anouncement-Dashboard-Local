import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Terang/gelap dikendalikan oleh `html.theme-light` (blok var di globals.css),
  // bukan varian `dark:`. Jangan tambahkan `darkMode` di sini kecuali memang
  // mulai memakai `dark:` — saat ini tidak ada satu pun di kode.
  theme: {
    extend: {
      colors: {
        // Warna semantik dipetakan lewat kanal RGB, BUKAN `var(--surface-1)`
        // langsung. Alasannya: Tailwind hanya bisa menyuntikkan modifier alpha
        // (`bg-accent/10`, `hover:bg-surface-2/60`, `border-danger/40`) kalau
        // nilai warnanya memuat placeholder <alpha-value>. Dengan string opak
        // seperti "var(--surface-1)", setiap utilitas ber-`/N` dibuang tanpa
        // peringatan. Pasangan `--*-rgb` didefinisikan di app/globals.css.
        surface: {
          0: "rgb(var(--surface-0-rgb) / <alpha-value>)",
          1: "rgb(var(--surface-1-rgb) / <alpha-value>)",
          2: "rgb(var(--surface-2-rgb) / <alpha-value>)",
          3: "rgb(var(--surface-3-rgb) / <alpha-value>)",
        },
        text: {
          1: "rgb(var(--text-1-rgb) / <alpha-value>)",
          2: "rgb(var(--text-2-rgb) / <alpha-value>)",
          3: "rgb(var(--text-3-rgb) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border-rgb) / <alpha-value>)",
          strong: "rgb(var(--surface-3-rgb) / <alpha-value>)",
        },
        // Masthead accent — mengikuti --site-primary
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          subtle: "var(--site-primary-alpha)",
        },
        // Semantic status
        success: {
          DEFAULT: "rgb(var(--color-success-rgb) / <alpha-value>)",
          subtle: "var(--color-success-subtle)",
        },
        warning: {
          DEFAULT: "rgb(var(--color-warning-rgb) / <alpha-value>)",
          subtle: "var(--color-warning-subtle)",
        },
        danger: {
          DEFAULT: "rgb(var(--color-danger-rgb) / <alpha-value>)",
          subtle: "var(--color-danger-subtle)",
        },
        info: {
          DEFAULT: "rgb(var(--color-info-rgb) / <alpha-value>)",
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
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Type scale — satu ramp untuk semua permukaan. Nilai di globals.css.
      fontSize: {
        display: ["var(--text-display)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        title: ["var(--text-title)", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        heading: ["var(--text-heading)", { lineHeight: "1.3" }],
        body: ["var(--text-body)", { lineHeight: "1.6" }],
        small: ["var(--text-small)", { lineHeight: "1.5" }],
        caption: ["var(--text-caption)", { lineHeight: "1.4" }],
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
      // Skala z-index semantik. Urutan tumpukan: konten < dropdown < topbar
      // sticky < scrim drawer < sidebar < tombol drawer < scrim modal < modal
      // < toast < tooltip. Jangan pakai angka bebas (z-[9999]) lagi — pakai
      // nama di bawah supaya urutan tumpukan bisa dibaca dari kelasnya.
      zIndex: {
        dropdown: "100",
        sticky: "200",
        scrim: "290",
        sidebar: "300",
        "drawer-toggle": "310",
        "modal-scrim": "500",
        modal: "600",
        toast: "700",
        tooltip: "800",
      },
      animation: {
        "fade-in": "fadeIn var(--motion-slow) var(--motion-ease)",
        "slide-up": "slideUp var(--motion-slow) var(--motion-ease)",
        "scale-in": "scaleIn var(--motion-standard) var(--motion-ease)",
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
  plugins: [],
};

export default config;
