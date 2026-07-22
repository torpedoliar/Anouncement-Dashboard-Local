"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { FiKey, FiSave, FiTrash2 } from "react-icons/fi";

interface CredentialStatus {
    appId: string;
    appName: string;
    appSlug: string;
    hasCredential: boolean;
    lastUsedAt: string | null;
}

export default function CredentialsPage() {
    const searchParams = useSearchParams();
    const highlightApp = searchParams.get("app");

    const [apps, setApps] = useState<CredentialStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedApp, setExpandedApp] = useState<string | null>(highlightApp);
    const [formData, setFormData] = useState<Record<string, { username: string; password: string }>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const fetchCredentials = useCallback(async () => {
        try {
            const res = await fetch("/api/portal/credentials");
            if (res.ok) {
                const data = await res.json();
                setApps(data);
                // Initialize form data
                const initial: Record<string, { username: string; password: string }> = {};
                data.forEach((app: CredentialStatus) => {
                    initial[app.appId] = { username: "", password: "" };
                });
                setFormData(initial);
            }
        } catch (err) {
            console.error("Failed to fetch credentials:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCredentials();
    }, [fetchCredentials]);

    useEffect(() => {
        if (highlightApp) {
            setExpandedApp(highlightApp);
        }
    }, [highlightApp]);

    const handleSave = async (appId: string) => {
        const data = formData[appId];
        if (!data?.username || !data?.password) {
            alert("Username dan password harus diisi");
            return;
        }

        setSaving(appId);
        try {
            const res = await fetch("/api/portal/credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appId,
                    username: data.username,
                    password: data.password,
                }),
            });

            if (res.ok) {
                setFormData((prev) => ({
                    ...prev,
                    [appId]: { username: "", password: "" },
                }));
                await fetchCredentials();
                setExpandedApp(null);
            } else {
                const err = await res.json();
                alert(err.error || "Gagal menyimpan kredensial");
            }
        } catch {
            alert("Terjadi kesalahan");
        } finally {
            setSaving(null);
        }
    };

    const handleDelete = async (appId: string) => {
        if (!confirm("Hapus kredensial untuk aplikasi ini?")) return;

        try {
            const res = await fetch(`/api/portal/credentials?appId=${appId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchCredentials();
            }
        } catch {
            alert("Gagal menghapus kredensial");
        }
    };

    return (
        <div style={{ padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ marginBottom: "32px" }}>
                <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    PORTAL SSO
                </p>
                <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0 }}>
                    Kelola Kredensial
                </h1>
                <p style={{ color: "#525252", fontSize: "14px", marginTop: "8px" }}>
                    Simpan username dan password untuk setiap aplikasi. Kredensial disimpan terenkripsi.
                </p>
            </div>

            {isLoading ? (
                <div style={{ padding: "64px", textAlign: "center", color: "#525252" }}>Loading...</div>
            ) : apps.length === 0 ? (
                <div style={{ padding: "64px", textAlign: "center", backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "12px" }}>
                    <FiKey size={48} color="#262626" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "#525252" }}>Belum ada aplikasi yang di-assign ke Anda.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {apps.map((app) => {
                        const isExpanded = expandedApp === app.appId;
                        const data = formData[app.appId] || { username: "", password: "" };

                        return (
                            <div key={app.appId} style={{
                                backgroundColor: "#111",
                                border: "1px solid #262626",
                                borderRadius: "8px",
                                overflow: "hidden",
                            }}>
                                {/* Header */}
                                <div
                                    onClick={() => setExpandedApp(isExpanded ? null : app.appId)}
                                    style={{
                                        padding: "16px 20px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{
                                            width: "36px",
                                            height: "36px",
                                            borderRadius: "8px",
                                            backgroundColor: "#262626",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#737373",
                                            fontSize: "16px",
                                            fontWeight: 700,
                                        }}>
                                            {app.appName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>{app.appName}</div>
                                            <div style={{
                                                fontSize: "12px",
                                                color: app.hasCredential ? "#22c55e" : "#eab308",
                                                marginTop: "2px",
                                            }}>
                                                {app.hasCredential ? "✓ Kredensial tersimpan" : "⚠ Belum ada kredensial"}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        {app.hasCredential && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(app.appId); }}
                                                style={{
                                                    padding: "6px 12px",
                                                    backgroundColor: "transparent",
                                                    border: "1px solid #262626",
                                                    borderRadius: "6px",
                                                    color: "#dc2626",
                                                    fontSize: "12px",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                <FiTrash2 size={12} /> Hapus
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded form */}
                                {isExpanded && (
                                    <div style={{ padding: "0 20px 20px", borderTop: "1px solid #262626" }}>
                                        <div style={{ paddingTop: "16px" }}>
                                            <div style={{ marginBottom: "12px" }}>
                                                <label style={{ display: "block", color: "#a1a1aa", fontSize: "13px", marginBottom: "6px" }}>Username</label>
                                                <input
                                                    type="text"
                                                    value={data.username}
                                                    onChange={(e) => setFormData((prev) => ({
                                                        ...prev,
                                                        [app.appId]: { ...prev[app.appId], username: e.target.value },
                                                    }))}
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
                                                    placeholder="Username aplikasi"
                                                />
                                            </div>
                                            <div style={{ marginBottom: "16px" }}>
                                                <label style={{ display: "block", color: "#a1a1aa", fontSize: "13px", marginBottom: "6px" }}>Password</label>
                                                <input
                                                    type="password"
                                                    value={data.password}
                                                    onChange={(e) => setFormData((prev) => ({
                                                        ...prev,
                                                        [app.appId]: { ...prev[app.appId], password: e.target.value },
                                                    }))}
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
                                                    placeholder="Password aplikasi"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleSave(app.appId)}
                                                disabled={saving === app.appId}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    padding: "10px 20px",
                                                    backgroundColor: saving === app.appId ? "#333" : "#dc2626",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: "8px",
                                                    fontSize: "13px",
                                                    fontWeight: 600,
                                                    cursor: saving === app.appId ? "not-allowed" : "pointer",
                                                }}
                                            >
                                                <FiSave size={14} />
                                                {saving === app.appId ? "Menyimpan..." : "Simpan Kredensial"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
