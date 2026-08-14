"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, FloppyDisk, Layout, ShareNetwork, ChatCircleText, Check, X, UploadSimple } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Image from "next/image";

interface SiteSettings {
    id: string;
    siteId: string;
    siteName: string; // From Site model
    logoPath: string | null; // From Site model
    primaryColor: string; // From Site model
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string | null;
    aboutText: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    twitterUrl: string | null;
    linkedinUrl: string | null;
    youtubeUrl: string | null;
    commentAutoApprove: boolean;
    commentRequireEmail: boolean;
}

export default function SiteSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'social' | 'comments'>('general');
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Clear message after 3 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Initial fetch
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch(`/api/sites/${params.id}/settings`);
                if (!response.ok) throw new Error("Failed to fetch settings");
                const data = await response.json();
                setSettings(data);
            } catch (error) {
                console.error(error);
                setMessage({ type: 'error', text: 'Gagal memuat pengaturan site' });
            } finally {
                setIsLoading(false);
            }
        };

        if (params.id) {
            fetchSettings();
        }
    }, [params.id]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'heroImage' | 'logoPath') => {
        const file = e.target.files?.[0];
        if (!file || !settings) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();
            setSettings({ ...settings, [field]: data.url });
            setMessage({ type: 'success', text: 'Gambar berhasil diupload' });
        } catch (error) {
            console.error("Error uploading image:", error);
            setMessage({ type: 'error', text: "Gagal mengupload gambar" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);

        try {
            const response = await fetch(`/api/sites/${params.id}/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (!response.ok) throw new Error("Failed to save settings");

            setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan' });
            router.refresh();
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <div className="spinner" />
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="mx-auto max-w-[1000px] p-8">
            {/* Toast Notification */}
            {message && (
                <div
                    className={`fixed right-6 top-6 z-[9999] flex items-center gap-2 rounded-card px-5 py-3 text-sm font-medium text-white shadow-lvl-2 ${
                        message.type === 'success' ? 'bg-success' : 'bg-danger'
                    }`}
                    role="status"
                >
                    {message.type === 'success' ? <Check size={16} weight="bold" /> : <X size={16} weight="bold" />}
                    {message.text}
                </div>
            )}

            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.back()}
                    className="mb-4 inline-flex items-center gap-2 text-[13px] text-text-2 transition-colors duration-150 hover:text-text-1"
                >
                    <ArrowLeft size={16} /> Kembali
                </button>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="mb-2 font-display text-2xl font-semibold text-text-1">
                            Pengaturan Site
                        </h1>
                        <p className="text-text-3">
                            Konfigurasi tampilan dan fitur untuk site ini
                        </p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        iconLeft={!isSaving ? <FloppyDisk size={14} weight="bold" /> : undefined}
                    >
                        {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-8 flex gap-6 border-b border-border">
                {[
                    { id: 'general', label: 'Umum', icon: Layout },
                    { id: 'social', label: 'Media Sosial', icon: ShareNetwork },
                    { id: 'comments', label: 'Komentar', icon: ChatCircleText },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={
                            activeTab === tab.id
                                ? "-mb-px flex items-center gap-2 border-b-2 border-accent p-3 font-semibold text-text-1"
                                : "-mb-px flex items-center gap-2 border-b-2 border-transparent p-3 font-medium text-text-2 transition-colors duration-150 hover:text-text-1"
                        }
                    >
                        <tab.icon size={16} weight={activeTab === tab.id ? "fill" : "regular"} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="rounded-card border border-border bg-surface-2 p-6">
                {/* General Tab */}
                {activeTab === 'general' && (
                    <div className="flex flex-col gap-6">

                        {/* Site Branding */}
                        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                            <div>
                                <label className="mb-2 block text-[13px] text-text-2">
                                    Nama Situs
                                </label>
                                <input
                                    type="text"
                                    value={settings.siteName || ''}
                                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                                    className="w-full rounded-control border border-border bg-surface-1 px-3 py-3 text-sm text-text-1 placeholder:text-text-3"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-[13px] text-text-2">
                                    Warna Utama
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="color"
                                        value={settings.primaryColor || '#dc2626'}
                                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                        className="h-[45px] w-12 cursor-pointer rounded-control border-none bg-transparent p-0"
                                    />
                                    <input
                                        type="text"
                                        value={settings.primaryColor || '#dc2626'}
                                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                        className="flex-1 rounded-control border border-border bg-surface-1 px-3 py-3 text-sm text-text-1 placeholder:text-text-3"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Logo Upload */}
                        <div>
                            <label className="mb-2 block text-[13px] text-text-2">
                                Logo Perusahaan
                            </label>
                            {settings.logoPath ? (
                                <div className="relative h-[120px] w-[120px] overflow-hidden rounded-card border border-border bg-surface-0">
                                    <Image
                                        src={settings.logoPath}
                                        alt="Logo"
                                        fill
                                        className="object-contain p-2.5"
                                    />
                                    <button
                                        onClick={() => setSettings({ ...settings, logoPath: null })}
                                        aria-label="Hapus logo"
                                        className="absolute right-1 top-1 rounded-control bg-accent p-1 text-white transition-opacity duration-150 hover:opacity-90"
                                    >
                                        <X size={12} weight="bold" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex h-[120px] w-[120px] cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-1 transition-colors duration-150 hover:bg-surface-2">
                                    <UploadSimple size={24} className="mb-2 text-text-3" />
                                    <span className="text-[11px] text-text-3">Upload Logo</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, "logoPath")}
                                        className="hidden"
                                    />
                                </label>
                            )}
                            <p className="mt-2 text-xs text-text-3">
                                Format: PNG, JPG, GIF (max 2MB). Disarankan background transparan.
                            </p>
                        </div>

                        <div className="my-6 h-px bg-border"></div>

                        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                            <div>
                                <label className="mb-2 block text-[13px] text-text-2">
                                    Hero Title
                                </label>
                                <input
                                    type="text"
                                    value={settings.heroTitle}
                                    onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                                    className="w-full rounded-control border border-border bg-surface-1 px-3 py-3 text-sm text-text-1 placeholder:text-text-3"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-[13px] text-text-2">
                                    Hero Subtitle
                                </label>
                                <input
                                    type="text"
                                    value={settings.heroSubtitle}
                                    onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                                    className="w-full rounded-control border border-border bg-surface-1 px-3 py-3 text-sm text-text-1 placeholder:text-text-3"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-[13px] text-text-2">
                                About Text / Footer Text
                            </label>
                            <textarea
                                value={settings.aboutText || ''}
                                onChange={(e) => setSettings({ ...settings, aboutText: e.target.value })}
                                rows={4}
                                className="w-full min-h-[120px] resize-y rounded-control border border-border bg-surface-1 px-3 py-3 text-sm text-text-1 placeholder:text-text-3"
                            />
                        </div>
                    </div>
                )}

                {/* Social Media Tab */}
                {activeTab === 'social' && (
                    <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                        {[
                            { key: 'instagramUrl', label: 'Instagram URL' },
                            { key: 'facebookUrl', label: 'Facebook URL' },
                            { key: 'twitterUrl', label: 'Twitter / X URL' },
                            { key: 'linkedinUrl', label: 'LinkedIn URL' },
                            { key: 'youtubeUrl', label: 'YouTube URL' },
                        ].map((field) => (
                            <div key={field.key}>
                                <label className="mb-2 block text-[13px] text-text-2">
                                    {field.label}
                                </label>
                                <input
                                    type="url"
                                    value={(settings as any)[field.key] || ''}
                                    onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full rounded-control border border-border bg-surface-1 px-3 py-3 text-sm text-text-1 placeholder:text-text-3"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Comments Tab */}
                {activeTab === 'comments' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-1 p-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-text-1">
                                    Auto Approve Komentar
                                </h3>
                                <p className="max-w-[400px] text-xs text-text-3">
                                    Jika aktif, komentar akan langsung muncul tanpa perlu persetujuan admin.
                                </p>
                            </div>
                            <div className="relative inline-block h-6 w-12 shrink-0">
                                <input
                                    type="checkbox"
                                    checked={settings.commentAutoApprove}
                                    onChange={(e) => setSettings({ ...settings, commentAutoApprove: e.target.checked })}
                                    className="h-0 w-0 opacity-0"
                                    id="auto-approve-toggle"
                                />
                                <label
                                    htmlFor="auto-approve-toggle"
                                    className={
                                        settings.commentAutoApprove
                                            ? "absolute inset-0 cursor-pointer rounded-full bg-accent transition-colors duration-300"
                                            : "absolute inset-0 cursor-pointer rounded-full bg-border transition-colors duration-300"
                                    }
                                >
                                    <span
                                        className={
                                            settings.commentAutoApprove
                                                ? "absolute bottom-[3px] left-[26px] h-[18px] w-[18px] rounded-full bg-white transition-all duration-300"
                                                : "absolute bottom-[3px] left-1 h-[18px] w-[18px] rounded-full bg-white transition-all duration-300"
                                        }
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-1 p-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-text-1">
                                    Wajib Email
                                </h3>
                                <p className="max-w-[400px] text-xs text-text-3">
                                    Pengunjung harus mengisi alamat email saat berkomentar.
                                </p>
                            </div>
                            <div className="relative inline-block h-6 w-12 shrink-0">
                                <input
                                    type="checkbox"
                                    checked={settings.commentRequireEmail}
                                    onChange={(e) => setSettings({ ...settings, commentRequireEmail: e.target.checked })}
                                    className="h-0 w-0 opacity-0"
                                    id="require-email-toggle"
                                />
                                <label
                                    htmlFor="require-email-toggle"
                                    className={
                                        settings.commentRequireEmail
                                            ? "absolute inset-0 cursor-pointer rounded-full bg-accent transition-colors duration-300"
                                            : "absolute inset-0 cursor-pointer rounded-full bg-border transition-colors duration-300"
                                    }
                                >
                                    <span
                                        className={
                                            settings.commentRequireEmail
                                                ? "absolute bottom-[3px] left-[26px] h-[18px] w-[18px] rounded-full bg-white transition-all duration-300"
                                                : "absolute bottom-[3px] left-1 h-[18px] w-[18px] rounded-full bg-white transition-all duration-300"
                                        }
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
