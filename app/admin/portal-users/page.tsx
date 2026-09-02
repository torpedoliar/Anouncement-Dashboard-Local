"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import {
    ArrowsClockwise,
    CaretDown,
    CaretLeft,
    CaretRight,
    CaretRight as ChevronRight,
    Eye,
    EyeSlash,
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
import Modal from "@/components/ui/Modal";

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
    // HRIS fields (TASK-36 GET /api/portal-users mengembalikan field ini)
    email?: string | null;
    nikSantos?: string | null;
    eligible?: boolean | null;
    lastSyncAt?: string | null;
    // HRIS org data (Oscar TASK-39) — GET belum return; UI tampil '-' sampai backend live
    departemen?: string | null;
    jabatan?: string | null;
}

// Hasil POST /api/admin/hris/sync (Oscar TASK-29/36) — dipakai tombol Tarik dari HRIS
interface HrisSyncResult {
    totalProcessed: number;
    updated: number;
    unchanged: number;
    deactivated: number;
    errors: Array<{ nik: string; error: string }>;
    jobId?: string;
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
    const [isSyncing, setIsSyncing] = useState(false);
    // Hapus Semua (TASK-42) — modal konfirmasi 2-lapis: warning + password admin
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [deleteAllPassword, setDeleteAllPassword] = useState("");
    const [showDeleteAllPassword, setShowDeleteAllPassword] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [deleteAllError, setDeleteAllError] = useState("");
    const deleteAllPasswordRef = useRef<HTMLInputElement>(null);
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
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

    // Tarik dari HRIS — bulk sync (SuperAdmin only). POST /api/admin/hris/sync (Oscar TASK-29)
    const handleTarikHris = async () => {
        const ok = await confirm({
            title: "Tarik dari HRIS",
            message: "Menarik data karyawan dari HRIS akan membuat akun JIT untuk yang belum ada dan memperbarui yang sudah ada. Lanjutkan?",
        });
        if (!ok) return;

        setIsSyncing(true);
        try {
            const response = await fetch("/api/admin/hris/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full: true }),
            });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal menarik dari HRIS", "error");
                return;
            }
            const result: HrisSyncResult = await response.json();
            const errorCount = result.errors?.length ?? 0;
            showToast(
                `Tarik HRIS selesai: ${result.updated} diperbarui, ${result.deactivated} dinonaktifkan${errorCount > 0 ? `, ${errorCount} error` : ""}`,
                errorCount > 0 ? "warning" : "success"
            );
            fetchUsers();
        } catch {
            showToast("Terjadi kesalahan saat menarik dari HRIS", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    // Hapus Semua pengguna PORTAL_USER (TASK-42) — SuperAdmin only.
    // POST /api/admin/portal-users/delete-all { adminPassword } (Oscar TASK-41).
    // 401/403 = password salah -> inline error, modal tetap terbuka agar bisa dicoba lagi.
    const handleDeleteAll = async () => {
        setIsDeletingAll(true);
        setDeleteAllError("");
        try {
            const response = await fetch("/api/admin/portal-users/delete-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminPassword: deleteAllPassword }),
            });
            if (response.status === 401 || response.status === 403) {
                setDeleteAllError("Password admin salah");
                return;
            }
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                showToast(data?.error || "Gagal menghapus pengguna", "error");
                return;
            }
            const result: { deletedCount?: number } = await response.json().catch(() => ({}));
            showToast(`${result.deletedCount ?? 0} pengguna dihapus`, "success");
            closeDeleteAllModal();
            fetchUsers();
        } catch {
            showToast("Terjadi kesalahan jaringan saat menghapus pengguna", "error");
        } finally {
            setIsDeletingAll(false);
        }
    };

    const closeDeleteAllModal = () => {
        setShowDeleteAllModal(false);
        setDeleteAllPassword("");
        setShowDeleteAllPassword(false);
        setDeleteAllError("");
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

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
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
        { key: "email", header: "EMAIL" },
        { key: "eligible", header: "ELIGIBLE" },
        { key: "nikSantos", header: "NIK SANTOS" },
        { key: "departemen", header: "DEPARTEMEN" },
        { key: "jabatan", header: "JABATAN" },
        { key: "lastSyncAt", header: "LAST SYNC" },
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
                    user.role === "PORTAL_ADMIN" ? "border-danger/30 bg-danger-subtle" : "border-border bg-surface-2"
                }`}>
                    <User size={14} className={user.role === "PORTAL_ADMIN" ? "text-danger" : "text-text-2"} />
                </div>
                <span className="text-sm font-semibold text-text-1">{user.name}</span>
            </div>,
            <span key="nik" className="font-mono text-xs tabular-nums text-text-2">{user.nik}</span>,
            <span key="email" className="block max-w-[12rem] truncate text-xs text-text-2" title={user.email ?? ""}>
                {user.email || <span className="text-text-3">-</span>}
            </span>,
            user.eligible === null || user.eligible === undefined ? (
                <span key="eligible" className="text-xs text-text-3">-</span>
            ) : (
                <Badge key="eligible" tone={user.eligible ? "success" : "danger"}>
                    {user.eligible ? "ELIGIBLE" : "TIDAK ELIGIBLE"}
                </Badge>
            ),
            <span key="nikSantos" className="font-mono text-xs tabular-nums text-text-2">
                {user.nikSantos || <span className="text-text-3">-</span>}
            </span>,
            <span key="departemen" className="block max-w-[10rem] truncate text-xs text-text-2" title={user.departemen ?? ""}>
                {user.departemen || <span className="text-text-3">-</span>}
            </span>,
            <span key="jabatan" className="block max-w-[10rem] truncate text-xs text-text-2" title={user.jabatan ?? ""}>
                {user.jabatan || <span className="text-text-3">-</span>}
            </span>,
            <span key="lastSyncAt" className="whitespace-nowrap font-mono text-xs tabular-nums text-text-2">
                {user.lastSyncAt ? formatDateTime(user.lastSyncAt) : <span className="text-text-3">-</span>}
            </span>,
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
                    <h1 className="font-display text-2xl font-semibold text-text-1">Pengguna Portal</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isSuperAdmin && (
                        <Button
                            type="button"
                            variant="secondary"
                            iconLeft={<ArrowsClockwise size={14} aria-hidden="true" />}
                            onClick={handleTarikHris}
                            disabled={isSyncing || isDeletingAll}
                        >
                            {isSyncing ? "Menarik..." : "Tarik dari HRIS"}
                        </Button>
                    )}
                    {isSuperAdmin && (
                        <Button
                            type="button"
                            variant="danger"
                            iconLeft={<Trash size={14} aria-hidden="true" />}
                            onClick={() => setShowDeleteAllModal(true)}
                            disabled={isSyncing || isDeletingAll}
                        >
                            {isDeletingAll ? "Menghapus..." : "Hapus Semua"}
                        </Button>
                    )}
                    <Button type="button" iconLeft={<Plus size={14} aria-hidden="true" />} onClick={openAddModal}>
                        Tambah Pengguna
                    </Button>
                </div>
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

            {/* Create/Edit Modal — shell dari kit (portal, focus trap, Escape, kunci scroll) */}
            <Modal
                open={showModal}
                onClose={closeModal}
                title={editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
                size="md"
            >
                        {error && (
                            <div
                                className="mb-4 rounded-control border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                                role="alert"
                            >
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

                            {/* Aksi tetap di dalam <form> agar type="submit" bekerja. */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={closeModal}
                                    disabled={isSaving}
                                >
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? "Menyimpan..." : "Simpan"}
                                </Button>
                            </div>
                        </form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                open={showResetModal && !!resetTarget}
                onClose={() => { setShowResetModal(false); setResetTarget(null); }}
                title="Reset Password"
                description={
                    resetTarget
                        ? `Untuk ${resetTarget.name} (${resetTarget.nik})`
                        : undefined
                }
                size="sm"
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => { setShowResetModal(false); setResetTarget(null); }}
                            disabled={isResetting}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            disabled={isResetting || !newPassword}
                            onClick={handleResetPassword}
                        >
                            {isResetting ? "Mereset..." : "Reset Password"}
                        </Button>
                    </>
                }
            >
                <Input
                    label="Password baru"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    autoComplete="new-password"
                />
            </Modal>

            {/* Hapus Semua Modal (TASK-42) — konfirmasi 2-lapis: warning + password admin.
                Bukan useConfirm biasa karena butuh input. 401/403 tidak menutup modal
                (inline error, user bisa coba lagi). Focus awal ke input password. */}
            <Modal
                open={showDeleteAllModal}
                onClose={closeDeleteAllModal}
                title="Hapus Semua Pengguna?"
                description="Tindakan ini menghapus SEMUA portal user (bukan admin). Tidak bisa dibatalkan."
                size="sm"
                initialFocusRef={deleteAllPasswordRef}
                closeOnBackdrop={false}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={closeDeleteAllModal}
                            disabled={isDeletingAll}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            disabled={isDeletingAll || !deleteAllPassword}
                            onClick={handleDeleteAll}
                        >
                            {isDeletingAll ? "Menghapus..." : "Hapus Permanen"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {deleteAllError && (
                        <div
                            className="rounded-control border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                            role="alert"
                        >
                            {deleteAllError}
                        </div>
                    )}
                    <div className="relative">
                        <Input
                            ref={deleteAllPasswordRef}
                            label="Password admin"
                            type={showDeleteAllPassword ? "text" : "password"}
                            value={deleteAllPassword}
                            onChange={(e) => setDeleteAllPassword(e.target.value)}
                            placeholder="Masukkan password admin"
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowDeleteAllPassword((p) => !p)}
                            aria-label={showDeleteAllPassword ? "Sembunyikan password" : "Tampilkan password"}
                            className="absolute right-3 top-[38px] text-text-3 transition-colors hover:text-text-1"
                        >
                            {showDeleteAllPassword ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                        </button>
                    </div>
                </div>
            </Modal>
            <ConfirmDialog />
        </div>
    );
}