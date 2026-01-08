"use client";

import { useState, useEffect, useCallback } from "react";
import { FiX, FiSearch, FiImage, FiVideo, FiFolder, FiGlobe, FiCheck, FiLoader, FiChevronDown } from "react-icons/fi";

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
    onSelect: (url: string, type: "image" | "video") => void;
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
                setLocalMedia(prev => [...prev, ...(data.data || [])]);
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
            const stockType = mediaFilter === "all" ? "photo" : (mediaFilter === "image" ? "photo" : "video");
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
                setStockMedia(prev => [...prev, ...(data.data || [])]);
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
            // Local media - use directly
            const isVideo = selectedMedia.mimeType.startsWith("video/");
            onSelect(selectedMedia.url, isVideo ? "video" : "image");
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
                    alert("Gagal download media");
                }
            } catch (error) {
                console.error("Error downloading:", error);
                alert("Gagal download media");
            } finally {
                setDownloading(false);
            }
        }
    };

    if (!isOpen) return null;

    const modalStyle: React.CSSProperties = {
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
    };

    const contentStyle: React.CSSProperties = {
        backgroundColor: "#0a0a0a",
        border: "1px solid #262626",
        width: "90%",
        maxWidth: "900px",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: "8px",
        overflow: "hidden",
    };

    return (
        <div style={modalStyle} onClick={onClose}>
            <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #262626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <h2 style={{ color: "#fff", fontSize: "18px", fontWeight: 600, margin: 0 }}>
                        Media Library
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#737373",
                            cursor: "pointer",
                            padding: "4px",
                        }}
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {/* Tabs & Filters */}
                <div style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid #1a1a1a",
                    display: "flex",
                    gap: "16px",
                    alignItems: "center",
                    flexWrap: "wrap",
                }}>
                    {/* Tab Buttons */}
                    <div style={{ display: "flex", gap: "4px" }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab("local")}
                            style={{
                                padding: "8px 16px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: activeTab === "local" ? "#dc2626" : "#1a1a1a",
                                color: activeTab === "local" ? "#fff" : "#737373",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "13px",
                                cursor: "pointer",
                            }}
                        >
                            <FiFolder size={14} /> Local
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("stock")}
                            style={{
                                padding: "8px 16px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: activeTab === "stock" ? "#dc2626" : "#1a1a1a",
                                color: activeTab === "stock" ? "#fff" : "#737373",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "13px",
                                cursor: "pointer",
                            }}
                        >
                            <FiGlobe size={14} /> Stock Media
                        </button>
                    </div>

                    {/* Media Type Filter */}
                    {mediaType === "all" && (
                        <div style={{ display: "flex", gap: "4px" }}>
                            <button
                                type="button"
                                onClick={() => setMediaFilter("all")}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: mediaFilter === "all" ? "#262626" : "transparent",
                                    color: mediaFilter === "all" ? "#fff" : "#737373",
                                    border: "1px solid #333",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                }}
                            >
                                Semua
                            </button>
                            <button
                                type="button"
                                onClick={() => setMediaFilter("image")}
                                style={{
                                    padding: "6px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    backgroundColor: mediaFilter === "image" ? "#262626" : "transparent",
                                    color: mediaFilter === "image" ? "#fff" : "#737373",
                                    border: "1px solid #333",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                }}
                            >
                                <FiImage size={12} /> Foto
                            </button>
                            <button
                                type="button"
                                onClick={() => setMediaFilter("video")}
                                style={{
                                    padding: "6px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    backgroundColor: mediaFilter === "video" ? "#262626" : "transparent",
                                    color: mediaFilter === "video" ? "#fff" : "#737373",
                                    border: "1px solid #333",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                }}
                            >
                                <FiVideo size={12} /> Video
                            </button>
                        </div>
                    )}

                    {/* Search */}
                    <div style={{ flex: 1, minWidth: "200px" }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #333",
                            borderRadius: "4px",
                            padding: "0 12px",
                        }}>
                            <FiSearch size={14} color="#737373" />
                            <input
                                type="text"
                                placeholder={activeTab === "local" ? "Cari media..." : "Cari stock media..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: "8px 12px",
                                    backgroundColor: "transparent",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: "13px",
                                    outline: "none",
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflow: "auto",
                    padding: "16px 20px",
                }}>
                    {activeTab === "local" ? (
                        // Local Media Grid
                        <>
                            {localLoading && localMedia.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px", color: "#737373" }}>
                                    <FiLoader size={24} style={{ animation: "spin 1s linear infinite" }} />
                                    <p style={{ marginTop: "8px" }}>Memuat media...</p>
                                </div>
                            ) : localMedia.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px", color: "#737373" }}>
                                    <FiFolder size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                                    <p>Belum ada media</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                                        gap: "12px",
                                    }}>
                                        {localMedia.map((media) => {
                                            const isVideo = media.mimeType.startsWith("video/");
                                            const isSelected = selectedMedia && "id" in selectedMedia && selectedMedia.id === media.id;

                                            return (
                                                <div
                                                    key={media.id}
                                                    onClick={() => setSelectedMedia(media)}
                                                    style={{
                                                        position: "relative",
                                                        aspectRatio: "1",
                                                        backgroundColor: "#1a1a1a",
                                                        borderRadius: "4px",
                                                        overflow: "hidden",
                                                        cursor: "pointer",
                                                        border: isSelected ? "2px solid #dc2626" : "2px solid transparent",
                                                    }}
                                                >
                                                    {isVideo ? (
                                                        <video
                                                            src={media.url}
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                objectFit: "cover",
                                                            }}
                                                        />
                                                    ) : (
                                                        <img
                                                            src={media.url}
                                                            alt={media.alt || media.filename}
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                objectFit: "cover",
                                                            }}
                                                        />
                                                    )}
                                                    {isVideo && (
                                                        <div style={{
                                                            position: "absolute",
                                                            top: "4px",
                                                            left: "4px",
                                                            backgroundColor: "rgba(0,0,0,0.7)",
                                                            padding: "2px 6px",
                                                            borderRadius: "2px",
                                                        }}>
                                                            <FiVideo size={12} color="#fff" />
                                                        </div>
                                                    )}
                                                    {isSelected && (
                                                        <div style={{
                                                            position: "absolute",
                                                            inset: 0,
                                                            backgroundColor: "rgba(220, 38, 38, 0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}>
                                                            <FiCheck size={24} color="#fff" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Load More */}
                                    {localMedia.length < localTotal && (
                                        <div style={{ textAlign: "center", marginTop: "16px" }}>
                                            <button
                                                type="button"
                                                onClick={() => fetchLocalMedia(localPage + 1)}
                                                disabled={localLoading}
                                                style={{
                                                    padding: "8px 24px",
                                                    backgroundColor: "#1a1a1a",
                                                    color: "#fff",
                                                    border: "1px solid #333",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                }}
                                            >
                                                <FiChevronDown size={14} />
                                                {localLoading ? "Memuat..." : "Muat Lebih"}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        // Stock Media Grid
                        <>
                            {!stockAvailable ? (
                                <div style={{ textAlign: "center", padding: "40px", color: "#737373" }}>
                                    <FiGlobe size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                                    <p>Stock media tidak tersedia</p>
                                    <p style={{ fontSize: "12px", marginTop: "4px" }}>Pexels API key tidak dikonfigurasi</p>
                                </div>
                            ) : stockLoading && stockMedia.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px", color: "#737373" }}>
                                    <FiLoader size={24} style={{ animation: "spin 1s linear infinite" }} />
                                    <p style={{ marginTop: "8px" }}>Mencari stock media...</p>
                                </div>
                            ) : stockMedia.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px", color: "#737373" }}>
                                    <FiSearch size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                                    <p>Tidak ditemukan</p>
                                    <p style={{ fontSize: "12px", marginTop: "4px" }}>Coba kata kunci lain</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                                        gap: "12px",
                                    }}>
                                        {stockMedia.map((media) => {
                                            const isSelected = selectedMedia && "photographer" in selectedMedia && selectedMedia.id === media.id;

                                            return (
                                                <div
                                                    key={media.id}
                                                    onClick={() => setSelectedMedia(media)}
                                                    style={{
                                                        position: "relative",
                                                        aspectRatio: "1",
                                                        backgroundColor: "#1a1a1a",
                                                        borderRadius: "4px",
                                                        overflow: "hidden",
                                                        cursor: "pointer",
                                                        border: isSelected ? "2px solid #dc2626" : "2px solid transparent",
                                                    }}
                                                >
                                                    <img
                                                        src={media.thumbnail}
                                                        alt={media.alt || `By ${media.photographer}`}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit: "cover",
                                                        }}
                                                    />
                                                    {media.type === "video" && (
                                                        <div style={{
                                                            position: "absolute",
                                                            top: "4px",
                                                            left: "4px",
                                                            backgroundColor: "rgba(0,0,0,0.7)",
                                                            padding: "2px 6px",
                                                            borderRadius: "2px",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                        }}>
                                                            <FiVideo size={12} color="#fff" />
                                                            {media.duration && (
                                                                <span style={{ color: "#fff", fontSize: "10px" }}>
                                                                    {Math.floor(media.duration / 60)}:{String(media.duration % 60).padStart(2, "0")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        position: "absolute",
                                                        bottom: 0,
                                                        left: 0,
                                                        right: 0,
                                                        padding: "4px 6px",
                                                        background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                                                    }}>
                                                        <p style={{
                                                            color: "#fff",
                                                            fontSize: "10px",
                                                            margin: 0,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            📷 {media.photographer}
                                                        </p>
                                                    </div>
                                                    {isSelected && (
                                                        <div style={{
                                                            position: "absolute",
                                                            inset: 0,
                                                            backgroundColor: "rgba(220, 38, 38, 0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}>
                                                            <FiCheck size={24} color="#fff" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Load More */}
                                    {stockMedia.length < stockTotal && (
                                        <div style={{ textAlign: "center", marginTop: "16px" }}>
                                            <button
                                                type="button"
                                                onClick={() => fetchStockMedia(stockPage + 1, debouncedQuery)}
                                                disabled={stockLoading}
                                                style={{
                                                    padding: "8px 24px",
                                                    backgroundColor: "#1a1a1a",
                                                    color: "#fff",
                                                    border: "1px solid #333",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                }}
                                            >
                                                <FiChevronDown size={14} />
                                                {stockLoading ? "Memuat..." : "Muat Lebih"}
                                            </button>
                                        </div>
                                    )}

                                    {/* Pexels Attribution */}
                                    <p style={{
                                        textAlign: "center",
                                        color: "#525252",
                                        fontSize: "11px",
                                        marginTop: "16px",
                                    }}>
                                        Photos and videos provided by{" "}
                                        <a
                                            href="https://www.pexels.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: "#07A081" }}
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
                <div style={{
                    padding: "12px 20px",
                    borderTop: "1px solid #262626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <div style={{ color: "#737373", fontSize: "12px" }}>
                        {selectedMedia ? (
                            "filename" in selectedMedia ? (
                                <span>Dipilih: {selectedMedia.filename}</span>
                            ) : (
                                <span>Dipilih: Stock {selectedMedia.type} by {selectedMedia.photographer}</span>
                            )
                        ) : (
                            <span>Pilih media untuk digunakan</span>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "transparent",
                                color: "#737373",
                                border: "1px solid #333",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "13px",
                            }}
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSelect}
                            disabled={!selectedMedia || downloading}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: selectedMedia ? "#dc2626" : "#333",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                cursor: selectedMedia ? "pointer" : "not-allowed",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            {downloading ? (
                                <>
                                    <FiLoader size={14} style={{ animation: "spin 1s linear infinite" }} />
                                    Downloading...
                                </>
                            ) : (
                                <>
                                    <FiCheck size={14} />
                                    Pilih
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
