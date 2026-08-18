"use client";

import { useEffect } from "react";
import { WarningCircle, ArrowClockwise, SquaresFour } from "@phosphor-icons/react";
import { humanizeError } from "@/lib/error-humanize";
import Link from "next/link";

interface AdminErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
    useEffect(() => {
        console.error("Admin Page Error:", error);
    }, [error]);

    const friendlyMessage = humanizeError(
        error,
        "Bagian administrasi ini mengalami gangguan saat memuat data terbaru."
    );

    return (
        <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center text-text-1">
            <div className="w-full max-w-md rounded-sheet border border-border/80 bg-surface-1 p-8 shadow-lvl-2">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
                    <WarningCircle size={32} weight="duotone" />
                </div>

                <h2 className="font-display text-xl font-bold tracking-tight text-text-1">
                    Gagal Memuat Halaman Admin
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-text-2">
                    {friendlyMessage}
                </p>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-lvl-1 transition-all duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <ArrowClockwise size={16} weight="bold" />
                        Coba Lagi
                    </button>
                    <Link
                        href="/admin"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-surface-2 px-4 text-sm font-medium text-text-1 transition-all duration-150 hover:bg-surface-3 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <SquaresFour size={16} />
                        Dashboard Utama
                    </Link>
                </div>

                {error.digest && (
                    <p className="mt-6 border-t border-border/60 pt-3 font-mono text-xs text-text-3">
                        Kode Referensi: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
