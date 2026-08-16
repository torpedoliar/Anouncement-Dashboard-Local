"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, CaretDown, SignOut, Gear, Sun, Moon, List } from "@phosphor-icons/react";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { findActiveAdminItem } from "@/lib/admin-nav";
import Dropdown from "@/components/ui/Dropdown";

interface AdminTopbarProps {
    drawerOpen: boolean;
    onToggleDrawer: () => void;
}

export default function AdminTopbar({ drawerOpen, onToggleDrawer }: AdminTopbarProps) {
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [adminTheme, setAdminTheme] = useState<"light" | "dark" | null>(null);
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

    // Tema sudah diterapkan script pra-paint di app/admin/layout.tsx; di sini
    // kita cuma menyalin keadaan DOM ke state supaya ikon & aria-pressed cocok.
    // Tidak ada penulisan class di mount — itu yang dulu menyebabkan kedip
    // gelap→terang bagi pengguna yang menyimpan tema terang.
    useEffect(() => {
        setAdminTheme(
            document.documentElement.classList.contains("theme-light") ? "light" : "dark"
        );
    }, []);

    const handleToggleTheme = () => {
        const next = adminTheme === "light" ? "dark" : "light";
        setAdminTheme(next);
        try {
            localStorage.setItem("adminTheme", next);
        } catch {
            // Storage diblokir: tema tetap berubah untuk sesi ini.
        }
        document.documentElement.classList.toggle("theme-light", next === "light");
    };

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
        // End the NextAuth session (clears the JWT cookie), then redirect.
        // Mirrors AdminSidebar — a bare router.push would leave the session cookie valid.
        await signOut({ callbackUrl: "/admin-login" });
    };

    return (
        <header className="sticky top-0 z-sticky flex h-14 items-center justify-between gap-4 border-b border-border bg-surface-0 px-4 md:px-6">
            {/* Left: tombol menu (mobile) + judul halaman */}
            <div className="flex min-w-0 items-center gap-2">
                {/* Dulu tombol ini mengapung `fixed` di atas konten dan memaksa
                    `<main>` ber-padding-top 60px, padahal topbar tingginya 56px —
                    hasilnya pita kosong 60px di atas topbar. Sekarang ikut di
                    dalam topbar: satu bar, tanpa selisih, tanpa lapisan z-index
                    tambahan. */}
                <button
                    type="button"
                    onClick={onToggleDrawer}
                    className="-ml-1 shrink-0 cursor-pointer rounded-control p-2 text-text-2 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
                    aria-label={drawerOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
                    aria-expanded={drawerOpen}
                >
                    <List size={20} aria-hidden="true" />
                </button>
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
                {/* Placeholder "--:--:--" dipertahankan agar lebar tidak berubah
                    saat jam pertama kali muncul (menghindari layout shift). */}
                <span
                    className="hidden font-mono tabular-nums text-sm text-text-2 sm:inline"
                    suppressHydrationWarning
                >
                    {currentTime
                        ? currentTime.toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                          })
                        : "--:--:--"}
                </span>

                {/* Notifications (bell) — placeholder arrival; real center lands Phase 2 */}
                <button
                    className="rounded-control p-2 text-text-2 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label="Notifikasi"
                    onClick={() => router.push("/admin/analytics")}
                >
                    <Bell size={18} aria-hidden="true" />
                </button>

                {/* Light/night theme toggle */}
                <button
                    className="rounded-control p-2 text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors duration-300 ease-[var(--motion-ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-pressed={adminTheme === "light"}
                    aria-label="Beralih tampilan terang/gelap"
                    title={adminTheme === "light" ? "Tampilan gelap" : "Tampilan terang"}
                    onClick={handleToggleTheme}
                >
                    {adminTheme === "light"
                        ? <Moon size={18} aria-hidden="true" />
                        : <Sun size={18} aria-hidden="true" />
                    }
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
