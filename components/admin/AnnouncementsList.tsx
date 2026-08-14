"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, PencilSimple, Trash, X, MagnifyingGlass, Eraser } from "@phosphor-icons/react";
import { formatDateShort, formatNumber } from "@/lib/utils";
import BulkActionBar from "./BulkActionBar";
import { useToast } from "@/contexts/ToastContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusPill from "@/components/ui/StatusPill";
import { deriveAnnouncementStatus } from "@/lib/announcement-status";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";

interface Announcement {
    id: string;
    title: string;
    slug: string;
    isPublished: boolean;
    isPinned: boolean;
    isHero: boolean;
    viewCount: number;
    wordCount: number;
    scheduledAt?: Date | string | null;
    takedownAt?: Date | string | null;
    updatedAt: Date | string;
    createdAt: Date | string;
    category: {
        name: string;
        color: string;
    };
    author?: { name?: string } | null;
    sites?: Array<{
        site: { id: string; name: string; slug: string };
        isPrimary: boolean;
    }>;
    primarySite?: { name: string; slug: string } | null;
}

interface Category {
    id: string;
    name: string;
    slug: string;
    color: string;
}

type FilterStatus = "semua" | "draf" | "terjadwal" | "terbit" | "diturunkan";

interface AnnouncementsListProps {
    announcements: Announcement[];
    categories: Category[];
}

export default function AnnouncementsList({ announcements, categories }: AnnouncementsListProps) {
    const router = useRouter();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
    const { showToast } = useToast();

    // Filter state
    const [keyword, setKeyword] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("semua");
    const [showFilters, setShowFilters] = useState(false);

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
                showToast("Pengumuman berhasil dihapus", "success");
                router.refresh();
            } else {
                showToast("Gagal menghapus pengumuman", "error");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setDeletingId(null);
            setShowDeleteModal(false);
            setSelectedAnnouncement(null);
        }
    };

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
        setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id)));
    };

    const clearSelection = () => setSelectedIds(new Set());

    // Derive status for a row
    const statusFor = (a: Announcement) => deriveAnnouncementStatus(a);

    // Filtered data (client-side)
    const filtered = useMemo(() => {
        return announcements.filter((a) => {
            if (filterCategory !== "all" && a.category.name !== filterCategory) return false;
            if (keyword) {
                const q = keyword.toLowerCase();
                if (!a.title.toLowerCase().includes(q) && !a.slug.toLowerCase().includes(q)) return false;
            }
            if (filterStatus !== "semua") {
                const derived = statusFor(a);
                const map: Record<string, string> = {
                    draf: "draft",
                    terjadwal: "scheduled",
                    terbit: "published",
                    diturunkan: "taken-down",
                };
                if (derived !== map[filterStatus]) return false;
            }
            return true;
        });
    }, [announcements, filterCategory, keyword, filterStatus]);

    // Prune selectedIds when filtered set shrinks (filter change hides selected rows)
    useEffect(() => {
        setSelectedIds((prev) => {
            const filteredIds = new Set(filtered.map((a) => a.id));
            const next = new Set<string>();
            prev.forEach((id) => { if (filteredIds.has(id)) next.add(id); });
            return next;
        });
    }, [filtered]);

    const resetFilters = () => {
        setKeyword("");
        setFilterCategory("all");
        setFilterStatus("semua");
    };

    const statusOptions: { value: FilterStatus; label: string }[] = [
        { value: "semua", label: "Semua" },
        { value: "draf", label: "Draf" },
        { value: "terbit", label: "Terbit" },
        { value: "terjadwal", label: "Terjadwal" },
        { value: "diturunkan", label: "Diturunkan" },
    ];

    // Category filter chips from the props (covers zero-announcement categories too)
    const dataCategories = useMemo(() => {
        const seen = new Set<string>();
        return categories.filter((c) => {
            if (seen.has(c.name)) return false;
            seen.add(c.name);
            return true;
        });
    }, [categories]);

    const hasFilters = keyword || filterCategory !== "all" || filterStatus !== "semua";

    return (
        <>
            <div className="p-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <p className="text-xs font-semibold tracking-wider text-accent mb-0.5">KELOLA</p>
                        <h1 className="text-xl font-bold text-text-1">Pengumuman</h1>
                        <p className="text-sm text-text-2 mt-0.5">
                            {filtered.length} dari {announcements.length} pengumuman
                        </p>
                    </div>
                    <Link
                        href="/admin/announcements/new"
                        className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium bg-accent text-white rounded-control hover:opacity-90 transition-colors"
                    >
                        <CheckCircle weight="fill" size={16} />
                        BUAT BARU
                    </Link>
                </div>

                {/* Filters */}
                <div className="mb-4">
                    {/* Search + toggle */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className="relative flex-1 max-w-sm">
                            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2" size={16} weight="regular" />
                            <input
                                type="text"
                                placeholder="Cari judul atau slug…"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="w-full h-9 pl-9 pr-3 text-sm bg-surface-1 border border-border rounded-control text-text-1 placeholder:text-text-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                aria-label="Cari pengumuman"
                            />
                            {keyword && (
                                <button
                                    onClick={() => setKeyword("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-3 hover:text-text-1"
                                    aria-label="Hapus pencarian"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-1.5 h-9 px-3 text-sm rounded-control border transition-colors ${
                                showFilters
                                    ? "bg-surface-2 text-text-1 border-border"
                                    : "text-text-2 border-border hover:bg-surface-2"
                            }`}
                            aria-label="Tampilkan filter"
                        >
                            Filter
                        </button>
                    </div>

                    {/* Filter row */}
                    {showFilters && (
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Category chips */}
                            <button
                                onClick={() => setFilterCategory("all")}
                                className={`h-7 px-2.5 text-xs font-medium rounded-control transition-colors ${
                                    filterCategory === "all"
                                        ? "bg-accent text-white"
                                        : "bg-surface-1 text-text-2 border border-border hover:bg-surface-2"
                                }`}
                            >
                                Semua
                            </button>
                            {dataCategories.map((cat) => (
                                <button
                                    key={cat.name}
                                    onClick={() => setFilterCategory(cat.name)}
                                    className={`h-7 px-2.5 text-xs font-medium rounded-control transition-colors ${
                                        filterCategory === cat.name
                                            ? "bg-accent text-white"
                                            : "bg-surface-1 text-text-2 border border-border hover:bg-surface-2"
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}

                            <span className="w-px h-5 bg-border mx-1" />

                            {/* Status filter */}
                            {statusOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilterStatus(opt.value)}
                                    className={`h-7 px-2.5 text-xs font-medium rounded-control transition-colors ${
                                        filterStatus === opt.value
                                            ? "bg-accent text-white"
                                            : "bg-surface-1 text-text-2 border border-border hover:bg-surface-2"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}

                            {hasFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-text-2 hover:text-text-1 transition-colors"
                                    aria-label="Reset filter"
                                >
                                    <Eraser size={12} />
                                    Reset
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Ledger */}
                {filtered.length > 0 ? (
                    <div className="rounded-card border border-border shadow-1 overflow-hidden">
                        <Table
                            columns={[
                                { key: "sel", header: (
                                    <input
                                        type="checkbox"
                                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 accent-accent cursor-pointer"
                                        aria-label="Pilih semua"
                                    />
                                )},
                                { key: "title", header: "Judul" },
                                { key: "category", header: "Kategori" },
                                { key: "status", header: "Status" },
                                { key: "site", header: "Situs" },
                                { key: "author", header: "Penulis" },
                                { key: "words", header: "Kata" },
                                { key: "updated", header: "Terakhir ubah" },
                                { key: "actions", header: "Aksi" },
                            ]}
                            rows={filtered.map((a) => {
                                const st = statusFor(a);
                                return [
                                    // checkbox
                                    <input
                                        type="checkbox"
                                        key="cb"
                                        checked={selectedIds.has(a.id)}
                                        onChange={() => toggleSelection(a.id)}
                                        className="w-4 h-4 accent-accent cursor-pointer"
                                        aria-label={`Pilih ${a.title}`}
                                    />,
                                    // title
                                    <div key="title" className="flex items-center gap-1.5 min-w-0">
                                        {a.isPinned && <span title="Disematkan" aria-label="Disematkan">📌</span>}
                                        {a.isHero && <span title="Hero" aria-label="Hero">⭐</span>}
                                        <span className="font-medium truncate max-w-xs text-text-1">{a.title}</span>
                                    </div>,
                                    // category (DB-driven color inline — allowed)
                                    <Badge key="cat" style={{ backgroundColor: a.category.color + "20", color: a.category.color }}>
                                        {a.category.name.toUpperCase()}
                                    </Badge>,
                                    // status via StatusPill
                                    <StatusPill key="status" status={st} />,
                                    // primary site
                                    <span key="site" className="text-text-1">
                                        {a.primarySite?.name ?? "—"}
                                    </span>,
                                    // author
                                    <span key="author" className="text-text-1">
                                        {a.author?.name ?? "—"}
                                    </span>,
                                    // word count (mono)
                                    <span key="words" className="font-mono tabular-nums text-text-2">
                                        {formatNumber(a.wordCount)}
                                    </span>,
                                    // updated time (mono)
                                    <span key="updated" className="font-mono tabular-nums text-text-2">
                                        {formatDateShort(a.updatedAt)}
                                    </span>,
                                    // actions
                                    <div key="actions" className="inline-flex items-center gap-1">
                                        <Link
                                            href={`/admin/announcements/${a.id}/edit`}
                                            className="p-1.5 text-text-2 hover:text-text-1 transition-colors rounded-control hover:bg-surface-2"
                                            aria-label={`Edit ${a.title}`}
                                        >
                                            <PencilSimple size={16} />
                                        </Link>
                                        <button
                                            onClick={() => handleDeleteClick(a)}
                                            disabled={deletingId === a.id}
                                            className="p-1.5 text-text-2 hover:text-text-1 transition-colors rounded-control hover:bg-surface-2 disabled:opacity-50"
                                            aria-label={`Hapus ${a.title}`}
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>,
                                ];
                            })}
                            ariaLabel="Daftar pengumuman"
                        />
                    </div>
                ) : (
                    <div className="rounded-card border border-border shadow-1 p-12 text-center">
                        {announcements.length > 0 ? (
                            <>
                                <p className="text-text-2 mb-3">Tidak ada pengumuman yang cocok dengan filter.</p>
                                <button
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium bg-accent text-white rounded-control hover:opacity-90 transition-colors"
                                >
                                    <Eraser size={16} />
                                    Reset Filter
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-text-3 mb-3">Belum ada pengumuman.</p>
                                <Link
                                    href="/admin/announcements/new"
                                    className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium bg-accent text-white rounded-control hover:opacity-90 transition-colors"
                                >
                                    Buat Pengumuman Pertama
                                </Link>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Bulk Action Bar */}
            <BulkActionBar
                selectedCount={selectedIds.size}
                onClear={clearSelection}
                selectedIds={Array.from(selectedIds)}
            />

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={showDeleteModal}
                title="Hapus Pengumuman"
                message={`Apakah Anda yakin ingin menghapus &ldquo;${selectedAnnouncement?.title}&rdquo;? Tindakan ini tidak dapat dibatalkan.`}
                confirmLabel="Hapus"
                cancelLabel="Batal"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => { setShowDeleteModal(false); setSelectedAnnouncement(null); }}
            />
        </>
    );
}
