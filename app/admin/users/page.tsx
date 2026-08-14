"use client";

import { useState, useEffect, useMemo } from "react";
import type { FormEvent, ReactNode } from "react";
import { Plus, PencilSimple, Trash, X, ShieldCheck, User as UserIcon, Lightning } from "@phosphor-icons/react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import Table, { type TableColumn } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

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
            setEditingUser(null);
            setFormData({ name: "", email: "", password: "", role: "EDITOR", siteIds: [] });
            fetchUsers();
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
            fetchUsers();
        } catch {
            showToast("An error occurred", "error");
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

            {/* Users ledger */}
            {users.length === 0 ? (
                <div className="rounded-card border border-border p-12 text-center shadow-lvl-1">
                    <p className="text-text-3">Belum ada pengguna.</p>
                </div>
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

            {/* Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label={editingUser ? "Edit User" : "Tambah User"}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowModal(false);
                    }}
                >
                    <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-sheet border border-border bg-surface-1 p-6 shadow-lvl-3">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="font-display text-lg font-semibold text-text-1">
                                {editingUser ? "Edit User" : "Tambah User"}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="cursor-pointer rounded-control p-1.5 text-text-2 hover:bg-surface-2 hover:text-text-1"
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

                            <Button type="submit" disabled={isSaving} className="w-full">
                                {isSaving ? "MENYIMPAN..." : "SIMPAN"}
                            </Button>
                        </form>
                    </div>
                </div>
            )}

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
