"use client";

import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { FiKey, FiSave, FiTrash2, FiPlus, FiChevronDown } from "react-icons/fi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";

interface AccountInfo {
    id: string;
    label: string;
    lastUsedAt: string | null;
}

interface CredentialStatus {
    appId: string;
    appName: string;
    appSlug: string;
    credentialCount: number;
    lastUsedAt: string | null;
    accounts: AccountInfo[];
}

export default function CredentialsPage() {
    const searchParams = useSearchParams();
    const highlightApp = searchParams.get("app");

    const [apps, setApps] = useState<CredentialStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedApp, setExpandedApp] = useState<string | null>(highlightApp);
    // Form per app: label + username + password (klik "Tambah Akun")
    const [formData, setFormData] = useState<Record<string, { label: string; username: string; password: string }>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [credToDelete, setCredToDelete] = useState<AccountInfo | null>(null);
    const { showToast } = useToast();

    const fetchCredentials = useCallback(async () => {
        try {
            const res = await fetch("/api/portal/credentials");
            if (res.ok) {
                const data = await res.json();
                setApps(data);
                const initial: Record<string, { label: string; username: string; password: string }> = {};
                data.forEach((app: CredentialStatus) => {
                    initial[app.appId] = { label: "", username: "", password: "" };
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
        if (!data?.label || !data?.username || !data?.password) {
            showToast("Label, username, dan password harus diisi", "error");
            return;
        }

        setSaving(appId);
        try {
            const res = await fetch("/api/portal/credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appId,
                    label: data.label,
                    username: data.username,
                    password: data.password,
                }),
            });

            if (res.ok) {
                setFormData((prev) => ({
                    ...prev,
                    [appId]: { label: "", username: "", password: "" },
                }));
                await fetchCredentials();
                showToast("Akun berhasil disimpan", "success");
            } else {
                const err = await res.json();
                showToast(err.error || "Gagal menyimpan akun", "error");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setSaving(null);
        }
    };

    const executeDelete = async (cred: AccountInfo) => {
        try {
            const res = await fetch(`/api/portal/credentials?credentialId=${cred.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchCredentials();
                showToast("Akun berhasil dihapus", "success");
            } else {
                showToast("Gagal menghapus akun", "error");
            }
        } catch {
            showToast("Gagal menghapus akun", "error");
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
                <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "8px" }}>
                    Simpan satu atau beberapa akun untuk setiap aplikasi. Kredensial disimpan terenkripsi.
                </p>
            </div>

            {isLoading ? (
                <div style={{ padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
            ) : apps.length === 0 ? (
                <div style={{ padding: "64px", textAlign: "center", backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "12px" }}>
                    <FiKey size={48} color="#262626" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "var(--text-muted)" }}>Belum ada aplikasi yang di-assign ke Anda.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {apps.map((app) => {
                        const isExpanded = expandedApp === app.appId;
                        const data = formData[app.appId] || { label: "", username: "", password: "" };

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
                                                color: app.credentialCount > 0 ? "#22c55e" : "#eab308",
                                                marginTop: "2px",
                                            }}>
                                                {app.credentialCount > 0
                                                    ? (app.credentialCount === 1 ? "✓ 1 akun tersimpan" : `✓ ${app.credentialCount} akun tersimpan`)
                                                    : "⚠ Belum ada akun"}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: "12px",
                                        color: "var(--text-muted)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                    }}>
                                        <FiChevronDown style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                                    </div>
                                </div>

                                {/* Expanded: daftar akun + form tambah */}
                                {isExpanded && (
                                    <div style={{ padding: "0 20px 20px", borderTop: "1px solid #262626" }}>
                                        {/* Daftar akun */}
                                        {app.accounts.length > 0 && (
                                            <div style={{ paddingTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                                {app.accounts.map((acc) => (
                                                    <div key={acc.id} style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        padding: "10px 14px",
                                                        backgroundColor: "#0a0a0a",
                                                        border: "1px solid #262626",
                                                        borderRadius: "8px",
                                                    }}>
                                                        <div>
                                                            <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{acc.label}</div>
                                                            <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                                                                {acc.lastUsedAt ? `Terakhir dipakai ${new Date(acc.lastUsedAt).toLocaleDateString()}` : "Belum pernah dipakai"}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setCredToDelete(acc); }}
                                                            style={{
                                                                padding: "6px 10px",
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
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Form tambah akun */}
                                        <div style={{ paddingTop: "16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                                                <FiPlus size={14} color="var(--text-muted)" />
                                                <span style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600 }}>Tambah Akun</span>
                                            </div>
                                            <div style={{ marginBottom: "12px" }}>
                                                <label style={{ display: "block", color: "#a1a1aa", fontSize: "13px", marginBottom: "6px" }}>Label Akun</label>
                                                <input
                                                    type="text"
                                                    value={data.label}
                                                    onChange={(e) => setFormData((prev) => ({
                                                        ...prev,
                                                        [app.appId]: { ...prev[app.appId], label: e.target.value },
                                                    }))}
                                                    style={{ ...inputStyle }}
                                                    placeholder="Mis. Akun Pusat / Akun Cabang"
                                                />
                                            </div>
                                            <div style={{ marginBottom: "12px" }}>
                                                <label style={{ display: "block", color: "#a1a1aa", fontSize: "13px", marginBottom: "6px" }}>Username</label>
                                                <input
                                                    type="text"
                                                    value={data.username}
                                                    onChange={(e) => setFormData((prev) => ({
                                                        ...prev,
                                                        [app.appId]: { ...prev[app.appId], username: e.target.value },
                                                    }))}
                                                    style={{ ...inputStyle }}
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
                                                    style={{ ...inputStyle }}
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
                                                {saving === app.appId ? "Menyimpan..." : "Tambah Akun"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={!!credToDelete}
                title="Hapus Akun"
                message={credToDelete ? `Hapus akun "${credToDelete.label}" untuk aplikasi ini?` : ""}
                confirmLabel="Hapus"
                cancelLabel="Batal"
                variant="danger"
                onConfirm={() => {
                    if (credToDelete) executeDelete(credToDelete);
                    setCredToDelete(null);
                }}
                onCancel={() => setCredToDelete(null)}
            />
        </div>
    );
}

const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    backgroundColor: "#0a0a0a",
    border: "1px solid #262626",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
};
