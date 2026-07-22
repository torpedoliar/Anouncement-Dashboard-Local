"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMail } from "react-icons/fi";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/portal/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.error || "Terjadi kesalahan. Silakan coba lagi.");
            } else {
                setSubmitted(true);
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            backgroundColor: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
        }}>
            <div style={{
                width: "100%",
                maxWidth: "400px",
                backgroundColor: "#111",
                border: "1px solid #262626",
                borderRadius: "12px",
                padding: "40px",
            }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        backgroundColor: "rgba(220, 38, 38, 0.1)",
                        border: "1px solid rgba(220, 38, 38, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                    }}>
                        <FiMail size={22} color="#dc2626" />
                    </div>
                    <p style={{
                        color: "#dc2626",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.2em",
                        marginBottom: "8px",
                    }}>PORTAL SSO</p>
                    <h1 style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontSize: "24px",
                        fontWeight: 700,
                        color: "#fff",
                        margin: 0,
                    }}>Lupa Password</h1>
                </div>

                {submitted ? (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            padding: "16px",
                            backgroundColor: "rgba(34, 197, 94, 0.1)",
                            border: "1px solid rgba(34, 197, 94, 0.2)",
                            borderRadius: "8px",
                            marginBottom: "24px",
                        }}>
                            <p style={{
                                color: "#86efac",
                                fontSize: "14px",
                                margin: 0,
                                lineHeight: "1.6",
                            }}>
                                Jika email terdaftar, link reset telah dikirim.
                            </p>
                        </div>
                        <Link
                            href="/portal-login"
                            style={{
                                display: "inline-block",
                                padding: "10px 24px",
                                backgroundColor: "#262626",
                                color: "#a1a1aa",
                                borderRadius: "8px",
                                fontSize: "13px",
                                fontWeight: 500,
                                textDecoration: "none",
                                border: "1px solid #262626",
                            }}
                        >
                            Kembali ke Login
                        </Link>
                    </div>
                ) : (
                    <>
                        <p style={{
                            color: "#737373",
                            fontSize: "13px",
                            lineHeight: "1.6",
                            margin: "0 0 24px",
                            textAlign: "center",
                        }}>
                            Masukkan email Anda. Kami akan mengirimkan link untuk mengatur ulang password.
                        </p>

                        {/* Error */}
                        {error && (
                            <div style={{
                                padding: "12px 16px",
                                backgroundColor: "rgba(220, 38, 38, 0.1)",
                                border: "1px solid rgba(220, 38, 38, 0.3)",
                                borderRadius: "8px",
                                marginBottom: "20px",
                                color: "#fca5a5",
                                fontSize: "13px",
                            }}>{error}</div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{
                                    display: "block",
                                    color: "#a1a1aa",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                }}>Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        backgroundColor: "#0a0a0a",
                                        border: "1px solid #262626",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "14px",
                                        outline: "none",
                                    }}
                                    placeholder="email@example.com"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: isLoading ? "#333" : "#dc2626",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                    marginBottom: "16px",
                                }}
                            >
                                {isLoading ? "Mengirim..." : "Kirim Link Reset"}
                            </button>

                            <div style={{ textAlign: "center" }}>
                                <Link href="/portal-login" style={{
                                    color: "#737373",
                                    fontSize: "13px",
                                    textDecoration: "none",
                                }}>Kembali ke login</Link>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
