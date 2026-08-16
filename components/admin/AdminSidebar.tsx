"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Clock,
    CaretLeft,
    CaretRight,
    PlusCircle,
    SignOut,
    X,
} from "@phosphor-icons/react";
import { adminNavGroups, findActiveAdminItem } from "@/lib/admin-nav";
import Button from "@/components/ui/Button";
import MastheadRack from "./MastheadRack";

interface AdminSidebarProps {
    userName?: string | null;
    userEmail?: string | null;
    isSuperAdmin?: boolean;
    /** Mode rail desktop. Hanya untuk label aria/arah caret — geometri diatur CSS. */
    rail: boolean;
    onToggleRail: () => void;
    drawerOpen: boolean;
    onCloseDrawer: () => void;
}

/**
 * Panel navigasi admin.
 *
 * Geometri (lebar, posisi fixed, transform drawer, breakpoint 1024px) sepenuhnya
 * milik CSS lewat kelas `.admin-sidebar` + atribut `html[data-admin-sidebar]`.
 * Komponen ini tidak lagi menghitung `window.innerWidth`; tampil/sembunyi per
 * breakpoint memakai utilitas `lg:` sehingga benar sebelum hydration.
 */
export default function AdminSidebar({
    userName,
    userEmail,
    isSuperAdmin,
    rail,
    onToggleRail,
    drawerOpen,
    onCloseDrawer,
}: AdminSidebarProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    // Jam hidup — diperbarui tiap detik.
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await signOut({ callbackUrl: "/admin-login" });
    };

    const activeHref = findActiveAdminItem(pathname, adminNavGroups, isSuperAdmin)?.href;

    return (
        <aside
            className="admin-sidebar fixed top-0 left-0 z-sidebar flex h-full flex-col border-r border-border bg-surface-0"
            aria-label="Navigasi admin"
        >
            {/* Logo + kontrol rail/tutup */}
            <div className="admin-rail-stack flex items-center justify-between gap-2 border-b border-border px-6 py-6">
                <Link
                    href="/admin"
                    className="flex min-w-0 items-center gap-3 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label="Dashboard admin"
                >
                    <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent"
                        aria-hidden="true"
                    >
                        <span className="font-display text-lg font-bold text-white">S</span>
                    </span>
                    <span className="admin-rail-hide min-w-0">
                        <span className="block truncate font-display text-[11px] font-bold tracking-[0.1em] text-text-1">
                            ADMIN
                        </span>
                        <span className="block truncate text-[11px] text-text-3">Dashboard</span>
                    </span>
                </Link>

                {/* Desktop: ciutkan ke rail. Mobile: tutup drawer. */}
                <button
                    type="button"
                    onClick={onToggleRail}
                    className="hidden shrink-0 cursor-pointer rounded-control p-1.5 text-text-2 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:inline-flex"
                    aria-expanded={!rail}
                    aria-label={rail ? "Perluas menu" : "Ciutkan menu"}
                    title={rail ? "Perluas menu" : "Ciutkan menu"}
                >
                    {rail ? <CaretRight size={16} /> : <CaretLeft size={16} />}
                </button>
                <button
                    type="button"
                    onClick={onCloseDrawer}
                    className="shrink-0 cursor-pointer rounded-control p-1.5 text-text-2 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
                    aria-label="Tutup menu"
                    tabIndex={drawerOpen ? 0 : -1}
                >
                    <X size={18} />
                </button>
            </div>

            {/* Jam */}
            <div className="admin-rail-center border-b border-border p-4">
                <div className="flex items-center gap-2 rounded-control bg-surface-1 px-2.5 py-2">
                    <Clock size={14} className="shrink-0 text-accent" aria-hidden="true" />
                    <div>
                        {/* suppressHydrationWarning: jam sengaja beda antara server & klien. */}
                        <p
                            className="admin-rail-hide truncate text-[10px] font-medium text-text-2"
                            suppressHydrationWarning
                        >
                            {currentTime
                                ? currentTime.toLocaleDateString("id-ID", {
                                      weekday: "long",
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                  })
                                : "\u00A0"}
                        </p>
                        <p
                            className="mono text-[13px] font-semibold text-text-1"
                            suppressHydrationWarning
                        >
                            {currentTime
                                ? currentTime.toLocaleTimeString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                  })
                                : "--:--:--"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Aksi cepat */}
            <div className="border-b border-border p-4">
                <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push("/admin/announcements/new")}
                    iconLeft={<PlusCircle size={16} aria-hidden="true" />}
                    aria-label="Buat pengumuman baru"
                    title="Buat pengumuman baru"
                >
                    <span className="admin-rail-hide">Buat Baru</span>
                </Button>
            </div>

            {/* Rak situs (masthead) — teks penuh, disembunyikan di mode rail */}
            <div className="admin-rail-hide border-b border-border px-4 pb-4">
                <MastheadRack />
            </div>

            {/* Navigasi */}
            <nav className="flex-1 overflow-y-auto py-4" aria-label="Menu utama">
                <ul className="m-0 list-none p-0">
                    {adminNavGroups.map((group) => {
                        const items = group.items.filter(
                            (item) => !item.superAdminOnly || isSuperAdmin
                        );
                        if (items.length === 0) return null;
                        return (
                            <li key={group.id} className="mb-4">
                                <p className="admin-rail-hide mb-1 px-6 text-xs font-medium text-text-3">
                                    {group.title}
                                </p>
                                <ul className="m-0 list-none p-0">
                                    {items.map((item) => {
                                        const active = activeHref === item.href;
                                        const Icon = item.icon;
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    className={`admin-rail-center flex items-center gap-3 px-6 py-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                                                        active
                                                            ? "bg-accent-subtle text-accent"
                                                            : "text-text-2 hover:bg-surface-2 hover:text-text-1"
                                                    }`}
                                                    aria-current={active ? "page" : undefined}
                                                    title={item.label}
                                                >
                                                    <Icon
                                                        size={18}
                                                        className={`shrink-0 ${
                                                            active ? "text-accent" : "text-text-3"
                                                        }`}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="admin-rail-hide truncate">
                                                        {item.label}
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Profil & keluar */}
            <div className="border-t border-border bg-surface-0 p-4">
                <div className="admin-rail-center flex items-center gap-3">
                    <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-3"
                        aria-hidden="true"
                    >
                        <span className="text-sm font-bold text-text-1">
                            {userName?.charAt(0)?.toUpperCase() || "A"}
                        </span>
                    </span>
                    <span className="admin-rail-hide min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-text-1">
                            {userName}
                        </span>
                        <span className="block truncate text-[11px] text-text-3">{userEmail}</span>
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="admin-rail-center mt-3 w-full justify-start text-danger hover:bg-danger-subtle hover:text-danger"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    iconLeft={<SignOut size={16} aria-hidden="true" />}
                    aria-label="Keluar"
                    title="Keluar"
                >
                    <span className="admin-rail-hide">
                        {isLoggingOut ? "Keluar..." : "Keluar"}
                    </span>
                </Button>
            </div>
        </aside>
    );
}
