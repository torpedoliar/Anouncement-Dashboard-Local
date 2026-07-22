"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiLock } from "react-icons/fi";

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!token) {
            setError("Token reset tidak ditemukan.");
            return;
        }

        if (password.length < 8) {
            setError("Password minimal 8 karakter.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Password dan konfirmasi tidak cocok.");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/portal/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.error || "Terjadi kesalahan. Silakan coba lagi.");
            } else {
                setSuccess(true);
                setTimeout(() => {
                    router.push("/portal-login?reset=success");
                }, 2000);
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
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
                    textAlign: "center",
                    maxWidth: "400px",
                    backgroundColor: "#111",
                    border: "1px solid #262626",
                    borderRadius: "12px",
                    padding: "40px",
                }}>
                    <p style={{ color: "#fca5a5", fontSize: "14px", margin: 0 }}>
                        Token reset tidak ditemukan. Silakan minta link reset baru.
                    </p>
                </div>
            </div>
        );
    }

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
                        <FiLock size={22} color="#dc2626" />
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
                    }}>Atur Ulang Password</h1>
                </div>

                {success ? (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            padding: "16px",
                            backgroundColor: "rgba(34, 197, 94, 0.1)",
                            border: "1px solid rgba(34, 197, 94, 0.2)",
                            borderRadius: "8px",
                            marginBottom: "16px",
                        }}>
                            <p style={{
                                color: "#86efac",
                                fontSize: "14px",
                                margin: 0,
                                lineHeight: "1.6",
                            }}>
                                Password berhasil diubah. Mengalihkan ke halaman login...
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
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
                                }}>Password Baru</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
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
                                    placeholder="Minimal 8 karakter"
                                />
                            </div>

                            <div style={{ marginBottom: "24px" }}>
                                <label style={{
                                    display: "block",
                                    color: "#a1a1aa",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    marginBottom: "6px",
                                }}>Konfirmasi Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
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
                                    placeholder="Ulangi password baru"
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
                                }}
                            >
                                {isLoading ? "Menyimpan..." : "Simpan Password Baru"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div style={{
                minHeight: "100vh",
                backgroundColor: "#0a0a0a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>
                <p style={{ color: "#737373", fontSize: "14px" }}>Memuat...</p>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
