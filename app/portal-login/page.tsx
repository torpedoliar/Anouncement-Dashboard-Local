"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function PortalLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl: "/portal",
            });

            if (result?.error) {
                setError(result.error);
            } else {
                router.push("/portal");
                router.refresh();
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
                    }}>Masuk ke Portal</h1>
                </div>

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
                    <div style={{ marginBottom: "16px" }}>
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

                    <div style={{ marginBottom: "24px" }}>
                        <label style={{
                            display: "block",
                            color: "#a1a1aa",
                            fontSize: "13px",
                            fontWeight: 500,
                            marginBottom: "6px",
                        }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                            placeholder="Password"
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
                        {isLoading ? "Masuk..." : "Masuk"}
                    </button>

                    <div style={{ textAlign: "center" }}>
                        <a href="/portal/forgot-password" style={{
                            color: "#737373",
                            fontSize: "13px",
                            textDecoration: "none",
                        }}>Lupa password?</a>
                    </div>
                </form>
            </div>
        </div>
    );
}
