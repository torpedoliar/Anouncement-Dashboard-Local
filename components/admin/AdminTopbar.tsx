"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CaretDown, SignOut, Gear } from "@phosphor-icons/react";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { findActiveAdminItem } from "@/lib/admin-nav";
import Dropdown from "@/components/ui/Dropdown";

export default function AdminTopbar() {
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const siteTheme = useSiteTheme();

    // Live clock - update every second (mono, tabular)
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const active = findActiveAdminItem(pathname, undefined, false);

    const title =
        active?.label ||
        (pathname ? pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") : "Dashboard") ||
        "Dashboard";

    // channel strip derives from the site provider (falls back to brand at rest)
    const primaryColor = siteTheme.theme.primaryColor;
    const siteName = siteTheme.siteName;
    const siteSlug = siteTheme.siteSlug;

    const handleLogout = async () => {
        router.push("/admin-login");
    };

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface-0 px-4 md:px-6">
            {/* Left: breadcrumb / page title */}
            <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-text-1 capitalize">
                    {title}
                </span>
            </div>

            {/* Center: channel strip — live site masthead */}
            <div className="hidden items-center gap-2 md:flex">
                <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                    aria-hidden="true"
                />
                <span className="text-sm font-medium text-text-1">{siteName}</span>
                <span className="font-mono text-xs text-text-3">{siteSlug}</span>
            </div>

            {/* Right: monitor clock + notifications + user menu */}
            <div className="flex items-center gap-2">
                {currentTime && (
                    <span className="hidden font-mono tabular-nums text-sm text-text-2 sm:inline">
                        {currentTime.toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        })}
                    </span>
                )}

                {/* Notifications (bell) — placeholder arrival; real center lands Phase 2 */}
                <button
                    className="rounded-control p-2 text-text-2 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label="Notifikasi"
                    onClick={() => router.push("/admin/analytics")}
                >
                    <Bell size={18} aria-hidden="true" />
                </button>

                {/* User menu */}
                <Dropdown
                    align="right"
                    trigger={
                        <span className="inline-flex items-center gap-2 rounded-control p-1.5 text-text-2 hover:bg-surface-2 hover:text-text-1">
                            <span
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
                                aria-hidden="true"
                            >
                                {siteName.charAt(0).toUpperCase() || "S"}
                            </span>
                            <CaretDown size={12} aria-hidden="true" />
                        </span>
                    }
                    items={[
                        { label: "Pengaturan", icon: <Gear size={16} />, onSelect: () => router.push("/admin/settings") },
                        { label: "Keluar", icon: <SignOut size={16} />, danger: true, onSelect: handleLogout },
                    ]}
                />
            </div>
        </header>
    );
}
