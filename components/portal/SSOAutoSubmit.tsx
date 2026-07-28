"use client";

import { useEffect, useRef, useState } from "react";
import { FiLoader, FiCheckCircle } from "react-icons/fi";

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
        <div style={{
            minHeight: "calc(100vh - 60px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "#0a0a0a"
        }}>
            <div style={{
                width: "100%",
                maxWidth: "400px",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "32px",
                textAlign: "center"
            }}>
                {/* Logo */}
                <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center" }}>
                    {app.logoPath ? (
                        <img
                            src={app.logoPath}
                            alt={app.name}
                            style={{ width: "64px", height: "64px", borderRadius: "12px", objectFit: "cover" }}
                        />
                    ) : (
                        <div style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "12px",
                            backgroundColor: "var(--border-color)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                            fontSize: "24px",
                            fontWeight: 700,
                        }}>
                            {app.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <h2 style={{ color: "var(--text-primary)", fontSize: "20px", marginBottom: "8px" }}>
                    SSO ke {app.name}
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
                    {status === "preparing" ? "Menyiapkan sesi dan kredensial..." : "Mengalihkan..."}
                </p>

                {/* Visual Feedback of the Form Injection */}
                <div style={{
                    backgroundColor: "#171717",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "24px",
                    textAlign: "left"
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Username</span>
                        <span style={{ fontSize: "13px", color: "var(--color-success)", fontWeight: 500, fontFamily: "monospace" }}>
                            {cred.username}
                        </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 600 }}>Password</span>
                        <span style={{ fontSize: "13px", color: "var(--color-success)", fontWeight: 500, letterSpacing: "2px" }}>
                            ••••••••
                        </span>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--text-muted)" }}>
                    {status === "preparing" ? (
                        <>
                            <div style={{
                                width: "16px",
                                height: "16px",
                                border: "2px solid var(--text-muted)",
                                borderTopColor: "transparent",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite"
                            }}>
                                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                            <span style={{ fontSize: "14px" }}>Mengisi kredensial...</span>
                        </>
                    ) : (
                        <>
                            <FiCheckCircle style={{ color: "var(--color-success)" }} />
                            <span style={{ fontSize: "14px", color: "var(--color-success)" }}>Selesai!</span>
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
                style={{ display: "none" }}
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
