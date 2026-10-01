"use client";

import Image from "next/image";
import { Star } from "@phosphor-icons/react";
import { healthBucket, iconColor, type HomeApp } from "@/lib/portal-home";

const STATUS_LABEL = {
    ONLINE: "Normal",
    DEGRADED: "Lambat",
    OFFLINE: "Gangguan",
    UNKNOWN: "Belum dicek",
} as const;

const STATUS_DOT = {
    ONLINE: "bg-success",
    DEGRADED: "bg-warning portal-breathe",
    OFFLINE: "bg-danger portal-breathe",
    UNKNOWN: "bg-text-3",
} as const;

/**
 * Pasang view-transition-name HANYA pada ikon yang diklik. App yang sama bisa
 * tampil di Favorit, Terakhir dipakai, dan beberapa grup; nama ganda membatalkan
 * transisi lintas halaman.
 */
export function markLaunch(el: HTMLElement) {
    const slug = el.dataset.slug;
    const icon = el.querySelector<HTMLElement>("[data-app-icon]");
    if (slug && icon) icon.style.viewTransitionName = `app-${slug}`;
}

export default function AppTile({
    app,
    pinned,
    onTogglePin,
    size = "lg",
}: {
    app: HomeApp;
    pinned: boolean;
    onTogglePin: (app: HomeApp) => void;
    size?: "lg" | "md";
}) {
    const bucket = healthBucket(app.healthStatus);
    const tipId = `tip-${app.id}-${size}`;
    const iconSize = size === "lg" ? 56 : 44;
    const statusText = `${STATUS_LABEL[bucket]}${app.healthLatencyMs && bucket !== "OFFLINE" ? ` · ${app.healthLatencyMs}ms` : ""}`;

    return (
        <div className="group/tile relative">
            {/* <a> biasa (bukan next/link): View Transitions lintas dokumen butuh navigasi penuh. */}
            <a
                href={`/portal/app/${app.slug}`}
                data-app-tile
                data-slug={app.slug}
                aria-describedby={tipId}
                onClick={(e) => markLaunch(e.currentTarget)}
                className="flex flex-col items-center gap-2 rounded-sheet px-2 py-3 text-center transition-[background-color,transform] duration-150 ease-[var(--motion-ease)] hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
                <span className="relative">
                    <span
                        data-app-icon
                        className="flex items-center justify-center overflow-hidden rounded-[14px] text-lg font-bold text-white shadow-lvl-1"
                        style={{ width: iconSize, height: iconSize, backgroundColor: app.logoPath ? undefined : iconColor(app.name) }}
                    >
                        {app.logoPath ? (
                            <Image src={app.logoPath} alt="" width={iconSize} height={iconSize} className="h-full w-full object-cover" />
                        ) : (
                            app.name.charAt(0).toUpperCase()
                        )}
                    </span>
                    <span
                        aria-hidden="true"
                        className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-0 ${STATUS_DOT[bucket]}`}
                    />
                </span>
                <span className="line-clamp-2 text-[12.5px] font-medium leading-tight text-text-1">{app.name}</span>
            </a>

            {/* Bintang — muncul saat hover/fokus di dalam tile, selalu terlihat bila sudah di-pin */}
            <button
                type="button"
                onClick={() => onTogglePin(app)}
                aria-pressed={pinned}
                aria-label={pinned ? `Hapus ${app.name} dari favorit` : `Jadikan ${app.name} favorit`}
                className={`absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-1/90 text-text-2 shadow-lvl-1 transition-opacity duration-150 hover:text-warning focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    pinned ? "text-warning opacity-100" : "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
                }`}
            >
                <Star size={14} weight={pinned ? "fill" : "regular"} aria-hidden="true" />
            </button>

            {/* Tooltip — hover & fokus keyboard; teks status untuk pembaca layar juga */}
            <div
                id={tipId}
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-tooltip mt-1 w-56 -translate-x-1/2 rounded-card border border-border bg-surface-1 p-3 text-left text-xs text-text-2 opacity-0 shadow-lvl-2 transition-opacity duration-150 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
            >
                <p className="font-semibold text-text-1">{app.name}</p>
                <p className="mt-0.5">Status: {statusText}</p>
                {bucket === "OFFLINE" && (
                    <p className="mt-1 text-danger">Server tidak merespons{app.healthError ? ` (${app.healthError})` : ""}.</p>
                )}
                {app.description && <p className="mt-1 line-clamp-3">{app.description}</p>}
                <p className="mt-1 text-text-3">
                    {app.credentialCount > 0 ? `${app.credentialCount} akun tersimpan` : "Belum ada akun tersimpan"}
                </p>
            </div>
        </div>
    );
}
