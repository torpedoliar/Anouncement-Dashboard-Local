"use client";

import { useEffect } from "react";
import { WarningCircle, ArrowClockwise, House } from "@phosphor-icons/react";
import { humanizeError } from "@/lib/error-humanize";
import Link from "next/link";

interface RootErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
    useEffect(() => {
        // Catat error ke console secara terstruktur
        console.error("Root Application Error:", error);
    }, [error]);

    const friendlyMessage = humanizeError(
        error,
        "Halaman ini mengalami gangguan sementara saat memproses data. Silakan coba muat ulang atau kembali nanti."
    );

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-surface-0 px-4 py-12 text-text-1 selection:bg-accent/30 selection:text-white">
            {/* Background glowing aura */}
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
                <div className="h-96 w-96 rounded-full bg-danger/10 blur-[120px]" />
            </div>

            <main className="relative z-10 w-full max-w-lg rounded-sheet border border-border/80 bg-surface-1/90 p-8 shadow-lvl-3 backdrop-blur-xl md:p-10">
                {/* Icon Header */}
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger shadow-inner">
                    <WarningCircle size={36} weight="duotone" />
                </div>

                {/* Content */}
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-danger">
                        Terjadi Gangguan Sistem
                    </div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-text-1 md:text-3xl">
                        Oops! Terjadi Sedikit Kendala
                    </h1>
                    <p className="text-sm leading-relaxed text-text-2">
                        {friendlyMessage}
                    </p>
                </div>

                {/* Actions */}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-accent px-5 text-sm font-semibold text-white shadow-lvl-2 transition-all duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <ArrowClockwise size={18} weight="bold" />
                        Coba Muat Ulang
                    </button>
                    <Link
                        href="/"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface-2 px-5 text-sm font-medium text-text-1 transition-all duration-150 hover:bg-surface-3 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <House size={18} />
                        Ke Beranda
                    </Link>
                </div>

                {/* Technical Code / Digest (Opsional) */}
                {error.digest && (
                    <div className="mt-8 border-t border-border/60 pt-4 text-center">
                        <p className="font-mono text-xs text-text-3">
                            ID Referensi: <span className="text-text-2">{error.digest}</span>
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
