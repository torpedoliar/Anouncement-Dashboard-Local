"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

interface SSOAutoSubmitProps {
    app: {
        name: string;
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

    useEffect(() => {
        // Beri waktu 1.5 detik agar user bisa melihat proses injection kredensial
        const timer = setTimeout(() => {
            setStatus("submitting");
            if (formRef.current) {
                formRef.current.submit();
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10">
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

                <h2 className="mt-6 font-display text-xl font-semibold text-text-1">
                    SSO ke {app.name}
                </h2>
                <p className="mt-2 text-sm text-text-2">
                    {status === "preparing" ? "Menyiapkan sesi dan kredensial..." : "Mengalihkan..."}
                </p>

                {/* Visual Feedback of the Form Injection */}
                <div className="mt-6 rounded-card border border-border bg-surface-2 p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-text-3">Username</span>
                        <span className="font-mono text-sm text-success">{cred.username}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-text-3">Password</span>
                        <span className="text-sm tracking-[2px] text-success">••••••••</span>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2">
                    {status === "preparing" ? (
                        <>
                            <div
                                className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent"
                                aria-hidden="true"
                            />
                            <span className="text-sm text-text-2">Mengisi kredensial...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={20} className="shrink-0 text-success" aria-hidden="true" />
                            <span className="text-sm text-success">Selesai!</span>
                        </>
                    )}
                </div>
            </div>

            {/* Hidden Auto-Submit Form */}
            <form
                ref={formRef}
                id="sso-form"
                method={app.httpMethod.toLowerCase()}
                action={app.loginUrl}
                className="hidden"
            >
                <input type="hidden" name={app.usernameField} value={cred.username} />
                <input type="hidden" name={app.passwordField} value={cred.password} />
                {extraFields.map((f, i) => (
                    <input key={i} type="hidden" name={f.name} value={f.value} />
                ))}
            </form>
        </div>
    );
}