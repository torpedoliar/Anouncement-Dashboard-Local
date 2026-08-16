"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
    UploadSimple,
    Trash,
    Copy,
    Check,
    Image as ImageIcon,
    VideoCamera,
    Eye,
} from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
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
    const { confirm, ConfirmDialog } = useConfirm();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchMedia = useCallback(async () => {
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
    }, [showToast]);

    useEffect(() => {
        fetchMedia();
    }, [fetchMedia]);

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
        e.target.value = "";
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm({ title: "Hapus File", message: "Yakin hapus file ini?", variant: "danger" }))) return;

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

    const imageCount = media.filter((m) => isImage(m.mimeType)).length;
    const videoCount = media.filter((m) => isVideo(m.mimeType)).length;

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
                <div>
                    <p className="text-accent text-xs font-semibold tracking-widest mb-1">
                        MEDIA
                    </p>
                    <h1 className="text-2xl font-bold text-text-1 flex items-center gap-3">
                        <ImageIcon size={24} weight="duotone" className="text-accent" />
                        Galeri Media
                    </h1>
                </div>
                <label
                    className="inline-flex cursor-pointer items-center gap-2 rounded-control bg-accent px-6 py-3 text-xs font-semibold tracking-widest text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Upload media"
                >
                    {isUploading ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        <UploadSimple size={14} weight="bold" />
                    )}
                    {isUploading ? "UPLOADING..." : "UPLOAD MEDIA"}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleUpload}
                        disabled={isUploading}
                        className="hidden"
                    />
                </label>
                {/* Hidden dropzone visual that delegates to file input */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Klik untuk upload media"
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-border bg-surface-1 p-8 transition-colors hover:border-text-3/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:hidden"
                >
                    <UploadSimple size={28} className="text-text-3" weight="duotone" />
                    <span className="text-xs text-text-3">Klik atau seret file ke sini</span>
                </button>
            </div>

            {/* Stats */}
            <div className="mb-6 flex flex-wrap gap-6 rounded-card border border-border bg-surface-1 px-5 py-4">
                <div>
                    <span className="block text-xs font-medium text-text-3">Total Media</span>
                    <span className="text-xl font-semibold text-text-1">{media.length}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-text-3">Gambar</span>
                    <span className="text-xl font-semibold text-success">{imageCount}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-text-3">Video</span>
                    <span className="text-xl font-semibold text-info">{videoCount}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-text-3">Total Ukuran</span>
                    <span className="text-xl font-semibold text-text-1">
                        {formatFileSize(media.reduce((sum, m) => sum + m.size, 0))}
                    </span>
                </div>
            </div>

            {/* Gallery */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center rounded-card border border-border bg-surface-1 py-16 text-text-3">
                    <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-text-3 border-t-transparent" />
                    <p className="mt-3 text-sm">Memuat media...</p>
                </div>
            ) : media.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-border-strong bg-surface-1 py-20 text-center">
                    <ImageIcon size={48} className="mb-4 text-text-3" weight="duotone" />
                    <p className="text-sm font-medium text-text-2">Belum ada media</p>
                    <p className="mt-1 text-xs text-text-3">Upload gambar atau video pertama Anda</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {media.map((item) => (
                        <div
                            key={item.id}
                            className="group overflow-hidden rounded-card border border-border bg-surface-1 transition-shadow hover:shadow-lvl-2 focus-within:shadow-lvl-2"
                        >
                            {/* Thumbnail */}
                            <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                className="relative block w-full overflow-hidden"
                                aria-label={`Preview ${item.filename}`}
                            >
                                {isVideo(item.mimeType) ? (
                                    <>
                                        <video
                                            src={item.url}
                                            muted
                                            preload="metadata"
                                            className="aspect-[4/3] h-full w-full object-cover"
                                            onLoadedMetadata={(e) => {
                                                const video = e.currentTarget;
                                                video.currentTime = 0.5;
                                            }}
                                        />
                                        {/* Play overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 transition-transform group-hover:scale-110">
                                                <VideoCamera size={20} className="text-white" weight="fill" />
                                            </div>
                                        </div>
                                        {/* Video badge */}
                                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-blue-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                            <VideoCamera size={10} />
                                            VIDEO
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Image
                                            src={item.url}
                                            alt={item.alt || item.filename}
                                            fill
                                            className="object-cover"
                                        />
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                                            <Eye size={24} className="text-white opacity-80" weight="duotone" />
                                        </div>
                                        {/* Image badge */}
                                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                            <ImageIcon size={10} />
                                            FOTO
                                        </span>
                                    </>
                                )}
                            </button>

                            {/* Info */}
                            <div className="p-3">
                                <p className="truncate text-xs font-medium text-text-1" title={item.filename}>
                                    {item.filename}
                                </p>
                                <p className="mb-3 text-[11px] text-text-3">
                                    {formatFileSize(item.size)} <span aria-hidden="true">·</span>{" "}
                                    {formatDistanceToNow(new Date(item.uploadedAt), { addSuffix: true, locale: localeId })}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewItem(item)}
                                        aria-label={`Preview ${item.filename}`}
                                        className="flex items-center gap-1 rounded-control border border-border bg-surface-2 px-2 py-1.5 text-[11px] font-medium text-text-2 hover:bg-surface-3 hover:text-text-1"
                                    >
                                        <Eye size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyUrl(item.url, item.id)}
                                        aria-label={`Salin URL ${item.filename}`}
                                        className="flex flex-1 items-center justify-center gap-1 rounded-control border border-border bg-surface-2 px-2 py-1.5 text-[11px] font-medium text-text-2 hover:bg-surface-3 hover:text-text-1"
                                    >
                                        {copiedId === item.id ? (
                                            <Check size={12} />
                                        ) : (
                                            <Copy size={12} />
                                        )}
                                        <span>URL</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item.id)}
                                        aria-label={`Hapus ${item.filename}`}
                                        className="flex items-center gap-1 rounded-control bg-danger/90 px-2 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-danger"
                                    >
                                        <Trash size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox preview — `bare` memakai perilaku dialog dari kit
                (portal, focus trap, Escape, kunci scroll) tanpa chrome panel.
                Sebelumnya overlay ini tidak bisa ditutup dengan Escape, tidak
                menahan fokus, dan halaman di belakangnya masih bisa di-scroll. */}
            <Modal
                open={!!previewItem}
                onClose={() => setPreviewItem(null)}
                title={previewItem ? `Pratinjau ${previewItem.filename}` : "Pratinjau media"}
                bare
                panelClassName="w-full max-w-[90vw]"
            >
                {previewItem && (
                    <div className="flex max-h-[85vh] w-full flex-col items-center">
                        {isVideo(previewItem.mimeType) ? (
                            <video
                                src={previewItem.url}
                                controls
                                autoPlay
                                className="max-h-[75vh] max-w-full bg-black"
                            />
                        ) : (
                            <Image
                                src={previewItem.url}
                                alt={previewItem.alt || previewItem.filename}
                                width={1200}
                                height={800}
                                className="max-h-[75vh] max-w-full object-contain"
                            />
                        )}

                        {/* Info bar. Latar lightbox selalu gelap terlepas dari
                            tema, jadi teks di sini memang putih — bukan token
                            text-*, yang akan jadi gelap di tema terang dan
                            hilang di atas hitam. */}
                        <div className="mt-4 flex w-full flex-wrap items-center gap-4 rounded-card border border-white/15 bg-white/10 px-5 py-3">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                {previewItem.filename}
                            </span>
                            <span className="mono text-sm text-white/70">
                                {formatFileSize(previewItem.size)}
                            </span>
                            <button
                                type="button"
                                onClick={() => copyUrl(previewItem.url, previewItem.id)}
                                aria-label="Salin URL media"
                                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-control bg-accent px-4 py-2 text-xs font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                            >
                                <Copy size={12} weight="bold" aria-hidden="true" />
                                Salin URL
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
            <ConfirmDialog />
        </div>
    );
}
