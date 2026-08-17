"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";

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
        const t = setTimeout(() => {
            if (!document.hidden) setFailed(true);
        }, 3000);
        return () => clearTimeout(t);
    }, [status, failed]);

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-0 px-5 py-10">
            <div className="w-full max-w-[400px] rounded-sheet border border-border bg-surface-1 p-8 text-center shadow-lvl-2">
                {/* Logo */}
                <div className="flex justify-center">
                    {app.logoPath ? (
                        <img
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
                    {status === "preparing" ? "Menyambungkan..." : "Mengalihkan..."}
                </p>

                {failed ? (
                    <div className="mt-6 rounded-card border border-warning/30 bg-surface-2 p-4 text-left text-sm text-text-2">
                        Tidak bisa membuka {app.name} otomatis.
                    </div>
                ) : null}

                <div className="mt-6 flex items-center justify-center gap-2">
                    {status === "preparing" ? (
                        <>
                            <div
                                className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent"
                                aria-hidden="true"
                            />
                            <span className="text-sm text-text-2">Menghubungkan...</span>
                        </>
                    ) : failed ? (
                        <span className="text-sm text-warning">Hubungi admin atau coba lagi.</span>
                    ) : (
                        <>
                            <CheckCircle size={20} className="shrink-0 text-success" aria-hidden="true" />
                            <span className="text-sm text-success">Mengalihkan...</span>
                        </>
                    )}
                </div>

                {failed && (
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
                aria-hidden={failed ? undefined : "true"}
            >
                <input type="hidden" name="appSlug" value={app.slug} />
                {credentialId && <input type="hidden" name="credentialId" value={credentialId} />}
            </form>
        </div>
    );
}
