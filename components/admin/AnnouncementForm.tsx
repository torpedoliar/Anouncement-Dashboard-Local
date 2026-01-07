"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiSave, FiX, FiUpload, FiStar, FiMapPin, FiEye, FiClock, FiImage, FiVideo, FiYoutube, FiPlay, FiFolder } from "react-icons/fi";
import RichTextEditor from "./RichTextEditor";
import MediaPickerModal from "./MediaPickerModal";

interface Category {
    id: string;
    name: string;
    color: string;
}

interface AnnouncementFormProps {
    categories: Category[];
    initialData?: {
        id: string;
        title: string;
        content: string;
        categoryId: string;
        imagePath?: string | null;
        videoPath?: string | null;
        videoType?: string | null;
        youtubeUrl?: string | null;
        isHero: boolean;
        isPinned: boolean;
        isPublished: boolean;
        scheduledAt?: string | null;
        takedownAt?: string | null;
    };
}

type MediaType = "image" | "video" | "youtube";

export default function AnnouncementForm({ categories, initialData }: AnnouncementFormProps) {
    const router = useRouter();
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
    const [isHero, setIsHero] = useState(initialData?.isHero || false);
    const [isPinned, setIsPinned] = useState(initialData?.isPinned || false);
    const [isPublished, setIsPublished] = useState(initialData?.isPublished || false);
    const [scheduledAt, setScheduledAt] = useState(initialData?.scheduledAt || "");
    const [takedownAt, setTakedownAt] = useState(initialData?.takedownAt || "");

    const [imageUploading, setImageUploading] = useState(false);
    const [videoUploading, setVideoUploading] = useState(false);
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    const isEditing = !!initialData?.id;

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #262626',
        color: '#fff',
        fontSize: '14px',
        outline: 'none',
    };

    const labelStyle = {
        display: 'block',
        color: '#a3a3a3',
        fontSize: '13px',
        fontWeight: 500 as const,
        marginBottom: '8px',
    };

    const cardStyle = {
        backgroundColor: '#0a0a0a',
        border: '1px solid #1a1a1a',
        padding: '16px',
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageUploading(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

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

        // Validate file size (100MB max)
        if (file.size > 100 * 1024 * 1024) {
            setError("Ukuran video maksimal 100MB");
            return;
        }

        // Validate file type
        if (file.type !== "video/mp4") {
            setError("Format video harus MP4");
            return;
        }

        setVideoUploading(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/media", {
                method: "POST",
                body: formData,
            });

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

    // Extract YouTube video ID
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

        // Validate YouTube URL if selected
        if (mediaType === "youtube" && youtubeUrl && !extractYoutubeId(youtubeUrl)) {
            setError("URL YouTube tidak valid");
            setIsLoading(false);
            return;
        }

        try {
            const url = isEditing
                ? `/api/announcements/${initialData.id}`
                : "/api/announcements";

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    content,
                    categoryId,
                    imagePath: mediaType === "image" ? imagePath : null,
                    videoPath: mediaType === "video" ? videoPath : null,
                    videoType: mediaType === "youtube" ? "youtube" : (mediaType === "video" ? "upload" : null),
                    youtubeUrl: mediaType === "youtube" ? youtubeUrl : null,
                    isHero,
                    isPinned,
                    isPublished,
                    scheduledAt: scheduledAt || null,
                    takedownAt: takedownAt || null,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save");
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

    return (
        <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Error */}
                {error && (
                    <div style={{
                        padding: '16px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontSize: '14px',
                    }}>
                        {error}
                    </div>
                )}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr',
                    gap: '24px',
                }}>
                    {/* Main Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Title */}
                        <div>
                            <label style={labelStyle}>
                                Judul Pengumuman *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Masukkan judul pengumuman"
                                style={inputStyle}
                                required
                            />
                        </div>

                        {/* Content */}
                        <div>
                            <label style={labelStyle}>
                                Konten *
                            </label>
                            <RichTextEditor
                                content={content}
                                onChange={setContent}
                                placeholder="Tulis konten pengumuman..."
                            />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Category */}
                        <div style={cardStyle}>
                            <label style={labelStyle}>Kategori</label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                style={inputStyle}
                            >
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Media Upload - Image/Video/YouTube */}
                        <div style={cardStyle}>
                            <label style={labelStyle}>Media Cover</label>

                            {/* Media Type Toggle */}
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setMediaType("image")}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        backgroundColor: mediaType === "image" ? '#dc2626' : '#1a1a1a',
                                        color: mediaType === "image" ? '#fff' : '#737373',
                                        border: 'none',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <FiImage size={14} /> Gambar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMediaType("video")}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        backgroundColor: mediaType === "video" ? '#dc2626' : '#1a1a1a',
                                        color: mediaType === "video" ? '#fff' : '#737373',
                                        border: 'none',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <FiVideo size={14} /> Video
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMediaType("youtube")}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        backgroundColor: mediaType === "youtube" ? '#dc2626' : '#1a1a1a',
                                        color: mediaType === "youtube" ? '#fff' : '#737373',
                                        border: 'none',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <FiYoutube size={14} /> YouTube
                                </button>
                            </div>

                            {/* Image Upload */}
                            {mediaType === "image" && (
                                imagePath ? (
                                    <div style={{ position: 'relative' }}>
                                        <img
                                            src={imagePath}
                                            alt="Preview"
                                            style={{
                                                width: '100%',
                                                height: '128px',
                                                objectFit: 'cover',
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setImagePath("")}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                padding: '4px',
                                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                color: '#fff',
                                                border: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <FiX size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '100px',
                                            border: '2px dashed #333',
                                            cursor: 'pointer',
                                        }}>
                                            <FiImage size={24} color="#525252" style={{ marginBottom: '4px' }} />
                                            <span style={{ color: '#525252', fontSize: '12px' }}>
                                                {imageUploading ? "Uploading..." : "Upload gambar"}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                style={{ display: 'none' }}
                                                disabled={imageUploading}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowMediaPicker(true)}
                                            style={{
                                                padding: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                backgroundColor: '#1a1a1a',
                                                color: '#a3a3a3',
                                                border: '1px solid #333',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <FiFolder size={14} /> Media Library
                                        </button>
                                    </div>
                                )
                            )}

                            {/* Video Upload */}
                            {mediaType === "video" && (
                                videoPath ? (
                                    <div style={{ position: 'relative' }}>
                                        <video
                                            src={videoPath}
                                            style={{
                                                width: '100%',
                                                height: '128px',
                                                objectFit: 'cover',
                                                backgroundColor: '#000',
                                            }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'rgba(0,0,0,0.4)',
                                        }}>
                                            <FiPlay size={32} color="#fff" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setVideoPath("")}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                padding: '4px',
                                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                color: '#fff',
                                                border: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <FiX size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '128px',
                                        border: '2px dashed #333',
                                        cursor: videoUploading ? 'not-allowed' : 'pointer',
                                        opacity: videoUploading ? 0.6 : 1,
                                    }}>
                                        <FiVideo size={32} color="#525252" style={{ marginBottom: '8px' }} />
                                        <span style={{ color: '#525252', fontSize: '14px' }}>
                                            {videoUploading ? "Uploading video..." : "Klik untuk upload video"}
                                        </span>
                                        <span style={{ color: '#404040', fontSize: '11px', marginTop: '4px' }}>
                                            MP4, max 100MB
                                        </span>
                                        <input
                                            type="file"
                                            accept="video/mp4"
                                            onChange={handleVideoUpload}
                                            style={{ display: 'none' }}
                                            disabled={videoUploading}
                                        />
                                    </label>
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
                                        style={{ ...inputStyle, marginBottom: '8px' }}
                                    />
                                    {youtubeVideoId && (
                                        <div style={{
                                            position: 'relative',
                                            paddingBottom: '56.25%',
                                            height: 0,
                                            overflow: 'hidden',
                                            borderRadius: '4px',
                                        }}>
                                            <iframe
                                                src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    border: 'none',
                                                }}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    )}
                                    {!youtubeVideoId && youtubeUrl && (
                                        <p style={{ color: '#ef4444', fontSize: '12px' }}>
                                            URL YouTube tidak valid
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Options */}
                        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h4 style={{ color: '#fff', fontWeight: 500 }}>Opsi</h4>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isPublished}
                                    onChange={(e) => setIsPublished(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                                />
                                <FiEye size={16} color="#22c55e" />
                                <span style={{ color: '#a3a3a3', fontSize: '14px' }}>Publish</span>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isPinned}
                                    onChange={(e) => setIsPinned(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                                />
                                <FiMapPin size={16} color="#dc2626" />
                                <span style={{ color: '#a3a3a3', fontSize: '14px' }}>Pin di atas</span>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isHero}
                                    onChange={(e) => setIsHero(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                                />
                                <FiStar size={16} color="#eab308" />
                                <span style={{ color: '#a3a3a3', fontSize: '14px' }}>Tampilkan di Hero</span>
                            </label>
                        </div>

                        {/* Scheduled Publish */}
                        <div style={cardStyle}>
                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiClock size={14} color="#22c55e" />
                                Jadwalkan Publish
                            </label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                style={inputStyle}
                            />
                            <p style={{ color: '#525252', fontSize: '11px', marginTop: '4px' }}>
                                Kosongkan jika ingin publish manual
                            </p>
                        </div>

                        {/* Scheduled Takedown */}
                        <div style={cardStyle}>
                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiClock size={14} color="#ef4444" />
                                Jadwalkan Takedown
                            </label>
                            <input
                                type="datetime-local"
                                value={takedownAt}
                                onChange={(e) => setTakedownAt(e.target.value)}
                                style={inputStyle}
                            />
                            <p style={{ color: '#525252', fontSize: '11px', marginTop: '4px' }}>
                                Kosongkan jika tidak ingin auto-takedown
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    paddingTop: '24px',
                    borderTop: '1px solid #1a1a1a',
                }}>
                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.5 : 1,
                        }}
                    >
                        <FiSave size={16} />
                        {isLoading ? "Menyimpan..." : isEditing ? "Perbarui" : "Simpan"}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: 'transparent',
                            color: '#737373',
                            fontSize: '13px',
                            fontWeight: 600,
                            border: '1px solid #333',
                            cursor: 'pointer',
                        }}
                    >
                        Batal
                    </button>
                </div>
            </form>

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
        </>
    );
}
