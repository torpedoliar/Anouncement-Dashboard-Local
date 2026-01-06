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
    FiX,
    FiClock,
    FiImage,
    FiMessageSquare,
    FiMonitor,
    FiMail,
    FiSend
} from "react-icons/fi";


interface AdminSidebarProps {
    userName?: string | null;
    userEmail?: string | null;
}

export default function AdminSidebar({ userName, userEmail }: AdminSidebarProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(true);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const pathname = usePathname();

    // Detect screen size
    useEffect(() => {
        const checkScreenSize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
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

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await signOut({ callbackUrl: "/admin-login" });
    };

    const navItems = [
        { href: "/admin", icon: FiHome, label: "DASHBOARD" },
        { href: "/admin/announcements", icon: FiFileText, label: "PENGUMUMAN" },
        { href: "/admin/categories", icon: FiTag, label: "KATEGORI" },
        { href: "/admin/media", icon: FiImage, label: "MEDIA" },
        { href: "/admin/comments", icon: FiMessageSquare, label: "KOMENTAR" },
        { href: "/admin/analytics", icon: FiActivity, label: "ANALYTICS" },
        { href: "/admin/users", icon: FiUsers, label: "PENGGUNA" },
        { href: "/admin/sessions", icon: FiMonitor, label: "SESI" },
        { href: "/admin/email", icon: FiMail, label: "EMAIL" },
        { href: "/admin/newsletter", icon: FiSend, label: "NEWSLETTER" },
        { href: "/admin/audit-logs", icon: FiActivity, label: "AUDIT LOG" },
        { href: "/admin/settings", icon: FiSettings, label: "PENGATURAN" },
    ];

    // Sidebar should be visible if: Desktop OR Mobile+Open
    const sidebarVisible = isDesktop || isOpen;

    return (
        <>
            {/* Mobile Menu Button - Only visible on mobile */}
            {!isDesktop && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        position: 'fixed',
                        top: '16px',
                        left: '16px',
                        zIndex: 60,
                        padding: '8px',
                        backgroundColor: '#171717',
                        border: '1px solid #262626',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                    }}
                    aria-label="Toggle Menu"
                >
                    {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                </button>
            )}

            {/* Backdrop for Mobile */}
            {!isDesktop && isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 40,
                    }}
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside style={{
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 50,
                height: '100%',
                width: '256px',
                backgroundColor: '#000',
                borderRight: '1px solid #1a1a1a',
                display: 'flex',
                flexDirection: 'column',
                transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.3s ease-in-out',
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
                    {/* Current Date & Time */}
                    {currentTime && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '12px',
                            padding: '8px 10px',
                            backgroundColor: '#0a0a0a',
                            borderRadius: '4px',
                        }}>
                            <FiClock size={14} style={{ color: '#dc2626' }} />
                            <div>
                                <p style={{ fontSize: '10px', color: '#a3a3a3', fontWeight: 500 }}>
                                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                                <p style={{ fontSize: '13px', color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    )}
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
                            boxSizing: 'border-box',
                            padding: '12px 16px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                        }}
                    >
                        <FiPlusCircle size={14} />
                        <span>BUAT BARU</span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px 24px',
                                            color: isActive ? '#dc2626' : '#a3a3a3',
                                            backgroundColor: isActive ? '#0a0a0a' : 'transparent',
                                            borderLeft: isActive ? '2px solid #dc2626' : '2px solid transparent',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            letterSpacing: '0.1em',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <item.icon size={16} />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User Profile & Logout */}
                <div style={{
                    padding: '16px',
                    borderTop: '1px solid #1a1a1a',
                    backgroundColor: '#000',
                }}>
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
                    >
                        <FiLogOut size={14} />
                        <span>{isLoggingOut ? "KELUAR..." : "KELUAR"}</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
