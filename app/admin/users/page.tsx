"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import { Plus, PencilSimple, Trash, ShieldCheck, User as UserIcon, Lightning } from "@phosphor-icons/react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import Table, { type TableColumn } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";

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

type RoleTone = "neutral" | "success" | "warning" | "danger" | "info";

function roleBadge(user: User): { label: string; tone: RoleTone; icon: ReactNode } {
    if (user.isSuperAdmin) {
        return { label: "SUPER ADMIN", tone: "danger", icon: <Lightning size={12} /> };
    }
    if (user.role === "ADMIN") {
        return { label: "ADMIN", tone: "danger", icon: <ShieldCheck size={12} /> };
    }
    return { label: "EDITOR", tone: "info", icon: <UserIcon size={12} /> };
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    // Pagination + pencarian server-side (GET /api/users?page=&limit=&q=)
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const { showToast } = useToast();
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
    const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });

    // Muat awal. fetchUsers sengaja tidak masuk deps: ia membaca page/searchQuery
    // lewat argumen default, dan perubahan keduanya sudah memicu fetch sendiri
    // (search via debounce-effect, pagination via handler klik).
    useEffect(() => {
        fetchUsers();
        fetchSites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchUsers = async (targetPage = page, q = "") => {
        try {
            const params = new URLSearchParams({ page: String(targetPage), limit: "20" });
            if (q) params.set("q", q);
            const response = await fetch(`/api/users?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    // Respons lama (array) — API belum berformat { data, pagination }.
                    setUsers(data);
                } else {
                    setUsers(data.data || []);
                    setTotalPages(data.pagination?.totalPages || 1);
                }
            }
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounce pencarian 300ms; reset ke halaman 1 saat query berubah.
    // Ref "firstRun" melewati eksekusi pertama: saat mount, fetchUsers() dari
    // effect muat-awal sudah mengambil halaman 1 — tanpa ini terjadi fetch dobel.
    const isFirstSearch = useRef(true);
    useEffect(() => {
        if (isFirstSearch.current) {
            isFirstSearch.current = false;
            return;
        }
        const t = setTimeout(() => {
            setPage(1);
            fetchUsers(1, searchQuery);
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

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
                case "role": {
                    const roleA = a.isSuperAdmin ? "SUPER_ADMIN" : a.role;
                    const roleB = b.isSuperAdmin ? "SUPER_ADMIN" : b.role;
                    return roleA.localeCompare(roleB) * dir;
                }
                case "createdAt":
                    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
                default:
                    return 0;
            }
        });
    }, [users, sort]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
            const method = editingUser ? "PUT" : "POST";

            const body: Record<string, unknown> = {
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
            showToast(
                editingUser ? "User berhasil diperbarui" : "User berhasil ditambahkan",
                "success"
            );
            setEditingUser(null);
            setFormData({ name: "", email: "", password: "", role: "EDITOR", siteIds: [] });
            fetchUsers(page, searchQuery);
        } catch {
            setError("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const executeDelete = async (user: User) => {
        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Failed to delete user", "error");
                return;
            }

            showToast("User berhasil dihapus", "success");
            fetchUsers(page, searchQuery);
        } catch {
            showToast("An error occurred", "error");
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setError("");
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
        setError("");
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

    const columns: TableColumn[] = [
        { key: "name", header: "Nama", sortKey: "name" },
        { key: "email", header: "Email" },
        { key: "role", header: "Role", sortKey: "role" },
        { key: "sites", header: "Situs (Akses)" },
        { key: "createdAt", header: "Dibuat", sortKey: "createdAt" },
        { key: "actions", header: "Aksi" },
    ];

    const rows = sortedUsers.map((user) => {
        const rb = roleBadge(user);
        return [
            <div key="name" className="flex items-center gap-2">
                <span className="font-medium text-text-1">{user.name}</span>
            </div>,
            <span key="email" className="break-all text-text-2">{user.email}</span>,
            <Badge key="role" tone={rb.tone}>
                {rb.icon}
                {rb.label}
            </Badge>,
            <div key="sites" className="flex flex-wrap items-center gap-1">
                {user.isSuperAdmin ? (
                    <span className="text-xs italic text-text-2">Semua Situs</span>
                ) : user.siteIds && user.siteIds.length > 0 ? (
                    user.siteIds.map(id => {
                        const siteName = sites.find(s => s.id === id)?.name || "Unknown";
                        return (
                            <span
                                key={id}
                                className="rounded-control border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-text-2"
                            >
                                {siteName}
                            </span>
                        );
                    })
                ) : (
                    <span className="text-xs text-danger">Tidak ada akses</span>
                )}
            </div>,
            <span key="createdAt" className="font-mono tabular-nums text-text-2">
                {formatDate(user.createdAt)}
            </span>,
            <div key="actions" className="inline-flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => openEditModal(user)}
                    className="cursor-pointer rounded-control p-1.5 text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1"
                    aria-label={`Edit ${user.name}`}
                >
                    <PencilSimple size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => setUserToDelete(user)}
                    className="cursor-pointer rounded-control p-1.5 text-text-2 transition-colors hover:bg-surface-2 hover:text-danger"
                    aria-label={`Hapus ${user.name}`}
                >
                    <Trash size={16} />
                </button>
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
                    <div className="h-10 w-36 animate-pulse rounded bg-surface-2" />
                </div>

                {/* Ledger-shaped skeleton */}
                <div className="rounded-card border border-border shadow-lvl-1">
                    <div className="flex gap-4 border-b border-border px-4 py-3.5">
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-36 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-36 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-6 w-16 animate-pulse rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-0.5 text-xs font-semibold tracking-wider text-accent">PENGGUNA</p>
                    <h1 className="font-display text-xl font-bold text-text-1">Manajemen User</h1>
                </div>
                <Button onClick={openAddModal} iconLeft={<Plus size={16} />}>
                    Tambah User
                </Button>
            </div>

            {/* Pencarian server-side */}
            <div className="relative mb-4 max-w-md">
                <input
                    type="search"
                    placeholder="Cari nama atau email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Cari pengguna"
                    className="h-10 w-full rounded-control border border-border bg-surface-1 px-3 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
            </div>

            {/* Users ledger */}
            {users.length === 0 ? (
                <EmptyState
                    icon={<UserIcon weight="duotone" />}
                    title={searchQuery ? "Tidak ada pengguna yang cocok" : "Belum ada pengguna"}
                    description={
                        searchQuery
                            ? `Tidak ditemukan pengguna untuk pencarian "${searchQuery}".`
                            : "Tambahkan pengguna pertama untuk memberi akses tim."
                    }
                />
            ) : (
                <div className="overflow-hidden rounded-card border border-border shadow-lvl-1">
                    <Table
                        columns={columns}
                        rows={rows}
                        sort={sort}
                        onSort={handleSort}
                        ariaLabel="Daftar pengguna"
                    />
                </div>
            )}

            {/* Pagination — server-side (20/halaman) */}
            {totalPages > 1 && (
                <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination pengguna">
                    <button
                        type="button"
                        onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchUsers(p, searchQuery); }}
                        disabled={page <= 1}
                        className="inline-flex h-9 cursor-pointer items-center rounded-control border border-border bg-surface-1 px-3 text-sm text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Halaman sebelumnya"
                    >
                        ‹
                    </button>
                    <span className="mono px-2 text-sm text-text-2" aria-current="page">
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchUsers(p, searchQuery); }}
                        disabled={page >= totalPages}
                        className="inline-flex h-9 cursor-pointer items-center rounded-control border border-border bg-surface-1 px-3 text-sm text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Halaman berikutnya"
                    >
                        ›
                    </button>
                </nav>
            )}

            {/* Modal — shell (portal, focus trap, Escape, kunci scroll) dari kit */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
                size="sm"
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
                                label="NAMA"
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Nama lengkap"
                            />
                            <Input
                                label="EMAIL"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="email@contoh.com"
                            />
                            <Input
                                label={editingUser ? "PASSWORD (kosongkan jika tidak ingin mengubah)" : "PASSWORD"}
                                type="password"
                                required={!editingUser}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="••••••••"
                            />
                            <Select
                                label="ROLE"
                                value={formData.role}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        role: e.target.value as "ADMIN" | "EDITOR" | "SUPER_ADMIN",
                                    })
                                }
                                options={[
                                    { value: "EDITOR", label: "EDITOR" },
                                    { value: "ADMIN", label: "ADMIN" },
                                    { value: "SUPER_ADMIN", label: "SUPER ADMIN" },
                                ]}
                            />

                            {formData.role !== "SUPER_ADMIN" && (
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-text-1">
                                        AKSES SITUS (Hanya beri centang untuk diizinkan)
                                    </label>
                                    <div className="max-h-40 overflow-y-auto rounded-control border border-border bg-surface-1 p-3">
                                        {sites.length === 0 ? (
                                            <span className="text-xs text-text-3">Tidak ada situs tersedia</span>
                                        ) : (
                                            <div className="space-y-2">
                                                {sites.map(site => (
                                                    <label
                                                        key={site.id}
                                                        className="flex cursor-pointer items-center gap-2 text-sm text-text-1"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.siteIds.includes(site.id)}
                                                            onChange={() => handleSiteToggle(site.id)}
                                                            className="h-4 w-4 cursor-pointer accent-accent"
                                                        />
                                                        {site.name}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Aksi ikut di dalam <form> supaya type="submit" tetap
                                memicu submit; itu sebabnya baris ini tidak memakai
                                prop `footer` milik Modal. */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowModal(false)}
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

            <ConfirmDialog
                open={!!userToDelete}
                title="Hapus Pengguna"
                message={`Yakin ingin menghapus ${userToDelete?.name}?`}
                confirmLabel="Hapus"
                cancelLabel="Batal"
                variant="danger"
                onConfirm={() => {
                    if (userToDelete) executeDelete(userToDelete);
                    setUserToDelete(null);
                }}
                onCancel={() => setUserToDelete(null)}
            />
        </div>
    );
}
