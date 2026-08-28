"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Sparkle, ArrowsClockwise, Eye, EyeSlash } from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/hooks/useConfirm";

// Kontrak endpoint — Oscar TASK-29 (app/api/admin/hris/*/route.ts)
interface HrisConfigPublic {
    id: number;
    baseUrl: string;
    apiKeyMasked: string | null;
    enabled: boolean;
    lastSyncAt: string | null;
    lastPingAt: string | null;
    pingError: string | null;
    updatedAt: string;
}

interface ConfigGetResponse {
    configured: boolean;
    config?: HrisConfigPublic;
}

interface ConfigPostResponse {
    message: string;
    config: HrisConfigPublic;
}

interface PingResponse {
    healthStatus: "ONLINE" | "OFFLINE";
    lastPingAt: string;
    error?: string;
    ok: boolean;
}

interface SyncResult {
    totalProcessed: number;
    updated: number;
    unchanged: number;
    deactivated: number;
    errors: Array<{ nik: string; error: string }>;
    jobId?: string;
}

export default function HrisGatewayPage() {
    const [config, setConfig] = useState<HrisConfigPublic | null>(null);
    const [configured, setConfigured] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [syncRunning, setSyncRunning] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [newBaseUrl, setNewBaseUrl] = useState("");
    const [newApiKey, setNewApiKey] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [error, setError] = useState("");
    const [pingResult, setPingResult] = useState<PingResponse | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchConfig = useCallback(async () => {
        try {
            const response = await fetch("/api/admin/hris/config");
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Gagal memuat konfigurasi");
            }
            const data: ConfigGetResponse = await response.json();
            setConfigured(data.configured);
            if (data.configured && data.config) {
                setConfig(data.config);
                setNewBaseUrl(data.config.baseUrl || "");
                setEnabled(data.config.enabled);
            } else {
                setConfig(null);
                setNewBaseUrl("");
                setNewApiKey("");
                setEnabled(false);
            }
            setPingResult(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal memuat konfigurasi";
            showToast(message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            // POST /api/admin/hris/config payload {baseUrl, apiKey, enabled}
            const response = await fetch("/api/admin/hris/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl: newBaseUrl, apiKey: newApiKey, enabled }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Gagal menyimpan konfigurasi");
            }

            const data: ConfigPostResponse = await response.json();
            setConfig(data.config);
            setConfigured(true);
            setNewApiKey("");
            setShowPassword(false);
            showToast("Konfigurasi berhasil disimpan", "success");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Terjadi kesalahan";
            setError(message);
            showToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTestLoading(true);
        setError("");
        setPingResult(null);

        try {
            // POST /api/admin/hris/ping → { healthStatus, lastPingAt, error?, ok }
            const response = await fetch("/api/admin/hris/ping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Test connection gagal");
            }

            const result: PingResponse = await response.json();
            setPingResult(result);

            if (result.healthStatus === "ONLINE") {
                showToast("Koneksi HRIS aktif", "success");
            } else {
                showToast(result.error || "Koneksi HRIS tidak responsif", "error");
            }
            // Refresh config untuk update lastPingAt
            fetchConfig();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Test gagal";
            setError(message);
            setPingResult({ healthStatus: "OFFLINE", lastPingAt: new Date().toISOString(), error: message, ok: false });
            showToast(message, "error");
        } finally {
            setTestLoading(false);
        }
    };

    const handleRunSync = async () => {
        if (!(await confirm({ title: "Jalankan Sinkronisasi Manual", message: "Menjalankan sinkronisasi akan mengambil data terbaru dari HRIS. Lanjutkan?" }))) return;

        setSyncRunning(true);
        setShowConfirmModal(false);
        setError("");

        try {
            // POST /api/admin/hris/sync → { totalProcessed, updated, unchanged, deactivated, errors, jobId }
            const response = await fetch("/api/admin/hris/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full: false }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Sinkronisasi gagal");
            }

            const result: SyncResult = await response.json();
            const errorCount = result.errors?.length ?? 0;
            showToast(
                `Sinkronisasi selesai: ${result.updated} diperbarui, ${result.deactivated} dinonaktifkan${errorCount > 0 ? `, ${errorCount} error` : ""}`,
                "success"
            );
            // Refresh config untuk update lastSyncAt
            fetchConfig();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Sinkronisasi gagal";
            setError(message);
            showToast(message, "error");
        } finally {
            setSyncRunning(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Belum pernah";
        return new Date(dateString).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-1 h-3 w-28 animate-pulse rounded bg-surface-2" />
                        <div className="h-7 w-56 animate-pulse rounded bg-surface-2" />
                    </div>
                </div>

                {/* Connection Settings skeleton */}
                <Card className="mb-4 p-4">
                    <div className="mb-4 h-4 w-40 animate-pulse rounded bg-surface-2" />
                    <div className="space-y-4">
                        <div>
                            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                            <div className="h-10 w-full animate-pulse rounded-control border border-border bg-surface-2" />
                        </div>
                        <div>
                            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                            <div className="h-10 w-full animate-pulse rounded-control border border-border bg-surface-2" />
                        </div>
                        <div className="h-10 w-32 animate-pulse rounded bg-surface-2" />
                    </div>
                </Card>

                {/* Health Status skeleton */}
                <Card className="mb-4 p-4">
                    <div className="mb-4 h-4 w-32 animate-pulse rounded bg-surface-2" />
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                            <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                        </div>
                        <div className="h-9 w-32 animate-pulse rounded bg-surface-2" />
                    </div>
                </Card>

                {/* Sync Controls skeleton */}
                <Card className="p-4">
                    <div className="mb-4 h-4 w-32 animate-pulse rounded bg-surface-2" />
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                            <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                        </div>
                        <div className="h-9 w-40 animate-pulse rounded bg-surface-2" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold tracking-widest text-accent">SETTINGS &gt; HRIS GATEWAY</p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Konfigurasi Gateway HRIS</h1>
                </div>
            </div>

            {/* Connection Settings Card */}
            <Card className="mb-4 p-4">
                <p className="mb-4 text-sm font-semibold text-text-1">Pengaturan Koneksi</p>

                {error && (
                    <div
                        className="mb-4 rounded-control border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSaveConfig} className="space-y-4">
                    <div>
                        <label
                            htmlFor="base-url"
                            className="mb-2 block text-xs font-semibold text-text-2"
                        >
                            Base URL *
                        </label>
                        <Input
                            id="base-url"
                            type="text"
                            value={newBaseUrl}
                            onChange={(e) => setNewBaseUrl(e.target.value)}
                            required
                            placeholder="http://[host]:[port]"
                            className="w-full"
                        />
                    </div>

                    {/* API Key field:
                        - Belum ada config (configured=false): input password editable + show/hide
                        - Sudah ada config: tampilkan masked (apiKeyMasked dari GET), read-only.
                          Untuk ganti key, admin kirim field apiKey baru di POST; endpoint
                          re-encrypt. Di sini kita tampilkan masked lalu tombol "Ganti API Key". */}
                    {configured && config ? (
                        <div>
                            <label className="mb-2 block text-xs font-semibold text-text-2">API Key</label>
                            <Input
                                id="api-key-masked"
                                type="text"
                                value={config.apiKeyMasked ?? "••••"}
                                readOnly
                                aria-readonly="true"
                                className="w-full bg-surface-2 text-text-1 cursor-not-allowed font-mono"
                            />
                            <p className="mt-1 text-xs text-text-3 italic">
                                API key dienkripsi dengan AES-256-GCM menggunakan PORTAL_CREDENTIAL_KEY. Isi field di bawah untuk mengganti.
                            </p>
                            <div className="mt-2">
                                <label
                                    htmlFor="api-key-new"
                                    className="mb-2 block text-xs font-semibold text-text-2"
                                >
                                    API Key Baru (opsional)
                                </label>
                                <div className="relative">
                                    <Input
                                        id="api-key-new"
                                        type={showPassword ? "text" : "password"}
                                        value={newApiKey}
                                        onChange={(e) => setNewApiKey(e.target.value)}
                                        placeholder="Kosongkan jika tidak ingin mengganti"
                                        className="pr-10 w-full"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Sembunyikan API key" : "Lihat API key"}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
                                    >
                                        {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label
                                htmlFor="api-key"
                                className="mb-2 block text-xs font-semibold text-text-2"
                            >
                                API Key *
                            </label>
                            <div className="relative">
                                <Input
                                    id="api-key"
                                    type={showPassword ? "text" : "password"}
                                    value={newApiKey}
                                    onChange={(e) => setNewApiKey(e.target.value)}
                                    required
                                    placeholder="Masukkan API key"
                                    className="pr-10 w-full"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Sembunyikan API key" : "Lihat API key"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
                                >
                                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-text-3 italic">
                                API key dienkripsi dengan AES-256-GCM menggunakan PORTAL_CREDENTIAL_KEY
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-text-1">
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                                className="h-4 w-4 cursor-pointer accent-accent"
                            />
                            Aktifkan gateway
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="submit" disabled={saving}>
                            {saving ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Health Status Card */}
            <Card className="mb-4 p-4">
                <p className="mb-4 text-sm font-semibold text-text-1">Status Kesehatan</p>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-3">Ping terakhir:</span>
                        <span className="font-mono text-xs tabular-nums text-text-2">
                            {config?.lastPingAt ? formatDate(config.lastPingAt) : "Belum pernah"}
                        </span>
                    </div>

                    {config?.pingError && (
                        <div className="rounded-control border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-warning">
                            Error terakhir: {config.pingError}
                        </div>
                    )}

                    {pingResult && (
                        <div className="flex items-center gap-2">
                            <Badge tone={pingResult.healthStatus === "ONLINE" ? "success" : "danger"}>
                                {pingResult.healthStatus}
                            </Badge>
                            {pingResult.error && (
                                <span className="text-xs text-text-3">{pingResult.error}</span>
                            )}
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        iconLeft={!testLoading ? <Sparkle size={14} aria-hidden="true" /> : undefined}
                        onClick={handleTestConnection}
                        disabled={testLoading || saving}
                    >
                        {testLoading ? "Menguji..." : "Test Connection"}
                    </Button>
                </div>
            </Card>

            {/* Sync Controls Card */}
            <Card className="p-4">
                <p className="mb-4 text-sm font-semibold text-text-1">Sinkronisasi</p>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-3">Sinkronisasi terakhir:</span>
                        <span className="font-mono text-xs tabular-nums text-text-2">
                            {config?.lastSyncAt ? formatDate(config.lastSyncAt) : "Belum pernah"}
                        </span>
                    </div>

                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        iconLeft={<ArrowsClockwise size={14} aria-hidden="true" />}
                        onClick={() => setShowConfirmModal(true)}
                        disabled={syncRunning || saving}
                    >
                        {syncRunning ? "Menjalankan..." : "Sinkron Sekarang"}
                    </Button>
                </div>
            </Card>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <Modal
                    open={true}
                    onClose={() => setShowConfirmModal(false)}
                    title="Jalankan Sinkronisasi Manual"
                    description="Menjalankan sinkronisasi akan mengambil data terbaru dari HRIS untuk semua pengguna yang terdaftar."
                    size="sm"
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={syncRunning}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleRunSync}
                                disabled={syncRunning}
                                iconLeft={<ArrowsClockwise size={14} aria-hidden="true" />}
                            >
                                {syncRunning ? "Menjalankan..." : "Konfirmasi"}
                            </Button>
                        </>
                    }
                >
                    <div className="flex items-start gap-3 rounded-control border border-border bg-surface-2 p-3">
                        <ShieldCheck size={20} className="shrink-0 text-accent mt-0.5" aria-hidden="true" />
                        <div className="text-sm text-text-2">
                            Sinkronisasi akan memperbarui:<br />
                            • Nama dan email dari HRIS<br />
                            • Status keaktifan pengguna<br />
                            • Data NIK HRIS terbaru
                        </div>
                    </div>
                </Modal>
            )}

            <ConfirmDialog />
        </div>
    );
}
