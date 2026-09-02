"use client";

import { useState, useEffect, useCallback } from "react";
import { CaretLeft, CaretRight, GridFour, PencilSimple, Plus, Trash, Users } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import Table, { type TableColumn } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

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

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-7 w-48 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div className="h-10 w-32 animate-pulse rounded bg-surface-2" />
                </div>

                {/* Stats skeleton */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-card border border-border p-4 shadow-lvl-1">
                            <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-2" />
                            <div className="h-7 w-12 animate-pulse rounded bg-surface-2" />
                        </div>
                    ))}
                </div>

                {/* Ledger-shaped skeleton */}
                <div className="rounded-card border border-border shadow-lvl-1">
                    <div className="flex gap-4 border-b border-border px-4 py-3">
                        <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                                <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-6 w-16 animate-pulse rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const activeCount = groups.filter(g => g.isActive).length;
    const inactiveCount = groups.filter(g => !g.isActive).length;

    const columns: TableColumn[] = [
        { key: "name", header: "NAMA" },
        { key: "description", header: "DESKRIPSI" },
        { key: "apps", header: "APLIKASI" },
        { key: "members", header: "ANGGOTA" },
        { key: "status", header: "STATUS" },
        { key: "actions", header: "AKSI" },
    ];

    const rows = groups.map((group) => [
        <div key="name" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-border bg-surface-2">
                <Users size={14} className="text-text-2" />
            </div>
            <span className="text-sm font-semibold text-text-1">{group.name}</span>
        </div>,
        <span key="desc" className="max-w-48 truncate text-sm text-text-2">{group.description || "-"}</span>,
        <Badge key="apps" tone="info">{group._count.apps} app</Badge>,
        <Badge key="members" tone="neutral">{group._count.members} user</Badge>,
        <Badge key="status" tone={group.isActive ? "success" : "neutral"}>
            {group.isActive ? "AKTIF" : "NONAKTIF"}
        </Badge>,
        <div key="actions" className="inline-flex items-center gap-1">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openEditModal(group)}
                aria-label="Edit"
                title="Edit"
            >
                <PencilSimple size={14} />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(group)}
                aria-label="Hapus"
                title="Hapus"
                className="text-danger"
            >
                <Trash size={14} />
            </Button>
        </div>,
    ]);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Grup Portal</h1>
                </div>
                <Button type="button" iconLeft={<Plus size={14} aria-hidden="true" />} onClick={openAddModal}>
                    Tambah Grup
                </Button>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">TOTAL GRUP</p>
                    <p className="font-display text-2xl font-semibold text-text-1">{pagination?.total || groups.length}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">AKTIF</p>
                    <p className="font-display text-2xl font-semibold text-success">{activeCount}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">NONAKTIF</p>
                    <p className="font-display text-2xl font-semibold text-danger">{inactiveCount}</p>
                </Card>
            </div>

            {/* Table */}
            {groups.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-card border border-border p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-2">
                        <Users size={24} className="text-text-3" aria-hidden="true" />
                    </div>
                    <p className="text-text-3">Belum ada grup.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                    <Table
                        columns={columns}
                        rows={rows}
                        ariaLabel="Daftar grup portal"
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

            {/* Modal — shell (portal, focus trap, Escape, kunci scroll) dari kit */}
            <Modal
                open={showModal}
                onClose={closeModal}
                title={editingGroup ? "Edit Grup" : "Tambah Grup"}
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
                            />
                            <Input
                                label="DESKRIPSI"
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <label className="flex items-center gap-2 text-sm text-text-1">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="h-4 w-4 cursor-pointer accent-accent"
                                />
                                Aktif
                            </label>

                            {/* App assignment */}
                            <div>
                                <span className="mb-2 block text-sm font-semibold text-text-1">APLIKASI DALAM GRUP</span>
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
                                                <GridFour size={14} className="text-text-3" aria-hidden="true" />
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
            <ConfirmDialog />
        </div>
    );
}