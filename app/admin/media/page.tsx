"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FiUpload, FiTrash2, FiImage, FiLoader, FiCopy, FiCheck } from "react-icons/fi";
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
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Yakin hapus gambar ini?")) return;

        try {
            const response = await fetch(`/api/media?id=${id}`, { method: "DELETE" });
            if (response.ok) {
                showToast("Gambar dihapus", "success");
                setMedia((prev) => prev.filter((m) => m.id !== id));
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
                    {isUploading ? "UPLOADING..." : "UPLOAD GAMBAR"}
                    <input
                        type="file"
                        accept="image/*"
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
                    <span style={{ color: "#525252", fontSize: "12px" }}>Total Gambar</span>
                    <p style={{ color: "#fff", fontSize: "20px", fontWeight: 600 }}>{media.length}</p>
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
                    <p style={{ marginTop: "12px" }}>Memuat gambar...</p>
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
                    <p style={{ color: "#525252", fontSize: "16px" }}>Belum ada gambar</p>
                    <p style={{ color: "#404040", fontSize: "14px" }}>Upload gambar pertama Anda</p>
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
                            <div style={{ position: "relative", aspectRatio: "4/3", backgroundColor: "#111" }}>
                                <Image
                                    src={item.url}
                                    alt={item.alt || item.filename}
                                    fill
                                    style={{ objectFit: "cover" }}
                                />
                            </div>
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
        </div>
    );
}
