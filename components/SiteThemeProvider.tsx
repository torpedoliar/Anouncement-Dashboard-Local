"use client";

/**
 * SiteThemeProvider Component
 * Provides dynamic theming based on site's primary color
 * Wraps site pages to apply consistent styling
 */

import { createContext, useContext, useMemo, ReactNode } from "react";

interface SiteTheme {
    primaryColor: string;
    primaryColorLight: string;
    primaryColorDark: string;
    primaryColorAlpha: string;
    /** Kanal RGB dipisah spasi ("237 28 36") untuk utilitas Tailwind beralpha. */
    primaryColorChannels: string;
    textOnPrimary: string;
}

interface SiteThemeContextValue {
    theme: SiteTheme;
    siteName: string;
    siteSlug: string;
}

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null);

export function useSiteTheme() {
    const context = useContext(SiteThemeContext);
    if (!context) {
        // Return default theme if not in provider
        return {
            theme: {
                primaryColor: "#ED1C24",
                primaryColorLight: "#FF3B42",
                primaryColorDark: "#C41920",
                primaryColorAlpha: "rgba(237, 28, 36, 0.1)",
                primaryColorChannels: "237 28 36",
                textOnPrimary: "#FFFFFF",
            },
            siteName: "Site",
            siteSlug: "",
        };
    }
    return context;
}

interface SiteThemeProviderProps {
    children: ReactNode;
    primaryColor: string;
    siteName: string;
    siteSlug: string;
}

// Helper to adjust color brightness
function adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

// Pilih warna teks di atas warna background acak (mis. category.color atau
// site.primaryColor yang diedit admin) berdasarkan kontras WCAG, bukan
// perceived brightness. Sebelumnya memakai (0.299r+0.587g+0.114b)/255 > 0.5
// yang memberi keputusan salah pada merah brand (dianggap "terang" → teks
// hitam, padahal putih yang benar). Threshold 0.179: pada luminansi itu, putih
// dan hitam sama-sama ~4.5:1 — di bawahnya teks putih, di atasnya hitam. (T7)
export function getContrastColor(hexColor: string): string {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
    return L < 0.179 ? "#FFFFFF" : "#000000";
}

// Convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Kanal RGB dipisah spasi, mis. "237 28 36".
 *
 * Dipakai Tailwind lewat `rgb(var(--accent-rgb) / <alpha-value>)` supaya
 * utilitas beralpha seperti `bg-accent/10` bisa dihitung. Tanpa ini, warna
 * accent tidak punya bentuk yang bisa disuntik alpha dan setiap `accent/N`
 * hilang dari CSS.
 */
function hexToRgbChannels(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r} ${g} ${b}`;
}

export default function SiteThemeProvider({
    children,
    primaryColor,
    siteName,
    siteSlug,
}: SiteThemeProviderProps) {
    const theme = useMemo<SiteTheme>(() => {
        const color = primaryColor || "#ED1C24";
        return {
            primaryColor: color,
            primaryColorLight: adjustBrightness(color, 30),
            primaryColorDark: adjustBrightness(color, -20),
            primaryColorAlpha: hexToRgba(color, 0.1),
            primaryColorChannels: hexToRgbChannels(color),
            textOnPrimary: getContrastColor(color),
        };
    }, [primaryColor]);

    const value = useMemo(
        () => ({ theme, siteName, siteSlug }),
        [theme, siteName, siteSlug]
    );

    return (
        <SiteThemeContext.Provider value={value}>
            <style jsx global>{`
                :root {
                    --site-primary: ${theme.primaryColor};
                    --site-primary-light: ${theme.primaryColorLight};
                    --site-primary-dark: ${theme.primaryColorDark};
                    --site-primary-alpha: ${theme.primaryColorAlpha};
                    --site-primary-rgb: ${theme.primaryColorChannels};
                    --site-text-on-primary: ${theme.textOnPrimary};
                }

                /*
                  Hover tautan "polos" saja.

                  Aturan ini dulu berupa \`a:hover\` tanpa batas. Spesifisitasnya
                  (0,1,1) mengalahkan utilitas Tailwind (0,1,0), jadi setiap
                  \`hover:text-*\` pada tautan di seluruh aplikasi — termasuk item
                  navigasi admin dan portal — ditimpa jadi merah brand. Dibatasi
                  ke \`a:not([class])\` supaya hanya tautan mentah (konten artikel
                  hasil HTML) yang terpengaruh, sementara komponen tetap memakai
                  state hover-nya sendiri.
                */
                a:not([class]):hover {
                    color: var(--site-primary);
                }

                ::selection {
                    background-color: var(--site-primary);
                    color: var(--site-text-on-primary);
                }

                /* Scrollbar styling */
                ::-webkit-scrollbar-thumb {
                    background: var(--site-primary-dark);
                }

                ::-webkit-scrollbar-thumb:hover {
                    background: var(--site-primary);
                }
            `}</style>
            {children}
        </SiteThemeContext.Provider>
    );
}
