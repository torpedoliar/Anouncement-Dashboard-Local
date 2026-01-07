"use client";

import { useState, useEffect } from "react";
import { FiMail, FiSave, FiRefreshCw, FiCheck, FiX, FiServer } from "react-icons/fi";

interface EmailSettings {
    id: number;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPass: string | null;
    fromName: string;
    fromEmail: string;
    replyToEmail: string | null;
    autoSendNewArticle: boolean;
}

export default function EmailPage() {
    const [settings, setSettings] = useState<EmailSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch("/api/email/settings");
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
            }
        } catch (err) {
            console.error("Failed to fetch email settings:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setIsSaving(true);
        setSuccessMessage("");
        setTestResult(null);

        try {
            const response = await fetch("/api/email/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (response.ok) {
                setSuccessMessage("Pengaturan berhasil disimpan");
                fetchSettings();
            } else {
                const data = await response.json();
                alert(data.error || "Gagal menyimpan pengaturan");
            }
        } catch {
            alert("Terjadi kesalahan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const response = await fetch("/api/email/settings", {
                method: "POST",
            });
            const data = await response.json();
            setTestResult(data);
        } catch {
            setTestResult({ success: false, error: "Connection test failed" });
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ padding: "32px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <p style={{ color: "#525252" }}>Loading...</p>
            </div>
        );
    }

    if (!settings) {
        return (
            <div style={{ padding: "32px", textAlign: "center", color: "#ef4444" }}>
                Failed to load email settings
            </div>
        );
    }

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{ marginBottom: "32px" }}>
                <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    EMAIL
                </p>
                <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                    Pengaturan Email
                </h1>
            </div>

            <form onSubmit={handleSave}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                    {/* SMTP Settings */}
                    <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", padding: "24px" }}>
                        <h2 style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", fontSize: "16px", fontWeight: 600, marginBottom: "24px" }}>
                            <FiServer size={18} />
                            Konfigurasi SMTP
                        </h2>

                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                SMTP HOST
                            </label>
                            <input
                                type="text"
                                value={settings.smtpHost}
                                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                                placeholder="localhost"
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#111",
                                    border: "1px solid #333",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                PORT
                            </label>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <input
                                    type="number"
                                    value={settings.smtpPort}
                                    onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 25 })}
                                    style={{
                                        width: "100px",
                                        padding: "12px",
                                        backgroundColor: "#111",
                                        border: "1px solid #333",
                                        color: "#fff",
                                        fontSize: "14px",
                                    }}
                                />
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#a1a1aa", fontSize: "13px", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.smtpSecure}
                                        onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                                        style={{ width: "18px", height: "18px", accentColor: "#dc2626" }}
                                    />
                                    SSL/TLS (port 465)
                                </label>
                            </div>
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                USERNAME (opsional)
                            </label>
                            <input
                                type="text"
                                value={settings.smtpUser || ""}
                                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value || null })}
                                placeholder="user@domain.com"
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#111",
                                    border: "1px solid #333",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                PASSWORD (opsional)
                            </label>
                            <input
                                type="password"
                                value={settings.smtpPass || ""}
                                onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value || null })}
                                placeholder="••••••••"
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#111",
                                    border: "1px solid #333",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "12px 20px",
                                backgroundColor: "#1a1a1a",
                                color: "#fff",
                                fontSize: "13px",
                                fontWeight: 600,
                                border: "1px solid #333",
                                cursor: isTesting ? "not-allowed" : "pointer",
                                opacity: isTesting ? 0.6 : 1,
                            }}
                        >
                            <FiRefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
                            {isTesting ? "Testing..." : "Test Connection"}
                        </button>

                        {testResult && (
                            <div style={{
                                marginTop: "16px",
                                padding: "12px",
                                backgroundColor: testResult.success ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                                border: `1px solid ${testResult.success ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                                color: testResult.success ? "#22c55e" : "#ef4444",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}>
                                {testResult.success ? <FiCheck size={16} /> : <FiX size={16} />}
                                {testResult.success ? "Connection successful!" : testResult.error}
                            </div>
                        )}
                    </div>

                    {/* Sender Settings */}
                    <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", padding: "24px" }}>
                        <h2 style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", fontSize: "16px", fontWeight: 600, marginBottom: "24px" }}>
                            <FiMail size={18} />
                            Informasi Pengirim
                        </h2>

                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                NAMA PENGIRIM
                            </label>
                            <input
                                type="text"
                                value={settings.fromName}
                                onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                                placeholder="Santos Jaya Abadi News"
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#111",
                                    border: "1px solid #333",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                EMAIL PENGIRIM
                            </label>
                            <input
                                type="email"
                                value={settings.fromEmail}
                                onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
                                placeholder="news@company.com"
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#111",
                                    border: "1px solid #333",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                REPLY-TO EMAIL (opsional)
                            </label>
                            <input
                                type="email"
                                value={settings.replyToEmail || ""}
                                onChange={(e) => setSettings({ ...settings, replyToEmail: e.target.value || null })}
                                placeholder="reply@company.com"
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#111",
                                    border: "1px solid #333",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>

                        <div style={{ borderTop: "1px solid #262626", paddingTop: "24px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "12px", color: "#a1a1aa", fontSize: "14px", cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={settings.autoSendNewArticle}
                                    onChange={(e) => setSettings({ ...settings, autoSendNewArticle: e.target.checked })}
                                    style={{ width: "18px", height: "18px" }}
                                />
                                Kirim email otomatis saat artikel baru dipublikasikan
                            </label>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <button
                        type="submit"
                        disabled={isSaving}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "14px 28px",
                            backgroundColor: "#dc2626",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: 600,
                            border: "none",
                            cursor: isSaving ? "not-allowed" : "pointer",
                            opacity: isSaving ? 0.6 : 1,
                        }}
                    >
                        <FiSave size={16} />
                        {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                    </button>

                    {successMessage && (
                        <span style={{ color: "#22c55e", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FiCheck size={16} />
                            {successMessage}
                        </span>
                    )}
                </div>
            </form>
        </div>
    );
}
