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
            className="site-picker-card relative block overflow-hidden rounded-sheet bg-surface-1 p-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
            {/* Garis aksen warna situs */}
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: site.primaryColor }} />

            <div
                className="mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[14px] text-2xl font-bold text-white"
                style={{ backgroundColor: site.primaryColor }}
            >
                {(site.logo || site.logoPath) ? (
                    <Image
                        width={56}
                        height={56}
                        src={site.logo || site.logoPath || ""}
                        alt={site.name}
                        className="h-full w-full object-contain"
                    />
                ) : (
                    site.name.charAt(0).toUpperCase()
                )}
            </div>

            <h2 className="mb-2 font-serif text-xl font-bold text-text-1">{site.name}</h2>

            {site.description && (
                <p className="mb-5 line-clamp-2 text-sm leading-normal text-text-2">{site.description}</p>
            )}

            <div className="mb-5 flex gap-4 text-[13px] text-text-3">
                <span className="flex items-center gap-1.5"><FileText size={14} aria-hidden="true" />{articleCount} artikel</span>
                <span className="flex items-center gap-1.5"><Tag size={14} aria-hidden="true" />{categoryCount} kategori</span>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: site.primaryColor }}>
                Kunjungi Site
                <ArrowRight size={16} aria-hidden="true" />
            </div>
        </Link>
    );
}
