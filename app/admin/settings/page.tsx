"use client";

import { useState, useEffect } from "react";
import { FloppyDisk, UploadSimple, X, InstagramLogo, LinkedinLogo, FacebookLogo, TwitterLogo, YoutubeLogo, Info, Database, ArrowClockwise, ArrowSquareOut, CloudArrowUp } from "@phosphor-icons/react";
import Button, { buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";

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
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const performUpdate = async () => {
        if (!(await confirm({ title: 'Konfirmasi Update', message: 'Apakah Anda yakin ingin memperbarui aplikasi ke versi terbaru?', variant: 'default' }))) {
            return;
        }

        setIsUpdating(true);
        setUpdateProgress([{ step: 'Memulai proses update...', status: 'running' }]);
        try {
            const res = await fetch('/api/update', { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.steps) setUpdateProgress(data.steps);
                showToast(data.message || 'Update berhasil dimulai!', 'success');
            } else {
                showToast(data.message || 'Gagal menjalankan update', 'error');
                if (data.steps) setUpdateProgress(data.steps);
            }
        } catch {
            showToast('Gagal menghubungi server untuk update', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

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

            // Fetch remote version from GitHub (client-side) with cache-busting
            const remoteRes = await fetch(`${GITHUB_VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
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
                showToast(error.error || "Backup gagal", "error");
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
            showToast("Gagal membuat backup", "error");
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

            if (!(await confirm({ title: 'Perhatian', message: 'Restore akan menimpa data yang ada dengan data dari backup. Lanjutkan?', variant: 'danger' }))) {
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
                    showToast(`Restore berhasil!`, "success");
                    window.location.reload();
                } else {
                    showToast('Gagal restore: ' + (result.error || 'Unknown error'), "error");
                }
            } catch (err) {
                console.error('Restore error:', err);
                showToast('Gagal membaca file backup. Pastikan format file benar.', "error");
            } finally {
                setIsRestoring(false);
            }
        };

        input.click();
    };

    return (
        <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '2px solid var(--border-strong)',
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
                <Info size={20} color="var(--color-info)" />
                <h2 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                    INFORMASI VERSI
                </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '4px' }}>Versi Aplikasi</p>
                    <p style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: 700 }}>v{versionInfo?.version || "..."}</p>
                </div>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '4px' }}>Schema Database</p>
                    <p style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: 700 }}>v{versionInfo?.schemaVersion || "..."}</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {/*
                  Tiga tombol aksi ini dulu memakai latar hex gelap
                  (#1e40af / #14532d / #7c2d12) dengan color: var(--text-primary).
                  Di tema terang --text-primary jadi gelap, sehingga teksnya
                  praktis hilang di atas latar gelap. Sekarang memakai kit Button:
                  kontras aman di kedua tema dan bentuknya sama dengan tombol lain
                  di seluruh aplikasi.
                */}
                <Button
                    variant="secondary"
                    onClick={checkForUpdates}
                    disabled={isChecking}
                    iconLeft={
                        <ArrowClockwise
                            size={14}
                            className={isChecking ? 'animate-spin' : ''}
                            aria-hidden="true"
                        />
                    }
                >
                    {isChecking ? "Mengecek..." : "Cek Update"}
                </Button>
                <Button
                    variant="secondary"
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    iconLeft={<Database size={14} aria-hidden="true" />}
                >
                    {isBackingUp ? "Mengunduh..." : "Backup Database"}
                </Button>
                <Button
                    variant="danger"
                    onClick={handleRestore}
                    disabled={isRestoring}
                    iconLeft={<CloudArrowUp size={14} aria-hidden="true" />}
                >
                    {isRestoring ? "Memulihkan..." : "Restore Database"}
                </Button>
                <a
                    href="https://github.com/torpedoliar/Anouncement-Dashboard-Local"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({ variant: "ghost" })}
                >
                    <ArrowSquareOut size={14} aria-hidden="true" />
                    GitHub
                    <span className="sr-only">(buka tab baru)</span>
                </a>
            </div>

            {checkResult && (
                // Latar/border hex gelap diganti token *-subtle: tetap menandakan
                // status (info vs sukses) tapi ikut berganti di tema terang.
                <div style={{
                    padding: '16px',
                    backgroundColor: checkResult.hasUpdate
                        ? 'var(--color-info-subtle)'
                        : 'var(--color-success-subtle)',
                    border: `1px solid ${checkResult.hasUpdate ? 'var(--color-info)' : 'var(--color-success)'}`,
                    borderRadius: 'var(--radius-card)',
                }}>
                    {checkResult.error ? (
                        <p style={{ color: 'var(--color-warning)' }}>{checkResult.error}</p>
                    ) : checkResult.hasUpdate ? (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <p style={{ color: 'var(--color-info)', fontWeight: 600 }}>
                                    Update tersedia: v{checkResult.latestVersion}
                                </p>
                                {/* Dulu: teks var(--text-primary) di atas latar
                                    var(--color-success). Di tema gelap itu teks
                                    hampir putih di atas hijau terang (~2:1),
                                    di bawah ambang WCAG. Kit Button memakai
                                    pasangan warna yang sudah terjamin. */}
                                <Button
                                    size="sm"
                                    onClick={performUpdate}
                                    disabled={isUpdating}
                                    iconLeft={
                                        <ArrowClockwise
                                            size={12}
                                            className={isUpdating ? 'animate-spin' : ''}
                                            aria-hidden="true"
                                        />
                                    }
                                >
                                    {isUpdating ? "Memperbarui..." : "Update Sekarang"}
                                </Button>
                            </div>
                            <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>{checkResult.releaseNotes}</p>
                            {checkResult.hasSchemaUpdate && (
                                <p style={{ color: 'var(--color-warning)', fontSize: '12px', marginTop: '8px' }}>
                                    ⚠️ Update ini memerlukan migrasi database
                                </p>
                            )}
                            {/* Progress indicator */}
                            {updateProgress.length > 0 && (
                                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                                    {updateProgress.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{
                                                color: p.status === 'success' ? 'var(--color-success)' :
                                                    p.status === 'error' ? 'var(--color-error)' :
                                                        p.status === 'warning' ? 'var(--color-warning)' : 'var(--color-info)'
                                            }}>
                                                {p.status === 'success' ? '✓' : p.status === 'error' ? '✗' : p.status === 'running' ? '⏳' : '⚠'}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{p.step}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-success)' }}>✓ Aplikasi sudah versi terbaru!</p>
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
                    // Sejajar dengan `z-modal` pada skala z-index semantik
                    // (tailwind.config.ts). Dulu 9999 — di atas toast.
                    zIndex: 600,
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        const modal = document.getElementById('update-modal');
                        if (modal) modal.style.display = 'none';
                    }
                }}
            >
                <div style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '12px',
                    padding: '32px',
                    maxWidth: '650px',
                    width: '90%',
                }}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                        📦 Cara Update Aplikasi
                    </h3>
                    <p style={{ color: 'var(--color-warning)', marginBottom: '16px', fontSize: '13px', padding: '10px', backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: '6px' }}>
                        ⚠️ Jalankan perintah ini di <strong>PowerShell server</strong> tempat aplikasi diinstall
                    </p>
                    <div style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '20px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        lineHeight: 1.8,
                    }}>
                        <p style={{ color: 'var(--color-success)' }}># 1. Masuk ke folder project</p>
                        <p style={{ color: 'var(--text-1)', marginBottom: '12px' }}>cd &quot;E:\Vibe\Dashboard SJA\announcement-dashboard&quot;</p>

                        <p style={{ color: 'var(--color-success)' }}># 2. Download kode terbaru</p>
                        <p style={{ color: 'var(--text-1)', marginBottom: '12px' }}>git pull origin main</p>

                        <p style={{ color: 'var(--color-success)' }}># 3. Rebuild dan restart (tunggu 3-5 menit)</p>
                        <p style={{ color: 'var(--text-1)' }}>docker-compose down; docker-compose build --no-cache; docker-compose up -d</p>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`cd "E:\\Vibe\\Dashboard SJA\\announcement-dashboard"\ngit pull origin main\ndocker-compose down; docker-compose build --no-cache; docker-compose up -d`);
                                showToast('Perintah sudah dicopy! Paste ke PowerShell server.', 'success');
                            }}
                            style={{
                                padding: '10px 20px', backgroundColor: 'var(--color-success)', border: 'none',
                                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
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
                                padding: '10px 20px', backgroundColor: 'var(--border-strong)', border: 'none',
                                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                borderRadius: '6px',
                            }}
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
            <ConfirmDialog />
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
        field: "logoPath"
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
            <div className="p-8" aria-hidden="true">
                <div className="mb-6 h-7 w-48 rounded bg-surface-2 animate-pulse" />
                <div className="space-y-4 rounded-card border border-border bg-surface-1 p-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-3 w-40 rounded bg-surface-2 animate-pulse" />
                            <div className="h-10 w-full max-w-md rounded-control bg-surface-2 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Nilai hex mati (#0a0a0a / #262626 / #fff / #737373) diganti token supaya
    // form ini ikut tema terang. Dengan hex, input tetap hitam berteks putih di
    // atas kartu putih — praktis tidak terbaca.
    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-control)',
        color: 'var(--text-1)',
        fontSize: '14px',
        boxSizing: 'border-box' as const,
    };

    const labelStyle = {
        display: 'block',
        color: 'var(--text-2)',
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
                        color: 'var(--brand-red)',
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
                        color: 'var(--text-primary)',
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
                        backgroundColor: 'var(--brand-red)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        border: 'none',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.5 : 1,
                    }}
                >
                    <FloppyDisk size={14} />
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
                    color: message.includes("berhasil") ? 'var(--color-success)' : 'var(--color-error)',
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
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--bg-tertiary)',
                    padding: '24px',
                    overflow: 'hidden',
                }}>
                    <p style={{
                        color: 'var(--brand-red)',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        marginBottom: '4px',
                    }}>UMUM</p>
                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
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
                                        border: '1px solid var(--bg-tertiary)',
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
                                            backgroundColor: 'var(--bg-secondary)',
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
                                            backgroundColor: 'var(--brand-red)',
                                            color: 'var(--text-primary)',
                                            border: 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px',
                                    border: '1px dashed var(--border-strong)',
                                    cursor: 'pointer',
                                }}>
                                    <UploadSimple size={20} color="var(--text-muted)" />
                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Upload Logo</span>
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

                {/* Kolom hero global (heroTitle/heroSubtitle/heroImage) sengaja tidak dipakai di sini:
                    konsumen tunggalnya (app/page.tsx + HeroSection) sudah dihapus. Halaman per-site
                    memakai SiteSettings.hero* sendiri. Kolom DB tetap, tanpa migration. */}

                {/* About Text Section */}
                <div style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-tertiary)',
                    padding: '24px',
                }}>
                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
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
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                        }}
                        placeholder="Deskripsi singkat perusahaan untuk footer..."
                    />
                </div>

                {/* Social Media Section */}
                <div style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-tertiary)',
                    padding: '24px',
                }}>
                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
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
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <InstagramLogo size={14} /> Instagram URL
                            </label>
                            <input
                                type="url"
                                value={settings.instagramUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, instagramUrl: e.target.value || null }))}
                                placeholder="https://instagram.com/username"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <FacebookLogo size={14} /> Facebook URL
                            </label>
                            <input
                                type="url"
                                value={settings.facebookUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, facebookUrl: e.target.value || null }))}
                                placeholder="https://facebook.com/page"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <TwitterLogo size={14} /> Twitter / X URL
                            </label>
                            <input
                                type="url"
                                value={settings.twitterUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, twitterUrl: e.target.value || null }))}
                                placeholder="https://twitter.com/username"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <LinkedinLogo size={14} /> LinkedIn URL
                            </label>
                            <input
                                type="url"
                                value={settings.linkedinUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, linkedinUrl: e.target.value || null }))}
                                placeholder="https://linkedin.com/company/name"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginBottom: '8px',
                            }}>
                                <YoutubeLogo size={14} /> YouTube URL
                            </label>
                            <input
                                type="url"
                                value={settings.youtubeUrl || ""}
                                onChange={(e) => setSettings((prev) => ({ ...prev, youtubeUrl: e.target.value || null }))}
                                placeholder="https://youtube.com/@channel"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
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
