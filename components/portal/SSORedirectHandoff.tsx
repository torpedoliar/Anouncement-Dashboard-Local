"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LaunchBridge from "@/components/portal/LaunchBridge";

interface SSORedirectHandoffProps {
    app: {
        name: string;
        logoPath?: string | null;
        slug: string;
    };
}

/**
 * Interstitial REDIRECT (credential-less): kirim form POST ke /api/sso/redirect,
 * server memverifikasi sesi + akses lalu 302 ke target. Fallback link manual bila
 * navigasi tertahan — UX konsisten dengan SSORerouteSubmit.
 */
export default function SSORedirectHandoff({ app }: SSORedirectHandoffProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [status, setStatus] = useState<"preparing" | "submitting">("preparing");
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            setStatus("submitting");
            if (formRef.current) formRef.current.submit();
        }, 0);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (status !== "submitting" || failed) return;
        // Redirect server cepat; kalau 5 dtk setelah submit masih di sini berarti
        // navigasi gagal (target lambat/down) — tampilkan fallback manual daripada
        // spinner abadi. Pola SSORerouteSubmit: timer hidup SETELAH submit dimulai.
        const t = setTimeout(() => {
            if (!document.hidden) setFailed(true);
        }, 5000);
        return () => clearTimeout(t);
    }, [status, failed]);

    return (
        <>
            <LaunchBridge
                app={{ name: app.name, slug: app.slug, logoPath: app.logoPath }}
                title={`Mengalihkan ke ${app.name}`}
                subtitle="Aplikasi ini diautentikasi otomatis oleh jaringan perusahaan."
                steps={[
                    { label: "Menyiapkan", state: status === "preparing" ? "active" : "done" },
                    { label: `Mengalihkan ke ${app.name}`, state: failed ? "error" : status === "submitting" ? "active" : "pending" },
                ]}
                notice={failed ? <>Tidak bisa membuka {app.name} otomatis. Coba buka manual, atau hubungi admin bila berulang.</> : undefined}
                actions={failed ? (
                    <>
                        <button
                            type="submit"
                            form="sso-redirect-form"
                            className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            Coba lagi
                        </button>
                        <Link href="/portal" className="inline-flex h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-text-1 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                            Kembali ke Portal
                        </Link>
                    </>
                ) : undefined}
            />
            {/* Hidden Auto-Submit Form */}
            <form
                ref={formRef}
                id="sso-redirect-form"
                method="POST"
                action="/api/sso/redirect"
                className="sr-only"
                aria-hidden={failed ? undefined : "true"}
            >
                <input type="hidden" name="appSlug" value={app.slug} />
            </form>
        </>
    );
}
