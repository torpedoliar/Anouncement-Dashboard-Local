"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GearSix, Key, List, SignOut, SquaresFour, X } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";

interface PortalHeaderProps {
    userName?: string | null;
}

export default function PortalHeader({ userName }: PortalHeaderProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { href: "/portal", icon: SquaresFour, label: "Aplikasi" },
        { href: "/portal/credentials", icon: Key, label: "Kredensial" },
        { href: "/portal/settings", icon: GearSix, label: "Pengaturan" },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-surface-1">
            <div className="flex h-14 items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <Link href="/portal" className="font-display font-semibold text-text-1">
                    <span className="text-accent">PORTAL</span> SSO
                </Link>

                {/* Desktop nav */}
                <nav className="hidden items-center gap-1 sm:flex">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive(item.href) ? "page" : undefined}
                                className={`inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                                    isActive(item.href)
                                        ? "bg-accent-subtle text-accent"
                                        : "text-text-2 hover:bg-surface-2 hover:text-text-1"
                                }`}
                            >
                                <Icon size={16} aria-hidden="true" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right side */}
                <div className="flex items-center gap-3">
                    <span className="hidden text-sm text-text-2 sm:inline">{userName}</span>
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<SignOut size={16} aria-hidden="true" />}
                        onClick={() => signOut({ callbackUrl: "/portal-login" })}
                        aria-label="Keluar"
                    >
                        Keluar
                    </Button>

                    {/* Mobile toggle */}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
                        aria-expanded={mobileOpen}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-control text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 sm:hidden"
                    >
                        {mobileOpen ? <X size={16} aria-hidden="true" /> : <List size={16} aria-hidden="true" />}
                    </button>
                </div>
            </div>

            {/* Mobile nav */}
            {mobileOpen && (
                <div className="absolute inset-x-0 top-14 border-b border-border bg-surface-1 p-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                aria-current={isActive(item.href) ? "page" : undefined}
                                className={`flex min-h-11 items-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors duration-150 ${
                                    isActive(item.href)
                                        ? "bg-accent-subtle text-accent"
                                        : "text-text-2 hover:bg-surface-2 hover:text-text-1"
                                }`}
                            >
                                <Icon size={16} aria-hidden="true" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            )}
        </header>
    );
}