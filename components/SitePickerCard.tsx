"use client";

/**
 * SitePickerCard Component
 * Displays a single site card in the site picker grid
 */

import Link from "next/link";
import { FiArrowRight, FiFileText, FiTag } from "react-icons/fi";

interface SitePickerCardProps {
    site: {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        logoPath?: string | null;
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
            style={{
                display: "block",
                backgroundColor: "#111",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "28px",
                textDecoration: "none",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = site.primaryColor;
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = `0 10px 40px ${site.primaryColor}30`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
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
                {site.logoPath ? (
                    <img
                        src={site.logoPath}
                        alt={site.name}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
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
                    color: "#fff",
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
                        color: "#888",
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
                        color: "#666",
                    }}
                >
                    <FiFileText size={14} />
                    <span>{articleCount} artikel</span>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "#666",
                    }}
                >
                    <FiTag size={14} />
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
                <FiArrowRight size={16} />
            </div>
        </Link>
    );
}
