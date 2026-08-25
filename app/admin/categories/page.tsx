"use client";

import { useState, useEffect } from "react";
import {
    PencilSimple,
    Trash,
    Check,
    X,
    Folder,
    MagnifyingGlass,
} from "@phosphor-icons/react";
import { useConfirm } from "@/hooks/useConfirm";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

interface Category {
    id: string;
    name: string;
    slug: string;
    color: string;
    order: number;
    _count?: { announcements: number };
    site?: {
        id: string;
        name: string;
        slug: string;
    };
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();

    // Form states
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#dc2626");
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch("/api/categories");
            if (response.ok) {
                const data = await response.json();
                setCategories(data);
            }
        } catch (error) {
            console.error("Failed to fetch categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newName.trim()) {
            setError("Nama kategori harus diisi");
            return;
        }

        try {
            const response = await fetch("/api/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, color: newColor }),
            });

            if (response.ok) {
                setNewName("");
                setNewColor("#dc2626");
                setShowAddForm(false);
                setError("");
                fetchCategories();
            } else {
                const data = await response.json();
                setError(data.error || "Gagal menambah kategori");
            }
        } catch {
            setError("Terjadi kesalahan");
        }
    };

    const handleEdit = async (id: string) => {
        if (!editName.trim()) {
            setError("Nama kategori harus diisi");
            return;
        }

        try {
            const response = await fetch(`/api/categories/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName, color: editColor }),
            });

            if (response.ok) {
                setEditingId(null);
                setError("");
                fetchCategories();
            } else {
                const data = await response.json();
                setError(data.error || "Gagal mengupdate kategori");
            }
        } catch {
            setError("Terjadi kesalahan");
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const response = await fetch(`/api/categories/${id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                fetchCategories();
            } else {
                const data = await response.json();
                setError(data.error || "Gagal menghapus kategori");
            }
        } catch {
            setError("Terjadi kesalahan");
        } finally {
            setDeletingId(null);
        }
    };

    const startEdit = (category: Category) => {
        setEditingId(category.id);
        setEditName(category.name);
        setEditColor(category.color);
        setError("");
    };

    // Group categories by site
    const groupedCategories = categories.reduce((acc, category) => {
        const siteId = category.site?.id || "unknown";
        if (!acc[siteId]) {
            acc[siteId] = {
                siteName: category.site?.name || "Global / Unknown Site",
                categories: [],
            };
        }
        acc[siteId].categories.push(category);
        return acc;
    }, {} as Record<string, { siteName: string; categories: Category[] }>);

    // Filter categories by search query (client-side)
    const matchesSearch = (name: string, slug: string) => {
        const q = searchQuery.toLowerCase();
        return !q || name.toLowerCase().includes(q) || slug.toLowerCase().includes(q);
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
                <div>
                    <p className="text-accent text-xs font-semibold tracking-widest mb-1">
                        KATEGORI
                    </p>
                    <h1 className="text-2xl font-bold text-text-1">
                        Manajemen Kategori
                    </h1>
                    <p className="text-text-3 mt-1">
                        Kelola kategori pengumuman ({categories.length} kategori)
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="md"
                    iconLeft={<PencilSimple size={16} weight="bold" />}
                    onClick={() => {
                        setShowAddForm(true);
                        setError("");
                    }}
                >
                    Tambah Kategori
                </Button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                    <MagnifyingGlass size={16} className="text-text-3" />
                </div>
                <input
                    type="text"
                    placeholder="Cari nama atau slug kategori..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Cari kategori"
                    className="h-10 w-full rounded-control border border-border bg-surface-1 pl-10 pr-3 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
            </div>

            {/* Error Message */}
            {error && (
                <div
                    className="mb-6 flex items-center justify-between gap-3 rounded-control border border-danger bg-danger-subtle px-4 py-3 text-danger"
                    role="alert"
                >
                    <span className="text-sm">{error}</span>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Tutup pesan error"
                        className="shrink-0"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div className="mb-8 rounded-card border border-border bg-surface-1 p-5">
                    <h3 className="mb-4 text-sm font-semibold text-text-1">
                        Tambah Kategori Baru
                    </h3>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="mb-2 block text-sm font-medium text-text-2">
                                Nama Kategori
                            </label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Contoh: Promo"
                                aria-label="Nama kategori baru"
                                className="h-10 w-full rounded-control border border-border bg-surface-1 px-3 text-sm text-text-1 placeholder:text-text-3"
                            />
                        </div>
                        <div className="w-28">
                            <label className="mb-2 block text-sm font-medium text-text-2">
                                Warna
                            </label>
                            <input
                                type="color"
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                aria-label="Warna kategori baru"
                                className="h-10 w-full rounded-control border border-border cursor-pointer bg-surface-2"
                            />
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            iconLeft={<Check size={16} weight="bold" />}
                            onClick={handleAdd}
                        >
                            Simpan
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<X size={16} />}
                            onClick={() => {
                                setShowAddForm(false);
                                setNewName("");
                                setNewColor("#dc2626");
                                setError("");
                            }}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
            )}

            {/* Categories List grouped by Site */}
            {isLoading ? (
                <div className="space-y-4" aria-hidden="true">
                    {[0, 1].map((g) => (
                        <div key={g} className="overflow-hidden rounded-card border border-border bg-surface-1">
                            <div className="border-b border-border bg-surface-2 px-5 py-3">
                                <div className="h-3.5 w-40 rounded bg-surface-3 animate-pulse" />
                            </div>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
                                    <div className="h-7 w-7 rounded animate-pulse bg-surface-2" />
                                    <div className="h-3.5 w-36 rounded bg-surface-2 animate-pulse" />
                                    <div className="h-3.5 flex-1 max-w-24 rounded bg-surface-2 animate-pulse" />
                                    <div className="ml-auto h-6 w-16 rounded-full bg-surface-2 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ) : categories.length === 0 ? (
                <EmptyState
                    icon={<Folder weight="duotone" />}
                    title="Belum ada kategori"
                    description="Kategori mengelompokkan pengumuman per site dan memunculkan di navigasi."
                    action={
                        <Button
                            variant="primary"
                            size="sm"
                            iconLeft={<PencilSimple size={14} weight="bold" />}
                            onClick={() => {
                                setShowAddForm(true);
                                setError("");
                            }}
                        >
                            Tambah Kategori
                        </Button>
                    }
                />
            ) : (
                Object.entries(groupedCategories)
                    .filter(([siteId]) => {
                        const group = groupedCategories[siteId];
                        return group.categories.some(
                            (c) =>
                                matchesSearch(c.name, c.slug) ||
                                group.siteName.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    })
                    .map(([siteId, group]) => (
                        <div key={siteId} className="mb-6 overflow-hidden rounded-card border border-border bg-surface-1">
                            {/* Site header */}
                            <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-5 py-3">
                                <Folder size={18} className="text-text-2" weight="duotone" />
                                <h2 className="text-sm font-bold tracking-wide text-text-1">
                                    {group.siteName}
                                </h2>
                                <Badge tone="neutral">{group.categories.length}</Badge>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm" aria-label={`Kategori situs ${group.siteName}`}>
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="w-[80px] px-4 py-3 text-left text-xs font-medium text-text-3">
                                                Warna
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-text-3">
                                                Nama
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-text-3">
                                                Slug
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-text-3">
                                                Pengumuman
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-text-3">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.categories
                                            .filter((c) => matchesSearch(c.name, c.slug))
                                            .map((category) => (
                                                <tr
                                                    key={category.id}
                                                    className="border-b border-border last:border-0 hover:bg-surface-2/60"
                                                >
                                                    {editingId === category.id ? (
                                                        <>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="color"
                                                                    value={editColor}
                                                                    onChange={(e) => setEditColor(e.target.value)}
                                                                    aria-label="Warna kategori"
                                                                    className="h-8 w-10 rounded border border-border cursor-pointer bg-surface-2"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="text"
                                                                    value={editName}
                                                                    onChange={(e) => setEditName(e.target.value)}
                                                                    aria-label="Nama kategori"
                                                                    className="h-9 w-full rounded-control border border-border bg-surface-1 px-3 text-sm text-text-1"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-text-3">
                                                                {category.slug}
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-text-2">
                                                                {category._count?.announcements || 0}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        variant="primary"
                                                                        size="sm"
                                                                        iconLeft={<Check size={14} weight="bold" />}
                                                                        onClick={() => handleEdit(category.id)}
                                                                        aria-label="Simpan perubahan"
                                                                    >
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        iconLeft={<X size={14} />}
                                                                        onClick={() => {
                                                                            setEditingId(null);
                                                                            setError("");
                                                                        }}
                                                                        aria-label="Batal edit"
                                                                    >
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-4 py-3">
                                                                <div
                                                                    style={{
                                                                        width: 28,
                                                                        height: 28,
                                                                        backgroundColor: category.color,
                                                                        borderRadius: 6,
                                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                                    }}
                                                                    aria-label={`Warna: ${category.name}`}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-text-1">
                                                                {category.name}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-text-3">
                                                                {category.slug}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-text-2">
                                                                    {category._count?.announcements || 0}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        iconLeft={<PencilSimple size={14} />}
                                                                        onClick={() => startEdit(category)}
                                                                        aria-label={`Edit ${category.name}`}
                                                                    >
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        iconLeft={<Trash size={14} />}
                                                                        onClick={async () => {
                                                                            if (
                                                                                await confirm({
                                                                                    title: "Hapus Kategori",
                                                                                    message: `Hapus kategori "${category.name}"?`,
                                                                                    variant: "danger",
                                                                                })
                                                                            ) {
                                                                                handleDelete(category.id);
                                                                            }
                                                                        }}
                                                                        disabled={deletingId === category.id}
                                                                        aria-label={`Hapus ${category.name}`}
                                                                    >
                                                                        {deletingId === category.id ? "Menghapus…" : null}
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
            )}
            <ConfirmDialog />
        </div>
    );
}
