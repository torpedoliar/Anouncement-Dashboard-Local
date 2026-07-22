"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiGrid, FiKey, FiLogOut, FiMenu, FiX } from "react-icons/fi";

interface PortalHeaderProps {
    userName?: string | null;
}

export default function PortalHeader({ userName }: PortalHeaderProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { href: "/portal", icon: FiGrid, label: "Aplikasi" },
        { href: "/portal/credentials", icon: FiKey, label: "Kredensial" },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        <header style={{
            backgroundColor: "#111",
            borderBottom: "1px solid #262626",
            padding: "0 24px",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
        }}>
            {/* Logo */}
            <Link href="/portal" style={{
                color: "#fff",
                fontSize: "16px",
                fontWeight: 700,
                textDecoration: "none",
                fontFamily: "Montserrat, sans-serif",
            }}>
                <span style={{ color: "#dc2626" }}>PORTAL</span> SSO
            </Link>

            {/* Desktop nav */}
            <nav style={{ display: "flex", alignItems: "center", gap: "4px" }} className="desktop-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 14px",
                                borderRadius: "6px",
                                color: isActive(item.href) ? "#fff" : "#737373",
                                backgroundColor: isActive(item.href) ? "#262626" : "transparent",
                                textDecoration: "none",
                                fontSize: "13px",
                                fontWeight: 500,
                            }}
                        >
                            <Icon size={14} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Right side */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ color: "#a1a1aa", fontSize: "13px" }}>{userName}</span>
                <button
                    onClick={() => signOut({ callbackUrl: "/portal-login" })}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        backgroundColor: "transparent",
                        border: "1px solid #262626",
                        borderRadius: "6px",
                        color: "#737373",
                        fontSize: "13px",
                        cursor: "pointer",
                    }}
                >
                    <FiLogOut size={14} />
                    Keluar
                </button>

                {/* Mobile toggle */}
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    style={{
                        display: "none",
                        background: "none",
                        border: "none",
                        color: "#737373",
                        cursor: "pointer",
                        padding: "4px",
                    }}
                    className="mobile-toggle"
                >
                    {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
                </button>
            </div>

            {/* Mobile nav */}
            {mobileOpen && (
                <div style={{
                    position: "absolute",
                    top: "60px",
                    left: 0,
                    right: 0,
                    backgroundColor: "#111",
                    borderBottom: "1px solid #262626",
                    padding: "12px",
                    zIndex: 50,
                }}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "12px 16px",
                                    borderRadius: "6px",
                                    color: isActive(item.href) ? "#fff" : "#737373",
                                    backgroundColor: isActive(item.href) ? "#262626" : "transparent",
                                    textDecoration: "none",
                                    fontSize: "14px",
                                }}
                            >
                                <Icon size={16} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            )}
        </header>
    );
}
