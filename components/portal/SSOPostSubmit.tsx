"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LaunchBridge from "@/components/portal/LaunchBridge";

interface SSOPostSubmitProps {
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

/**
 * SSO Mode POST — relay server-side. Browser dikirim ke /api/sso/post; portal
 * melakukan prefetch + login ke aplikasi target (token/cookie segar tiap akses),
 * lalu alihkan browser DENGAN cookie sesi aplikasi.
 */
export default function SSOPostSubmit({ app, cred, credentialId }: SSOPostSubmitProps) {
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
        }, 5000);
        return () => clearTimeout(t);
    }, [status, failed]);

    return (
        <>
            <LaunchBridge
                app={{ name: app.name, slug: app.slug, logoPath: app.logoPath }}
                title={`Membuka ${app.name}`}
                subtitle={`Masuk sebagai ${cred.username}`}
                steps={[
                    { label: "Menyiapkan", state: status === "preparing" ? "active" : "done" },
                    { label: `Portal masuk ke ${app.name}`, state: failed ? "error" : status === "submitting" ? "active" : "pending" },
                ]}
                notice={failed ? <>Tidak bisa membuka {app.name} otomatis. Coba buka manual, atau hubungi admin bila berulang.</> : undefined}
                actions={failed ? (
                    <>
                        <button
                            type="submit"
                            form="sso-post-form"
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
            <form
                ref={formRef}
                id="sso-post-form"
                method="POST"
                action="/api/sso/post"
                className="sr-only"
                aria-hidden={failed ? undefined : "true"}
            >
                <input type="hidden" name="appSlug" value={app.slug} />
                {credentialId && <input type="hidden" name="credentialId" value={credentialId} />}
            </form>
        </>
    );
}
