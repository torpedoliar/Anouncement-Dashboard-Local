"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LaunchBridge from "@/components/portal/LaunchBridge";

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
        <>
            <LaunchBridge
                app={{ name: app.name, slug: app.slug, logoPath: app.logoPath }}
                title={`Membuka ${app.name}`}
                subtitle={`Masuk sebagai ${cred.username}`}
                steps={[
                    { label: "Menyiapkan", state: status === "preparing" ? "active" : "done" },
                    { label: `Portal masuk ke ${app.name}`, state: status === "submitting" ? "active" : "pending" },
                ]}
                notice={slow ? <>{app.name} lambat merespons. Buka manual bila tidak ingin menunggu.</> : undefined}
                actions={slow ? (
                    <>
                        <button
                            type="submit"
                            form="sso-reroute-form"
                            className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            Buka {app.name}
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
                id="sso-reroute-form"
                method="POST"
                action="/api/sso/reroute"
                className="sr-only"
                aria-hidden="true"
            >
                <input type="hidden" name="appSlug" value={app.slug} />
                {credentialId && <input type="hidden" name="credentialId" value={credentialId} />}
            </form>
        </>
    );
}
