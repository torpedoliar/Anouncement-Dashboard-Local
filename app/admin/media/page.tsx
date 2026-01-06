"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FiUpload, FiTrash2, FiImage, FiLoader, FiCopy, FiCheck, FiX, FiPlay, FiVideo, FiEye } from "react-icons/fi";
import { useToast } from "@/contexts/ToastContext";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Media {
    id: string;
    filename: string;
    url: string;
    mimeType: string;
    size: number;
    alt: string | null;
    uploadedAt: string;
}

export default function MediaGalleryPage() {
    const [media, setMedia] = useState<Media[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [previewItem, setPreviewItem] = useState<Media | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        fetchMedia();
    }, []);

    const fetchMedia = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/media?limit=100");
            const data = await response.json();
            setMedia(data.data || []);
        } catch (error) {
            console.error("Error fetching media:", error);
            showToast("Gagal memuat galeri", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);

        for (const file of Array.from(files)) {
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("/api/media", {
                    method: "POST",
                    body: formData,
                });

                if (response.ok) {
                    showToast(`${file.name} berhasil diupload`, "success");
                } else {
                    const data = await response.json();
                    showToast(`${file.name}: ${data.error}`, "error");
                }
            } catch (error) {
                console.error("Upload error:", error);
                showToast(`Gagal upload ${file.name}`, "error");
            }
        }

        fetchMedia();
        setIsUploading(false);
        // Reset input
        e.target.value = "";
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Yakin hapus file ini?")) return;

        try {
            const response = await fetch(`/api/media?id=${id}`, { method: "DELETE" });
            if (response.ok) {
                showToast("File dihapus", "success");
                setMedia((prev) => prev.filter((m) => m.id !== id));
                if (previewItem?.id === id) setPreviewItem(null);
            }
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Gagal menghapus", "error");
        }
    };

    const copyUrl = (url: string, id: string) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        showToast("URL disalin!", "info");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isVideo = (mimeType: string) => mimeType.startsWith("video/");
    const isImage = (mimeType: string) => mimeType.startsWith("image/");

    const imageCount = media.filter(m => isImage(m.mimeType)).length;
    const videoCount = media.filter(m => isVideo(m.mimeType)).length;

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    marginBottom: "32px",
                }}
            >
                <div>
                    <p
                        style={{
                            color: "#dc2626",
                            fontSize: "11px",
                            fontWeight: 600,
                            letterSpacing: "0.2em",
                            marginBottom: "4px",
                        }}
                    >
                        MEDIA
                    </p>
                    <h1
                        style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: "24px",
                            fontWeight: 700,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <FiImage /> Galeri Media
                    </h1>
                </div>
                <label
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        cursor: isUploading ? "not-allowed" : "pointer",
                        opacity: isUploading ? 0.7 : 1,
                    }}
                >
                    {isUploading ? <FiLoader className="animate-spin" size={14} /> : <FiUpload size={14} />}
                    {isUploading ? "UPLOADING..." : "UPLOAD MEDIA"}
                    <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleUpload}
                        disabled={isUploading}
                        style={{ display: "none" }}
                    />
                </label>
            </div>

            {/* Stats */}
            <div
                style={{
                    padding: "16px 20px",
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #262626",
                    marginBottom: "24px",
                    display: "flex",
                    gap: "32px",
                }}
            >
                <div>
                    <span style={{ color: "#525252", fontSize: "12px" }}>Total Media</span>
                    <p style={{ color: "#fff", fontSize: "20px", fontWeight: 600 }}>{media.length}</p>
                </div>
                <div>
                    <span style={{ color: "#525252", fontSize: "12px" }}>Gambar</span>
                    <p style={{ color: "#22c55e", fontSize: "20px", fontWeight: 600 }}>{imageCount}</p>
                </div>
                <div>
                    <span style={{ color: "#525252", fontSize: "12px" }}>Video</span>
                    <p style={{ color: "#60a5fa", fontSize: "20px", fontWeight: 600 }}>{videoCount}</p>
                </div>
                <div>
                    <span style={{ color: "#525252", fontSize: "12px" }}>Total Ukuran</span>
                    <p style={{ color: "#fff", fontSize: "20px", fontWeight: 600 }}>
                        {formatFileSize(media.reduce((sum, m) => sum + m.size, 0))}
                    </p>
                </div>
            </div>

            {/* Gallery */}
            {isLoading ? (
                <div style={{ textAlign: "center", padding: "60px", color: "#525252" }}>
                    <FiLoader size={32} style={{ animation: "spin 1s linear infinite" }} />
                    <p style={{ marginTop: "12px" }}>Memuat media...</p>
                </div>
            ) : media.length === 0 ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "80px",
                        backgroundColor: "#0a0a0a",
                        border: "1px dashed #333",
                    }}
                >
                    <FiImage size={48} style={{ color: "#333", marginBottom: "16px" }} />
                    <p style={{ color: "#525252", fontSize: "16px" }}>Belum ada media</p>
                    <p style={{ color: "#404040", fontSize: "14px" }}>Upload gambar atau video pertama Anda</p>
                </div>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "16px",
                    }}
                >
                    {media.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                backgroundColor: "#0a0a0a",
                                border: "1px solid #262626",
                                overflow: "hidden",
                            }}
                        >
                            {/* Thumbnail */}
                            <div
                                style={{
                                    position: "relative",
                                    aspectRatio: "4/3",
                                    backgroundColor: "#111",
                                    cursor: "pointer",
                                }}
                                onClick={() => setPreviewItem(item)}
                            >
                                {isVideo(item.mimeType) ? (
                                    <>
                                        <video
                                            src={item.url}
                                            muted
                                            preload="metadata"
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            onLoadedMetadata={(e) => {
                                                const video = e.currentTarget;
                                                video.currentTime = 0.5;
                                            }}
                                        />
                                        {/* Play overlay */}
                                        <div style={{
                                            position: "absolute",
                                            inset: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: "rgba(0,0,0,0.3)",
                                        }}>
                                            <div style={{
                                                width: "48px",
                                                height: "48px",
                                                borderRadius: "50%",
                                                backgroundColor: "rgba(220, 38, 38, 0.9)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}>
                                                <FiPlay size={20} color="#fff" />
                                            </div>
                                        </div>
                                        {/* Video badge */}
                                        <div style={{
                                            position: "absolute",
                                            top: "8px",
                                            left: "8px",
                                            padding: "4px 8px",
                                            backgroundColor: "rgba(59, 130, 246, 0.9)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            fontSize: "10px",
                                            fontWeight: 600,
                                            color: "#fff",
                                        }}>
                                            <FiVideo size={10} /> VIDEO
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Image
                                            src={item.url}
                                            alt={item.alt || item.filename}
                                            fill
                                            style={{ objectFit: "cover" }}
                                        />
                                        {/* Hover overlay */}
                                        <div style={{
                                            position: "absolute",
                                            inset: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: "rgba(0,0,0,0)",
                                            transition: "background-color 0.2s",
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.4)"}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0)"}
                                        >
                                            <FiEye size={24} color="#fff" style={{ opacity: 0.8 }} />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Info */}
                            <div style={{ padding: "12px" }}>
                                <p
                                    style={{
                                        color: "#fff",
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        marginBottom: "4px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {item.filename}
                                </p>
                                <p style={{ color: "#525252", fontSize: "11px", marginBottom: "12px" }}>
                                    {formatFileSize(item.size)} •{" "}
                                    {formatDistanceToNow(new Date(item.uploadedAt), { addSuffix: true, locale: localeId })}
                                </p>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                        onClick={() => setPreviewItem(item)}
                                        style={{
                                            padding: "8px 12px",
                                            backgroundColor: "#171717",
                                            border: "1px solid #333",
                                            color: "#a3a3a3",
                                            fontSize: "11px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                        }}
                                    >
                                        <FiEye size={12} />
                                    </button>
                                    <button
                                        onClick={() => copyUrl(item.url, item.id)}
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "4px",
                                            padding: "8px",
                                            backgroundColor: "#171717",
                                            border: "1px solid #333",
                                            color: "#a3a3a3",
                                            fontSize: "11px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {copiedId === item.id ? <FiCheck size={12} /> : <FiCopy size={12} />}
                                        URL
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        style={{
                                            padding: "8px 12px",
                                            backgroundColor: "#7f1d1d",
                                            border: "none",
                                            color: "#fff",
                                            fontSize: "11px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <FiTrash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Preview Modal */}
            {previewItem && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.95)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                        padding: "24px",
                    }}
                    onClick={() => setPreviewItem(null)}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setPreviewItem(null)}
                        style={{
                            position: "absolute",
                            top: "24px",
                            right: "24px",
                            padding: "12px",
                            backgroundColor: "rgba(255,255,255,0.1)",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <FiX size={24} />
                    </button>

                    {/* Media content */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: "90vw",
                            maxHeight: "85vh",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                        }}
                    >
                        {isVideo(previewItem.mimeType) ? (
                            <video
                                src={previewItem.url}
                                controls
                                autoPlay
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "75vh",
                                    backgroundColor: "#000",
                                }}
                            />
                        ) : (
                            <Image
                                src={previewItem.url}
                                alt={previewItem.alt || previewItem.filename}
                                width={1200}
                                height={800}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "75vh",
                                    objectFit: "contain",
                                    width: "auto",
                                    height: "auto",
                                }}
                            />
                        )}

                        {/* Info bar */}
                        <div style={{
                            marginTop: "16px",
                            padding: "12px 20px",
                            backgroundColor: "rgba(255,255,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "24px",
                            flexWrap: "wrap",
                            justifyContent: "center",
                        }}>
                            <span style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>
                                {previewItem.filename}
                            </span>
                            <span style={{ color: "#a3a3a3", fontSize: "13px" }}>
                                {formatFileSize(previewItem.size)}
                            </span>
                            <button
                                onClick={() => copyUrl(previewItem.url, previewItem.id)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "8px 16px",
                                    backgroundColor: "#dc2626",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                <FiCopy size={12} />
                                Copy URL
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
