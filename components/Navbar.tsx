"use client";

import Link from "next/link";
import Image from "next/image";
import { FiMenu, FiX } from "react-icons/fi";
import { useState, useEffect } from "react";

interface NavLink {
    href: string;
    label: string;
}

interface NavbarProps {
    logoPath?: string | null;
    siteName?: string;
    customLinks?: NavLink[];
}

export default function Navbar({ logoPath, siteName = "Santos Jaya Abadi", customLinks }: NavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Mark as mounted to enable client-side rendering
        setMounted(true);

        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };

        // Initial check
        handleScroll();
        handleResize();

        window.addEventListener("scroll", handleScroll);
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    // Use defaults during SSR to prevent hydration mismatch
    const showDesktopNav = mounted ? isDesktop : true;
    const showMobileMenu = mounted ? !isDesktop : false;

    const navLinks = customLinks || [
        { href: "/", label: "BERANDA" },
        { href: "/#news", label: "BERITA" },
        { href: "/search", label: "PENCARIAN" },
    ];

    return (
        <>
            {/* Skip to Content Link - Accessibility */}
            <a
                href="#news"
                /*
                  Style inline di sini dulu menduplikasi kelas .skip-link di
                  globals.css — termasuk handler onFocus/onBlur yang meniru
                  `.skip-link:focus`. Duplikatnya juga memakai --text-primary
                  sebagai warna teks di atas merah brand, yang di tema terang
                  jadi teks gelap di atas merah (kontras buruk). Kelas CSS sudah
                  memakai --site-text-on-primary, jadi cukup pakai kelasnya.
                */
                className="skip-link"
            >
                Langsung ke Konten
            </a>
            <nav
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    // Sejajar `z-sticky` pada skala z-index semantik.
                    zIndex: 200,
                    // `transition: all` memaksa browser mengawasi setiap properti,
                    // termasuk properti layout. Dibatasi ke yang benar-benar berubah.
                    transition: 'background-color 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
                    backgroundColor: isScrolled ? 'rgba(0, 0, 0, 0.95)' : 'transparent',
                    borderBottom: isScrolled ? '1px solid var(--border-color)' : 'none',
                    backdropFilter: isScrolled ? 'blur(8px)' : 'none',
                }}
            >
                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
                        {/* Logo */}
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {logoPath ? (
                                <Image
                                    src={logoPath}
                                    alt={siteName}
                                    width={48}
                                    height={48}
                                    style={{ objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: 'var(--brand-red)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '18px' }}>
                                        {siteName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <span style={{
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                            }}>
                                {siteName}
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        {showDesktopNav && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        style={{
                                            color: 'var(--text-secondary)',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            letterSpacing: '0.15em',
                                            textTransform: 'uppercase',
                                            transition: 'color 0.3s',
                                            padding: '8px 0',
                                            borderBottom: '2px solid transparent',
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.color = '#fff';
                                            e.currentTarget.style.borderBottomColor = '#dc2626';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.color = '#a3a3a3';
                                            e.currentTarget.style.borderBottomColor = 'transparent';
                                        }}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        )}

                        {/* Mobile Menu Button */}
                        {showMobileMenu && (
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                style={{
                                    padding: '8px',
                                    color: 'var(--text-primary)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu */}
                    {showMobileMenu && isMobileMenuOpen && (
                        <div style={{
                            padding: '16px 0',
                            borderTop: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        }}>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '12px 16px',
                                        color: 'var(--text-secondary)',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        letterSpacing: '0.1em',
                                    }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <Link
                                href="/admin-login"
                                onClick={() => setIsMobileMenuOpen(false)}
                                style={{
                                    display: 'block',
                                    padding: '12px 16px',
                                    color: 'var(--brand-red)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    letterSpacing: '0.1em',
                                }}
                            >
                                ADMIN
                            </Link>
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
}
