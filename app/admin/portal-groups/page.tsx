"use client";

import { useState, useEffect, useCallback } from "react";
import { FiUsers, FiPlus, FiEdit, FiTrash, FiX, FiGrid } from "react-icons/fi";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";

interface PortalGroup {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    _count: { apps: number; members: number };
}

interface PortalApp {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const emptyForm = {
    name: "",
    description: "",
    isActive: true,
    appIds: [] as string[],
};

export default function PortalGroupsPage() {
    const [groups, setGroups] = useState<PortalGroup[]>([]);
    const [apps, setApps] = useState<PortalApp[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<PortalGroup | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchGroups = useCallback(async () => {
        try {
            const response = await fetch(`/api/portal-groups?page=${page}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                setGroups(data.data || data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Gagal memuat portal groups:", err);
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

    useEffect(() => {
        fetchGroups();
        fetchApps();
    }, [fetchGroups]);

    const fetchGroupDetail = async (groupId: string) => {
        try {
            const response = await fetch(`/api/portal-groups/${groupId}`);
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (err) {
            console.error("Gagal memuat detail grup:", err);
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingGroup ? `/api/portal-groups/${editingGroup.id}` : "/api/portal-groups";
            const method = editingGroup ? "PUT" : "POST";

            const body = {
                name: formData.name,
                description: formData.description || null,
                isActive: formData.isActive,
                appIds: formData.appIds,
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
            fetchGroups();
        } catch {
            setError("Terjadi kesalahan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (group: PortalGroup) => {
        if (!(await confirm({ title: "Hapus Grup", message: `Hapus grup "${group.name}"? ${group._count.members} anggota akan kehilangan akses via grup ini.`, variant: "danger" }))) return;

        try {
            const response = await fetch(`/api/portal-groups/${group.id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal menghapus", "error");
                return;
            }
            fetchGroups();
            showToast("Grup berhasil dihapus", "success");
        } catch {
            showToast("Terjadi kesalahan", "error");
        }
    };

    const openAddModal = () => {
        setEditingGroup(null);
        setFormData(emptyForm);
        setError("");
        setShowModal(true);
    };

    const openEditModal = async (group: PortalGroup) => {
        setEditingGroup(group);
        setError("");
        // Fetch detail to get current appIds
        const detail = await fetchGroupDetail(group.id);
        setFormData({
            name: group.name,
            description: group.description || "",
            isActive: group.isActive,
            appIds: detail?.apps?.map((a: { app: { id: string } }) => a.app.id) || [],
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingGroup(null);
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

    const inputStyle: React.CSSProperties = {
        width: "100%", boxSizing: "border-box",
        padding: "12px",
        backgroundColor: "#111",
        border: "1px solid #262626",
        color: "#fff",
        fontSize: "14px",
    };

    if (isLoading) {
        return (
            <div style={{ padding: "32px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <p style={{ color: "var(--text-tertiary)" }}>Loading...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                <div>
                    <p style={{ color: "var(--brand-red)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                        PORTAL
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                        Grup Portal
                    </h1>
                </div>
                <button
                    onClick={openAddModal}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        backgroundColor: "var(--brand-red)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    <FiPlus size={16} />
                    Tambah Grup
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "20px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "8px" }}>TOTAL GRUP</p>
                    <p style={{ color: "var(--text-primary)", fontSize: "24px", fontWeight: 700 }}>{pagination?.total || groups.length}</p>
                </div>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "20px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "8px" }}>AKTIF</p>
                    <p style={{ color: "var(--color-success)", fontSize: "24px", fontWeight: 700 }}>
                        {groups.filter(g => g.isActive).length}
                    </p>
                </div>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "20px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "8px" }}>NONAKTIF</p>
                    <p style={{ color: "var(--color-error)", fontSize: "24px", fontWeight: 700 }}>
                        {groups.filter(g => !g.isActive).length}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: "var(--bg-secondary)", border: "2px solid var(--border-strong)", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", boxSizing: "border-box", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid var(--border-strong)", backgroundColor: "var(--bg-card)" }}>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>NAMA</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>DESKRIPSI</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>APLIKASI</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>ANGGOTA</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>STATUS</th>
                            <th style={{ padding: "20px", textAlign: "right", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "var(--text-tertiary)" }}>
                                    Tidak ada grup portal ditemukan
                                </td>
                            </tr>
                        ) : (
                            groups.map((group, index) => (
                                <tr key={group.id} style={{ borderBottom: index < groups.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                                    <td style={{ padding: "20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                backgroundColor: "var(--bg-tertiary)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "8px",
                                            }}>
                                                <FiUsers size={16} color="#737373" />
                                            </div>
                                            <div>
                                                <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 500 }}>{group.name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "20px", color: "var(--text-secondary)", fontSize: "13px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {group.description || "-"}
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        <span style={{ padding: "4px 12px", backgroundColor: "rgba(59, 130, 246, 0.2)", color: "var(--color-info)", fontSize: "11px", fontWeight: 600 }}>
                                            {group._count.apps} app
                                        </span>
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        <span style={{ padding: "4px 12px", backgroundColor: "rgba(168, 85, 247, 0.2)", color: "#a855f7", fontSize: "11px", fontWeight: 600 }}>
                                            {group._count.members} user
                                        </span>
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        {group.isActive ? (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(34, 197, 94, 0.2)", color: "var(--color-success)", fontSize: "11px", fontWeight: 600 }}>
                                                AKTIF
                                            </span>
                                        ) : (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(239, 68, 68, 0.2)", color: "var(--color-error)", fontSize: "11px", fontWeight: 600 }}>
                                                NONAKTIF
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: "16px", textAlign: "right" }}>
                                        <button
                                            onClick={() => openEditModal(group)}
                                            style={{
                                                padding: "8px",
                                                backgroundColor: "transparent",
                                                border: "1px solid var(--border-color)",
                                                color: "var(--text-muted)",
                                                cursor: "pointer",
                                                marginRight: "8px",
                                            }}
                                            title="Edit"
                                        >
                                            <FiEdit size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(group)}
                                            style={{
                                                padding: "8px",
                                                backgroundColor: "transparent",
                                                border: "1px solid var(--border-color)",
                                                color: "var(--brand-red)",
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
                                backgroundColor: p === page ? "var(--brand-red)" : "var(--bg-tertiary)",
                                color: "var(--text-primary)",
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
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        width: "100%", boxSizing: "border-box",
                        maxWidth: "600px",
                        padding: "24px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
                                {editingGroup ? "Edit Grup" : "Tambah Grup"}
                            </h2>
                            <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                                <FiX size={20} />
                            </button>
                        </div>

                        {error && (
                            <div style={{ padding: "12px", backgroundColor: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)", color: "var(--color-error)", fontSize: "14px", marginBottom: "16px" }}>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>NAMA *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>DESKRIPSI</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ marginBottom: "16px", display: "flex", alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "var(--text-secondary)", fontSize: "14px" }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        style={{ accentColor: "var(--brand-red)", width: "18px", height: "18px" }}
                                    />
                                    Aktif
                                </label>
                            </div>

                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>APLIKASI DALAM GRUP</label>
                                <div style={{
                                    border: "1px solid var(--border-color)",
                                    backgroundColor: "var(--bg-card)",
                                    padding: "12px",
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                }}>
                                    {apps.length === 0 ? (
                                        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Tidak ada aplikasi tersedia</span>
                                    ) : (
                                        apps.map(app => (
                                            <label key={app.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#e5e5e5", fontSize: "14px" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.appIds.includes(app.id)}
                                                    onChange={() => handleAppToggle(app.id)}
                                                    style={{ accentColor: "var(--brand-red)" }}
                                                />
                                                <FiGrid size={14} color="#737373" />
                                                {app.name}
                                                {!app.isActive && (
                                                    <span style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>(nonaktif)</span>
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
                                    width: "100%", boxSizing: "border-box",
                                    padding: "12px",
                                    backgroundColor: "var(--brand-red)",
                                    color: "var(--text-primary)",
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
            <ConfirmDialog />
        </div>
    );
}
