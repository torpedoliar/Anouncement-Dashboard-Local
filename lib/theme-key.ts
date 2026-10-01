/**
 * Tema per permukaan. Situs pengumuman default "Edisi Pagi" (Paper), portal
 * default Night, admin mengikuti OS. Kunci `theme` lama (global) sengaja tidak
 * dibaca lagi untuk situs/portal: default per permukaan harus menang supaya
 * kesan dua edisi konsisten (spec 2026-10-02 §2.2).
 *
 * `pickTheme` diserialisasi ke script pra-paint lewat `toString()`. Badan
 * fungsinya harus mandiri (tanpa rujukan ke import/konstanta luar); anotasi
 * tipe aman karena SWC (Next) dan esbuild (tsx) membuangnya sebelum runtime.
 */
export type ThemeChoice = "light" | "dark";
type ThemeFallback = "light" | "dark" | "system";

function pickTheme(
    pathname: string,
    read: (key: string) => string | null,
    prefersLight: boolean,
): { key: string; fallback: ThemeFallback; theme: ThemeChoice } {
    let key = "adminTheme";
    let fallback: ThemeFallback = "system";
    if (pathname === "/site" || pathname.startsWith("/site/")) {
        key = "theme:site";
        fallback = "light";
    } else if (pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/portal-login")) {
        key = "theme:portal";
        fallback = "dark";
    }
    let saved: string | null = null;
    try {
        saved = read(key);
    } catch {
        saved = null;
    }
    if (saved === "light" || saved === "dark") return { key, fallback, theme: saved };
    const theme: ThemeChoice = fallback === "system" ? (prefersLight ? "light" : "dark") : fallback;
    return { key, fallback, theme };
}

export function themeKeyForPath(pathname: string): { key: string; fallback: "light" | "dark" | "system" } {
    const { key, fallback } = pickTheme(pathname, () => null, false);
    return { key, fallback };
}

export function resolveTheme(pathname: string, read: (key: string) => string | null, prefersLight: boolean): ThemeChoice {
    return pickTheme(pathname, read, prefersLight).theme;
}

export const THEME_PREPAINT_SCRIPT = `
(function () {
  try {
    var pickTheme = ${pickTheme.toString()};
    var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var r = pickTheme(location.pathname, function (k) { return localStorage.getItem(k); }, prefersLight);
    if (r.theme === 'light') document.documentElement.classList.add('theme-light');
  } catch (e) {}
})();
`;

/** Simpan pilihan tema di kunci permukaan aktif. Storage diblokir → abaikan. */
export function persistTheme(pathname: string, theme: ThemeChoice): void {
    try {
        localStorage.setItem(themeKeyForPath(pathname).key, theme);
    } catch {
        // Tema tetap berubah untuk sesi ini.
    }
}
