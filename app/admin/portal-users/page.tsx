"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { FiUsers, FiPlus, FiEdit, FiTrash, FiKey, FiToggleLeft, FiToggleRight, FiX, FiChevronDown, FiChevronRight } from "react-icons/fi";

interface PortalApp {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
}

interface AppAccess {
    id: string;
    appId: string;
    app: PortalApp;
}

interface PortalGroupInfo {
    id: string;
    groupId: string;
    group: { id: string; name: string };
}

interface PortalUser {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    appAccess?: AppAccess[];
    groups?: PortalGroupInfo[];
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const emptyForm = {
    email: "",
    name: "",
    role: "PORTAL_USER",
    isActive: true,
    password: "",
    appIds: [] as string[],
    groupIds: [] as string[],
};

export default function PortalUsersPage() {
    const [users, setUsers] = useState<PortalUser[]>([]);
    const [apps, setApps] = useState<PortalApp[]>([]);
    const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetTarget, setResetTarget] = useState<PortalUser | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [isResetting, setIsResetting] = useState(false);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            const response = await fetch(`/api/portal-users?page=${page}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                setUsers(data.data || data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Gagal memuat portal users:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    const fetchApps = async () => {
        try {
            const response = await fetch("/api/portal-apps?limit=100");
            if (response.ok) {
                const data = await response.json();
                setApps(data.data || data);
            }
        } catch (err) {
            console.error("Gagal memuat apps:", err);
        }
    };

    const fetchGroups = async () => {
        try {
            const response = await fetch("/api/portal-groups?limit=100");
            if (response.ok) {
                const data = await response.json();
                setGroups((data.data || data).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
            }
        } catch (err) {
            console.error("Gagal memuat groups:", err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchApps();
        fetchGroups();
    }, [fetchUsers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingUser ? `/api/portal-users/${editingUser.id}` : "/api/portal-users";
            const method = editingUser ? "PUT" : "POST";

            const body: Record<string, unknown> = {
                email: formData.email,
                name: formData.name,
                role: formData.role,
                isActive: formData.isActive,
            };
            if (formData.password) {
                body.password = formData.password;
            }
            if (!editingUser) {
                body.appIds = formData.appIds;
            }
            // Always send groupIds for edit (atomic replace via API)
            if (editingUser) {
                body.groupIds = formData.groupIds;
            }

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

            // If editing and apps changed, sync access
            if (editingUser) {
                const currentAppIds = editingUser.appAccess?.map(a => a.appId) || [];
                const toAdd = formData.appIds.filter(id => !currentAppIds.includes(id));
                const toRemove = currentAppIds.filter(id => !formData.appIds.includes(id));

                for (const appId of toAdd) {
                    await fetch(`/api/portal-users/${editingUser.id}/access`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ appId }),
                    });
                }
                for (const appId of toRemove) {
                    await fetch(`/api/portal-users/${editingUser.id}/access?appId=${appId}`, {
                        method: "DELETE",
                    });
                }
            }

            closeModal();
            fetchUsers();
        } catch {
            setError("Terjadi kesalahan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (user: PortalUser) => {
        if (!confirm(`Hapus pengguna "${user.name}" (${user.email})?`)) return;

        try {
            const response = await fetch(`/api/portal-users/${user.id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal menghapus");
                return;
            }
            fetchUsers();
        } catch {
            alert("Terjadi kesalahan");
        }
    };

    const handleToggleStatus = async (user: PortalUser) => {
        try {
            const response = await fetch(`/api/portal-users/${user.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !user.isActive }),
            });
            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal mengubah status");
                return;
            }
            fetchUsers();
        } catch {
            alert("Terjadi kesalahan");
        }
    };

    const handleResetPassword = async () => {
        if (!resetTarget || !newPassword) return;
        setIsResetting(true);

        try {
            const response = await fetch(`/api/portal-users/${resetTarget.id}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: newPassword }),
            });
            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal reset password");
                return;
            }
            setShowResetModal(false);
            setResetTarget(null);
            setNewPassword("");
            alert("Password berhasil direset");
        } catch {
            alert("Terjadi kesalahan");
        } finally {
            setIsResetting(false);
        }
    };

    const handleRevokeAccess = async (userId: string, appId: string) => {
        if (!confirm("Cabut akses aplikasi ini?")) return;

        try {
            const response = await fetch(`/api/portal-users/${userId}/access?appId=${appId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal mencabut akses");
                return;
            }
            fetchUsers();
        } catch {
            alert("Terjadi kesalahan");
        }
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ ...emptyForm, password: "" });
        setError("");
        setShowModal(true);
    };

    const openEditModal = (user: PortalUser) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            password: "",
            appIds: user.appAccess?.map(a => a.appId) || [],
            groupIds: user.groups?.map(g => g.groupId) || [],
        });
        setError("");
        setShowModal(true);
    };

    const openResetModal = (user: PortalUser) => {
        setResetTarget(user);
        setNewPassword("");
        setShowResetModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingUser(null);
        setFormData(emptyForm);
        setError("");
    };

    const handleAppToggle = (appId: string) => {
        setFormData(prev => {
            if (prev.appIds.includes(appId)) {
                return { ...prev, appIds: prev.appIds.filter(id => id !== appId) };
            }
            return { ...prev, appIds: [...prev.appIds, appId] };
        });
    };

    const handleGroupToggle = (groupId: string) => {
        setFormData(prev => {
            if (prev.groupIds.includes(groupId)) {
                return { ...prev, groupIds: prev.groupIds.filter(id => id !== groupId) };
            }
            return { ...prev, groupIds: [...prev.groupIds, groupId] };
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
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
                        Pengguna Portal
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
                    Tambah Pengguna
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>TOTAL PENGGUNA</p>
                    <p style={{ color: "#fff", fontSize: "24px", fontWeight: 700 }}>{pagination?.total || users.length}</p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>AKTIF</p>
                    <p style={{ color: "#22c55e", fontSize: "24px", fontWeight: 700 }}>
                        {users.filter(u => u.isActive).length}
                    </p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>NONAKTIF</p>
                    <p style={{ color: "#ef4444", fontSize: "24px", fontWeight: 700 }}>
                        {users.filter(u => !u.isActive).length}
                    </p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>PORTAL ADMIN</p>
                    <p style={{ color: "#a855f7", fontSize: "24px", fontWeight: 700 }}>
                        {users.filter(u => u.role === "PORTAL_ADMIN").length}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#111" }}>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>NAMA</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>EMAIL</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>ROLE</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>GRUP</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>STATUS</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>DIBUAT</th>
                            <th style={{ padding: "20px", textAlign: "right", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#525252" }}>
                                    Tidak ada pengguna portal ditemukan
                                </td>
                            </tr>
                        ) : (
                            users.map((user, index) => (
                                <Fragment key={user.id}>
                                    <tr style={{ borderBottom: expandedUserId === user.id ? "none" : (index < users.length - 1 ? "1px solid #262626" : "none") }}>
                                        <td style={{ padding: "20px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{
                                                    width: "36px",
                                                    height: "36px",
                                                    backgroundColor: user.role === "PORTAL_ADMIN" ? "rgba(168, 85, 247, 0.15)" : "#1a1a1a",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    borderRadius: "8px",
                                                    border: user.role === "PORTAL_ADMIN" ? "1px solid rgba(168, 85, 247, 0.3)" : "1px solid #333",
                                                }}>
                                                    <FiUsers size={16} color={user.role === "PORTAL_ADMIN" ? "#a855f7" : "#737373"} />
                                                </div>
                                                <span style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>{user.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "14px" }}>{user.email}</td>
                                        <td style={{ padding: "20px" }}>
                                            <span style={{
                                                padding: "4px 12px",
                                                backgroundColor: user.role === "PORTAL_ADMIN" ? "rgba(168, 85, 247, 0.2)" : "rgba(59, 130, 246, 0.2)",
                                                color: user.role === "PORTAL_ADMIN" ? "#a855f7" : "#60a5fa",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                            }}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: "20px" }}>
                                            {user.groups && user.groups.length > 0 ? (
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                                    {user.groups.map(g => (
                                                        <span key={g.id} style={{
                                                            padding: "2px 8px",
                                                            backgroundColor: "rgba(168, 85, 247, 0.15)",
                                                            color: "#a855f7",
                                                            fontSize: "10px",
                                                            fontWeight: 600,
                                                            borderRadius: "4px",
                                                        }}>
                                                            {g.group.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ color: "#525252", fontSize: "12px" }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "20px" }}>
                                            {user.isActive ? (
                                                <span style={{ padding: "4px 12px", backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#22c55e", fontSize: "11px", fontWeight: 600 }}>
                                                    AKTIF
                                                </span>
                                            ) : (
                                                <span style={{ padding: "4px 12px", backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444", fontSize: "11px", fontWeight: 600 }}>
                                                    NONAKTIF
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: "20px", color: "#71717a", fontSize: "13px" }}>{formatDate(user.createdAt)}</td>
                                        <td style={{ padding: "16px", textAlign: "right" }}>
                                            <button
                                                onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                                                style={{ padding: "8px", backgroundColor: "transparent", border: "1px solid #262626", color: "#737373", cursor: "pointer", marginRight: "4px" }}
                                                title="Lihat Akses"
                                            >
                                                {expandedUserId === user.id ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(user)}
                                                style={{ padding: "8px", backgroundColor: "transparent", border: "1px solid #262626", color: user.isActive ? "#22c55e" : "#ef4444", cursor: "pointer", marginRight: "4px" }}
                                                title={user.isActive ? "Nonaktifkan" : "Aktifkan"}
                                            >
                                                {user.isActive ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />}
                                            </button>
                                            <button
                                                onClick={() => openResetModal(user)}
                                                style={{ padding: "8px", backgroundColor: "transparent", border: "1px solid #262626", color: "#fbbf24", cursor: "pointer", marginRight: "4px" }}
                                                title="Reset Password"
                                            >
                                                <FiKey size={14} />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(user)}
                                                style={{ padding: "8px", backgroundColor: "transparent", border: "1px solid #262626", color: "#737373", cursor: "pointer", marginRight: "4px" }}
                                                title="Edit"
                                            >
                                                <FiEdit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                style={{ padding: "8px", backgroundColor: "transparent", border: "1px solid #262626", color: "#dc2626", cursor: "pointer" }}
                                                title="Hapus"
                                            >
                                                <FiTrash size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedUserId === user.id && (
                                        <tr key={`${user.id}-expanded`}>
                                            <td colSpan={7} style={{ padding: "0 20px 20px 20px", backgroundColor: "#0d0d0d", borderBottom: index < users.length - 1 ? "1px solid #262626" : "none" }}>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                                    {/* Groups */}
                                                    <div style={{ padding: "16px", backgroundColor: "#111", border: "1px solid #262626", borderRadius: "4px" }}>
                                                        <p style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>GRUP</p>
                                                        {user.groups && user.groups.length > 0 ? (
                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                                                {user.groups.map(g => (
                                                                    <span key={g.id} style={{
                                                                        padding: "4px 12px",
                                                                        backgroundColor: "rgba(168, 85, 247, 0.2)",
                                                                        color: "#a855f7",
                                                                        fontSize: "11px",
                                                                        fontWeight: 600,
                                                                        borderRadius: "4px",
                                                                    }}>
                                                                        {g.group.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p style={{ color: "#525252", fontSize: "13px" }}>Tidak ada grup</p>
                                                        )}
                                                    </div>
                                                    {/* Direct access */}
                                                    <div style={{ padding: "16px", backgroundColor: "#111", border: "1px solid #262626", borderRadius: "4px" }}>
                                                        <p style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>AKSES LANGSUNG (OVERRIDE)</p>
                                                        {user.appAccess && user.appAccess.length > 0 ? (
                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                                                {user.appAccess.map(access => (
                                                                    <div key={access.id} style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: "8px",
                                                                        padding: "6px 12px",
                                                                        backgroundColor: "#1a1a1a",
                                                                        border: "1px solid #333",
                                                                        borderRadius: "4px",
                                                                    }}>
                                                                        <span style={{ color: "#fff", fontSize: "13px" }}>{access.app.name}</span>
                                                                        <button
                                                                            onClick={() => handleRevokeAccess(user.id, access.appId)}
                                                                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px" }}
                                                                            title="Cabut akses"
                                                                        >
                                                                            <FiX size={12} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p style={{ color: "#525252", fontSize: "13px" }}>Tidak ada akses langsung</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
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

            {/* Create/Edit Modal */}
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
                        maxWidth: "500px",
                        padding: "24px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                                {editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
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
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>EMAIL *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    style={inputStyle}
                                />
                            </div>

                            {!editingUser && (
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>PASSWORD *</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>ROLE</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="PORTAL_USER">PORTAL_USER</option>
                                        <option value="PORTAL_ADMIN">PORTAL_ADMIN</option>
                                    </select>
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

                            {/* Group assignment */}
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>GRUP</label>
                                <div style={{
                                    border: "1px solid #262626",
                                    backgroundColor: "#111",
                                    padding: "12px",
                                    maxHeight: "150px",
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                }}>
                                    {groups.length === 0 ? (
                                        <span style={{ color: "#a3a3a3", fontSize: "13px" }}>Tidak ada grup tersedia</span>
                                    ) : (
                                        groups.map(group => (
                                            <label key={group.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#e5e5e5", fontSize: "14px" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.groupIds.includes(group.id)}
                                                    onChange={() => handleGroupToggle(group.id)}
                                                    style={{ accentColor: "#dc2626" }}
                                                />
                                                {group.name}
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Direct app access (override) */}
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>AKSES LANGSUNG (OVERRIDE)</label>
                                <p style={{ color: "#525252", fontSize: "11px", marginBottom: "8px" }}>Akses app di luar grup. Jika app sudah ada di grup, tidak perlu ditambah di sini.</p>
                                <div style={{
                                    border: "1px solid #262626",
                                    backgroundColor: "#111",
                                    padding: "12px",
                                    maxHeight: "150px",
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                }}>
                                    {apps.length === 0 ? (
                                        <span style={{ color: "#a3a3a3", fontSize: "13px" }}>Tidak ada aplikasi tersedia</span>
                                    ) : (
                                        apps.map(app => (
                                            <label key={app.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#e5e5e5", fontSize: "14px" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.appIds.includes(app.id)}
                                                    onChange={() => handleAppToggle(app.id)}
                                                    style={{ accentColor: "#dc2626" }}
                                                />
                                                {app.name}
                                                {!app.isActive && (
                                                    <span style={{ color: "#525252", fontSize: "11px" }}>(nonaktif)</span>
                                                )}
                                            </label>
                                        ))
                                    )}
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

            {/* Reset Password Modal */}
            {showResetModal && resetTarget && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 60,
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
                                Reset Password
                            </h2>
                            <button onClick={() => { setShowResetModal(false); setResetTarget(null); }} style={{ background: "none", border: "none", color: "#737373", cursor: "pointer" }}>
                                <FiX size={20} />
                            </button>
                        </div>

                        <p style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "16px" }}>
                            Reset password untuk <strong style={{ color: "#fff" }}>{resetTarget.name}</strong> ({resetTarget.email})
                        </p>

                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ display: "block", color: "#737373", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>PASSWORD BARU</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Masukkan password baru"
                                style={inputStyle}
                            />
                        </div>

                        <button
                            onClick={handleResetPassword}
                            disabled={isResetting || !newPassword}
                            style={{
                                width: "100%",
                                padding: "12px",
                                backgroundColor: "#fbbf24",
                                color: "#000",
                                fontSize: "13px",
                                fontWeight: 600,
                                border: "none",
                                cursor: isResetting || !newPassword ? "not-allowed" : "pointer",
                                opacity: isResetting || !newPassword ? 0.6 : 1,
                            }}
                        >
                            {isResetting ? "MERESET..." : "RESET PASSWORD"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
