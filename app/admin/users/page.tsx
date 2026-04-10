"use client";

import { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiX, FiShield, FiUser, FiZap } from "react-icons/fi";

interface Site {
    id: string;
    name: string;
}

interface User {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "EDITOR";
    isSuperAdmin: boolean;
    createdAt: string;
    siteIds?: string[];
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "EDITOR" as "ADMIN" | "EDITOR" | "SUPER_ADMIN",
        siteIds: [] as string[],
    });
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchSites();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch("/api/users");
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSites = async () => {
        try {
            const response = await fetch("/api/sites");
            if (response.ok) {
                const data = await response.json();
                setSites(data);
            }
        } catch (err) {
            console.error("Failed to fetch sites:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
            const method = editingUser ? "PUT" : "POST";

            const body: Record<string, any> = {
                name: formData.name,
                email: formData.email,
                role: formData.role === "SUPER_ADMIN" ? "ADMIN" : formData.role,
                isSuperAdmin: formData.role === "SUPER_ADMIN",
                siteIds: formData.role === "SUPER_ADMIN" ? [] : formData.siteIds,
            };
            if (formData.password) {
                body.password = formData.password;
            }

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Failed to save user");
                return;
            }

            setShowModal(false);
            setEditingUser(null);
            setFormData({ name: "", email: "", password: "", role: "EDITOR", siteIds: [] });
            fetchUsers();
        } catch {
            setError("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (user: User) => {
        if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;

        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Failed to delete user");
                return;
            }

            fetchUsers();
        } catch {
            alert("An error occurred");
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: "",
            role: user.isSuperAdmin ? "SUPER_ADMIN" : user.role,
            siteIds: user.siteIds || [],
        });
        setShowModal(true);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ name: "", email: "", password: "", role: "EDITOR", siteIds: [] });
        setShowModal(true);
    };

    const handleSiteToggle = (siteId: string) => {
        setFormData(prev => {
            const currentSites = prev.siteIds || [];
            if (currentSites.includes(siteId)) {
                return { ...prev, siteIds: currentSites.filter(id => id !== siteId) };
            } else {
                return { ...prev, siteIds: [...currentSites, siteId] };
            }
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const getRoleBadge = (user: User) => {
        if (user.isSuperAdmin) {
            return {
                bg: "rgba(237, 28, 36, 0.2)",
                color: "#ED1C24",
                label: "SUPER ADMIN",
                icon: <FiZap size={18} color="#ED1C24" />,
                iconBg: "rgba(237, 28, 36, 0.15)",
                iconBorder: "1px solid rgba(237, 28, 36, 0.3)"
            };
        }
        if (user.role === "ADMIN") {
            return {
                bg: "rgba(220, 38, 38, 0.2)",
                color: "#f87171",
                label: "ADMIN",
                icon: <FiShield size={18} color="#dc2626" />,
                iconBg: "rgba(220, 38, 38, 0.15)",
                iconBorder: "1px solid rgba(220, 38, 38, 0.3)"
            };
        }
        return {
            bg: "rgba(59, 130, 246, 0.2)",
            color: "#60a5fa",
            label: "EDITOR",
            icon: <FiUser size={18} color="#737373" />,
            iconBg: "#1a1a1a",
            iconBorder: "1px solid #333"
        };
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
                        PENGGUNA
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                        Manajemen User
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
                    Tambah User
                </button>
            </div>

            {/* Users Table */}
            <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#111" }}>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>NAMA</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>EMAIL</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>ROLE</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>SITUS (AKSES)</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>DIBUAT</th>
                            <th style={{ padding: "20px", textAlign: "right", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, index) => {
                            const badge = getRoleBadge(user);
                            return (
                                <tr key={user.id} style={{ borderBottom: index < users.length - 1 ? "1px solid #262626" : "none", transition: "background-color 0.2s" }}>
                                    <td style={{ padding: "20px", color: "#fff", fontSize: "15px", fontWeight: 500 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                            <div style={{
                                                width: "40px",
                                                height: "40px",
                                                backgroundColor: badge.iconBg,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "8px",
                                                border: badge.iconBorder,
                                            }}>
                                                {badge.icon}
                                            </div>
                                            {user.name}
                                        </div>
                                    </td>
                                    <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "14px" }}>{user.email}</td>
                                    <td style={{ padding: "20px" }}>
                                        <span style={{
                                            padding: "6px 14px",
                                            backgroundColor: badge.bg,
                                            color: badge.color,
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            letterSpacing: "0.1em",
                                            borderRadius: "4px",
                                        }}>
                                            {badge.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "13px" }}>
                                        {user.isSuperAdmin ? (
                                            <span style={{ fontStyle: "italic" }}>Semua Situs</span>
                                        ) : user.siteIds && user.siteIds.length > 0 ? (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                                {user.siteIds.map(id => {
                                                    const siteName = sites.find(s => s.id === id)?.name || "Unknown";
                                                    return (
                                                        <span key={id} style={{ padding: "2px 6px", backgroundColor: "#262626", borderRadius: "4px", fontSize: "11px" }}>
                                                            {siteName}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span style={{ color: "#ef4444" }}>Tidak ada akses</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "20px", color: "#71717a", fontSize: "14px" }}>{formatDate(user.createdAt)}</td>
                                    <td style={{ padding: "16px", textAlign: "right" }}>
                                        <button
                                            onClick={() => openEditModal(user)}
                                            style={{
                                                padding: "8px",
                                                backgroundColor: "transparent",
                                                border: "1px solid #262626",
                                                color: "#737373",
                                                cursor: "pointer",
                                                marginRight: "8px",
                                            }}
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user)}
                                            style={{
                                                padding: "8px",
                                                backgroundColor: "transparent",
                                                border: "1px solid #262626",
                                                color: "#dc2626",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

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
                        maxWidth: "400px",
                        padding: "24px",
                        maxHeight: "90vh",
                        overflowY: "auto"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                                {editingUser ? "Edit User" : "Tambah User"}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#737373", cursor: "pointer" }}>
                                <FiX size={20} />
                            </button>
                        </div>

                        {error && (
                            <div style={{ padding: "12px", backgroundColor: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", color: "#ef4444", fontSize: "14px", marginBottom: "16px" }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>NAMA</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#111",
                                        border: "1px solid #262626",
                                        color: "#fff",
                                        fontSize: "14px",
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>EMAIL</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#111",
                                        border: "1px solid #262626",
                                        color: "#fff",
                                        fontSize: "14px",
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                                    PASSWORD {editingUser && "(kosongkan jika tidak ingin mengubah)"}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#111",
                                        border: "1px solid #262626",
                                        color: "#fff",
                                        fontSize: "14px",
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>ROLE</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#111",
                                        border: "1px solid #262626",
                                        color: "#fff",
                                        fontSize: "14px",
                                    }}
                                >
                                    <option value="EDITOR">EDITOR</option>
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                                </select>
                            </div>
                            
                            {formData.role !== "SUPER_ADMIN" && (
                                <div style={{ marginBottom: "24px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>AKSES SITUS (Hanya beri centang untuk diizinkan)</label>
                                    <div style={{
                                        border: "1px solid #262626",
                                        backgroundColor: "#111",
                                        padding: "12px",
                                        maxHeight: "150px",
                                        overflowY: "auto",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "8px"
                                    }}>
                                        {sites.length === 0 ? (
                                            <span style={{ color: "#a3a3a3", fontSize: "13px" }}>Tidak ada situs tersedia</span>
                                        ) : (
                                            sites.map(site => (
                                                <label key={site.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#e5e5e5", fontSize: "14px" }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.siteIds.includes(site.id)}
                                                        onChange={() => handleSiteToggle(site.id)}
                                                        style={{ accentColor: "#dc2626" }}
                                                    />
                                                    {site.name}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

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
