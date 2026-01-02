"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiAlertTriangle } from "react-icons/fi";
import { formatDateShort, formatNumber } from "@/lib/utils";
import BulkActionBar from "./BulkActionBar";

interface Announcement {
    id: string;
    title: string;
    slug: string;
    isPublished: boolean;
    isPinned: boolean;
    isHero: boolean;
    viewCount: number;
    createdAt: Date | string;
    category: {
        name: string;
        color: string;
    };
}

interface Category {
    id: string;
    name: string;
    slug: string;
    color: string;
}

interface AnnouncementsListProps {
    announcements: Announcement[];
    categories: Category[];
}

export default function AnnouncementsList({ announcements, categories }: AnnouncementsListProps) {
    const router = useRouter();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleDeleteClick = (announcement: Announcement) => {
        setSelectedAnnouncement(announcement);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedAnnouncement) return;

        setDeletingId(selectedAnnouncement.id);

        try {
            const response = await fetch(`/api/announcements/${selectedAnnouncement.id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                router.refresh();
            } else {
                alert("Gagal menghapus pengumuman");
            }
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Terjadi kesalahan");
        } finally {
            setDeletingId(null);
            setShowDeleteModal(false);
            setSelectedAnnouncement(null);
        }
    };

    // Bulk selection handlers
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === announcements.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(announcements.map((a) => a.id)));
        }
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    return (
        <>
            <div style={{ padding: '32px' }}>
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
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.2em',
                            marginBottom: '4px',
                        }}>
                            KELOLA
                        </p>
                        <h1 style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '24px',
                            fontWeight: 700,
                            color: '#fff',
                        }}>
                            Pengumuman
                        </h1>
                        <p style={{ color: '#737373', marginTop: '4px' }}>
                            Kelola semua pengumuman ({announcements.length} total)
                        </p>
                    </div>
                    <Link
                        href="/admin/announcements/new"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                        }}
                    >
                        <FiPlus size={16} />
                        BUAT BARU
                    </Link>
                </div>

                {/* Quick Filters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                    <span style={{
                        padding: '8px 16px',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                    }}>
                        SEMUA
                    </span>
                    {categories.map((cat) => (
                        <span
                            key={cat.id}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#1a1a1a',
                                color: '#737373',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {cat.name.toUpperCase()}
                        </span>
                    ))}
                </div>

                {/* Announcements Table */}
                <div style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #1a1a1a',
                    overflow: 'hidden',
                }}>
                    {announcements.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                                    {/* Checkbox header */}
                                    <th style={{
                                        width: '48px',
                                        padding: '16px',
                                        textAlign: 'center',
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === announcements.length && announcements.length > 0}
                                            onChange={toggleSelectAll}
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                cursor: 'pointer',
                                                accentColor: '#dc2626',
                                            }}
                                            aria-label="Pilih semua"
                                        />
                                    </th>
                                    <th style={{
                                        textAlign: 'left',
                                        padding: '16px',
                                        color: '#737373',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.1em',
                                    }}>JUDUL</th>
                                    <th style={{
                                        textAlign: 'left',
                                        padding: '16px',
                                        color: '#737373',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.1em',
                                    }}>KATEGORI</th>
                                    <th style={{
                                        textAlign: 'left',
                                        padding: '16px',
                                        color: '#737373',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.1em',
                                    }}>STATUS</th>
                                    <th style={{
                                        textAlign: 'left',
                                        padding: '16px',
                                        color: '#737373',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.1em',
                                    }}>VIEWS</th>
                                    <th style={{
                                        textAlign: 'left',
                                        padding: '16px',
                                        color: '#737373',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.1em',
                                    }}>TANGGAL</th>
                                    <th style={{
                                        textAlign: 'right',
                                        padding: '16px',
                                        color: '#737373',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.1em',
                                    }}>AKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {announcements.map((announcement) => (
                                    <tr
                                        key={announcement.id}
                                        style={{
                                            borderBottom: '1px solid #1a1a1a',
                                            backgroundColor: selectedIds.has(announcement.id) ? '#1a1a1a' : 'transparent',
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(announcement.id)}
                                                onChange={() => toggleSelection(announcement.id)}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    cursor: 'pointer',
                                                    accentColor: '#dc2626',
                                                }}
                                                aria-label={`Pilih ${announcement.title}`}
                                            />
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {announcement.isPinned && (
                                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>📌</span>
                                                )}
                                                {announcement.isHero && (
                                                    <span style={{ color: '#eab308', fontSize: '12px' }}>⭐</span>
                                                )}
                                                <span style={{
                                                    color: '#fff',
                                                    fontWeight: 500,
                                                    maxWidth: '300px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {announcement.title}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                backgroundColor: announcement.category.color + '20',
                                                color: announcement.category.color,
                                            }}>
                                                {announcement.category.name.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            {announcement.isPublished ? (
                                                <span style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: '#22c55e',
                                                    fontSize: '13px',
                                                }}>
                                                    <FiEye size={14} />
                                                    Published
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: '#eab308',
                                                    fontSize: '13px',
                                                }}>
                                                    <FiEyeOff size={14} />
                                                    Draft
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', color: '#737373', fontSize: '13px' }}>
                                            {formatNumber(announcement.viewCount)}
                                        </td>
                                        <td style={{ padding: '16px', color: '#525252', fontSize: '13px' }}>
                                            {formatDateShort(announcement.createdAt)}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                <Link
                                                    href={`/admin/announcements/${announcement.id}/edit`}
                                                    style={{
                                                        padding: '8px',
                                                        color: '#737373',
                                                    }}
                                                >
                                                    <FiEdit2 size={16} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteClick(announcement)}
                                                    disabled={deletingId === announcement.id}
                                                    style={{
                                                        padding: '8px',
                                                        color: '#737373',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        opacity: deletingId === announcement.id ? 0.5 : 1,
                                                    }}
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '64px' }}>
                            <p style={{ color: '#525252', marginBottom: '16px' }}>Belum ada pengumuman.</p>
                            <Link
                                href="/admin/announcements/new"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 24px',
                                    backgroundColor: '#dc2626',
                                    color: '#fff',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                }}
                            >
                                Buat Pengumuman Pertama
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Bulk Action Bar */}
            <BulkActionBar
                selectedCount={selectedIds.size}
                onClear={clearSelection}
                selectedIds={Array.from(selectedIds)}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedAnnouncement && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                }}>
                    <div style={{
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #1a1a1a',
                        padding: '24px',
                        maxWidth: '400px',
                        width: '100%',
                        margin: '0 16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <FiAlertTriangle size={20} color="#ef4444" />
                            </div>
                            <h3 style={{
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 700,
                                color: '#fff',
                            }}>
                                Hapus Pengumuman
                            </h3>
                        </div>
                        <p style={{ color: '#737373', marginBottom: '24px' }}>
                            Apakah Anda yakin ingin menghapus &ldquo;{selectedAnnouncement.title}&rdquo;?
                            Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    color: '#737373',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={deletingId !== null}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    opacity: deletingId !== null ? 0.5 : 1,
                                }}
                            >
                                {deletingId ? "Menghapus..." : "Hapus"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
