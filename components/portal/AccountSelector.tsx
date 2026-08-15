"use client";

import Link from "next/link";

export interface SelectableAccount {
    id: string;
    label: string;
}

interface AccountSelectorProps {
    appName: string;
    accounts: SelectableAccount[];
    baseHref: string; // `/portal/app/[slug]`
}

/**
 * Tampil saat app punya >1 akun tersimpan. User memilih akun → halaman [appSlug]
 * di-render ulang dengan ?credentialId= akun terpilih.
 */
export default function AccountSelector({ appName, accounts, baseHref }: AccountSelectorProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10">
            <div className="w-full max-w-[400px]">
                <h1 className="font-display text-xl font-semibold text-text-1">
                    Pilih Akun
                </h1>
                <p className="mt-2 text-sm text-text-2">
                    Aplikasi {appName} memiliki lebih dari satu akun tersimpan. Pilih akun yang ingin digunakan.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                    {accounts.map((a) => (
                        <a
                            key={a.id}
                            href={`${baseHref}?credentialId=${a.id}`}
                            className="flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-1 px-4 py-3 text-sm transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <span className="truncate font-semibold text-text-1">{a.label}</span>
                            <span className="shrink-0 truncate font-mono tabular-nums text-xs text-text-3">{a.id}</span>
                        </a>
                    ))}
                </div>
                <Link
                    href="/portal"
                    className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    Batal
                </Link>
            </div>
        </div>
    );
}