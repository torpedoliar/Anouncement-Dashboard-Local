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
            <a href="#main-content" className="skip-link">
                Langsung ke Konten
            </a>
            <nav
                className={`fixed inset-x-0 top-0 z-sticky transition-colors duration-300 ${
                    isScrolled
                        ? "border-b border-border bg-[rgb(var(--surface-0-rgb)/0.95)] backdrop-blur-md"
                        : "border-b border-transparent bg-transparent"
                }`}
            >
                <div className="mx-auto max-w-7xl px-6">
                    <div className="flex h-20 items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-3">
                            {logoPath ? (
                                <Image
                                    src={logoPath}
                                    alt={siteName}
                                    width={48}
                                    height={48}
                                    className="object-contain"
                                />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center bg-brand">
                                    <span aria-hidden="true" className="text-lg font-bold text-white">
                                        {siteName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-text-1">
                                {siteName}
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden items-center gap-10 lg:flex">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="nav-link px-0 py-2 text-xs font-semibold uppercase tracking-[0.15em]"
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
                            className="cursor-pointer p-2 text-text-1 transition-colors duration-150 hover:text-accent lg:hidden"
                        >
                            {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                        </button>
                    </div>

                    {/* Mobile Menu */}
                    {isMobileMenuOpen && (
                        <div className="border-t border-border bg-[rgb(var(--surface-1-rgb)/0.98)] py-4 backdrop-blur-md lg:hidden">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block px-4 py-3 text-xs font-semibold tracking-[0.1em] text-text-2 transition-colors duration-150 hover:text-text-1"
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <Link
                                href="/admin-login"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block px-4 py-3 text-xs font-semibold tracking-[0.1em] text-accent"
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
