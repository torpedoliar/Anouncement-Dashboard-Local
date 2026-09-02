"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface SSORerouteSubmitProps {
    app: {
        name: string;
        logoPath?: string | null;
        slug: string;
    };
    cred: {
        username: string;
    };
    credentialId?: string;
}

export default function SSORerouteSubmit({ app, cred, credentialId }: SSORerouteSubmitProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [status, setStatus] = useState<"preparing" | "submitting">("preparing");

    useEffect(() => {
        const t = setTimeout(() => {
            setStatus("submitting");
            if (formRef.current) formRef.current.submit();
        }, 0);
        return () => clearTimeout(t);
    }, []);

    // ponytail: Oracle login bisa sangat lambat — jangan bunih UI dgn fallback
    // waktu. Loading tampil terus sampai navigasi berhasil/gagal sendiri.
    // Setelah 30 dtk, tombol "Buka Oracle" manual muncul utk user yang gugup.
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        if (status !== "submitting") return;
        const t = setTimeout(() => {
            if (!document.hidden) setSlow(true);
        }, 30000);
        return () => clearTimeout(t);
    }, [status]);

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-0 px-5 py-10">
            <div className="w-full max-w-[400px] rounded-sheet border border-border bg-surface-1 p-8 text-center shadow-lvl-2">
                {/* Logo */}
                <div className="flex justify-center">
                    {app.logoPath ? (
                        <Image
                            width={56}
                            height={56}
                            src={app.logoPath}
                            alt={app.name}
                            className="h-14 w-14 rounded-sheet object-cover"
                        />
                    ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-sheet bg-surface-3 text-xl font-semibold text-text-2">
                            {app.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <h1 className="mt-6 font-display text-xl font-semibold text-text-1">
                    SSO ke {app.name}
                </h1>

                <p role="status" aria-live="polite" className="sr-only">
                    {status === "preparing" ? "Menyambungkan..." : "Mengalihkan ke aplikasi eksternal"}
                </p>
                <p className="mt-2 text-sm text-text-2">
                    {status === "preparing" ? `Menyambungkan sebagai ${cred.username}...` : "Mengalihkan..."}
                </p>

                {slow ? (
                    <div className="mt-6 rounded-card border border-border bg-surface-2 p-4 text-left text-sm text-text-2">
                        {app.name} lambat merespons. Buka manual bila tidak ingin menunggu.
                    </div>
                ) : null}

                <div className="mt-6 flex items-center justify-center gap-2">
                    <>
                        {/* Impressive concentric ring loader — tampil terus sampai navigasi selesai */}
                        <div className="sso-rings-container" aria-hidden="true">
                            <div className="sso-ring sso-ring-outer"></div>
                            <div className="sso-ring sso-ring-middle"></div>
                            <div className="sso-ring sso-ring-inner"></div>
                        </div>
                        <span className="text-sm text-text-2">
                            {status === "preparing" ? "Menghubungkan..." : "Mengalihkan..."}
                        </span>
                    </>
                </div>

                {slow && (
                    <div className="mt-4 flex flex-col gap-2">
                        <button
                            type="submit"
                            form="sso-reroute-form"
                            className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            Buka {app.name}
                        </button>
                        <Link href="/portal" className="inline-flex h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-text-1 hover:bg-surface-2">
                            Kembali ke Portal
                        </Link>
                    </div>
                )}
            </div>

            {/* Hidden Auto-Submit Form */}
            <form
                ref={formRef}
                id="sso-reroute-form"
                method="POST"
                action="/api/sso/reroute"
                className="sr-only"
                aria-hidden="true"
            >
                <input type="hidden" name="appSlug" value={app.slug} />
                {credentialId && <input type="hidden" name="credentialId" value={credentialId} />}
            </form>
        </div>
    );
}
