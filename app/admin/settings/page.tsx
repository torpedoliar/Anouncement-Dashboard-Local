"use client";

import { useState, useEffect } from "react";
import { FiSave, FiUpload, FiX, FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiYoutube, FiInfo, FiDatabase, FiRefreshCw, FiExternalLink } from "react-icons/fi";

interface Settings {
    siteName: string;
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string | null;
    logoPath: string | null;
    primaryColor: string;
    aboutText: string;
    instagramUrl: string | null;
    linkedinUrl: string | null;
    facebookUrl: string | null;
    twitterUrl: string | null;
    youtubeUrl: string | null;
}

interface VersionCheckResult {
    hasUpdate: boolean;
    hasSchemaUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    currentSchemaVersion: string;
    latestSchemaVersion: string;
    releaseNotes: string;
    error?: string;
}

function VersionInfoSection() {
    const [versionInfo, setVersionInfo] = useState<{ version: string; schemaVersion: string } | null>(null);
    const [checkResult, setCheckResult] = useState<VersionCheckResult | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);

    useEffect(() => {
        fetchVersion();
    }, []);

    const fetchVersion = async () => {
        try {
            const res = await fetch("/api/version");
            const data = await res.json();
            setVersionInfo(data);
        } catch (err) {
            console.error("Failed to fetch version:", err);
        }
    };

    const checkForUpdates = async () => {
        setIsChecking(true);
        try {
            const res = await fetch("/api/version/check");
            const data = await res.json();
            setCheckResult(data);
        } catch (err) {
            console.error("Failed to check updates:", err);
        } finally {
            setIsChecking(false);
        }
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const response = await fetch("/api/backup");
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || "Backup gagal");
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `backup_${new Date().toISOString().split("T")[0]}.sql`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Backup error:", err);
            alert("Gagal membuat backup");
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <div style={{
            backgroundColor: '#0a0a0a',
            border: '2px solid #333',
            borderRadius: '8px',
            padding: '28px',
            marginTop: '32px',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
            }}>
                <FiInfo size={20} color="#3b82f6" />
                <h2 style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                    INFORMASI VERSI
                </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', backgroundColor: '#111', border: '1px solid #262626', borderRadius: '8px' }}>
                    <p style={{ color: '#71717a', fontSize: '12px', marginBottom: '4px' }}>Versi Aplikasi</p>
                    <p style={{ color: '#fff', fontSize: '24px', fontWeight: 700 }}>v{versionInfo?.version || "..."}</p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#111', border: '1px solid #262626', borderRadius: '8px' }}>
                    <p style={{ color: '#71717a', fontSize: '12px', marginBottom: '4px' }}>Schema Database</p>
                    <p style={{ color: '#fff', fontSize: '24px', fontWeight: 700 }}>v{versionInfo?.schemaVersion || "..."}</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <button
                    onClick={checkForUpdates}
                    disabled={isChecking}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 20px', backgroundColor: '#1e40af', border: 'none',
                        color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isChecking ? 'not-allowed' : 'pointer',
                        borderRadius: '6px', opacity: isChecking ? 0.7 : 1,
                    }}
                >
                    <FiRefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
                    {isChecking ? "Mengecek..." : "Cek Update"}
                </button>
                <button
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 20px', backgroundColor: '#14532d', border: 'none',
                        color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isBackingUp ? 'not-allowed' : 'pointer',
                        borderRadius: '6px', opacity: isBackingUp ? 0.7 : 1,
                    }}
                >
                    <FiDatabase size={14} />
                    {isBackingUp ? "Downloading..." : "Backup Database"}
                </button>
                <a
                    href="https://github.com/torpedoliar/Anouncement-Dashboard-Local"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 20px', backgroundColor: '#262626', border: 'none',
                        color: '#a1a1aa', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                        borderRadius: '6px',
                    }}
                >
                    <FiExternalLink size={14} />
                    GitHub
                </a>
            </div>

            {checkResult && (
                <div style={{
                    padding: '16px',
                    backgroundColor: checkResult.hasUpdate ? '#1e3a5f' : '#14532d',
                    border: `1px solid ${checkResult.hasUpdate ? '#3b82f6' : '#22c55e'}`,
                    borderRadius: '8px',
                }}>
                    {checkResult.error ? (
                        <p style={{ color: '#fbbf24' }}>{checkResult.error}</p>
                    ) : checkResult.hasUpdate ? (
                        <div>
                            <p style={{ color: '#60a5fa', fontWeight: 600, marginBottom: '4px' }}>
                                Update tersedia: v{checkResult.latestVersion}
                            </p>
                            <p style={{ color: '#94a3b8', fontSize: '13px' }}>{checkResult.releaseNotes}</p>
                            {checkResult.hasSchemaUpdate && (
                                <p style={{ color: '#fbbf24', fontSize: '12px', marginTop: '8px' }}>
                                    ⚠️ Update ini memerlukan migrasi database
                                </p>
                            )}
                        </div>
                    ) : (
                        <p style={{ color: '#4ade80' }}>✓ Aplikasi sudah versi terbaru!</p>
                    )}
                </div>
            )}
        </div>
    );
}


export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({
        siteName: "Santos Jaya Abadi",
        heroTitle: "BERITA & PENGUMUMAN",
        heroSubtitle: "Informasi terbaru dari perusahaan",
        heroImage: null,
        logoPath: null,
        primaryColor: "#dc2626",
        aboutText: "Didirikan tahun 1979, PT. Santos Jaya Abadi adalah salah satu perusahaan roasting kopi terbesar di Asia Tenggara dengan merek ikonik Kapal Api.",
        instagramUrl: null,
        linkedinUrl: null,
        facebookUrl: null,
        twitterUrl: null,
        youtubeUrl: null,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/settings");
            if (response.ok) {
                const data = await response.json();
                if (data) setSettings(data);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage("");

        try {
            const response = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (response.ok) {
                setMessage("Pengaturan berhasil disimpan!");
            } else {
                setMessage("Gagal menyimpan pengaturan.");
            }
        } catch {
            setMessage("Terjadi kesalahan.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        field: "logoPath" | "heroImage"
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setSettings((prev) => ({ ...prev, [field]: data.url }));
                setMessage("");
            } else {
                setMessage(data.error || "Gagal upload gambar");
            }
        } catch (error) {
            console.error("Upload failed:", error);
            setMessage("Terjadi kesalahan saat upload");
        }

        // Reset file input
        e.target.value = "";
    };

    if (isLoading) {
        return (
            <div style={{
                padding: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
            }}>
                <p style={{ color: '#525252' }}>Loading...</p>
            </div>
        );
    }

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
        color: '#737373',
        fontSize: '11px',
        fontWeight: 600 as const,
        letterSpacing: '0.1em',
        marginBottom: '8px',
        textTransform: 'uppercase' as const,
    };

    return (
        <div style={{ padding: '32px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '32px',
            }}>
                <div>
                    <p style={{
                        color: '#dc2626',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        marginBottom: '4px',
                    }}>
                        KONFIGURASI
                    </p>
                    <h1 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#fff',
                    }}>
                        Pengaturan
                    </h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        border: 'none',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.5 : 1,
                    }}
                >
                    <FiSave size={14} />
                    {isSaving ? "MENYIMPAN..." : "SIMPAN"}
                </button>
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    padding: '16px',
                    marginBottom: '32px',
                    backgroundColor: message.includes("berhasil") ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: message.includes("berhasil") ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    color: message.includes("berhasil") ? '#22c55e' : '#ef4444',
                }}>
                    {message}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '32px',
            }}>
                {/* General Settings */}
                <div style={{
                    backgroundColor: '#000',
                    border: '1px solid #1a1a1a',
                    padding: '24px',
                }}>
                    <p style={{
                        color: '#dc2626',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        marginBottom: '4px',
                    }}>UMUM</p>
                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '24px',
                    }}>
                        Pengaturan Situs
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <label style={labelStyle}>Nama Situs</label>
                            <input
                                type="text"
                                value={settings.siteName}
                                onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Warna Utama</label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input
                                    type="color"
                                    value={settings.primaryColor}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, primaryColor: e.target.value }))}
                                    style={{
                                        width: '56px',
                                        height: '48px',
                                        cursor: 'pointer',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #1a1a1a',
                                    }}
                                />
                                <input
                                    type="text"
                                    value={settings.primaryColor}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, primaryColor: e.target.value }))}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Logo</label>
                            {settings.logoPath ? (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img
                                        src={settings.logoPath}
                                        alt="Logo"
                                        style={{
                                            height: '64px',
                                            objectFit: 'contain',
                                            backgroundColor: '#0a0a0a',
                                            padding: '12px',
                                        }}
                                    />
                                    <button
                                        onClick={() => setSettings((prev) => ({ ...prev, logoPath: null }))}
                                        style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            padding: '4px',
                                            backgroundColor: '#dc2626',
                                            color: '#fff',
                                            border: 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <FiX size={12} />
                                    </button>
                                </div>
                            ) : (
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px',
                                    border: '1px dashed #333',
                                    cursor: 'pointer',
                                }}>
                                    <FiUpload size={20} color="#525252" />
                                    <span style={{ color: '#525252', fontSize: '14px' }}>Upload Logo</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, "logoPath")}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hero Settings */}
                <div style={{
                    backgroundColor: '#000',
                    border: '1px solid #1a1a1a',
                    padding: '24px',
                }}>
                    <p style={{
                        color: '#dc2626',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        marginBottom: '4px',
                    }}>HERO</p>
                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '24px',
                    }}>
                        Hero Section
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <label style={labelStyle}>Judul Hero</label>
                            <input
                                type="text"
                                value={settings.heroTitle}
                                onChange={(e) => setSettings((prev) => ({ ...prev, heroTitle: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Subjudul Hero</label>
                            <input
                                type="text"
                                value={settings.heroSubtitle}
                                onChange={(e) => setSettings((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Background Hero</label>
                            {settings.heroImage ? (
                                <div style={{ position: 'relative' }}>
                                    <img
                                        src={settings.heroImage}
                                        alt="Hero"
                                        style={{
                                            width: '100%',
                                            height: '128px',
                                            objectFit: 'cover',
                                        }}
                                    />
                                    <button
                                        onClick={() => setSettings((prev) => ({ ...prev, heroImage: null }))}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            padding: '4px',
                                            backgroundColor: '#dc2626',
                                            color: '#fff',
                                            border: 'none',
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
                                    height: '128px',
                                    border: '1px dashed #333',
                                    cursor: 'pointer',
                                }}>
                                    <FiUpload size={32} color="#525252" style={{ marginBottom: '8px' }} />
                                    <span style={{ color: '#525252', fontSize: '14px' }}>Upload Background</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, "heroImage")}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* About Text Section */}
                <div style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #1a1a1a',
                    padding: '24px',
                }}>
                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '24px',
                    }}>
                        Tentang (Footer)
                    </h2>
                    <textarea
                        value={settings.aboutText}
                        onChange={(e) => setSettings((prev) => ({ ...prev, aboutText: e.target.value }))}
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            backgroundColor: '#111',
                            border: '1px solid #262626',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none',
                            resize: 'vertical',
                        }}
                        placeholder="Deskripsi singkat perusahaan untuk footer..."
                    />
                </div>

                {/* Social Media Section */}
                <div style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #1a1a1a',
                    padding: '24px',
                }}>
                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '24px',
                    }}>
                        Media Sosial
                    </h2>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#737373',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <FiInstagram size={14} /> Instagram URL
                            </label>
                            <input
                                type="url"
                                value={settings.instagramUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, instagramUrl: e.target.value || null }))}
                                placeholder="https://instagram.com/username"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: '#111',
                                    border: '1px solid #262626',
                                    color: '#fff',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#737373',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <FiFacebook size={14} /> Facebook URL
                            </label>
                            <input
                                type="url"
                                value={settings.facebookUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, facebookUrl: e.target.value || null }))}
                                placeholder="https://facebook.com/page"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: '#111',
                                    border: '1px solid #262626',
                                    color: '#fff',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#737373',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <FiTwitter size={14} /> Twitter / X URL
                            </label>
                            <input
                                type="url"
                                value={settings.twitterUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, twitterUrl: e.target.value || null }))}
                                placeholder="https://twitter.com/username"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: '#111',
                                    border: '1px solid #262626',
                                    color: '#fff',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#737373',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <FiLinkedin size={14} /> LinkedIn URL
                            </label>
                            <input
                                type="url"
                                value={settings.linkedinUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, linkedinUrl: e.target.value || null }))}
                                placeholder="https://linkedin.com/company/name"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: '#111',
                                    border: '1px solid #262626',
                                    color: '#fff',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#737373',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <FiYoutube size={14} /> YouTube URL
                            </label>
                            <input
                                type="url"
                                value={settings.youtubeUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, youtubeUrl: e.target.value || null }))}
                                placeholder="https://youtube.com/@channel"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: '#111',
                                    border: '1px solid #262626',
                                    color: '#fff',
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Version Info Section */}
                <VersionInfoSection />
            </div>
        </div>
    );
}
