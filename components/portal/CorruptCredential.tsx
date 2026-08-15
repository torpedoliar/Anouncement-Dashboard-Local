"use client";

import Link from "next/link";
import { Warning } from "@phosphor-icons/react";

interface CorruptCredentialProps {
    appName: string;
    appSlug: string;
}

export default function CorruptCredential({ appName, appSlug }: CorruptCredentialProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10">
            <div className="max-w-[400px] text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet border border-warning/30 bg-warning-subtle">
                    <Warning size={24} className="text-warning" aria-hidden="true" />
                </div>
                <h1 className="mt-5 font-display text-xl font-semibold text-text-1">
                    Kredensial Rusak
                </h1>
                <p className="mt-3 text-sm text-text-2">
                    Kredensial rusak. Silakan simpan ulang.
                </p>
                <p className="mt-2 text-sm text-text-3">
                    Kredensial untuk <strong className="font-semibold text-text-1">{appName}</strong> tidak dapat dibaca. Silakan simpan ulang untuk melanjutkan.
                </p>
                <Link
                    href={`/portal/credentials?app=${appSlug}`}
                    className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Simpan Ulang Kredensial
                </Link>
            </div>
        </div>
    );
}