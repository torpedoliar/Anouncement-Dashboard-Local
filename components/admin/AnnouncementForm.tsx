"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, YoutubeLogo, Image as ImageIcon, VideoCamera, FolderOpen, Play, Eye, Clock, Star, X, UploadSimple, ChatCenteredText } from "@phosphor-icons/react";
import RichTextEditor from "./RichTextEditor";
import MediaPickerModal from "./MediaPickerModal";
import SiteSyndicationPicker, { SiteAssoc } from "./SiteSyndicationPicker";
import AnnouncementPreview from "./AnnouncementPreview";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { deriveAnnouncementStatus } from "@/lib/announcement-status";

interface Category {
    id: string;
    name: string;
    color: string;
}

interface AnnouncementFormProps {
    categories: Category[];
    /** Current admin site context — used to pre-select the site for new articles. */
    defaultSiteId?: string | null;
    initialData?: {
        id: string;
        title: string;
        content: string;
        categoryId: string;
        imagePath?: string | null;
        videoPath?: string | null;
        videoType?: string | null;
        youtubeUrl?: string | null;
        isPublished: boolean;
        allowComments?: boolean;
        scheduledAt?: string | null;
        takedownAt?: string | null;
        sites?: { siteId: string; isPrimary: boolean; isHero: boolean; isPinned: boolean }[];
    };
}

type MediaType = "image" | "video" | "youtube";

export default function AnnouncementForm({ categories, defaultSiteId, initialData }: AnnouncementFormProps) {
    const router = useRouter();
    const { theme, siteName: currentSiteName } = useSiteTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [title, setTitle] = useState(initialData?.title || "");
    const [content, setContent] = useState(initialData?.content || "");
    const [categoryId, setCategoryId] = useState(initialData?.categoryId || categories[0]?.id || "");
    const [imagePath, setImagePath] = useState(initialData?.imagePath || "");
    const [videoPath, setVideoPath] = useState(initialData?.videoPath || "");
    const [youtubeUrl, setYoutubeUrl] = useState(initialData?.youtubeUrl || "");
    const [mediaType, setMediaType] = useState<MediaType>(
        initialData?.videoType === "youtube" ? "youtube" :
            initialData?.videoPath ? "video" : "image"
    );
    const [isPublished, setIsPublished] = useState(initialData?.isPublished || false);
    const [allowComments, setAllowComments] = useState(initialData?.allowComments ?? true);
    const [scheduledAt, setScheduledAt] = useState(initialData?.scheduledAt || "");
    const [takedownAt, setTakedownAt] = useState(initialData?.takedownAt || "");

    // Multi-site syndication state with per-site Primary / Hero / Pin flags
    const [siteAssocs, setSiteAssocs] = useState<SiteAssoc[]>(
        initialData?.sites?.map(s => ({
            siteId: s.siteId,
            isPrimary: s.isPrimary,
            isHero: s.isHero,
            isPinned: s.isPinned,
        })) || []
    );

    const [imageUploading, setImageUploading] = useState(false);
    const [videoUploading, setVideoUploading] = useState(false);
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    const isEditing = !!initialData?.id;

    // Draft state
    const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
    const [pendingDraft, setPendingDraft] = useState<{ content: string; updatedAt: string } | null>(null);
    const lastSavedContent = useRef<string>(initialData?.content || "");

    // Derive status for display
    const status = deriveAnnouncementStatus({
        isPublished,
        scheduledAt: scheduledAt || undefined,
        takedownAt: takedownAt || undefined,
    });

    // Status label map
    const statusLabel = {
        draft: "Draf",
        scheduled: "Terjadwal",
        published: "Terbit sekarang",
        "taken-down": "Sudah ditarik",
    } as const;

    // Word count & reading time
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const readingTime = content.trim() ? Math.max(1, Math.ceil(wordCount / 200)) : 0;

    // On open: detect unsaved draft
    useEffect(() => {
        if (!isEditing || !initialData?.id) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/announcements/${initialData.id}/draft`);
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                if (data.hasDraft && data.draftContent && data.draftContent !== data.content) {
                    setPendingDraft({ content: data.draftContent, updatedAt: data.draftUpdatedAt });
                }
            } catch {
                // Non-critical
            }
        })();
        return () => { cancelled = true; };
    }, [isEditing, initialData?.id]);

    // Debounced autosave
    useEffect(() => {
        if (!isEditing || !initialData?.id) return;
        if (content === lastSavedContent.current) return;

        const handle = setTimeout(async () => {
            try {
                setDraftStatus("saving");
                const res = await fetch(`/api/announcements/${initialData.id}/draft`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ draftContent: content }),
                });
                if (res.ok) {
                    lastSavedContent.current = content;
                    setDraftStatus("saved");
                    setDraftSavedAt(new Date());
                } else {
                    setDraftStatus("idle");
                }
            } catch {
                setDraftStatus("idle");
            }
        }, 3000);

        return () => clearTimeout(handle);
    }, [content, isEditing, initialData?.id]);

    const restoreDraft = () => {
        if (pendingDraft) {
            setContent(pendingDraft.content);
            setPendingDraft(null);
        }
    };

    const discardDraft = async () => {
        setPendingDraft(null);
        if (initialData?.id) {
            try {
                await fetch(`/api/announcements/${initialData.id}/draft`, { method: "DELETE" });
            } catch { /* non-critical */ }
        }
    };

    // --- Media handlers (unchanged) ---
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageUploading(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/upload", { method: "POST", body: formData });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Upload failed");
            }
            const data = await response.json();
            setImagePath(data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setImageUploading(false);
        }
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 100 * 1024 * 1024) {
            setError("Ukuran video maksimal 100MB");
            return;
        }
        if (file.type !== "video/mp4") {
            setError("Format video harus MP4");
            return;
        }
        setVideoUploading(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/media", { method: "POST", body: formData });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Upload failed");
            }
            const data = await response.json();
            setVideoPath(data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload video failed");
        } finally {
            setVideoUploading(false);
        }
    };

    const extractYoutubeId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        if (mediaType === "youtube" && youtubeUrl && !extractYoutubeId(youtubeUrl)) {
            setError("URL YouTube tidak valid");
            setIsLoading(false);
            return;
        }

        if (siteAssocs.length === 0) {
            setError("Pilih minimal satu site untuk publish");
            setIsLoading(false);
            return;
        }

        try {
            // datetime-local inputs yield "YYYY-MM-DDTHH:mm" (no timezone), which
            // fails the API's Zod .datetime() check — normalize to ISO-8601 safely.
            const normalizeDateTime = (v: string) => {
                if (!v || !v.trim()) return null;
                const d = new Date(v);
                return isNaN(d.getTime()) ? null : d.toISOString();
            };

            const cleanString = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

            const url = isEditing
                ? `/api/announcements/${initialData.id}`
                : "/api/announcements";

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    content,
                    categoryId,
                    imagePath: mediaType === "image" ? cleanString(imagePath) : null,
                    videoPath: mediaType === "video" ? cleanString(videoPath) : null,
                    videoType: mediaType === "youtube" ? "youtube" : (mediaType === "video" ? "upload" : null),
                    youtubeUrl: mediaType === "youtube" ? cleanString(youtubeUrl) : null,
                    isPublished,
                    allowComments,
                    scheduledAt: normalizeDateTime(scheduledAt),
                    takedownAt: normalizeDateTime(takedownAt),
                    sites: siteAssocs,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save");
            }

            if (isEditing && initialData?.id) {
                lastSavedContent.current = content;
                fetch(`/api/announcements/${initialData.id}/draft`, { method: "DELETE" }).catch(() => {});
            }

            router.push("/admin/announcements");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsLoading(false);
        }
    };

    const youtubeVideoId = extractYoutubeId(youtubeUrl);

    // Build media preview object for the preview panel
    const previewMedia =
        mediaType === "image"
            ? { type: "image" as const, url: imagePath || null }
            : mediaType === "video"
                ? { type: "video" as const, url: videoPath || null }
                : { type: "youtube" as const, url: youtubeUrl || null };

    const selectedCategory = categories.find(c => c.id === categoryId);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Error banner */}
            {error && (
                <div
                    className="rounded-card p-4 text-sm"
                    style={{ background: "var(--color-danger-subtle)", border: "1px solid var(--color-danger)" }}
                >
                    {error}
                </div>
            )}

            {/* Unsaved draft restore banner */}
            {pendingDraft && (
                <div
                    className="flex items-center justify-between gap-4 rounded-card p-3.5 text-sm"
                    style={{
                        background: "var(--color-warning-subtle)",
                        border: "1px solid rgba(234,179,8,0.4)",
                        color: "var(--color-warning)",
                        flexWrap: "wrap",
                    }}
                >
                    <span>
                        Ditemukan draft otomatis yang belum disimpan
                        {pendingDraft.updatedAt && ` (${new Date(pendingDraft.updatedAt).toLocaleString("id-ID")})`}.
                    </span>
                    <span className="flex gap-2 shrink-0">
                        <button type="button" onClick={restoreDraft}
                            className="rounded-control px-3 py-1.5 text-xs font-semibold cursor-pointer"
                            style={{ background: "var(--color-warning)", color: "var(--surface-0)" }}
                        >Pulihkan</button>
                        <button type="button" onClick={discardDraft}
                            className="rounded-control border px-3 py-1.5 text-xs cursor-pointer"
                            style={{
                                background: "transparent",
                                color: "var(--color-warning)",
                                borderColor: "rgba(234,179,8,0.4)",
                            }}
                        >Abaikan</button>
                    </span>
                </div>
            )}

            {/* Autosave indicator */}
            {isEditing && draftStatus !== "idle" && (
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    {draftStatus === "saving"
                        ? "Menyimpan draft..."
                        : draftSavedAt
                            ? `Draft tersimpan otomatis ${draftSavedAt.toLocaleTimeString("id-ID")}`
                            : ""}
                </p>
            )}

            {/* ── Publish status bar (top) ── */}
            <div
                className="flex flex-wrap items-center gap-3 rounded-card p-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                    Status
                </span>
                <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                        background: status === "published"
                            ? "var(--color-success-subtle)"
                            : status === "scheduled"
                                ? "var(--color-warning-subtle)"
                                : "var(--color-info-subtle)",
                        color: status === "published"
                            ? "var(--color-success)"
                            : status === "scheduled"
                                ? "var(--color-warning)"
                                : "var(--color-info)",
                    }}
                >
                    <Check size={12} weight="bold" />
                    {statusLabel[status]}
                </span>

                <label className="flex items-center gap-2.5 cursor-pointer" aria-label="Publish">
                    <input
                        type="checkbox"
                        checked={isPublished}
                        onChange={(e) => setIsPublished(e.target.checked)}
                        className="size-4 accent-[var(--brand-red)]"
                    />
                    <Eye size={16} weight="fill" className="text-success" />
                    <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Publish</span>
                </label>

                <div className="flex items-center gap-2">
                    <label htmlFor="scheduledAt" className="text-xs" style={{ color: "var(--text-3)" }}>
                        <Clock size={12} weight="fill" className="inline mr-1 text-success" />
                        Terjadwal
                    </label>
                    <input
                        id="scheduledAt"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="rounded-control border px-2 py-1 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                        style={{ background: "var(--surface-0)", borderColor: "var(--border)", color: "var(--text-1)" }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="takedownAt" className="text-xs" style={{ color: "var(--text-3)" }}>
                        <Clock size={12} weight="fill" className="inline mr-1 text-danger" />
                        Takedown
                    </label>
                    <input
                        id="takedownAt"
                        type="datetime-local"
                        value={takedownAt}
                        onChange={(e) => setTakedownAt(e.target.value)}
                        className="rounded-control border px-2 py-1 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                        style={{ background: "var(--surface-0)", borderColor: "var(--border)", color: "var(--text-1)" }}
                    />
                </div>

                {siteAssocs.length > 0 && (
                    <span className="ml-auto text-xs" style={{ color: "var(--text-3)" }}>
                        <Star size={11} weight="fill" className="inline mr-1 text-warning" />
                        {siteAssocs.some(s => s.isPrimary) && "Primary"} · {siteAssocs.filter(s => s.isHero).length} hero · {siteAssocs.filter(s => s.isPinned).length} pin · {siteAssocs.length} site
                    </span>
                )}
            </div>

            {/* ── Two-pane layout ── */}
            <div className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
                {/* LEFT: fields */}
                <div className="flex flex-col gap-5">
                    {/* Title */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                            Judul Pengumuman *
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Masukkan judul pengumuman"
                            required
                            className="w-full rounded-control border px-4 py-3 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                            style={{
                                background: "var(--surface-0)",
                                borderColor: "var(--border)",
                                color: "var(--text-1)",
                            }}
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                            Konten *
                        </label>
                        <RichTextEditor content={content} onChange={setContent} placeholder="Tulis konten pengumuman..." />
                        {/* Word count / reading time */}
                        {content.trim() && (
                            <p className="mt-1.5 mono text-xs" style={{ color: "var(--text-3)" }}>
                                {wordCount} kata · {readingTime} min baca
                            </p>
                        )}
                    </div>

                    {/* Options (allow comments) */}
                    <div
                        className="flex items-center gap-3 rounded-card p-4"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                        <label htmlFor="allowComments" className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                id="allowComments"
                                type="checkbox"
                                checked={allowComments}
                                onChange={(e) => setAllowComments(e.target.checked)}
                                className="size-4 accent-[var(--brand-red)]"
                            />
                            <ChatCenteredText size={16} weight="fill" className="text-info" />
                            <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Izinkan Komentar</span>
                        </label>
                    </div>

                    {/* Category + Site Syndication */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-card p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                            <label htmlFor="categoryId" className="block text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
                                Kategori
                            </label>
                            <select
                                id="categoryId"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full rounded-control border px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                                style={{
                                    background: "var(--surface-0)",
                                    borderColor: "var(--border)",
                                    color: "var(--text-1)",
                                }}
                            >
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="rounded-card p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                            <SiteSyndicationPicker
                                value={siteAssocs}
                                defaultSiteId={defaultSiteId}
                                onChange={setSiteAssocs}
                            />
                        </div>
                    </div>

                    {/* Media cover */}
                    <div className="rounded-card p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <label className="block text-sm font-medium mb-3" style={{ color: "var(--text-2)" }}>
                            Media Cover
                        </label>

                        {/* Media type toggle */}
                        <div className="flex gap-1 mb-4">
                            {([
                                { type: "image" as const, icon: ImageIcon, label: "Gambar" },
                                { type: "video" as const, icon: VideoCamera, label: "Video" },
                                { type: "youtube" as const, icon: YoutubeLogo, label: "YouTube" },
                            ] as const).map(({ type, icon: Icon, label }) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setMediaType(type)}
                                    aria-pressed={mediaType === type}
                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-control py-2 px-2 text-xs font-semibold transition-colors duration-150 cursor-pointer"
                                    style={{
                                        background: mediaType === type ? "var(--brand-red)" : "var(--surface-3)",
                                        color: mediaType === type ? "var(--text-1)" : "var(--text-3)",
                                    }}
                                >
                                    <Icon size={14} /> {label}
                                </button>
                            ))}
                        </div>

                        {/* Image upload/preview */}
                        {mediaType === "image" && (
                            imagePath ? (
                                <div className="relative">
                                    <img
                                        src={imagePath}
                                        alt="Preview"
                                        className="w-full h-32 object-cover rounded-card"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setImagePath("")}
                                        className="absolute top-2 right-2 size-6 rounded-full flex items-center justify-center cursor-pointer"
                                        style={{ background: "rgba(0,0,0,0.8)", color: "var(--text-1)" }}
                                        aria-label="Hapus gambar"
                                    >
                                        <X size={14} weight="bold" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <label
                                        className="flex flex-col items-center justify-center h-28 border-2 border-dashed cursor-pointer rounded-card transition-colors duration-150 hover:border-[var(--text-3)]"
                                        style={{ borderColor: "var(--border-strong)" }}
                                        role="button"
                                        aria-label="Upload gambar"
                                    >
                                        <UploadSimple size={24} className="mb-1" style={{ color: "var(--text-3)" }} />
                                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                                            {imageUploading ? "Uploading..." : "Upload gambar"}
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            disabled={imageUploading}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowMediaPicker(true)}
                                        className="flex items-center justify-center gap-1.5 rounded-control border py-2 px-3 text-xs cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-3)]"
                                        style={{
                                            background: "var(--surface-3)",
                                            borderColor: "var(--border-strong)",
                                            color: "var(--text-2)",
                                        }}
                                    >
                                        <FolderOpen size={14} /> Media Library
                                    </button>
                                </div>
                            )
                        )}

                        {/* Video upload/preview */}
                        {mediaType === "video" && (
                            videoPath ? (
                                <div className="relative">
                                    <video
                                        src={videoPath}
                                        className="w-full h-32 object-cover rounded-card"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
                                        <Play size={32} weight="fill" color="#fff" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setVideoPath("")}
                                        className="absolute top-2 right-2 size-6 rounded-full flex items-center justify-center cursor-pointer"
                                        style={{ background: "rgba(0,0,0,0.8)", color: "var(--text-1)" }}
                                        aria-label="Hapus video"
                                    >
                                        <X size={14} weight="bold" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <label
                                        className="flex flex-col items-center justify-center h-32 border-2 border-dashed cursor-pointer rounded-card transition-colors duration-150 hover:border-[var(--text-3)]"
                                        style={{ borderColor: "var(--border-strong)" }}
                                        role="button"
                                        aria-label="Upload video MP4, maksimal 100MB"
                                    >
                                        <VideoCamera size={32} className="mb-2" style={{ color: "var(--text-3)" }} />
                                        <span className="text-sm" style={{ color: "var(--text-3)" }}>
                                            {videoUploading ? "Uploading video..." : "Klik untuk upload video"}
                                        </span>
                                        <span className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                                            MP4, max 100MB
                                        </span>
                                        <input
                                            type="file"
                                            accept="video/mp4"
                                            onChange={handleVideoUpload}
                                            className="hidden"
                                            disabled={videoUploading}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowMediaPicker(true)}
                                        className="flex items-center justify-center gap-1.5 rounded-control border py-2 px-3 text-xs cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-3)]"
                                        style={{
                                            background: "var(--surface-3)",
                                            borderColor: "var(--border-strong)",
                                            color: "var(--text-2)",
                                        }}
                                    >
                                        <FolderOpen size={14} /> Media Library
                                    </button>
                                </div>
                            )
                        )}

                        {/* YouTube URL */}
                        {mediaType === "youtube" && (
                            <div>
                                <input
                                    type="text"
                                    placeholder="https://youtube.com/watch?v=..."
                                    value={youtubeUrl}
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                    className="w-full rounded-control border px-4 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                                    style={{
                                        background: "var(--surface-0)",
                                        borderColor: "var(--border)",
                                        color: "var(--text-1)",
                                        marginBottom: "8px",
                                    }}
                                />
                                {youtubeVideoId && (
                                    <div className="relative" style={{ paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "6px" }}>
                                        <iframe
                                            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                                            className="absolute inset-0 size-full"
                                            style={{ border: 0 }}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            title="YouTube embed"
                                        />
                                    </div>
                                )}
                                {!youtubeVideoId && youtubeUrl && (
                                    <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                                        URL YouTube tidak valid
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: "var(--surface-2)" }}>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 rounded-control px-6 py-3 text-sm font-semibold cursor-pointer transition-opacity duration-150"
                            style={{
                                background: "var(--brand-red)",
                                color: "var(--text-1)",
                                opacity: isLoading ? 0.5 : 1,
                            }}
                        >
                            <UploadSimple size={16} weight="bold" />
                            {isLoading ? "Menyimpan..." : isEditing ? "Perbarui" : "Simpan"}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="rounded-control border px-6 py-3 text-sm font-semibold cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-3)]"
                            style={{
                                background: "transparent",
                                color: "var(--text-3)",
                                borderColor: "var(--border-strong)",
                            }}
                        >
                            Batal
                        </button>
                    </div>
                </div>

                {/* RIGHT: live preview (sticky on desktop) */}
                <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start lg:pt-1">
                    <AnnouncementPreview
                        title={title}
                        content={content}
                        category={selectedCategory?.name}
                        media={previewMedia}
                        siteName={currentSiteName}
                        primaryColor={theme.primaryColor}
                    />
                </div>
            </div>

            {/* Mobile preview — stacks below */}
            <div className="lg:hidden">
                <AnnouncementPreview
                    title={title}
                    content={content}
                    category={selectedCategory?.name}
                    media={previewMedia}
                    siteName={currentSiteName}
                    primaryColor={theme.primaryColor}
                />
            </div>

            {/* Media Picker Modal */}
            <MediaPickerModal
                isOpen={showMediaPicker}
                onClose={() => setShowMediaPicker(false)}
                onSelect={(url, type) => {
                    if (type === "video") {
                        setMediaType("video");
                        setVideoPath(url);
                    } else {
                        setMediaType("image");
                        setImagePath(url);
                    }
                    setShowMediaPicker(false);
                }}
                mediaType={mediaType === "youtube" ? "all" : mediaType}
            />
        </form>
    );
}
