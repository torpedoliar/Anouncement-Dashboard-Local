"use client";

import Link from "next/link";
import { ShieldWarning } from "@phosphor-icons/react";

interface AccessDeniedProps {
    appName: string;
}

export default function AccessDenied({ appName }: AccessDeniedProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10">
            <div className="max-w-[400px] text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet border border-danger/30 bg-danger-subtle">
                    <ShieldWarning size={24} className="text-danger" aria-hidden="true" />
                </div>
                <h1 className="mt-5 font-display text-xl font-semibold text-text-1">
                    Akses Ditolak
                </h1>
                <p className="mt-3 text-sm text-text-2">
                    Anda tidak punya akses ke <strong className="font-semibold text-text-1">{appName}</strong>
                </p>
                <Link
                    href="/portal"
                    className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-surface-1 px-4 text-sm font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Kembali ke Portal
                </Link>
            </div>
        </div>
    );
}