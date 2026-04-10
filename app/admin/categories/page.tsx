"use client";

import { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiFolder } from "react-icons/fi";

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
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState("");

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

    const cardStyle = {
        backgroundColor: '#0a0a0a',
        border: '2px solid #333',
        borderRadius: '8px',
        padding: '16px',
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #262626',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
    };

    const buttonPrimaryStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        backgroundColor: '#dc2626',
        color: '#fff',
        border: 'none',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '14px',
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

    return (
        <div style={{ padding: '32px', backgroundColor: '#000', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '32px',
            }}>
                <div>
                    <p style={{
                        color: '#dc2626',
                        fontSize: '12px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        marginBottom: '8px',
                    }}>
                        KATEGORI
                    </p>
                    <h1 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '28px',
                        fontWeight: 700,
                        color: '#fff',
                    }}>
                        Manajemen Kategori
                    </h1>
                    <p style={{ color: '#737373', marginTop: '4px' }}>
                        Kelola kategori pengumuman ({categories.length} kategori)
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowAddForm(true);
                        setError("");
                    }}
                    style={{ ...buttonPrimaryStyle, borderRadius: '6px' }}
                >
                    <FiPlus size={18} />
                    Tambah Kategori
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid #dc2626',
                    color: '#dc2626',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: '6px',
                }}>
                    {error}
                    <button
                        onClick={() => setError("")}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                    >
                        <FiX size={16} />
                    </button>
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div style={{ ...cardStyle, marginBottom: '32px' }}>
                    <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                        Tambah Kategori Baru
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: '#a3a3a3', fontSize: '13px', marginBottom: '8px' }}>
                                Nama Kategori
                            </label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Contoh: Promo"
                                style={{ ...inputStyle, borderRadius: '6px' }}
                            />
                        </div>
                        <div style={{ width: '120px' }}>
                            <label style={{ display: 'block', color: '#a3a3a3', fontSize: '13px', marginBottom: '8px' }}>
                                Warna
                            </label>
                            <input
                                type="color"
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '42px',
                                    backgroundColor: '#0a0a0a',
                                    border: '1px solid #262626',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                }}
                            />
                        </div>
                        <button
                            onClick={handleAdd}
                            style={{ ...buttonPrimaryStyle, padding: '10px 16px', borderRadius: '6px' }}
                        >
                            <FiCheck size={18} />
                        </button>
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setNewName("");
                                setNewColor("#dc2626");
                                setError("");
                            }}
                            style={{
                                padding: '10px 16px',
                                backgroundColor: '#262626',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '6px',
                            }}
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List grouped by Site */}
            {isLoading ? (
                <div style={cardStyle}>
                    <p style={{ color: '#737373', textAlign: 'center', padding: '32px' }}>Memuat...</p>
                </div>
            ) : categories.length === 0 ? (
                <div style={cardStyle}>
                    <p style={{ color: '#737373', textAlign: 'center', padding: '32px' }}>Belum ada kategori</p>
                </div>
            ) : (
                Object.entries(groupedCategories).map(([siteId, group]) => (
                    <div key={siteId} style={{ ...cardStyle, marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
                        <div style={{
                            backgroundColor: '#111',
                            padding: '16px 20px',
                            borderBottom: '2px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <FiFolder color="#a1a1aa" size={18} />
                            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
                                SITUS: {group.siteName.toUpperCase()}
                            </h2>
                            <span style={{ backgroundColor: '#262626', color: '#a1a1aa', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                                {group.categories.length}
                            </span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #262626', backgroundColor: '#0a0a0a' }}>
                                    <th style={{ textAlign: 'left', padding: '12px 20px', color: '#737373', fontSize: '13px', fontWeight: 600, width: '80px' }}>
                                        Warna
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 20px', color: '#737373', fontSize: '13px', fontWeight: 600 }}>
                                        Nama
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 20px', color: '#737373', fontSize: '13px', fontWeight: 600 }}>
                                        Slug
                                    </th>
                                    <th style={{ textAlign: 'center', padding: '12px 20px', color: '#737373', fontSize: '13px', fontWeight: 600 }}>
                                        Pengumuman
                                    </th>
                                    <th style={{ textAlign: 'right', padding: '12px 20px', color: '#737373', fontSize: '13px', fontWeight: 600 }}>
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.categories.map((category, index) => (
                                    <tr
                                        key={category.id}
                                        style={{
                                            borderBottom: index < group.categories.length - 1 ? '1px solid #1a1a1a' : 'none',
                                            backgroundColor: '#0a0a0a',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        {editingId === category.id ? (
                                            <>
                                                <td style={{ padding: '12px 20px' }}>
                                                    <input
                                                        type="color"
                                                        value={editColor}
                                                        onChange={(e) => setEditColor(e.target.value)}
                                                        style={{
                                                            width: '40px',
                                                            height: '32px',
                                                            backgroundColor: '#0a0a0a',
                                                            border: '1px solid #262626',
                                                            cursor: 'pointer',
                                                            borderRadius: '4px',
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px 20px' }}>
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        style={{ ...inputStyle, padding: '8px 12px', borderRadius: '4px' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px 20px', color: '#525252' }}>
                                                    {category.slug}
                                                </td>
                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#a3a3a3' }}>
                                                    {category._count?.announcements || 0}
                                                </td>
                                                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleEdit(category.id)}
                                                            style={{
                                                                padding: '8px',
                                                                backgroundColor: '#16a34a',
                                                                color: '#fff',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                borderRadius: '4px',
                                                            }}
                                                        >
                                                            <FiCheck size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(null);
                                                                setError("");
                                                            }}
                                                            style={{
                                                                padding: '8px',
                                                                backgroundColor: '#262626',
                                                                color: '#fff',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                borderRadius: '4px',
                                                            }}
                                                        >
                                                            <FiX size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ padding: '12px 20px' }}>
                                                    <div
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            backgroundColor: category.color,
                                                            borderRadius: '6px',
                                                            border: '1px solid rgba(255,255,255,0.1)'
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px 20px', color: '#fff', fontWeight: 500 }}>
                                                    {category.name}
                                                </td>
                                                <td style={{ padding: '12px 20px', color: '#525252', fontFamily: 'monospace', fontSize: '13px' }}>
                                                    {category.slug}
                                                </td>
                                                <td style={{ padding: '12px 20px', textAlign: 'center', color: '#a3a3a3' }}>
                                                    <span style={{ backgroundColor: '#1a1a1a', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                                                        {category._count?.announcements || 0}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        <button
                                                            onClick={() => startEdit(category)}
                                                            style={{
                                                                padding: '8px',
                                                                backgroundColor: 'transparent',
                                                                color: '#a3a3a3',
                                                                border: '1px solid #262626',
                                                                cursor: 'pointer',
                                                                borderRadius: '4px',
                                                            }}
                                                        >
                                                            <FiEdit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Hapus kategori "${category.name}"?`)) {
                                                                    handleDelete(category.id);
                                                                }
                                                            }}
                                                            disabled={deletingId === category.id}
                                                            style={{
                                                                padding: '8px',
                                                                backgroundColor: 'transparent',
                                                                color: '#dc2626',
                                                                border: '1px solid #262626',
                                                                cursor: 'pointer',
                                                                opacity: deletingId === category.id ? 0.5 : 1,
                                                                borderRadius: '4px',
                                                            }}
                                                        >
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))
            )}
        </div>
    );
}
