"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { InstagramLogo, LinkedinLogo, FacebookLogo, TwitterLogo, YoutubeLogo } from "@phosphor-icons/react";
import NewsletterSubscribe from "./NewsletterSubscribe";

interface Settings {
    siteName: string;
    aboutText: string;
    logoPath: string | null;
    instagramUrl: string | null;
    linkedinUrl: string | null;
    facebookUrl: string | null;
    twitterUrl: string | null;
    youtubeUrl: string | null;
}

interface FooterProps {
    settings?: Partial<Settings>;
}

export default function Footer({ settings: initialSettings }: FooterProps) {
    const currentYear = new Date().getFullYear();
    const [settings, setSettings] = useState<Settings>({
        siteName: initialSettings?.siteName || "Santos Jaya Abadi",
        aboutText: initialSettings?.aboutText || "Didirikan tahun 1979, PT. Santos Jaya Abadi adalah salah satu perusahaan roasting kopi terbesar di Asia Tenggara dengan merek ikonik Kapal Api.",
        logoPath: initialSettings?.logoPath || null,
        instagramUrl: initialSettings?.instagramUrl || null,
        linkedinUrl: initialSettings?.linkedinUrl || null,
        facebookUrl: initialSettings?.facebookUrl || null,
        twitterUrl: initialSettings?.twitterUrl || null,
        youtubeUrl: initialSettings?.youtubeUrl || null,
    });

    useEffect(() => {
        if (initialSettings) return; // Skip fetch if settings provided via props

        fetch("/api/settings")
            .then((res) => res.json())
            .then((data) => {
                if (data) setSettings(data);
            })
            .catch((err) => console.error("Failed to fetch settings:", err));
    }, [initialSettings]);

    const socialLinks = [
        { icon: InstagramLogo, href: settings.instagramUrl, label: "Instagram" },
        { icon: FacebookLogo, href: settings.facebookUrl, label: "Facebook" },
        { icon: TwitterLogo, href: settings.twitterUrl, label: "Twitter" },
        { icon: LinkedinLogo, href: settings.linkedinUrl, label: "LinkedIn" },
        { icon: YoutubeLogo, href: settings.youtubeUrl, label: "YouTube" },
    ].filter(link => link.href);

    return (
        <footer className="border-t border-border bg-surface-0">
            {/* Main Footer */}
            <div className="mx-auto max-w-7xl px-6 py-16">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-12">
                    {/* Company Info */}
                    <div>
                        <div className="mb-6 flex items-center gap-3">
                            {settings.logoPath ? (
                                <Image
                                    src={settings.logoPath}
                                    alt={settings.siteName}
                                    width={48}
                                    height={48}
                                    className="object-contain"
                                />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center bg-brand">
                                    <span aria-hidden="true" className="text-lg font-bold text-white">
                                        {settings.siteName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <span className="text-xs font-bold uppercase tracking-[0.1em] text-text-1">
                                {settings.siteName}
                            </span>
                        </div>
                        <p className="mb-6 max-w-sm text-sm leading-relaxed text-text-3">
                            {settings.aboutText}
                        </p>
                        {/* Social Links */}
                        {socialLinks.length > 0 && (
                            <div className="flex gap-2">
                                {socialLinks.map((social, index) => (
                                    <a
                                        key={index}
                                        href={social.href || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={social.label}
                                        aria-label={social.label}
                                        className="footer-social flex h-10 w-10 items-center justify-center"
                                    >
                                        <social.icon size={16} aria-hidden="true" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h2 className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                            TAUTAN
                        </h2>
                        <ul className="m-0 list-none p-0">
                            {/* Tautan global. Berita/Pencarian adalah per-site (lihat
                                navbar site), jadi hanya Beranda ke site picker. */}
                            {[
                                { href: "/site", label: "Beranda" },
                            ].map((link) => (
                                <li key={link.href} className="mb-3">
                                    <Link href={link.href} className="footer-link text-sm">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Newsletter Subscribe */}
                    <NewsletterSubscribe variant="inline" />
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-border">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-6 py-6">
                    <p className="text-xs tracking-[0.05em] text-text-3">
                        © {currentYear} {settings.siteName.toUpperCase()}. ALL RIGHTS RESERVED.
                    </p>
                    <Link
                        href="/admin-login"
                        className="text-[11px] text-text-3 transition-colors duration-150 hover:text-text-1"
                    >
                        Admin
                    </Link>
                    <Link
                        href="/portal-login"
                        className="text-[11px] text-text-3 transition-colors duration-150 hover:text-text-1"
                    >
                        Portal Karyawan
                    </Link>
                </div>
            </div>
        </footer>
    );
}
