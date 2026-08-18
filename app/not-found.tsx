import Link from "next/link";
import { Compass, House, ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-surface-0 px-4 py-12 text-text-1 selection:bg-accent/30 selection:text-white">
            {/* Background glowing aura */}
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
                <div className="h-96 w-96 rounded-full bg-accent/10 blur-[140px]" />
            </div>

            <main className="relative z-10 w-full max-w-md rounded-sheet border border-border/80 bg-surface-1/90 p-8 text-center shadow-lvl-3 backdrop-blur-xl md:p-10">
                {/* 404 Badge Icon */}
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-inner">
                    <Compass size={36} weight="duotone" />
                </div>

                <div className="space-y-3">
                    <span className="font-mono text-sm font-semibold uppercase tracking-widest text-accent">
                        Error 404
                    </span>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-text-1 md:text-3xl">
                        Halaman Tidak Ditemukan
                    </h1>
                    <p className="text-sm leading-relaxed text-text-2">
                        Tautan yang Anda tuju mungkin sudah dipindahkan, dihapus, atau alamat URL yang dimasukkan kurang tepat.
                    </p>
                </div>

                {/* Navigation Buttons */}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link
                        href="/"
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-accent px-5 text-sm font-semibold text-white shadow-lvl-2 transition-all duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <House size={18} />
                        Halaman Utama
                    </Link>
                    <Link
                        href="/admin"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface-2 px-5 text-sm font-medium text-text-1 transition-all duration-150 hover:bg-surface-3 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <ArrowLeft size={18} />
                        Admin Panel
                    </Link>
                </div>
            </main>
        </div>
    );
}
