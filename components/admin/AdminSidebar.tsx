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
    List,
} from "@phosphor-icons/react";
import { adminNavGroups, findActiveAdminItem } from "@/lib/admin-nav";
import Button from "@/components/ui/Button";
import SiteSelector from "./SiteSelector";

interface AdminSidebarProps {
    userName?: string | null;
    userEmail?: string | null;
    isSuperAdmin?: boolean;
}

export default function AdminSidebar({ userName, userEmail, isSuperAdmin }: AdminSidebarProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(true);
    const [collapsed, setCollapsed] = useState(() =>
        typeof window !== "undefined"
            ? localStorage.getItem("adminSidebarCollapsed") === "1"
            : false
    );
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    // Detect screen size
    useEffect(() => {
        const checkScreenSize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };
        checkScreenSize();
        window.addEventListener("resize", checkScreenSize);
        return () => window.removeEventListener("resize", checkScreenSize);
    }, []);

    // Close sidebar when route changes on mobile
    useEffect(() => {
        if (!isDesktop) {
            setIsOpen(false);
        }
    }, [pathname, isDesktop]);

    // Live clock - update every second
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("adminSidebarCollapsed", next ? "1" : "0");
            return next;
        });
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await signOut({ callbackUrl: "/admin-login" });
    };

    // Sidebar: fixed desktop (icon rail ↔ expanded) OR mobile slide-over
    const sidebarVisible = isDesktop || isOpen;
    const rail = isDesktop && collapsed;

    return (
        <>
            {/* Mobile Menu Button - Only visible on mobile */}
            {!isDesktop && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="fixed top-4 left-4 z-[60] rounded-control border border-border bg-surface-2 p-2 text-text-1 cursor-pointer transition-transform duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    style={{ transform: isOpen ? "translateX(256px)" : "translateX(0)" }}
                    aria-label="Buka menu"
                >
                    {isOpen ? <X size={24} /> : <List size={24} />}
                </button>
            )}

            {/* Backdrop for Mobile */}
            {!isDesktop && isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full border-r border-border bg-surface-0 flex flex-col transition-[width,transform] duration-300 ${rail ? "w-16" : "w-60"} ${sidebarVisible ? "translate-x-0" : "-translate-x-full"}`}
                aria-label="Navigasi admin"
            >
                {/* Logo + collapse toggle */}
                <div className={`flex items-center border-b border-border py-6 ${rail ? "justify-center px-0" : "justify-between px-6"}`}>
                    <Link href="/admin" className="flex items-center gap-3 min-w-0" aria-label="Admin dashboard">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-accent" aria-hidden="true">
                            <span className="font-display font-bold text-white text-lg">S</span>
                        </div>
                        {!rail && (
                            <div className="min-w-0">
                                <h1 className="font-display text-[11px] font-bold tracking-[0.1em] text-text-1 truncate">ADMIN</h1>
                                <p className="text-[11px] text-text-3 truncate">Dashboard</p>
                            </div>
                        )}
                    </Link>
                    {isDesktop && (
                        <button
                            onClick={toggleCollapsed}
                            className="ml-2 rounded-control p-1.5 text-text-2 hover:bg-surface-2 hover:text-text-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-expanded={!rail}
                            aria-label={rail ? "Perluas menu" : "Ciutkan menu"}
                        >
                            {rail ? <CaretRight size={16} /> : <CaretLeft size={16} />}
                        </button>
                    )}
                </div>

                {/* Live clock */}
                {currentTime && (
                    <div className={`border-b border-border p-4 ${rail ? "flex justify-center" : ""}`}>
                        <div className={`flex items-center gap-2 rounded-control bg-surface-1 px-2.5 py-2 ${rail ? "w-fit flex-col" : ""}`}>
                            <Clock size={14} className="text-accent shrink-0" aria-hidden="true" />
                            <div className={`${rail ? "text-center" : ""}`}>
                                {!rail && (
                                    <p className="text-[10px] font-medium text-text-2 truncate">
                                        {currentTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                )}
                                <p className={`font-mono tabular-nums font-semibold text-text-1 ${rail ? "text-xs" : "text-[13px]"}`}>
                                    {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Action */}
                <div className="border-b border-border p-4">
                    <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        onClick={() => router.push("/admin/announcements/new")}
                        iconLeft={<PlusCircle size={16} aria-hidden="true" />}
                        aria-label="Buat pengumuman baru"
                    >
                        {!rail && "Buat Baru"}
                    </Button>
                </div>

                {/* Site Selector (kept for now — replaced by MastheadRack in Task 5) */}
                <div className="border-b border-border px-4 pb-4">
                    <SiteSelector />
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4" aria-label="Menu utama">
                    <ul className="list-none p-0 m-0">
                        {adminNavGroups.map((group) => {
                            const items = group.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
                            if (items.length === 0) return null;
                            return (
                                <li key={group.id} className="mb-4">
                                    {!rail && (
                                        <p className="px-6 mb-1 text-xs font-medium text-text-3">{group.title}</p>
                                    )}
                                    <ul className="list-none p-0 m-0">
                                        {items.map((item) => {
                                            const active = findActiveAdminItem(pathname, adminNavGroups, isSuperAdmin)?.href === item.href;
                                            const Icon = item.icon;
                                            return (
                                                <li key={item.href}>
                                                    <Link
                                                        href={item.href}
                                                        className={`flex items-center gap-3 py-3 border-l-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                                                            active
                                                                ? "bg-accent/10 text-accent border-accent"
                                                                : "text-text-2 border-transparent hover:bg-surface-2 hover:text-text-1"
                                                        } ${rail ? "justify-center px-0" : "px-6"}`}
                                                        aria-current={active ? "page" : undefined}
                                                        title={rail ? item.label : undefined}
                                                    >
                                                        <Icon
                                                            size={rail ? 18 : 18}
                                                            className={active ? "text-accent" : "text-text-3 group-hover:text-text-1"}
                                                            aria-hidden="true"
                                                        />
                                                        {!rail && <span>{item.label}</span>}
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

                {/* User Profile & Logout */}
                <div className="border-t border-border bg-surface-0 p-4">
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center bg-surface-3 ${rail ? "mx-auto" : ""}`}
                            aria-hidden="true"
                        >
                            <span className="text-sm font-bold text-text-1">
                                {userName?.charAt(0)?.toUpperCase() || "A"}
                            </span>
                        </div>
                        {!rail && (
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-text-1">{userName}</p>
                                <p className="truncate text-[11px] text-text-3">{userEmail}</p>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`mt-3 w-full justify-start text-danger hover:bg-danger/10 ${rail ? "justify-center" : ""}`}
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        iconLeft={!rail ? <SignOut size={14} aria-hidden="true" /> : undefined}
                        aria-label="Keluar"
                    >
                        {!rail && <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>}
                        {rail && <SignOut size={16} aria-hidden="true" />}
                    </Button>
                </div>
            </aside>
        </>
    );
}
