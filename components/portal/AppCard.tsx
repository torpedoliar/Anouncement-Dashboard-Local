"use client";

import Link from "next/link";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Card from "@/components/ui/Card";

interface AppCardProps {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logoPath?: string | null;
    category?: string | null;
    credentialCount: number;
}

export default function AppCard({ name, slug, description, logoPath, category, credentialCount }: AppCardProps) {
    return (
        <Card className="group p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lvl-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
            {/* Header */}
            <div className="flex items-center gap-3">
                {logoPath ? (
                    <img
                        src={logoPath}
                        alt={name}
                        className="h-10 w-10 rounded-card object-cover"
                    />
                ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-3 text-base font-semibold text-text-2">
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-text-1">{name}</h3>
                    {category && (
                        <span className="text-xs text-text-3">{category}</span>
                    )}
                </div>
            </div>

            {/* Description */}
            {description && (
                <p className="mt-3 line-clamp-2 text-sm text-text-2">{description}</p>
            )}

            {/* Health indicator */}
            <div className="mt-3 flex items-center gap-1.5 text-xs">
                {credentialCount > 0 ? (
                    <>
                        <CheckCircle size={16} className="shrink-0 text-success" aria-hidden="true" />
                        <span className="text-success">
                            <span className="font-mono tabular-nums">{credentialCount}</span> akun tersimpan
                        </span>
                    </>
                ) : (
                    <>
                        <WarningCircle size={16} className="shrink-0 text-warning" aria-hidden="true" />
                        <span className="text-warning">Belum ada akun</span>
                    </>
                )}
            </div>

            {/* Action */}
            {credentialCount > 0 ? (
                <Link
                    href={`/portal/app/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block w-full rounded-control bg-accent py-2 text-center text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Buka
                </Link>
            ) : (
                <Link
                    href={`/portal/credentials?app=${slug}`}
                    className="mt-4 block w-full rounded-control border border-border bg-surface-1 py-2 text-center text-sm font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Simpan Kredensial
                </Link>
            )}
        </Card>
    );
}