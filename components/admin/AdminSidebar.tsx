"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    FiHome,
    FiFileText,
    FiSettings,
    FiLogOut,
    FiPlusCircle,
    FiTag,
    FiUsers,
    FiActivity,
    FiMenu,
    FiX
} from "react-icons/fi";

interface AdminSidebarProps {
    userName?: string | null;
    userEmail?: string | null;
}

export default function AdminSidebar({ userName, userEmail }: AdminSidebarProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar when route changes on mobile
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await signOut({ callbackUrl: "/admin-login" });
    };

    const navItems = [
        { href: "/admin", icon: FiHome, label: "DASHBOARD" },
        { href: "/admin/announcements", icon: FiFileText, label: "PENGUMUMAN" },
        { href: "/admin/categories", icon: FiTag, label: "KATEGORI" },
        { href: "/admin/users", icon: FiUsers, label: "PENGGUNA" },
        { href: "/admin/audit-logs", icon: FiActivity, label: "AUDIT LOG" },
        { href: "/admin/settings", icon: FiSettings, label: "PENGATURAN" },
    ];

    return (
        <>
            {/* Mobile Menu Button - Visible mainly on mobile */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-4 left-4 z-50 p-2 bg-neutral-900 border border-neutral-800 rounded-md text-white lg:hidden"
                aria-label="Toggle Menu"
            >
                {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>

            {/* Backdrop for Mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed top-0 left-0 z-40 h-full w-64 bg-black border-r border-neutral-900 
                    transition-transform duration-300 ease-in-out
                    flex flex-col
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                `}
            >
                {/* Logo */}
                <div className="p-6 border-b border-neutral-900">
                    <Link href="/admin" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-red-600 flex items-center justify-center transition-transform group-hover:scale-105">
                            <span className="font-montserrat font-bold text-white text-lg">S</span>
                        </div>
                        <div>
                            <h1 className="font-montserrat font-bold text-white text-[11px] tracking-widest">ADMIN</h1>
                            <p className="text-[11px] text-neutral-500">Dashboard</p>
                        </div>
                    </Link>
                </div>

                {/* Quick Action */}
                <div className="p-4 border-b border-neutral-900">
                    <Link
                        href="/admin/announcements/new"
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold tracking-widest transition-colors"
                    >
                        <FiPlusCircle size={14} />
                        <span>BUAT BARU</span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4">
                    <ul className="space-y-1 px-3">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`
                                            flex items-center gap-3 px-4 py-3 rounded-none text-[11px] font-semibold tracking-widest transition-colors
                                            ${isActive
                                                ? "bg-neutral-900 text-red-500 border-l-2 border-red-500"
                                                : "text-neutral-400 hover:text-white hover:bg-neutral-900/50 border-l-2 border-transparent"
                                            }
                                        `}
                                    >
                                        <item.icon size={16} className={isActive ? "text-red-500" : "text-neutral-500"} />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-neutral-900 bg-black">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-10 h-10 bg-neutral-900 flex items-center justify-center rounded-sm">
                            <span className="text-white font-bold text-sm">
                                {userName?.charAt(0)?.toUpperCase() || "A"}
                            </span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-[13px] text-white font-medium truncate">
                                {userName}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate">
                                {userEmail}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={`
                            w-full flex items-center gap-2 px-4 py-2 bg-transparent text-neutral-400 hover:text-red-500 hover:bg-neutral-900 
                            text-[11px] font-semibold tracking-widest transition-colors
                            ${isLoggingOut ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        `}
                    >
                        <FiLogOut size={14} />
                        <span>{isLoggingOut ? "KELUAR..." : "KELUAR"}</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
