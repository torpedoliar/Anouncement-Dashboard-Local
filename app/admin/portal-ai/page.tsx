"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkle, Eye, EyeSlash, Robot, PlugsConnected } from "@phosphor-icons/react";
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
    maxTokens: number | null;
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
    const [maxTokens, setMaxTokens] = useState("");
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; reply: string | null; error: string | null } | null>(null);

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
                setMaxTokens(data.config.maxTokens != null ? String(data.config.maxTokens) : "");
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

    // Uji koneksi dengan nilai form saat ini (belum disimpan) — memakai key
    // tersimpan bila kolom API key kosong.
    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const response = await fetch("/api/admin/portal-ai/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl, model, apiKey: apiKey || undefined }),
            });
            const data = await response.json();
            setTestResult(data);
            showToast(data.ok ? `Koneksi berhasil (${data.latencyMs}ms)` : data.error || "Koneksi gagal", data.ok ? "success" : "error");
        } catch {
            setTestResult({ ok: false, latencyMs: 0, reply: null, error: "Gagal menghubungi server" });
            showToast("Gagal menghubungi server", "error");
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await fetch("/api/admin/portal-ai", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl, model, apiKey: apiKey || undefined, enabled, maxTokens: maxTokens || undefined }),
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

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-1)" }}>
                            Max tokens (kosongkan = default 2500)
                        </label>
                        <Input
                            type="number"
                            min={500}
                            max={32000}
                            value={maxTokens}
                            onChange={(e) => setMaxTokens(e.target.value)}
                            placeholder="2500"
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                            Budget token per analisis. Model reasoning (DeepSeek-R1, QwQ, dsb.) disarankan ≥4000.
                        </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-1)" }}>
                        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                        Aktifkan analisis AI pada deteksi otomatis Portal Apps
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit" disabled={saving || testing}>
                            <Sparkle size={16} className="mr-2" />
                            {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleTest} disabled={saving || testing}>
                            <PlugsConnected size={16} className="mr-2" />
                            {testing ? "Menguji..." : "Uji Koneksi"}
                        </Button>
                    </div>

                    {testResult && (
                        <div
                            className="rounded-control border p-3 text-sm"
                            style={{
                                borderColor: testResult.ok ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
                                color: "var(--text-1)",
                            }}
                        >
                            {testResult.ok
                                ? `Koneksi OK (${testResult.latencyMs}ms). Balasan model: ${testResult.reply ?? "-"}`
                                : `Koneksi gagal: ${testResult.error}`}
                        </div>
                    )}
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
