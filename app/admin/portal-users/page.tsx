"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import {
    CaretDown,
    CaretLeft,
    CaretRight,
    CaretRight as ChevronRight,
    Key,
    PencilSimple,
    Plus,
    ShieldCheck,
    ToggleLeft,
    ToggleRight,
    Trash,
    User,
    UserCircle,
    X,
} from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import Table, { type TableColumn } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";

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
    nik: string;
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
    nik: "",
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
    const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

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

    useEffect(() => {
        if (!showModal) return;
        const handleModalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                closeModal();
            }
        };
        document.addEventListener("keydown", handleModalKeyDown);
        return () => document.removeEventListener("keydown", handleModalKeyDown);
    }, [showModal]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingUser ? `/api/portal-users/${editingUser.id}` : "/api/portal-users";
            const method = editingUser ? "PUT" : "POST";

            const body: Record<string, unknown> = {
                nik: formData.nik,
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
        if (!(await confirm({ title: "Hapus Pengguna", message: `Hapus pengguna "${user.name}" (${user.nik})?`, variant: "danger" }))) return;

        try {
            const response = await fetch(`/api/portal-users/${user.id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal menghapus", "error");
                return;
            }
            fetchUsers();
            showToast("Pengguna berhasil dihapus", "success");
        } catch {
            showToast("Terjadi kesalahan", "error");
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
                showToast(data.error || "Gagal mengubah status", "error");
                return;
            }
            fetchUsers();
            showToast("Status berhasil diubah", "success");
        } catch {
            showToast("Terjadi kesalahan", "error");
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
                showToast(data.error || "Gagal reset password", "error");
                return;
            }
            setShowResetModal(false);
            setResetTarget(null);
            setNewPassword("");
            showToast("Password berhasil direset", "success");
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setIsResetting(false);
        }
    };

    const handleRevokeAccess = async (userId: string, appId: string) => {
        if (!(await confirm({ title: "Cabut Akses", message: "Cabut akses aplikasi ini?", variant: "danger" }))) return;

        try {
            const response = await fetch(`/api/portal-users/${userId}/access?appId=${appId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal mencabut akses", "error");
                return;
            }
            fetchUsers();
            showToast("Akses berhasil dicabut", "success");
        } catch {
            showToast("Terjadi kesalahan", "error");
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
            nik: user.nik,
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

    const handleSort = (key: string) => {
        setSort((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { key, dir: "asc" }
        );
    };

    const sortedUsers = useMemo(() => {
        const dir = sort.dir === "asc" ? 1 : -1;
        return [...users].sort((a, b) => {
            switch (sort.key) {
                case "name":
                    return a.name.localeCompare(b.name, "id") * dir;
                case "role":
                    return a.role.localeCompare(b.role) * dir;
                case "createdAt":
                    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
                default:
                    return 0;
            }
        });
    }, [users, sort]);

    const getRoleBadge = (role: string) => {
        if (role === "PORTAL_ADMIN") {
            return { tone: "danger" as const, icon: <ShieldCheck size={12} aria-hidden="true" /> };
        }
        return { tone: "neutral" as const, icon: <UserCircle size={12} aria-hidden="true" /> };
    };

    const columns: TableColumn[] = [
        { key: "name", header: "NAMA", sortKey: "name" },
        { key: "nik", header: "NIK HRIS" },
        { key: "role", header: "ROLE", sortKey: "role" },
        { key: "groups", header: "GRUP" },
        { key: "status", header: "STATUS" },
        { key: "createdAt", header: "DIBUAT", sortKey: "createdAt" },
        { key: "actions", header: "AKSI" },
    ];

    const rows = sortedUsers.map((user) => {
        const roleBadge = getRoleBadge(user.role);
        return [
            <div key="user" className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card border ${
                    user.role === "PORTAL_ADMIN" ? "border-info/30 bg-info-subtle" : "border-border bg-surface-2"
                }`}>
                    <User size={14} className={user.role === "PORTAL_ADMIN" ? "text-info" : "text-text-2"} />
                </div>
                <span className="text-sm font-semibold text-text-1">{user.name}</span>
            </div>,
            <span key="nik" className="font-mono text-xs tabular-nums text-text-2">{user.nik}</span>,
            <Badge key="role" tone={roleBadge.tone}>
                {roleBadge.icon}
                {user.role}
            </Badge>,
            <div key="groups" className="flex flex-wrap items-center gap-1">
                {user.groups && user.groups.length > 0 ? (
                    user.groups.map(g => (
                        <Badge key={g.id} tone="neutral">{g.group.name}</Badge>
                    ))
                ) : (
                    <span className="text-xs text-text-3">-</span>
                )}
            </div>,
            <Badge key="status" tone={user.isActive ? "success" : "neutral"}>
                {user.isActive ? "AKTIF" : "NONAKTIF"}
            </Badge>,
            <span key="createdAt" className="whitespace-nowrap font-mono text-xs tabular-nums text-text-2">
                {formatDate(user.createdAt)}
            </span>,
            <div key="actions" className="inline-flex items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                    aria-label="Lihat Akses"
                    title="Lihat Akses"
                >
                    {expandedUserId === user.id ? <CaretDown size={14} /> : <ChevronRight size={14} />}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(user)}
                    aria-label={user.isActive ? "Nonaktifkan" : "Aktifkan"}
                    title={user.isActive ? "Nonaktifkan" : "Aktifkan"}
                    className={user.isActive ? "text-success" : "text-danger"}
                >
                    {user.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openResetModal(user)}
                    aria-label="Reset Password"
                    title="Reset Password"
                    className="text-warning"
                >
                    <Key size={14} />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(user)}
                    aria-label="Edit"
                    title="Edit"
                >
                    <PencilSimple size={14} />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(user)}
                    aria-label="Hapus"
                    title="Hapus"
                    className="text-danger"
                >
                    <Trash size={14} />
                </Button>
            </div>,
        ];
    });

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-7 w-48 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div className="h-10 w-40 animate-pulse rounded bg-surface-2" />
                </div>

                {/* Stats skeleton */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-card border border-border p-4 shadow-lvl-1">
                            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                            <div className="h-7 w-12 animate-pulse rounded bg-surface-2" />
                        </div>
                    ))}
                </div>

                {/* Ledger-shaped skeleton */}
                <div className="rounded-card border border-border shadow-lvl-1">
                    <div className="flex gap-4 border-b border-border px-4 py-3">
                        <div className="h-3 w-28 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                                <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-6 w-24 animate-pulse rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const adminCount = users.filter(u => u.role === "PORTAL_ADMIN").length;
    const activeCount = users.filter(u => u.isActive).length;
    const inactiveCount = users.filter(u => !u.isActive).length;

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-0.5 text-xs font-semibold tracking-widest text-accent">PORTAL</p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Pengguna Portal</h1>
                </div>
                <Button type="button" iconLeft={<Plus size={14} aria-hidden="true" />} onClick={openAddModal}>
                    Tambah Pengguna
                </Button>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">TOTAL PENGGUNA</p>
                    <p className="font-mono text-2xl tabular-nums text-text-1">{pagination?.total || users.length}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">AKTIF</p>
                    <p className="font-mono text-2xl tabular-nums text-success">{activeCount}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">NONAKTIF</p>
                    <p className="font-mono text-2xl tabular-nums text-text-1">{inactiveCount}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">PORTAL ADMIN</p>
                    <p className="font-mono text-2xl tabular-nums text-text-1">{adminCount}</p>
                </Card>
            </div>

            {/* Table */}
            {users.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-card border border-border p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-2">
                        <User size={24} className="text-text-3" aria-hidden="true" />
                    </div>
                    <p className="text-text-3">Belum ada pengguna.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                    <Table
                        columns={columns}
                        rows={rows}
                        sort={sort}
                        onSort={handleSort}
                        ariaLabel="Daftar pengguna portal"
                    />
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-xs tabular-nums text-text-3">
                        {((pagination.page - 1) * pagination.limit) + 1}–
                        {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            aria-label="Halaman sebelumnya"
                        >
                            <CaretLeft size={14} aria-hidden="true" />
                        </Button>
                        <span className="font-mono text-xs tabular-nums text-text-2">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            aria-label="Halaman berikutnya"
                        >
                            <CaretRight size={14} aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Expanded access */}
            {expandedUserId && (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {sortedUsers.filter(u => u.id === expandedUserId).map((user) => (
                        <Fragment key={user.id}>
                            <Card className="p-4">
                                <p className="mb-3 text-xs font-semibold tracking-widest text-text-3">GRUP</p>
                                {user.groups && user.groups.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {user.groups.map(g => (
                                            <Badge key={g.id} tone="neutral">{g.group.name}</Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-3">Tidak ada grup</p>
                                )}
                            </Card>
                            <Card className="p-4">
                                <p className="mb-3 text-xs font-semibold tracking-wide text-text-3">AKSES LANGSUNG (OVERRIDE)</p>
                                {user.appAccess && user.appAccess.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {user.appAccess.map(access => (
                                            <div key={access.id} className="flex items-center gap-2 rounded-control border border-border bg-surface-2 px-3 py-2">
                                                <span className="text-sm text-text-1">{access.app.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRevokeAccess(user.id, access.appId)}
                                                    className="cursor-pointer rounded p-1 text-danger transition-colors hover:bg-surface-3"
                                                    aria-label={`Cabut akses ${access.app.name}`}
                                                    title="Cabut akses"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-3">Tidak ada akses langsung</p>
                                )}
                            </Card>
                        </Fragment>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeModal();
                    }}
                >
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sheet border border-border bg-surface-1 p-6 shadow-lvl-3">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="font-display text-xl font-semibold text-text-1">
                                {editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
                            </h2>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="cursor-pointer rounded-control p-1 text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1"
                                aria-label="Tutup"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-control border border-danger-subtle bg-danger-subtle px-3 py-2 text-sm text-danger">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="NAMA *"
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Nama lengkap"
                            />
                            <Input
                                label="NIK HRIS *"
                                type="text"
                                value={formData.nik}
                                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                                required
                            />
                            {!editingUser && (
                                <Input
                                    label="PASSWORD *"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                            )}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Select
                                    label="ROLE"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    options={[
                                        { value: "PORTAL_USER", label: "PORTAL_USER" },
                                        { value: "PORTAL_ADMIN", label: "PORTAL_ADMIN" },
                                    ]}
                                />
                                <label className="flex items-center gap-2 pt-6 text-sm text-text-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="h-4 w-4 cursor-pointer accent-accent"
                                    />
                                    Aktif
                                </label>
                            </div>

                            {/* Group assignment */}
                            <div>
                                <p className="mb-2 text-xs font-semibold text-text-2">GRUP</p>
                                <div className="max-h-40 space-y-2 overflow-y-auto rounded-control border border-border bg-surface-1 p-3">
                                    {groups.length === 0 ? (
                                        <span className="text-sm text-text-3">Tidak ada grup tersedia</span>
                                    ) : (
                                        groups.map(group => (
                                            <label key={group.id} className="flex cursor-pointer items-center gap-2 text-sm text-text-1">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.groupIds.includes(group.id)}
                                                    onChange={() => handleGroupToggle(group.id)}
                                                    className="h-4 w-4 cursor-pointer accent-accent"
                                                />
                                                {group.name}
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Direct app access (override) */}
                            <div>
                                <p className="mb-1 text-xs font-semibold text-text-2">AKSES LANGSUNG (OVERRIDE)</p>
                                <p className="mb-2 text-xs text-text-3">Akses app di luar grup. Jika app sudah ada di grup, tidak perlu ditambah di sini.</p>
                                <div className="max-h-40 space-y-2 overflow-y-auto rounded-control border border-border bg-surface-1 p-3">
                                    {apps.length === 0 ? (
                                        <span className="text-sm text-text-3">Tidak ada aplikasi tersedia</span>
                                    ) : (
                                        apps.map(app => (
                                            <label key={app.id} className="flex cursor-pointer items-center gap-2 text-sm text-text-1">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.appIds.includes(app.id)}
                                                    onChange={() => handleAppToggle(app.id)}
                                                    className="h-4 w-4 cursor-pointer accent-accent"
                                                />
                                                {app.name}
                                                {!app.isActive && (
                                                    <span className="text-xs text-text-3">(nonaktif)</span>
                                                )}
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <Button type="submit" disabled={isSaving} className="w-full">
                                {isSaving ? "MENYIMPAN..." : "SIMPAN"}
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && resetTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Reset Password"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) { setShowResetModal(false); setResetTarget(null); }
                    }}
                >
                    <div className="w-full max-w-md rounded-sheet border border-border bg-surface-1 p-6 shadow-lvl-3">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="font-display text-xl font-semibold text-text-1">Reset Password</h2>
                            <button
                                type="button"
                                onClick={() => { setShowResetModal(false); setResetTarget(null); }}
                                className="cursor-pointer rounded-control p-1 text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1"
                                aria-label="Tutup"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="mb-4 text-sm text-text-2">
                            Reset password untuk <strong className="text-text-1">{resetTarget.name}</strong> ({resetTarget.nik})
                        </p>

                        <div className="mb-6">
                            <Input
                                label="PASSWORD BARU"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Masukkan password baru"
                            />
                        </div>

                        <Button type="button" variant="primary" disabled={isResetting || !newPassword} className="w-full" onClick={handleResetPassword}>
                            {isResetting ? "MERESET..." : "RESET PASSWORD"}
                        </Button>
                    </div>
                </div>
            )}
            <ConfirmDialog />
        </div>
    );
}