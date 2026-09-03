"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkle, Eye, EyeSlash, Robot } from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

interface PortalAiConfig {
    baseUrl: string | null;
    model: string | null;
    apiKeyMasked: string | null;
    enabled: boolean;
    lastUsedAt: string | null;
    lastError: string | null;
    updatedAt: string;
}

export default function PortalAiPage() {
    const [config, setConfig] = useState<PortalAiConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");
    const [model, setModel] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [enabled, setEnabled] = useState(false);

    const { showToast } = useToast();

    const fetchConfig = useCallback(async () => {
        try {
            const response = await fetch("/api/admin/portal-ai");
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Gagal memuat konfigurasi");
            if (data.configured && data.config) {
                setConfig(data.config);
                setBaseUrl(data.config.baseUrl ?? "");
                setModel(data.config.model ?? "");
                setEnabled(data.config.enabled);
            } else {
                setConfig(null);
            }
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Gagal memuat konfigurasi", "error");
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await fetch("/api/admin/portal-ai", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl, model, apiKey: apiKey || undefined, enabled }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Gagal menyimpan konfigurasi");
            setConfig(data.config);
            setApiKey("");
            showToast("Konfigurasi AI portal disimpan", "success");
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Gagal menyimpan konfigurasi", "error");
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <p style={{ color: "var(--text-2)" }}>Memuat konfigurasi AI...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-3xl space-y-6">
            <div className="flex items-center gap-3">
                <Robot size={32} weight="duotone" style={{ color: "var(--accent)" }} />
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>
                        AI Portal — Deep Analysis Login
                    </h1>
                    <p className="text-sm" style={{ color: "var(--text-2)" }}>
                        Lapis LLM opsional untuk deteksi cara login otomatis saat heuristik belum yakin.
                    </p>
                </div>
                {config && (
                    <Badge tone={config.enabled ? "success" : "neutral"}>
                        {config.enabled ? "Aktif" : "Nonaktif"}
                    </Badge>
                )}
            </div>

            <Card>
                <form onSubmit={handleSave} className="space-y-4 p-6">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-1)" }}>
                            Base URL (OpenAI-compatible)
                        </label>
                        <Input
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://api.openai.com/v1 atau http://ollama:11434/v1"
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                            Endpoint yang menyediakan <code>/chat/completions</code>: OpenAI, OpenRouter, Ollama, LiteLLM, dsb.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-1)" }}>
                            Model
                        </label>
                        <Input
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="gpt-4o-mini, llama3.1, dsb."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-1)" }}>
                            API Key {config?.apiKeyMasked && <span style={{ color: "var(--text-3)" }}>(tersimpan: {config.apiKeyMasked})</span>}
                        </label>
                        <div className="relative">
                            <Input
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={config?.apiKeyMasked ? "Kosongkan untuk mempertahankan key lama" : "sk-..."}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                style={{ color: "var(--text-3)" }}
                                aria-label={showKey ? "Sembunyikan key" : "Tampilkan key"}
                            >
                                {showKey ? <EyeSlash size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                            Key dienkripsi AES-256-GCM sebelum disimpan. Kosong boleh bila endpoint lokal tidak butuh key.
                        </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-1)" }}>
                        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                        Aktifkan analisis AI pada deteksi otomatis Portal Apps
                    </label>

                    <Button type="submit" disabled={saving}>
                        <Sparkle size={16} className="mr-2" />
                        {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
                    </Button>
                </form>
            </Card>

            <Card>
                <div className="p-6 space-y-2 text-sm" style={{ color: "var(--text-2)" }}>
                    <h2 className="font-semibold" style={{ color: "var(--text-1)" }}>Cara kerja & batasan</h2>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>AI hanya dipanggil saat detektor heuristik belum yakin (form tidak ditemukan, login dua langkah, atau confidence rendah).</li>
                        <li>DOM dipangkas menjadi daftar form/field — nilai input, token, dan kredensial tidak pernah dikirim ke model.</li>
                        <li>Saran field AI diverifikasi ulang terhadap DOM nyata; saran yang mengarang nama field dibuang.</li>
                        <li>Bila AI gagal/timeout, deteksi tetap berjalan dengan heuristik (fail-closed).</li>
                    </ul>
                    {config?.lastUsedAt && (
                        <p className="pt-2">
                            Terakhir dipakai: {new Date(config.lastUsedAt).toLocaleString("id-ID")}
                            {config.lastError && <span style={{ color: "var(--danger, #dc2626)" }}> — error: {config.lastError}</span>}
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
}
