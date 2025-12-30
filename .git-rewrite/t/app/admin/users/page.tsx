"use client";

import { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiX, FiShield, FiUser } from "react-icons/fi";

interface User {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "EDITOR";
    createdAt: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "EDITOR" as "ADMIN" | "EDITOR",
    });
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
            const method = editingUser ? "PUT" : "POST";

            const body: Record<string, string> = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
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
            setFormData({ name: "", email: "", password: "", role: "EDITOR" });
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
            role: user.role,
        });
        setShowModal(true);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ name: "", email: "", password: "", role: "EDITOR" });
        setShowModal(true);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
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
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>DIBUAT</th>
                            <th style={{ padding: "20px", textAlign: "right", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, index) => (
                            <tr key={user.id} style={{ borderBottom: index < users.length - 1 ? "1px solid #262626" : "none", transition: "background-color 0.2s" }}>
                                <td style={{ padding: "20px", color: "#fff", fontSize: "15px", fontWeight: 500 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                        <div style={{
                                            width: "40px",
                                            height: "40px",
                                            backgroundColor: user.role === "ADMIN" ? "rgba(220, 38, 38, 0.15)" : "#1a1a1a",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: "8px",
                                            border: user.role === "ADMIN" ? "1px solid rgba(220, 38, 38, 0.3)" : "1px solid #333",
                                        }}>
                                            {user.role === "ADMIN" ? <FiShield size={18} color="#dc2626" /> : <FiUser size={18} color="#737373" />}
                                        </div>
                                        {user.name}
                                    </div>
                                </td>
                                <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "14px" }}>{user.email}</td>
                                <td style={{ padding: "20px" }}>
                                    <span style={{
                                        padding: "6px 14px",
                                        backgroundColor: user.role === "ADMIN" ? "rgba(220, 38, 38, 0.2)" : "rgba(59, 130, 246, 0.2)",
                                        color: user.role === "ADMIN" ? "#f87171" : "#60a5fa",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        letterSpacing: "0.1em",
                                        borderRadius: "4px",
                                    }}>
                                        {user.role}
                                    </span>
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
                        ))}
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
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as "ADMIN" | "EDITOR" })}
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
                                </select>
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
