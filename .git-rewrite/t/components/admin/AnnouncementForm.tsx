"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiSave, FiX, FiUpload, FiStar, FiMapPin, FiEye, FiClock } from "react-icons/fi";
import RichTextEditor from "./RichTextEditor";

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
        isHero: boolean;
        isPinned: boolean;
        isPublished: boolean;
        scheduledAt?: string | null;
    };
}

export default function AnnouncementForm({ categories, initialData }: AnnouncementFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [title, setTitle] = useState(initialData?.title || "");
    const [content, setContent] = useState(initialData?.content || "");
    const [categoryId, setCategoryId] = useState(initialData?.categoryId || categories[0]?.id || "");
    const [imagePath, setImagePath] = useState(initialData?.imagePath || "");
    const [isHero, setIsHero] = useState(initialData?.isHero || false);
    const [isPinned, setIsPinned] = useState(initialData?.isPinned || false);
    const [isPublished, setIsPublished] = useState(initialData?.isPublished || false);
    const [scheduledAt, setScheduledAt] = useState(initialData?.scheduledAt || "");

    const [imageUploading, setImageUploading] = useState(false);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

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
                    imagePath: imagePath || null,
                    isHero,
                    isPinned,
                    isPublished,
                    scheduledAt: scheduledAt || null,
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

    return (
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

                    {/* Image Upload */}
                    <div style={cardStyle}>
                        <label style={labelStyle}>Gambar</label>
                        {imagePath ? (
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
                            <label style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '128px',
                                border: '2px dashed #333',
                                cursor: 'pointer',
                            }}>
                                <FiUpload size={32} color="#525252" style={{ marginBottom: '8px' }} />
                                <span style={{ color: '#525252', fontSize: '14px' }}>
                                    {imageUploading ? "Uploading..." : "Klik untuk upload"}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                    disabled={imageUploading}
                                />
                            </label>
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

                    {/* Scheduled */}
                    <div style={cardStyle}>
                        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiClock size={14} />
                            Jadwalkan Publish
                        </label>
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            style={inputStyle}
                        />
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
    );
}
