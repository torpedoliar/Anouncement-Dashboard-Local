"use client";

import { useState } from "react";
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
    FiActivity
} from "react-icons/fi";

interface AdminSidebarProps {
    userName?: string | null;
    userEmail?: string | null;
}

export default function AdminSidebar({ userName, userEmail }: AdminSidebarProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const pathname = usePathname();

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
        <aside style={{
            width: '256px',
            backgroundColor: '#000',
            borderRight: '1px solid #1a1a1a',
            position: 'fixed',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Logo */}
            <div style={{ padding: '24px', borderBottom: '1px solid #1a1a1a' }}>
                <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <span style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 'bold',
                            color: '#fff',
                            fontSize: '18px',
                        }}>S</span>
                    </div>
                    <div>
                        <h1 style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 700,
                            color: '#fff',
                            fontSize: '11px',
                            letterSpacing: '0.1em',
                        }}>ADMIN</h1>
                        <p style={{ fontSize: '11px', color: '#525252' }}>Dashboard</p>
                    </div>
                </Link>
            </div>

            {/* Quick Action */}
            <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a' }}>
                <Link
                    href="/admin/announcements/new"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                    }}
                >
                    <FiPlusCircle size={14} />
                    BUAT BARU
                </Link>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '16px' }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== "/admin" && pathname?.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                marginBottom: '4px',
                                backgroundColor: isActive ? '#dc2626' : 'transparent',
                                color: isActive ? '#fff' : '#737373',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.1em',
                                transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.backgroundColor = '#0a0a0a';
                                    e.currentTarget.style.color = '#fff';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#737373';
                                }
                            }}
                        >
                            <item.icon size={16} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* User & Logout */}
            <div style={{ padding: '16px', borderTop: '1px solid #1a1a1a' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                            {userName?.charAt(0)?.toUpperCase() || "A"}
                        </span>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{
                            fontSize: '13px',
                            color: '#fff',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {userName}
                        </p>
                        <p style={{
                            fontSize: '11px',
                            color: '#525252',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {userEmail}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#737373',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                        opacity: isLoggingOut ? 0.5 : 1,
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.color = '#dc2626';
                        e.currentTarget.style.backgroundColor = '#0a0a0a';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.color = '#737373';
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <FiLogOut size={14} />
                    <span>{isLoggingOut ? "KELUAR..." : "KELUAR"}</span>
                </button>
            </div>
        </aside>
    );
}
