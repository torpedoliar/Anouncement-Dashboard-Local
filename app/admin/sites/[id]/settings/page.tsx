"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiSave, FiArrowLeft, FiGlobe, FiLayout, FiShare2, FiMessageSquare, FiCheck, FiX, FiUpload, FiTrash2 } from "react-icons/fi";
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
            <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Toast Notification */}
            {message && (
                <div style={{
                    position: 'fixed',
                    top: '24px',
                    right: '24px',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    backgroundColor: message.type === 'success' ? '#22c55e' : '#ef4444',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 9999,
                    fontSize: '14px',
                    fontWeight: 500,
                }}>
                    {message.type === 'success' ? <FiCheck /> : <FiX />}
                    {message.text}
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#a3a3a3',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        marginBottom: '16px',
                    }}
                >
                    <FiArrowLeft /> Kembali
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                            Pengaturan Site
                        </h1>
                        <p style={{ color: '#a3a3a3', fontSize: '14px' }}>
                            Konfigurasi tampilan dan fitur untuk site ini
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                        }}
                    >
                        {isSaving ? (
                            <>Menyimpan...</>
                        ) : (
                            <>
                                <FiSave /> Simpan Perubahan
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '24px',
                borderBottom: '1px solid #262626',
                marginBottom: '32px'
            }}>
                {[
                    { id: 'general', label: 'Umum', icon: FiLayout },
                    { id: 'social', label: 'Media Sosial', icon: FiShare2 },
                    { id: 'comments', label: 'Komentar', icon: FiMessageSquare },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #dc2626' : '2px solid transparent',
                            padding: '12px 4px',
                            color: activeTab === tab.id ? '#fff' : '#a3a3a3',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab.id ? 600 : 400,
                            marginBottom: '-1px',
                        }}
                    >
                        <tab.icon />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ backgroundColor: '#171717', borderRadius: '8px', padding: '24px', border: '1px solid #262626' }}>

                {/* General Tab */}
                {activeTab === 'general' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Site Branding */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontSize: '13px' }}>
                                    Nama Situs
                                </label>
                                <input
                                    type="text"
                                    value={settings.siteName || ''}
                                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#0a0a0a',
                                        border: '1px solid #262626',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        color: '#fff',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontSize: '13px' }}>
                                    Warna Utama
                                </label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <input
                                        type="color"
                                        value={settings.primaryColor || '#dc2626'}
                                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                        style={{
                                            width: '48px',
                                            height: '45px',
                                            padding: '0',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            backgroundColor: 'transparent'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={settings.primaryColor || '#dc2626'}
                                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                        style={{
                                            flex: 1,
                                            backgroundColor: '#0a0a0a',
                                            border: '1px solid #262626',
                                            borderRadius: '6px',
                                            padding: '12px',
                                            color: '#fff',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Logo Upload */}
                        <div>
                            <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontSize: '13px' }}>
                                Logo Perusahaan
                            </label>
                            {settings.logoPath ? (
                                <div style={{ position: 'relative', width: '120px', height: '120px', backgroundColor: '#000', borderRadius: '8px', border: '1px solid #262626', overflow: 'hidden' }}>
                                    <Image
                                        src={settings.logoPath}
                                        alt="Logo"
                                        fill
                                        style={{ objectFit: 'contain', padding: '10px' }}
                                    />
                                    <button
                                        onClick={() => setSettings({ ...settings, logoPath: null })}
                                        style={{
                                            position: 'absolute',
                                            top: '4px',
                                            right: '4px',
                                            padding: '4px',
                                            backgroundColor: '#dc2626',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <FiX size={12} />
                                    </button>
                                </div>
                            ) : (
                                <label style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '120px',
                                    height: '120px',
                                    border: '1px dashed #333',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: '#0a0a0a',
                                }}>
                                    <FiUpload size={24} color="#525252" style={{ marginBottom: '8px' }} />
                                    <span style={{ color: '#525252', fontSize: '11px' }}>Upload Logo</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, "logoPath")}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}
                            <p style={{ marginTop: '8px', fontSize: '12px', color: '#525252' }}>
                                Format: PNG, JPG, GIF (max 2MB). Disarankan background transparan.
                            </p>
                        </div>

                        <div style={{ height: '1px', backgroundColor: '#262626', margin: '24px 0' }}></div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontSize: '13px' }}>
                                    Hero Title
                                </label>
                                <input
                                    type="text"
                                    value={settings.heroTitle}
                                    onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#0a0a0a',
                                        border: '1px solid #262626',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        color: '#fff',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontSize: '13px' }}>
                                    Hero Subtitle
                                </label>
                                <input
                                    type="text"
                                    value={settings.heroSubtitle}
                                    onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#0a0a0a',
                                        border: '1px solid #262626',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        color: '#fff',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontSize: '13px' }}>
                                About Text / Footer Text
                            </label>
                            <textarea
                                value={settings.aboutText || ''}
                                onChange={(e) => setSettings({ ...settings, aboutText: e.target.value })}
                                rows={4}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#0a0a0a',
                                    border: '1px solid #262626',
                                    borderRadius: '6px',
                                    padding: '12px',
                                    color: '#fff',
                                    outline: 'none',
                                    resize: 'vertical',
                                    boxSizing: 'border-box',
                                    minHeight: '120px'
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Social Media Tab */}
                {activeTab === 'social' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {[
                            { key: 'instagramUrl', label: 'Instagram URL' },
                            { key: 'facebookUrl', label: 'Facebook URL' },
                            { key: 'twitterUrl', label: 'Twitter / X URL' },
                            { key: 'linkedinUrl', label: 'LinkedIn URL' },
                            { key: 'youtubeUrl', label: 'YouTube URL' },
                        ].map((field) => (
                            <div key={field.key}>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontSize: '13px' }}>
                                    {field.label}
                                </label>
                                <input
                                    type="url"
                                    value={(settings as any)[field.key] || ''}
                                    onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                                    placeholder="https://..."
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#0a0a0a',
                                        border: '1px solid #262626',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        color: '#fff',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Comments Tab */}
                {activeTab === 'comments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px',
                            backgroundColor: '#0a0a0a',
                            borderRadius: '6px',
                            border: '1px solid #262626'
                        }}>
                            <div>
                                <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                                    Auto Approve Komentar
                                </h3>
                                <p style={{ color: '#525252', fontSize: '12px', maxWidth: '400px' }}>
                                    Jika aktif, komentar akan langsung muncul tanpa perlu persetujuan admin.
                                </p>
                            </div>
                            <div style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', flexShrink: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={settings.commentAutoApprove}
                                    onChange={(e) => setSettings({ ...settings, commentAutoApprove: e.target.checked })}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                    id="auto-approve-toggle"
                                />
                                <label
                                    htmlFor="auto-approve-toggle"
                                    style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundColor: settings.commentAutoApprove ? '#dc2626' : '#262626',
                                        borderRadius: '24px',
                                        transition: '.4s',
                                    }}
                                >
                                    <span style={{
                                        position: 'absolute',
                                        content: '""',
                                        height: '18px',
                                        width: '18px',
                                        left: settings.commentAutoApprove ? '26px' : '4px',
                                        bottom: '3px',
                                        backgroundColor: 'white',
                                        borderRadius: '50%',
                                        transition: '.4s',
                                    }} />
                                </label>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px',
                            backgroundColor: '#0a0a0a',
                            borderRadius: '6px',
                            border: '1px solid #262626'
                        }}>
                            <div>
                                <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                                    Wajib Email
                                </h3>
                                <p style={{ color: '#525252', fontSize: '12px', maxWidth: '400px' }}>
                                    Pengunjung harus mengisi alamat email saat berkomentar.
                                </p>
                            </div>
                            <div style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', flexShrink: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={settings.commentRequireEmail}
                                    onChange={(e) => setSettings({ ...settings, commentRequireEmail: e.target.checked })}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                    id="require-email-toggle"
                                />
                                <label
                                    htmlFor="require-email-toggle"
                                    style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundColor: settings.commentRequireEmail ? '#dc2626' : '#262626',
                                        borderRadius: '24px',
                                        transition: '.4s',
                                    }}
                                >
                                    <span style={{
                                        position: 'absolute',
                                        content: '""',
                                        height: '18px',
                                        width: '18px',
                                        left: settings.commentRequireEmail ? '26px' : '4px',
                                        bottom: '3px',
                                        backgroundColor: 'white',
                                        borderRadius: '50%',
                                        transition: '.4s',
                                    }} />
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

