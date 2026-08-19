"use client";

import Link from "next/link";
import { CheckCircle, WarningCircle, Warning } from "@phosphor-icons/react";
import Card from "@/components/ui/Card";

export interface AppCardProps {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logoPath?: string | null;
    category?: string | null;
    credentialCount: number;
    healthStatus?: string | null;
    healthLatencyMs?: number | null;
    healthCheckedAt?: Date | string | null;
    healthError?: string | null;
}

export default function AppCard({
    name,
    slug,
    description,
    logoPath,
    category,
    credentialCount,
    healthStatus = "ONLINE",
    healthLatencyMs,
    healthError,
}: AppCardProps) {
    const isOffline = healthStatus === "OFFLINE";
    const isDegraded = healthStatus === "DEGRADED";

    return (
        <Card className={`group relative p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lvl-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent flex flex-col justify-between ${
            isOffline ? "border-danger/40 bg-surface-1/90" : ""
        }`}>
            <div>
                {/* Header & Status Indicator */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        {logoPath ? (
                            <img
                                src={logoPath}
                                alt={name}
                                className="h-10 w-10 shrink-0 rounded-card object-cover border border-border"
                            />
                        ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-3 text-base font-bold text-text-2 border border-border">
                                {name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-text-1">{name}</h3>
                            {category && (
                                <span className="text-xs text-text-3">{category}</span>
                            )}
                        </div>
                    </div>

                    {/* Real-time Health Status Badge */}
                    <div className="shrink-0">
                        {healthStatus === "ONLINE" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success border border-success/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                                Online{healthLatencyMs ? ` (${healthLatencyMs}ms)` : ""}
                            </span>
                        )}
                        {isDegraded && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning border border-warning/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                                Lambat{healthLatencyMs ? ` (${healthLatencyMs}ms)` : ""}
                            </span>
                        )}
                        {isOffline && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-bold text-danger border border-danger/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-danger animate-ping" />
                                Gangguan
                            </span>
                        )}
                    </div>
                </div>

                {/* Offline Warning Notice if server is down */}
                {isOffline && (
                    <div className="mt-3 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-subtle/30 p-2.5 text-xs text-danger font-medium">
                        <Warning size={15} className="shrink-0 mt-0.5" />
                        <span>Server target tidak merespon ({healthError || "Offline"}). Akses mungkin terkendala.</span>
                    </div>
                )}

                {/* Description */}
                {description && (
                    <p className="mt-3 line-clamp-2 text-xs text-text-2 leading-relaxed">{description}</p>
                )}
            </div>

            {/* Bottom: Credential status & Action */}
            <div className="mt-4 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1">
                        {credentialCount > 0 ? (
                            <>
                                <CheckCircle size={15} className="shrink-0 text-success" aria-hidden="true" />
                                <span className="text-success font-medium">
                                    <span className="font-mono tabular-nums font-bold">{credentialCount}</span> akun tersimpan
                                </span>
                            </>
                        ) : (
                            <>
                                <WarningCircle size={15} className="shrink-0 text-warning" aria-hidden="true" />
                                <span className="text-warning font-medium">Belum ada akun</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Action Button */}
                {credentialCount > 0 ? (
                    <Link
                        href={`/portal/app/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-3 block w-full rounded-control py-2 text-center text-xs font-bold text-white transition-opacity duration-150 hover:opacity-90 shadow-sm focus-visible:outline-2 focus-visible:outline-accent ${
                            isOffline ? "bg-text-3 hover:bg-text-2" : "bg-accent"
                        }`}
                    >
                        {isOffline ? "Coba Buka (Server Offline)" : "Buka Aplikasi SSO"}
                    </Link>
                ) : (
                    <Link
                        href={`/portal/credentials?app=${slug}`}
                        className="mt-3 block w-full rounded-control border border-border bg-surface-1 py-2 text-center text-xs font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                        Simpan Kredensial
                    </Link>
                )}
            </div>
        </Card>
    );
}