"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
    X,
    MagnifyingGlass,
    VideoCamera,
    Folder,
    Globe,
    Check,
    Download,
    Spinner,
    FolderOpen,
    FilePdf,
} from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface LocalMedia {
    id: string;
    filename: string;
    url: string;
    mimeType: string;
    size: number;
    alt?: string;
    uploadedAt: string;
}

interface StockMedia {
    id: number;
    type: "photo" | "video";
    thumbnail: string;
    preview: string;
    download: string;
    photographer: string;
    photographerUrl: string;
    alt?: string;
    duration?: number;
}

interface MediaPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    // WR-04: baris PDF dilaporkan sebagai "pdf" agar penerima menyisipkan
    // blok PDF, bukan <img> rusak.
    onSelect: (url: string, type: "image" | "video" | "pdf") => void;
    mediaType?: "image" | "video" | "all";
}

type TabType = "local" | "stock";
type MediaFilterType = "all" | "image" | "video";

export default function MediaPickerModal({
    isOpen,
    onClose,
    onSelect,
    mediaType = "all",
}: MediaPickerModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>("local");
    const [mediaFilter, setMediaFilter] = useState<MediaFilterType>(mediaType === "all" ? "all" : mediaType);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const { showToast } = useToast();

    // Local media state
    const [localMedia, setLocalMedia] = useState<LocalMedia[]>([]);
    const [localLoading, setLocalLoading] = useState(false);
    const [localPage, setLocalPage] = useState(1);
    const [localTotal, setLocalTotal] = useState(0);

    // Stock media state
    const [stockMedia, setStockMedia] = useState<StockMedia[]>([]);
    const [stockLoading, setStockLoading] = useState(false);
    const [stockPage, setStockPage] = useState(1);
    const [stockTotal, setStockTotal] = useState(0);
    const [stockAvailable, setStockAvailable] = useState(true);

    // Selection state
    const [selectedMedia, setSelectedMedia] = useState<LocalMedia | StockMedia | null>(null);
    const [downloading, setDownloading] = useState(false);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Sync filter with prop when opening or changing type
    useEffect(() => {
        if (isOpen) {
            setMediaFilter(mediaType === "all" ? "all" : mediaType);
        }
    }, [isOpen, mediaType]);

    // Fetch local media
    const fetchLocalMedia = useCallback(async (page: number = 1) => {
        setLocalLoading(true);
        try {
            const typeParam = mediaFilter === "all" ? "" : `&type=${mediaFilter}`;
            const response = await fetch(`/api/media?page=${page}&limit=18${typeParam}`);
            const data = await response.json();

            if (page === 1) {
                setLocalMedia(data.data || []);
            } else {
                setLocalMedia((prev) => [...prev, ...(data.data || [])]);
            }
            setLocalTotal(data.pagination?.total || 0);
            setLocalPage(page);
        } catch (error) {
            console.error("Error fetching local media:", error);
        } finally {
            setLocalLoading(false);
        }
    }, [mediaFilter]);

    // Fetch stock media
    const fetchStockMedia = useCallback(async (page: number = 1, query: string = "") => {
        setStockLoading(true);
        try {
            const stockType = mediaFilter === "all" ? "photo" : mediaFilter === "image" ? "photo" : "video";
            const queryParam = query ? `&query=${encodeURIComponent(query)}` : "&query=business";
            const response = await fetch(`/api/stock-media?type=${stockType}&page=${page}&per_page=15${queryParam}`);
            const data = await response.json();

            if (!data.available) {
                setStockAvailable(false);
                return;
            }

            setStockAvailable(true);
            if (page === 1) {
                setStockMedia(data.data || []);
            } else {
                setStockMedia((prev) => [...prev, ...(data.data || [])]);
            }
            setStockTotal(data.totalResults || 0);
            setStockPage(page);
        } catch (error) {
            console.error("Error fetching stock media:", error);
            setStockAvailable(false);
        } finally {
            setStockLoading(false);
        }
    }, [mediaFilter]);

    // Initial load
    useEffect(() => {
        if (isOpen) {
            if (activeTab === "local") {
                fetchLocalMedia(1);
            } else {
                fetchStockMedia(1, debouncedQuery);
            }
        }
    }, [isOpen, activeTab, mediaFilter, debouncedQuery, fetchLocalMedia, fetchStockMedia]);

    // Reset when closing
    useEffect(() => {
        if (!isOpen) {
            setSelectedMedia(null);
            setSearchQuery("");
            setLocalPage(1);
            setStockPage(1);
        }
    }, [isOpen]);

    // Handle selection
    const handleSelect = async () => {
        if (!selectedMedia) return;

        if ("filename" in selectedMedia) {
            // Local media - use directly (WR-04: PDF dilaporkan sbg "pdf")
            const isPdf = selectedMedia.mimeType === "application/pdf";
            const isVideo = selectedMedia.mimeType.startsWith("video/");
            onSelect(selectedMedia.url, isPdf ? "pdf" : isVideo ? "video" : "image");
            onClose();
        } else {
            // Stock media - download first
            setDownloading(true);
            try {
                const response = await fetch("/api/stock-media/download", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        url: selectedMedia.download,
                        type: selectedMedia.type,
                        photographer: selectedMedia.photographer,
                        alt: selectedMedia.alt || `Stock ${selectedMedia.type} by ${selectedMedia.photographer}`,
                    }),
                });

                const data = await response.json();
                if (data.success) {
                    onSelect(data.url, selectedMedia.type === "video" ? "video" : "image");
                    onClose();
                } else {
                    showToast("Gagal download media", "error");
                }
            } catch (error) {
                console.error("Error downloading:", error);
                showToast("Gagal download media", "error");
            } finally {
                setDownloading(false);
            }
        }
    };

    return (
        // `bare` dipakai supaya tata letak internal picker (bar tab tetap di
        // atas, grid yang men-scroll sendiri) tidak berubah, sekaligus dapat
        // perilaku dialog dari kit: portal, focus trap, Escape, kunci scroll —
        // tiga hal yang dulu tidak ada di overlay ini.
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Pilih Media"
            bare
            hideCloseButton
            panelClassName="flex h-[85vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-sheet border border-border bg-surface-1 shadow-lvl-3"
        >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <h2 className="text-lg font-semibold text-text-1 m-0">Pilih Media</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup"
                        className="cursor-pointer rounded-control p-1.5 text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        <X size={18} weight="bold" aria-hidden="true" />
                    </button>
                </div>

                {/* Tabs & Filters */}
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-1 px-5 py-3">
                    {/* Tab Buttons */}
                    <div className="flex gap-1 rounded-control bg-surface-2 p-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab("local")}
                            className={`inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors ${
                                activeTab === "local"
                                    ? "bg-surface-1 text-text-1 shadow-sm"
                                    : "text-text-3 hover:text-text-1"
                            }`}
                            aria-pressed={activeTab === "local"}
                        >
                            <Folder size={14} weight="duotone" />
                            Lokal
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("stock")}
                            className={`inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors ${
                                activeTab === "stock"
                                    ? "bg-surface-1 text-text-1 shadow-sm"
                                    : "text-text-3 hover:text-text-1"
                            }`}
                            aria-pressed={activeTab === "stock"}
                        >
                            <Globe size={14} weight="duotone" />
                            Stock
                        </button>
                    </div>

                    {/* Media Type Filter */}
                    {mediaType === "all" && (
                        <div className="flex gap-1">
                            {(["all", "image", "video"] as const).map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    onClick={() => setMediaFilter(filter)}
                                    className={`rounded-control border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        mediaFilter === filter
                                            ? "border-border bg-surface-2 text-text-1"
                                            : "border-transparent text-text-3 hover:text-text-1"
                                    }`}
                                    aria-pressed={mediaFilter === filter}
                                >
                                    {filter === "all" ? "Semua" : filter === "image" ? "Foto" : "Video"}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search */}
                    <div className="min-w-[200px] flex-1">
                        <div className="flex items-center rounded-control border border-border bg-surface-2 px-3">
                            <MagnifyingGlass size={14} className="text-text-3" />
                            <input
                                type="text"
                                placeholder={activeTab === "local" ? "Cari media..." : "Cari stock media..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label={`Cari ${activeTab === "local" ? "media lokal" : "stock media"}`}
                                className="w-full bg-transparent px-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-5">
                    {activeTab === "local" ? (
                        <>
                            {localLoading && localMedia.length === 0 ? (
                                <div className="flex flex-col items-center py-16 text-text-3">
                                    <Spinner size={24} className="animate-spin" weight="duotone" />
                                    <p className="mt-2 text-sm">Memuat media...</p>
                                </div>
                            ) : localMedia.length === 0 ? (
                                <div className="flex flex-col items-center py-16 text-text-3">
                                    <FolderOpen size={48} className="mb-3 opacity-30" weight="duotone" />
                                    <p className="text-sm">Belum ada media</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                                        {localMedia.map((media) => {
                                            const isVideoMedia = media.mimeType.startsWith("video/");
                                            // WR-04: PDF bukan gambar — render kartu ikon,
                                            // jangan <img> yang selalu rusak.
                                            const isPdfMedia = media.mimeType === "application/pdf";
                                            const isSelected =
                                                selectedMedia &&
                                                "id" in selectedMedia &&
                                                selectedMedia.id === media.id;

                                            return (
                                                <button
                                                    key={media.id}
                                                    type="button"
                                                    onClick={() => setSelectedMedia(media)}
                                                    className={`group relative aspect-square overflow-hidden rounded-md border-2 transition-colors ${
                                                        isSelected
                                                            ? "border-accent"
                                                            : "border-transparent hover:border-text-3/30"
                                                    }`}
                                                    aria-label={`Pilih ${media.filename}`}
                                                    aria-pressed={!!isSelected}
                                                >
                                                    {isPdfMedia ? (
                                                        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-2 text-text-2">
                                                            <FilePdf size={28} weight="duotone" aria-hidden="true" />
                                                            <span className="max-w-full truncate px-1 text-[10px] font-medium">
                                                                {media.filename}
                                                            </span>
                                                        </span>
                                                    ) : isVideoMedia ? (
                                                        <video
                                                            src={media.url}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <Image
                                                            width={120}
                                                            height={120}
                                                            src={media.url}
                                                            alt={media.alt || media.filename}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    )}
                                                    {isVideoMedia && (
                                                        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                                            <VideoCamera size={12} />
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <span className="absolute inset-0 flex items-center justify-center bg-accent/30">
                                                            <Check size={24} className="text-white" weight="bold" />
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Load More */}
                                    {localMedia.length < localTotal && (
                                        <div className="mt-4 text-center">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                iconLeft={<Spinner size={14} className={localLoading ? "animate-spin" : ""} />}
                                                onClick={() => fetchLocalMedia(localPage + 1)}
                                                disabled={localLoading}
                                            >
                                                {localLoading ? "Memuat..." : "Muat Lebih"}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {!stockAvailable ? (
                                <div className="flex flex-col items-center py-16 text-text-3">
                                    <Globe size={48} className="mb-3 opacity-30" weight="duotone" />
                                    <p className="text-sm">Stock media tidak tersedia</p>
                                    <p className="mt-1 text-xs">Pexels API key tidak dikonfigurasi</p>
                                </div>
                            ) : stockLoading && stockMedia.length === 0 ? (
                                <div className="flex flex-col items-center py-16 text-text-3">
                                    <Spinner size={24} className="animate-spin" weight="duotone" />
                                    <p className="mt-2 text-sm">Mencari stock media...</p>
                                </div>
                            ) : stockMedia.length === 0 ? (
                                <div className="flex flex-col items-center py-16 text-text-3">
                                    <MagnifyingGlass size={48} className="mb-3 opacity-30" weight="duotone" />
                                    <p className="text-sm">Tidak ditemukan</p>
                                    <p className="mt-1 text-xs">Coba kata kunci lain</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                                        {stockMedia.map((media) => {
                                            const isSelected =
                                                selectedMedia &&
                                                "photographer" in selectedMedia &&
                                                selectedMedia.id === media.id;

                                            return (
                                                <button
                                                    key={media.id}
                                                    type="button"
                                                    onClick={() => setSelectedMedia(media)}
                                                    className={`group relative aspect-square overflow-hidden rounded-md border-2 transition-colors ${
                                                        isSelected
                                                            ? "border-accent"
                                                            : "border-transparent hover:border-text-3/30"
                                                    }`}
                                                    aria-label={`Pilih stock ${media.type} by ${media.photographer}`}
                                                    aria-pressed={!!isSelected}
                                                >
                                                    <Image
                                                        width={120}
                                                        height={120}
                                                        src={media.thumbnail}
                                                        alt={media.alt || `By ${media.photographer}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    {media.type === "video" && (
                                                        <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                                            <VideoCamera size={12} />
                                                            {media.duration && (
                                                                <>
                                                                    {Math.floor(media.duration / 60)}:
                                                                    {String(media.duration % 60).padStart(2, "0")}
                                                                </>
                                                            )}
                                                        </span>
                                                    )}
                                                    <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-2">
                                                        <p className="truncate text-[10px] font-medium text-white">
                                                            {media.photographer}
                                                        </p>
                                                    </span>
                                                    {isSelected && (
                                                        <span className="absolute inset-0 flex items-center justify-center bg-accent/30">
                                                            <Check size={24} className="text-white" weight="bold" />
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Load More */}
                                    {stockMedia.length < stockTotal && (
                                        <div className="mt-4 text-center">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                iconLeft={<Spinner size={14} className={stockLoading ? "animate-spin" : ""} />}
                                                onClick={() => fetchStockMedia(stockPage + 1, debouncedQuery)}
                                                disabled={stockLoading}
                                            >
                                                {stockLoading ? "Memuat..." : "Muat Lebih"}
                                            </Button>
                                        </div>
                                    )}

                                    {/* Pexels Attribution */}
                                    <p className="mt-4 text-center text-[11px] text-text-3">
                                        Photos and videos provided by{" "}
                                        <a
                                            href="https://www.pexels.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-500 underline decoration-emerald-500/30 hover:text-emerald-400"
                                        >
                                            Pexels
                                        </a>
                                    </p>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                    <div className="text-xs text-text-3">
                        {selectedMedia ? (
                            "filename" in selectedMedia ? (
                                <span>Dipilih: <span className="font-medium text-text-1">{selectedMedia.filename}</span></span>
                            ) : (
                                <span>Dipilih: Stock <span className="font-medium text-text-1">{selectedMedia.type}</span> by {selectedMedia.photographer}</span>
                            )
                        ) : (
                            <span>Pilih media untuk digunakan</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            iconLeft={downloading ? <Spinner size={14} className="animate-spin" /> : <Download size={14} weight="bold" />}
                            onClick={handleSelect}
                            disabled={!selectedMedia || downloading}
                        >
                            {downloading ? "Mengunduh..." : "Pilih"}
                        </Button>
                    </div>
                </div>
        </Modal>
    );
}
