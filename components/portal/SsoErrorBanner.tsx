"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Warning, X } from "@phosphor-icons/react";

interface SsoErrorBannerProps {
    error: string;
    appSlug?: string;
}

const MESSAGES: Record<string, { title: string; detail: string }> = {
    sso_failed: {
        title: "Login ke aplikasi ditolak",
        detail:
            "Aplikasi menolak kredensial yang tersimpan. Periksa kembali akun aplikasi di Pengaturan, " +
            "atau hubungi admin bila akun Anda benar.",
    },
    sso_cross_domain: {
        title: "Sesi tidak dapat dipindahkan ke aplikasi",
        detail:
            "Portal dan aplikasi berada di domain yang berbeda, sehingga sesi login tidak bisa diteruskan otomatis. " +
            "Solusi permanen: akses portal melalui subdomain perusahaan. Hubungi admin untuk pengaturannya.",
    },
};

/**
 * Banner hasil kegagalan SSO (query ?error=... dari route REROUTE/POST).
 * Tanpa banner ini pengalihan gagal terasa seperti portal "diam saja".
 */
export default function SsoErrorBanner({ error, appSlug }: SsoErrorBannerProps) {
    const msg = MESSAGES[error];
    const [dismissed, setDismissed] = useState(false);

    // URL dengan query error jangan ikut dibagikan/direload sebagai error abadi —
    // bersihkan dari address bar setelah banner tampil.
    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        url.searchParams.delete("app");
        window.history.replaceState({}, "", url.href);
    }, []);

    if (!msg || dismissed) return null;

    return (
        <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-card border border-warning/30 bg-surface-1 p-4"
        >
            <Warning size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-text-1">{msg.title}</p>
                <p className="mt-1 text-text-2">{msg.detail}</p>
                {appSlug && (
                    <Link
                        href={`/portal/app/${appSlug}`}
                        className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        Coba lagi
                    </Link>
                )}
            </div>
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Tutup notifikasi"
                className="shrink-0 rounded-control p-1 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
                <X size={16} />
            </button>
        </div>
    );
}
