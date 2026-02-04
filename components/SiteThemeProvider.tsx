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
                primaryColorLight: "#FF4D54",
                primaryColorDark: "#C41920",
                primaryColorAlpha: "rgba(237, 28, 36, 0.1)",
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

// Calculate if text should be light or dark based on background
function getContrastColor(hexColor: string): string {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

// Convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
                    --site-text-on-primary: ${theme.textOnPrimary};
                }

                /* Override accent colors across the site */
                a:hover {
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
