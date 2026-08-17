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

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        // Initial check
        handleScroll();

        window.addEventListener("scroll", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    // Navbar lalu memakai state isDesktop + guard mounted yang default-true di SSR,
    // jadi mobile melukis layout desktop (7 item pada gap 40px di container 312px)
    // sebelum hydration lalu snap ke hamburger. Kedua cabang kini dirender tanpa
    // syarat dan diatur lewat breakpoint CSS (hidden lg:flex / lg:hidden). Lihat
    // globals.css untuk catatan panjang tentang bug isDesktop-default-true yang sama.

    const navLinks = customLinks || [
        { href: "/site", label: "BERANDA" },
    ];

    return (
        <>
            {/* Skip to Content Link - Accessibility */}
            <a
                href="#main-content"
                /*
                  Style inline di sini dulu menduplikasi kelas .skip-link di
                  globals.css — termasuk handler onFocus/onBlur yang meniru
                  `.skip-link:focus`. Duplikatnya juga memakai --text-primary
                  sebagai warna teks di atas merah brand, yang di tema terang
                  jadi teks gelap di atas merah (kontras buruk). Kelas CSS sudah
                  memakai --site-text-on-primary, jadi cukup pakai kelasnya.
                  Target #main-content ada di <main> layout site (T2.5); #news
                  lama hilang setelah app/page.tsx dihapus di T1.
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
                        <div className="hidden lg:flex" style={{ alignItems: 'center', gap: '40px' }}>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="nav-link"
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        letterSpacing: '0.15em',
                                        textTransform: 'uppercase',
                                        padding: '8px 0',
                                        borderBottom: '2px solid transparent',
                                    }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label={isMobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
                            aria-expanded={isMobileMenuOpen}
                            className="lg:hidden"
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
                    </div>

                    {/* Mobile Menu */}
                    {isMobileMenuOpen && (
                        <div className="lg:hidden" style={{
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
