"use client";

import { useState } from "react";
import { FiMail, FiCheck, FiX, FiSend } from "react-icons/fi";

interface NewsletterSubscribeProps {
    variant?: "inline" | "card";
}

export default function NewsletterSubscribe({ variant = "inline" }: NewsletterSubscribeProps) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setStatus("idle");

        try {
            const response = await fetch("/api/newsletter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name: name || undefined }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus("success");
                setMessage(data.message || "Berhasil berlangganan!");
                setEmail("");
                setName("");
            } else {
                setStatus("error");
                setMessage(data.error || "Gagal berlangganan");
            }
        } catch {
            setStatus("error");
            setMessage("Terjadi kesalahan. Coba lagi.");
        } finally {
            setIsLoading(false);
            // Reset status after 5 seconds
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 5000);
        }
    };

    if (variant === "card") {
        return (
            <div style={{
                backgroundColor: "#0a0a0a",
                border: "1px solid #262626",
                padding: "32px",
                maxWidth: "400px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{
                        width: "40px",
                        height: "40px",
                        backgroundColor: "rgba(220, 38, 38, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <FiMail size={20} color="#dc2626" />
                    </div>
                    <div>
                        <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 600, margin: 0 }}>
                            Newsletter
                        </h3>
                        <p style={{ color: "#737373", fontSize: "13px", margin: 0 }}>
                            Dapatkan berita terbaru
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Nama (opsional)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "12px 14px",
                            backgroundColor: "#111",
                            border: "1px solid #333",
                            color: "#fff",
                            fontSize: "14px",
                            marginBottom: "12px",
                        }}
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            width: "100%",
                            padding: "12px 14px",
                            backgroundColor: "#111",
                            border: "1px solid #333",
                            color: "#fff",
                            fontSize: "14px",
                            marginBottom: "12px",
                        }}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !email}
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            padding: "12px",
                            backgroundColor: "#dc2626",
                            color: "#fff",
                            fontSize: "13px",
                            fontWeight: 600,
                            border: "none",
                            cursor: isLoading ? "not-allowed" : "pointer",
                            opacity: isLoading ? 0.7 : 1,
                        }}
                    >
                        {isLoading ? (
                            "Memproses..."
                        ) : (
                            <>
                                <FiSend size={14} />
                                Berlangganan
                            </>
                        )}
                    </button>
                </form>

                {status !== "idle" && (
                    <div style={{
                        marginTop: "12px",
                        padding: "12px",
                        backgroundColor: status === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        border: `1px solid ${status === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                        color: status === "success" ? "#22c55e" : "#ef4444",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}>
                        {status === "success" ? <FiCheck size={14} /> : <FiX size={14} />}
                        {message}
                    </div>
                )}
            </div>
        );
    }

    // Inline variant (for footer)
    return (
        <div>
            <h4 style={{
                color: "#dc2626",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "16px",
            }}>
                NEWSLETTER
            </h4>
            <p style={{
                color: "#737373",
                fontSize: "14px",
                marginBottom: "16px",
                lineHeight: 1.6,
            }}>
                Berlangganan untuk mendapatkan berita dan pengumuman terbaru.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                    type="email"
                    placeholder="Alamat email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                        padding: "12px 14px",
                        backgroundColor: "#111",
                        border: "1px solid #333",
                        color: "#fff",
                        fontSize: "14px",
                        width: "100%",
                        maxWidth: "280px",
                    }}
                />
                <button
                    type="submit"
                    disabled={isLoading || !email}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 20px",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        border: "none",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.7 : 1,
                        width: "fit-content",
                    }}
                >
                    {isLoading ? (
                        "MEMPROSES..."
                    ) : (
                        <>
                            <FiMail size={14} />
                            SUBSCRIBE
                        </>
                    )}
                </button>
            </form>

            {status !== "idle" && (
                <div style={{
                    marginTop: "12px",
                    padding: "10px 14px",
                    backgroundColor: status === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${status === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    color: status === "success" ? "#22c55e" : "#ef4444",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    maxWidth: "280px",
                }}>
                    {status === "success" ? <FiCheck size={14} /> : <FiX size={14} />}
                    {message}
                </div>
            )}
        </div>
    );
}
