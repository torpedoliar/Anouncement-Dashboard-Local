"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FiUpload, FiTrash2, FiX, FiCheck, FiImage } from "react-icons/fi";
import { useToast } from "@/contexts/ToastContext";

interface Media {
    id: string;
    filename: string;
    url: string;
    mimeType: string;
    size: number;
    alt: string | null;
    uploadedAt: string;
}

interface MediaPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
}

export default function MediaPickerModal({ isOpen, onClose, onSelect }: MediaPickerModalProps) {
    const [media, setMedia] = useState<Media[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            fetchMedia();
        }
    }, [isOpen]);

    const fetchMedia = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/media?limit=50");
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
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/media", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                showToast("Gambar berhasil diupload", "success");
                fetchMedia();
            } else {
                const data = await response.json();
                showToast(data.error || "Gagal upload", "error");
            }
        } catch (error) {
            console.error("Upload error:", error);
            showToast("Gagal upload gambar", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Yakin hapus gambar ini?")) return;

        try {
            const response = await fetch(`/api/media?id=${id}`, { method: "DELETE" });
            if (response.ok) {
                showToast("Gambar dihapus", "success");
                setMedia((prev) => prev.filter((m) => m.id !== id));
                if (selectedId === id) setSelectedId(null);
            }
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Gagal menghapus", "error");
        }
    };

    const handleSelect = () => {
        const selected = media.find((m) => m.id === selectedId);
        if (selected) {
            onSelect(selected.url);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "90%",
                    maxWidth: "900px",
                    maxHeight: "80vh",
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #262626",
                    borderRadius: "12px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        borderBottom: "1px solid #262626",
                    }}
                >
                    <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                        <FiImage /> Galeri Media
                    </h3>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 16px",
                                backgroundColor: "#dc2626",
                                color: "#fff",
                                fontSize: "13px",
                                fontWeight: 500,
                                borderRadius: "6px",
                                cursor: isUploading ? "not-allowed" : "pointer",
                            }}
                        >
                            <FiUpload size={14} />
                            {isUploading ? "Uploading..." : "Upload"}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleUpload}
                                disabled={isUploading}
                                style={{ display: "none" }}
                            />
                        </label>
                        <button
                            onClick={onClose}
                            style={{
                                padding: "8px",
                                backgroundColor: "transparent",
                                border: "1px solid #333",
                                color: "#737373",
                                borderRadius: "6px",
                                cursor: "pointer",
                            }}
                        >
                            <FiX size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
                    {isLoading ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#525252" }}>
                            Memuat gambar...
                        </div>
                    ) : media.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#525252" }}>
                            Belum ada gambar. Upload gambar pertama Anda!
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                                gap: "12px",
                            }}
                        >
                            {media.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedId(item.id)}
                                    style={{
                                        position: "relative",
                                        aspectRatio: "1",
                                        backgroundColor: "#111",
                                        border: selectedId === item.id ? "3px solid #dc2626" : "1px solid #262626",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        cursor: "pointer",
                                    }}
                                >
                                    <Image
                                        src={item.url}
                                        alt={item.alt || item.filename}
                                        fill
                                        style={{ objectFit: "cover" }}
                                    />
                                    {selectedId === item.id && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "8px",
                                                right: "8px",
                                                width: "24px",
                                                height: "24px",
                                                backgroundColor: "#dc2626",
                                                borderRadius: "50%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <FiCheck size={14} color="#fff" />
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(item.id);
                                        }}
                                        style={{
                                            position: "absolute",
                                            bottom: "8px",
                                            right: "8px",
                                            width: "28px",
                                            height: "28px",
                                            backgroundColor: "#7f1d1d",
                                            border: "none",
                                            borderRadius: "4px",
                                            color: "#fff",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <FiTrash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "12px",
                        padding: "16px 20px",
                        borderTop: "1px solid #262626",
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "transparent",
                            border: "1px solid #333",
                            color: "#a3a3a3",
                            fontSize: "13px",
                            borderRadius: "6px",
                            cursor: "pointer",
                        }}
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSelect}
                        disabled={!selectedId}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: selectedId ? "#dc2626" : "#333",
                            border: "none",
                            color: "#fff",
                            fontSize: "13px",
                            fontWeight: 500,
                            borderRadius: "6px",
                            cursor: selectedId ? "pointer" : "not-allowed",
                        }}
                    >
                        Pilih Gambar
                    </button>
                </div>
            </div>
        </div>
    );
}
