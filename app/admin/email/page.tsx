"use client";

import { useState, useEffect } from "react";
import {
    ArrowClockwise,
    Check,
    EnvelopeSimple,
    FloppyDisk,
    HardDrive,
    X,
} from "@phosphor-icons/react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useToast } from "@/contexts/ToastContext";

interface EmailSettings {
    id: number;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPass: string | null;
    fromName: string;
    fromEmail: string;
    replyToEmail: string | null;
    autoSendNewArticle: boolean;
}

export default function EmailPage() {
    const [settings, setSettings] = useState<EmailSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [successMessage, setSuccessMessage] = useState("");
    const { showToast } = useToast();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch("/api/email/settings");
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
            }
        } catch (err) {
            console.error("Failed to fetch email settings:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setIsSaving(true);
        setSuccessMessage("");
        setTestResult(null);

        try {
            const response = await fetch("/api/email/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (response.ok) {
                setSuccessMessage("Pengaturan berhasil disimpan");
                fetchSettings();
            } else {
                const data = await response.json();
                showToast(data.error || "Gagal menyimpan pengaturan", "error");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const response = await fetch("/api/email/settings", {
                method: "POST",
            });
            const data = await response.json();
            setTestResult(data);
        } catch {
            setTestResult({ success: false, error: "Connection test failed" });
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-8">
                <p className="text-text-3">Memuat pengaturan email...</p>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-6 md:p-8">
                <div className="rounded-card border border-danger bg-danger-subtle p-4 text-sm text-danger" role="alert">
                    Gagal memuat pengaturan email.
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1200px] p-6 md:p-8">
            <div className="mb-8">
                <p className="mb-1 text-xs font-semibold tracking-widest text-accent">EMAIL</p>
                <h1 className="font-display text-2xl font-bold text-text-1">Pengaturan Email</h1>
                <p className="mt-1 text-sm text-text-3">Atur pengiriman email, identitas pengirim, dan notifikasi otomatis.</p>
            </div>

            <form onSubmit={handleSave}>
                <div className="grid gap-5 lg:grid-cols-2">
                    <Card className="p-5">
                        <div className="mb-5 flex items-center gap-2 border-b border-border pb-4">
                            <HardDrive size={19} className="text-text-2" />
                            <div>
                                <h2 className="text-base font-semibold text-text-1">Konfigurasi SMTP</h2>
                                <p className="mt-0.5 text-xs text-text-3">Hubungkan layanan email untuk pengiriman.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Input
                                type="text"
                                label="SMTP host"
                                value={settings.smtpHost}
                                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                                placeholder="localhost"
                            />

                            <div className="flex flex-wrap items-end gap-5">
                                <Input
                                    type="number"
                                    label="Port"
                                    value={settings.smtpPort}
                                    onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 25 })}
                                    className="max-w-[120px]"
                                />
                                <label className="inline-flex h-10 cursor-pointer items-center gap-2 pb-0.5 text-sm text-text-2">
                                    <input
                                        type="checkbox"
                                        checked={settings.smtpSecure}
                                        onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                                        className="h-4 w-4 accent-accent"
                                    />
                                    SSL/TLS (port 465)
                                </label>
                            </div>

                            <Input
                                type="text"
                                label="Username (opsional)"
                                value={settings.smtpUser || ""}
                                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value || null })}
                                placeholder="user@domain.com"
                            />

                            <Input
                                type="password"
                                label="Password (opsional)"
                                value={settings.smtpPass || ""}
                                onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value || null })}
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="mt-5 border-t border-border pt-5">
                            <Button
                                type="button"
                                variant="secondary"
                                iconLeft={<ArrowClockwise size={16} className={isTesting ? "animate-spin" : ""} />}
                                onClick={handleTestConnection}
                                disabled={isTesting}
                            >
                                {isTesting ? "Menguji..." : "Uji koneksi"}
                            </Button>

                            {testResult && (
                                <div className="mt-4 flex items-center gap-2 text-sm" role="status">
                                    {testResult.success ? (
                                        <Badge tone="success"><Check size={13} /> Koneksi berhasil</Badge>
                                    ) : (
                                        <Badge tone="danger"><X size={13} /> {testResult.error || "Koneksi gagal"}</Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="mb-5 flex items-center gap-2 border-b border-border pb-4">
                            <EnvelopeSimple size={19} className="text-text-2" />
                            <div>
                                <h2 className="text-base font-semibold text-text-1">Identitas pengirim</h2>
                                <p className="mt-0.5 text-xs text-text-3">Tentukan nama dan alamat balasan email.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Input
                                type="text"
                                label="Nama pengirim"
                                value={settings.fromName}
                                onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                                placeholder="Santos Jaya Abadi News"
                            />

                            <Input
                                type="email"
                                label="Email pengirim"
                                value={settings.fromEmail}
                                onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
                                placeholder="news@company.com"
                            />

                            <Input
                                type="email"
                                label="Reply-to email (opsional)"
                                value={settings.replyToEmail || ""}
                                onChange={(e) => setSettings({ ...settings, replyToEmail: e.target.value || null })}
                                placeholder="reply@company.com"
                            />
                        </div>

                        <div className="mt-6 border-t border-border pt-5">
                            <label className="flex cursor-pointer items-start gap-3 text-sm text-text-2">
                                <input
                                    type="checkbox"
                                    checked={settings.autoSendNewArticle}
                                    onChange={(e) => setSettings({ ...settings, autoSendNewArticle: e.target.checked })}
                                    className="mt-0.5 h-4 w-4 accent-accent"
                                />
                                <span>
                                    <span className="block font-medium text-text-1">Kirim otomatis saat artikel baru dipublikasikan</span>
                                    <span className="mt-0.5 block text-xs text-text-3">Subscriber aktif akan menerima notifikasi artikel baru.</span>
                                </span>
                            </label>
                        </div>
                    </Card>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button
                        type="submit"
                        iconLeft={<FloppyDisk size={16} />}
                        disabled={isSaving}
                    >
                        {isSaving ? "Menyimpan..." : "Simpan pengaturan"}
                    </Button>
                    {successMessage && (
                        <Badge tone="success"><Check size={13} /> {successMessage}</Badge>
                    )}
                </div>
            </form>
        </div>
    );
}
