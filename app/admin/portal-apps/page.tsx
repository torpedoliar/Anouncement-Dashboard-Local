"use client";

import { useState, useEffect, useCallback } from "react";
import { FiGrid, FiPlus, FiEdit, FiTrash, FiX } from "react-icons/fi";

interface PortalApp {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    url: string;
    loginUrl: string | null;
    ssoMode: string;
    httpMethod: string;
    usernameField: string | null;
    passwordField: string | null;
    extraFields: string | null;
    category: string | null;
    isActive: boolean;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const emptyForm = {
    name: "",
    slug: "",
    description: "",
    url: "",
    loginUrl: "",
    ssoMode: "FORM",
    httpMethod: "POST",
    usernameField: "username",
    passwordField: "password",
    extraFields: "",
    category: "",
    isActive: true,
    displayOrder: 0,
};

export default function PortalAppsPage() {
    const [apps, setApps] = useState<PortalApp[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingApp, setEditingApp] = useState<PortalApp | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const fetchApps = useCallback(async () => {
        try {
            const response = await fetch(`/api/portal-apps?page=${page}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                setApps(data.data || data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Gagal memuat portal apps:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchApps();
    }, [fetchApps]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingApp ? `/api/portal-apps/${editingApp.id}` : "/api/portal-apps";
            const method = editingApp ? "PUT" : "POST";

            // Parse extraFields from JSON string to object
            let extraFieldsParsed = null;
            if (formData.extraFields && formData.extraFields.trim()) {
                try {
                    extraFieldsParsed = JSON.parse(formData.extraFields);
                } catch {
                    setError("Extra Fields harus berformat JSON yang valid");
                    setIsSaving(false);
                    return;
                }
            }

            const body: Record<string, unknown> = {
                name: formData.name,
                slug: formData.slug,
                description: formData.description || null,
                url: formData.url,
                loginUrl: formData.loginUrl,
                ssoMode: formData.ssoMode,
                httpMethod: formData.httpMethod,
                usernameField: formData.usernameField || "username",
                passwordField: formData.passwordField || "password",
                extraFields: extraFieldsParsed,
                category: formData.category || null,
                isActive: formData.isActive,
                displayOrder: Number(formData.displayOrder),
            };

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Gagal menyimpan data");
                return;
            }

            closeModal();
            fetchApps();
        } catch {
            setError("Terjadi kesalahan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (app: PortalApp) => {
        if (!confirm(`Hapus aplikasi "${app.name}"?`)) return;

        try {
            const response = await fetch(`/api/portal-apps/${app.id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal menghapus");
                return;
            }
            fetchApps();
        } catch {
            alert("Terjadi kesalahan");
        }
    };

    const openAddModal = () => {
        setEditingApp(null);
        setFormData(emptyForm);
        setError("");
        setShowModal(true);
    };

    const openEditModal = (app: PortalApp) => {
        setEditingApp(app);
        setFormData({
            name: app.name,
            slug: app.slug,
            description: app.description || "",
            url: app.url,
            loginUrl: app.loginUrl || "",
            ssoMode: app.ssoMode,
            httpMethod: app.httpMethod,
            usernameField: app.usernameField || "",
            passwordField: app.passwordField || "",
            extraFields: app.extraFields || "",
            category: app.category || "",
            isActive: app.isActive,
            displayOrder: app.displayOrder,
        });
        setError("");
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingApp(null);
        setFormData(emptyForm);
        setError("");
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "12px",
        backgroundColor: "#111",
        border: "1px solid #262626",
        color: "#fff",
        fontSize: "14px",
    };

    if (isLoading) {
        return (
            <div style={{ padding: "32px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <p style={{ color: "#525252" }}>Loading...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                <div>
                    <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                        PORTAL
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                        Aplikasi Portal
                    </h1>
                </div>
                <button
                    onClick={openAddModal}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    <FiPlus size={16} />
                    Tambah Aplikasi
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>TOTAL APLIKASI</p>
                    <p style={{ color: "#fff", fontSize: "24px", fontWeight: 700 }}>{pagination?.total || apps.length}</p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>AKTIF</p>
                    <p style={{ color: "#22c55e", fontSize: "24px", fontWeight: 700 }}>
                        {apps.filter(a => a.isActive).length}
                    </p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>NONAKTIF</p>
                    <p style={{ color: "#ef4444", fontSize: "24px", fontWeight: 700 }}>
                        {apps.filter(a => !a.isActive).length}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#111" }}>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>NAMA</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>SLUG</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>KATEGORI</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>SSO MODE</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>STATUS</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>URUTAN</th>
                            <th style={{ padding: "20px", textAlign: "right", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {apps.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#525252" }}>
                                    Tidak ada aplikasi portal ditemukan
                                </td>
                            </tr>
                        ) : (
                            apps.map((app, index) => (
                                <tr key={app.id} style={{ borderBottom: index < apps.length - 1 ? "1px solid #262626" : "none" }}>
                                    <td style={{ padding: "20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                backgroundColor: "#1a1a1a",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "8px",
                                            }}>
                                                <FiGrid size={16} color="#737373" />
                                            </div>
                                            <div>
                                                <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>{app.name}</p>
                                                {app.description && (
                                                    <p style={{ color: "#525252", fontSize: "12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {app.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "13px", fontFamily: "monospace" }}>{app.slug}</td>
                                    <td style={{ padding: "20px" }}>
                                        {app.category ? (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", fontSize: "11px", fontWeight: 600 }}>
                                                {app.category}
                                            </span>
                                        ) : (
                                            <span style={{ color: "#525252", fontSize: "13px" }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        <span style={{ padding: "4px 12px", backgroundColor: "rgba(168, 85, 247, 0.2)", color: "#a855f7", fontSize: "11px", fontWeight: 600 }}>
                                            {app.ssoMode}
                                        </span>
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        {app.isActive ? (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#22c55e", fontSize: "11px", fontWeight: 600 }}>
                                                AKTIF
                                            </span>
                                        ) : (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444", fontSize: "11px", fontWeight: 600 }}>
                                                NONAKTIF
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: "20px", color: "#71717a", fontSize: "13px" }}>{app.displayOrder}</td>
                                    <td style={{ padding: "16px", textAlign: "right" }}>
                                        <button
                                            onClick={() => openEditModal(app)}
                                            style={{
                                                padding: "8px",
                                                backgroundColor: "transparent",
                                                border: "1px solid #262626",
                                                color: "#737373",
                                                cursor: "pointer",
                                                marginRight: "8px",
                                            }}
                                            title="Edit"
                                        >
                                            <FiEdit size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(app)}
                                            style={{
                                                padding: "8px",
                                                backgroundColor: "transparent",
                                                border: "1px solid #262626",
                                                color: "#dc2626",
                                                cursor: "pointer",
                                            }}
                                            title="Hapus"
                                        >
                                            <FiTrash size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: p === page ? "#dc2626" : "#1a1a1a",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 50,
                }}>
                    <div style={{
                        backgroundColor: "#0a0a0a",
                        border: "1px solid #262626",
                        width: "100%",
                        maxWidth: "600px",
                        padding: "24px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                                {editingApp ? "Edit Aplikasi" : "Tambah Aplikasi"}
                            </h2>
                            <button onClick={closeModal} style={{ background: "none", border: "none", color: "#737373", cursor: "pointer" }}>
                                <FiX size={20} />
                            </button>
                        </div>

                        {error && (
                            <div style={{ padding: "12px", backgroundColor: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", color: "#ef4444", fontSize: "14px", marginBottom: "16px" }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>NAMA *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>SLUG *</label>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>DESKRIPSI</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>URL *</label>
                                    <input
                                        type="text"
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        required
                                        placeholder="https://app.example.com"
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>LOGIN URL</label>
                                    <input
                                        type="text"
                                        value={formData.loginUrl}
                                        onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                                        placeholder="https://app.example.com/login"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>SSO MODE</label>
                                    <select
                                        value={formData.ssoMode}
                                        onChange={(e) => setFormData({ ...formData, ssoMode: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="FORM">FORM</option>
                                        <option value="REDIRECT">REDIRECT</option>
                                        <option value="PROXY">PROXY</option>
                                        <option value="TOKEN">TOKEN</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>HTTP METHOD</label>
                                    <select
                                        value={formData.httpMethod}
                                        onChange={(e) => setFormData({ ...formData, httpMethod: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="POST">POST</option>
                                        <option value="GET">GET</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>USERNAME FIELD</label>
                                    <input
                                        type="text"
                                        value={formData.usernameField}
                                        onChange={(e) => setFormData({ ...formData, usernameField: e.target.value })}
                                        placeholder="username"
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>PASSWORD FIELD</label>
                                    <input
                                        type="text"
                                        value={formData.passwordField}
                                        onChange={(e) => setFormData({ ...formData, passwordField: e.target.value })}
                                        placeholder="password"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>EXTRA FIELDS (JSON)</label>
                                <textarea
                                    value={formData.extraFields}
                                    onChange={(e) => setFormData({ ...formData, extraFields: e.target.value })}
                                    placeholder='{"key": "value"}'
                                    rows={3}
                                    style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>KATEGORI</label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>URUTAN</label>
                                    <input
                                        type="number"
                                        value={formData.displayOrder}
                                        onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ marginBottom: "16px", display: "flex", alignItems: "flex-end" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#a1a1aa", fontSize: "14px", paddingBottom: "12px" }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            style={{ accentColor: "#dc2626", width: "18px", height: "18px" }}
                                        />
                                        Aktif
                                    </label>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                style={{
                                    width: "100%",
                                    padding: "12px",
                                    backgroundColor: "#dc2626",
                                    color: "#fff",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: isSaving ? "not-allowed" : "pointer",
                                    opacity: isSaving ? 0.6 : 1,
                                }}
                            >
                                {isSaving ? "MENYIMPAN..." : "SIMPAN"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
