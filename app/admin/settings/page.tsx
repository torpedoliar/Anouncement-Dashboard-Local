"use client";

import { useState, useEffect } from "react";
import { FiSave, FiUpload, FiX, FiInstagram, FiLinkedin, FiFacebook, FiTwitter, FiYoutube, FiInfo, FiDatabase, FiRefreshCw, FiExternalLink, FiUploadCloud } from "react-icons/fi";

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

const GITHUB_VERSION_URL = "https://raw.githubusercontent.com/torpedoliar/Anouncement-Dashboard-Local/main/version.json";

// Compare semver versions: returns 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

function VersionInfoSection() {
    const [versionInfo, setVersionInfo] = useState<{ version: string; schemaVersion: string } | null>(null);
    const [checkResult, setCheckResult] = useState<VersionCheckResult | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState<{ step: string; status: string }[]>([]);

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
            // Fetch local version from API
            const localRes = await fetch("/api/version");
            const localVersion = await localRes.json();

            // Fetch remote version from GitHub (client-side)
            const remoteRes = await fetch(GITHUB_VERSION_URL, { cache: "no-store" });
            if (!remoteRes.ok) {
                throw new Error("Tidak dapat terhubung ke GitHub");
            }
            const remoteVersion = await remoteRes.json();

            // Compare versions
            const hasUpdate = compareVersions(remoteVersion.version, localVersion.version) > 0;
            const hasSchemaUpdate = parseInt(remoteVersion.schemaVersion || "1") > parseInt(localVersion.schemaVersion || "1");

            setCheckResult({
                hasUpdate,
                hasSchemaUpdate,
                currentVersion: localVersion.version,
                latestVersion: remoteVersion.version,
                currentSchemaVersion: localVersion.schemaVersion || "1",
                latestSchemaVersion: remoteVersion.schemaVersion || "1",
                releaseNotes: remoteVersion.releaseNotes || "",
            });
        } catch (err) {
            console.error("Failed to check updates:", err);
            setCheckResult({
                hasUpdate: false,
                hasSchemaUpdate: false,
                currentVersion: versionInfo?.version || "1.0.0",
                latestVersion: versionInfo?.version || "1.0.0",
                currentSchemaVersion: versionInfo?.schemaVersion || "1",
                latestSchemaVersion: versionInfo?.schemaVersion || "1",
                releaseNotes: "",
                error: "Tidak dapat terhubung ke GitHub. Periksa koneksi internet.",
            });
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

    const handleRestore = async () => {
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            if (!confirm('PERHATIAN: Restore akan menimpa data yang ada dengan data dari backup. Lanjutkan?')) {
                return;
            }

            setIsRestoring(true);
            try {
                const text = await file.text();
                const backupData = JSON.parse(text);

                const response = await fetch('/api/backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(backupData),
                });

                const result = await response.json();

                if (response.ok) {
                    alert(`Restore berhasil!\n\nSettings: ${result.restored.settings ? '✓' : '✗'}\nKategori: ${result.restored.categories}\nPengumuman: ${result.restored.announcements}`);
                    window.location.reload();
                } else {
                    alert('Gagal restore: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Restore error:', err);
                alert('Gagal membaca file backup. Pastikan format file benar.');
            } finally {
                setIsRestoring(false);
            }
        };

        input.click();
    };

    const performUpdate = () => {
        // Show the update modal with instructions
        const modal = document.getElementById('update-modal');
        if (modal) modal.style.display = 'flex';
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
                <button
                    onClick={handleRestore}
                    disabled={isRestoring}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 20px', backgroundColor: '#7c2d12', border: 'none',
                        color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isRestoring ? 'not-allowed' : 'pointer',
                        borderRadius: '6px', opacity: isRestoring ? 0.7 : 1,
                    }}
                >
                    <FiUploadCloud size={14} />
                    {isRestoring ? "Restoring..." : "Restore Database"}
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
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <p style={{ color: '#60a5fa', fontWeight: 600 }}>
                                    Update tersedia: v{checkResult.latestVersion}
                                </p>
                                <button
                                    onClick={performUpdate}
                                    disabled={isUpdating}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px', backgroundColor: isUpdating ? '#166534' : '#22c55e', border: 'none',
                                        color: '#fff', fontSize: '12px', fontWeight: 600,
                                        cursor: isUpdating ? 'not-allowed' : 'pointer',
                                        borderRadius: '4px', opacity: isUpdating ? 0.8 : 1,
                                    }}
                                >
                                    <FiRefreshCw size={12} className={isUpdating ? 'animate-spin' : ''} />
                                    {isUpdating ? "Updating..." : "Update Sekarang"}
                                </button>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '13px' }}>{checkResult.releaseNotes}</p>
                            {checkResult.hasSchemaUpdate && (
                                <p style={{ color: '#fbbf24', fontSize: '12px', marginTop: '8px' }}>
                                    ⚠️ Update ini memerlukan migrasi database
                                </p>
                            )}
                            {/* Progress indicator */}
                            {updateProgress.length > 0 && (
                                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
                                    {updateProgress.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{
                                                color: p.status === 'success' ? '#22c55e' :
                                                    p.status === 'error' ? '#ef4444' :
                                                        p.status === 'warning' ? '#fbbf24' : '#60a5fa'
                                            }}>
                                                {p.status === 'success' ? '✓' : p.status === 'error' ? '✗' : p.status === 'running' ? '⏳' : '⚠'}
                                            </span>
                                            <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{p.step}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p style={{ color: '#4ade80' }}>✓ Aplikasi sudah versi terbaru!</p>
                    )}
                </div>
            )}

            {/* Update Modal */}
            <div
                id="update-modal"
                style={{
                    display: 'none',
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999,
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        const modal = document.getElementById('update-modal');
                        if (modal) modal.style.display = 'none';
                    }
                }}
            >
                <div style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    padding: '32px',
                    maxWidth: '650px',
                    width: '90%',
                }}>
                    <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                        📦 Cara Update Aplikasi
                    </h3>
                    <p style={{ color: '#fbbf24', marginBottom: '16px', fontSize: '13px', padding: '10px', backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: '6px' }}>
                        ⚠️ Jalankan perintah ini di <strong>PowerShell server</strong> tempat aplikasi diinstall
                    </p>
                    <div style={{
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #262626',
                        borderRadius: '8px',
                        padding: '20px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        lineHeight: 1.8,
                    }}>
                        <p style={{ color: '#22c55e' }}># 1. Masuk ke folder project</p>
                        <p style={{ color: '#e5e5e5', marginBottom: '12px' }}>cd &quot;E:\Vibe\Dashboard SJA\announcement-dashboard&quot;</p>

                        <p style={{ color: '#22c55e' }}># 2. Download kode terbaru</p>
                        <p style={{ color: '#e5e5e5', marginBottom: '12px' }}>git pull origin main</p>

                        <p style={{ color: '#22c55e' }}># 3. Rebuild dan restart (tunggu 3-5 menit)</p>
                        <p style={{ color: '#e5e5e5' }}>docker-compose down; docker-compose build --no-cache; docker-compose up -d</p>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`cd "E:\\Vibe\\Dashboard SJA\\announcement-dashboard"\ngit pull origin main\ndocker-compose down; docker-compose build --no-cache; docker-compose up -d`);
                                alert('Perintah sudah dicopy! Paste ke PowerShell server.');
                            }}
                            style={{
                                padding: '10px 20px', backgroundColor: '#22c55e', border: 'none',
                                color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                borderRadius: '6px',
                            }}
                        >
                            📋 Copy Semua Perintah
                        </button>
                        <button
                            onClick={() => {
                                const modal = document.getElementById('update-modal');
                                if (modal) modal.style.display = 'none';
                            }}
                            style={{
                                padding: '10px 20px', backgroundColor: '#333', border: 'none',
                                color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                borderRadius: '6px',
                            }}
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
                maxWidth: '900px',
            }}>
                {/* General Settings */}
                <div style={{
                    backgroundColor: '#000',
                    border: '1px solid #1a1a1a',
                    padding: '24px',
                    overflow: 'hidden',
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
