"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiYoutube } from "react-icons/fi";
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

export default function Footer() {
    const currentYear = new Date().getFullYear();
    const [settings, setSettings] = useState<Settings>({
        siteName: "Santos Jaya Abadi",
        aboutText: "Didirikan tahun 1979, PT. Santos Jaya Abadi adalah salah satu perusahaan roasting kopi terbesar di Asia Tenggara dengan merek ikonik Kapal Api.",
        logoPath: null,
        instagramUrl: null,
        linkedinUrl: null,
        facebookUrl: null,
        twitterUrl: null,
        youtubeUrl: null,
    });

    useEffect(() => {
        fetch("/api/settings")
            .then((res) => res.json())
            .then((data) => {
                if (data) setSettings(data);
            })
            .catch((err) => console.error("Failed to fetch settings:", err));
    }, []);

    const socialLinks = [
        { icon: FiInstagram, href: settings.instagramUrl, label: "Instagram" },
        { icon: FiFacebook, href: settings.facebookUrl, label: "Facebook" },
        { icon: FiTwitter, href: settings.twitterUrl, label: "Twitter" },
        { icon: FiLinkedin, href: settings.linkedinUrl, label: "LinkedIn" },
        { icon: FiYoutube, href: settings.youtubeUrl, label: "YouTube" },
    ].filter(link => link.href);

    return (
        <footer style={{ backgroundColor: '#000', borderTop: '1px solid #1a1a1a' }}>
            {/* Main Footer */}
            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 24px' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '48px',
                }}>
                    {/* Company Info */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            {settings.logoPath ? (
                                <Image
                                    src={settings.logoPath}
                                    alt={settings.siteName}
                                    width={48}
                                    height={48}
                                    style={{ objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '18px' }}>
                                        {settings.siteName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <span style={{
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 700,
                                color: '#fff',
                                fontSize: '12px',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                            }}>
                                {settings.siteName}
                            </span>
                        </div>
                        <p style={{
                            color: '#737373',
                            fontSize: '14px',
                            lineHeight: 1.7,
                            marginBottom: '24px',
                            maxWidth: '320px',
                        }}>
                            {settings.aboutText}
                        </p>
                        {/* Social Links */}
                        {socialLinks.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {socialLinks.map((social, index) => (
                                    <a
                                        key={index}
                                        href={social.href || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={social.label}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            border: '1px solid #333',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#737373',
                                            transition: 'all 0.3s',
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.borderColor = '#dc2626';
                                            e.currentTarget.style.backgroundColor = '#dc2626';
                                            e.currentTarget.style.color = '#fff';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.borderColor = '#333';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = '#737373';
                                        }}
                                    >
                                        <social.icon size={16} />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 style={{
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            marginBottom: '24px',
                        }}>
                            TAUTAN
                        </h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {[
                                { href: "/", label: "Beranda" },
                                { href: "/#news", label: "Berita" },
                                { href: "/search", label: "Pencarian" },
                            ].map((link) => (
                                <li key={link.href} style={{ marginBottom: '12px' }}>
                                    <Link
                                        href={link.href}
                                        style={{
                                            color: '#737373',
                                            fontSize: '14px',
                                            transition: 'color 0.3s',
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                                        onMouseOut={(e) => e.currentTarget.style.color = '#737373'}
                                    >
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
            <div style={{ borderTop: '1px solid #1a1a1a' }}>
                <div style={{
                    maxWidth: '1280px',
                    margin: '0 auto',
                    padding: '24px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '16px',
                }}>
                    <p style={{
                        color: '#525252',
                        fontSize: '12px',
                        letterSpacing: '0.05em',
                    }}>
                        © {currentYear} {settings.siteName.toUpperCase()}. ALL RIGHTS RESERVED.
                    </p>
                    <Link
                        href="/admin-login"
                        style={{
                            color: '#333',
                            fontSize: '11px',
                            textDecoration: 'none',
                            transition: 'color 0.3s',
                        }}
                    >
                        Admin
                    </Link>
                </div>
            </div>
        </footer>
    );
}
