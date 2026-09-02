"use client";

/**
 * SitePickerCard Component
 * Displays a single site card in the site picker grid
 */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Tag } from "@phosphor-icons/react";

interface SitePickerCardProps {
    site: {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        logoPath?: string | null;
        logo?: string | null; // Match Prisma model
        primaryColor: string;
        _count?: {
            announcementSites?: number;
            categories?: number;
        };
    };
}

export default function SitePickerCard({ site }: SitePickerCardProps) {
    const articleCount = site._count?.announcementSites || 0;
    const categoryCount = site._count?.categories || 0;

    return (
        <Link
            href={`/site/${site.slug}`}
            className="site-picker-card"
            style={{
                display: "block",
                backgroundColor: "var(--bg-card)",
                borderRadius: "16px",
                padding: "28px",
                textDecoration: "none",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Gradient accent at top */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "4px",
                    background: `linear-gradient(90deg, ${site.primaryColor}, ${site.primaryColor}80)`,
                }}
            />

            {/* Logo or Color Circle */}
            <div
                style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "14px",
                    backgroundColor: site.primaryColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "20px",
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#fff",
                    boxShadow: `0 4px 20px ${site.primaryColor}40`,
                }}
            >
                {(site.logo || site.logoPath) ? (
                    <Image
                        width={320}
                        height={160}
                        src={site.logo || site.logoPath || ""}
                        alt={site.name}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain", // changed to contain for logos
                            borderRadius: "14px",
                        }}
                    />
                ) : (
                    site.name.charAt(0).toUpperCase()
                )}
            </div>

            {/* Site Name */}
            <h2
                style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: "8px",
                }}
            >
                {site.name}
            </h2>

            {/* Description */}
            {site.description && (
                <p
                    style={{
                        fontSize: "14px",
                        color: "var(--text-muted)",
                        marginBottom: "20px",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {site.description}
                </p>
            )}

            {/* Stats */}
            <div
                style={{
                    display: "flex",
                    gap: "16px",
                    marginBottom: "20px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "var(--text-tertiary)",
                    }}
                >
                    <FileText size={14} />
                    <span>{articleCount} artikel</span>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "var(--text-tertiary)",
                    }}
                >
                    <Tag size={14} />
                    <span>{categoryCount} kategori</span>
                </div>
            </div>

            {/* CTA */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: site.primaryColor,
                }}
            >
                Kunjungi Site
                <ArrowRight size={16} />
            </div>
        </Link>
    );
}
