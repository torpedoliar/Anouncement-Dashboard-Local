"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LaunchBridge from "@/components/portal/LaunchBridge";

interface SSOAutoSubmitProps {
    app: {
        name: string;
        slug: string;
        logoPath?: string | null;
        loginUrl: string;
        httpMethod: string;
        usernameField: string;
        passwordField: string;
    };
    cred: {
        username: string;
        password: string;
    };
    extraFields: Array<{ name: string; value: string }>;
}

export default function SSOAutoSubmit({ app, cred, extraFields }: SSOAutoSubmitProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [status, setStatus] = useState<"preparing" | "submitting">("preparing");
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        // Konten disubmit langsung saat mount — patch ideal tidak menunggu delay.
        const t = setTimeout(() => {
            setStatus("submitting");
            if (formRef.current) formRef.current.submit();
        }, 0);
        return () => clearTimeout(t);
    }, []);

    // Identifikasi jika auto submit tidak menavigasi jauh (mis. host target mati): setelah 3 detik tampilkan fallback call-to-action
    useEffect(() => {
        if (status !== "submitting" || failed) return;
        const t = setTimeout(() => {
            if (!document.hidden) setFailed(true);
        }, 3000);
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
                    { label: `Mengirim login ke ${app.name}`, state: failed ? "error" : status === "submitting" ? "active" : "pending" },
                ]}
                notice={failed ? <>Tidak bisa membuka {app.name} otomatis. Coba buka manual, atau hubungi admin bila berulang.</> : undefined}
                actions={failed ? (
                    <>
                        <button
                            type="submit"
                            form="sso-form"
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
            {/* form tersembunyi — TIDAK berubah */}
            <form
                ref={formRef}
                id="sso-form"
                method={app.httpMethod.toLowerCase()}
                action={app.loginUrl}
                className="sr-only"
                aria-hidden={failed ? undefined : "true"}
            >
                <input type="hidden" name={app.usernameField} value={cred.username} />
                <input type="hidden" name={app.passwordField} value={cred.password} />
                {extraFields.map((f, i) => (
                    <input key={i} type="hidden" name={f.name} value={f.value} />
                ))}
            </form>
        </>
    );
}
