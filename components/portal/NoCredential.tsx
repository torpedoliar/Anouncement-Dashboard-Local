"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";

interface NoCredentialProps {
    appName: string;
    appSlug: string;
}

export default function NoCredential({ appName, appSlug }: NoCredentialProps) {
    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-0 px-4 py-10 sm:px-5">
            <div className="max-w-[400px] text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet border border-warning/30 bg-warning-subtle">
                    <WarningCircle size={24} className="text-warning" aria-hidden="true" />
                </div>
                <h1 className="mt-5 font-display text-xl font-semibold text-text-1">
                    Kredensial Belum Disimpan
                </h1>
                <p className="mt-3 text-sm text-text-2">
                    Anda belum menyimpan kredensial untuk <strong className="font-semibold text-text-1">{appName}</strong>
                </p>
                <Link
                    href={`/portal/credentials?app=${appSlug}`}
                    className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Simpan Kredensial
                </Link>
            </div>
        </div>
    );
}