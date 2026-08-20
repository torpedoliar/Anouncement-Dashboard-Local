"use client";

import { useState, useEffect, useCallback } from "react";
import { CaretLeft, CaretRight, GridFour, LockKey, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import Table, { type TableColumn } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";

interface PortalApp {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    url: string;
    loginUrl: string | null;
    ssoMode: string;
    httpMethod: string;
    usernameField: string | null;
    passwordField: string | null;
    extraFields: any;
    category: string | null;
    isActive: boolean;
    isPublic: boolean;
    displayOrder: number;
    healthStatus?: string | null;
    healthStatusCode?: number | null;
    healthLatencyMs?: number | null;
    healthCheckedAt?: string | null;
    healthError?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const emptyForm = {
    name: "",
    slug: "",
    description: "",
    url: "",
    loginUrl: "",
    ssoMode: "FORM",
    httpMethod: "POST",
    usernameField: "username",
    passwordField: "password",
    extraFields: "",
    category: "",
    isActive: true,
    isPublic: true,
    displayOrder: 0,
};

export default function PortalAppsPage() {
    const [apps, setApps] = useState<PortalApp[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingApp, setEditingApp] = useState<PortalApp | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [detectMsg, setDetectMsg] = useState<{ type: "ok" | "err"; text: string; warnings?: string[] } | null>(null);
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchApps = useCallback(async () => {
        try {
            const response = await fetch(`/api/portal-apps?page=${page}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                setApps(data.data || data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Gagal memuat portal apps:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchApps();
    }, [fetchApps]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingApp ? `/api/portal-apps/${editingApp.id}` : "/api/portal-apps";
            const method = editingApp ? "PUT" : "POST";

            // Parse extraFields from JSON string to object
            let extraFieldsParsed = null;
            if (formData.extraFields && formData.extraFields.trim()) {
                try {
                    extraFieldsParsed = JSON.parse(formData.extraFields);
                } catch {
                    setError("Extra Fields harus berformat JSON yang valid");
                    setIsSaving(false);
                    return;
                }
            }

            const body: Record<string, unknown> = {
                name: formData.name,
                slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
                description: formData.description || null,
                url: formData.url,
                loginUrl: formData.loginUrl || null,
                ssoMode: formData.ssoMode,
                httpMethod: formData.httpMethod,
                usernameField: formData.usernameField || "username",
                passwordField: formData.passwordField || "password",
                extraFields: extraFieldsParsed,
                category: formData.category || null,
                isActive: formData.isActive,
                isPublic: formData.isPublic,
                displayOrder: Number(formData.displayOrder),
            };

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.details && Array.isArray(data.details)) {
                    const messages = data.details.map((d: any) => `${d.field}: ${d.message}`).join(', ');
                    setError(`${data.error}: ${messages}`);
                } else {
                    setError(data.error || "Gagal menyimpan data");
                }
                return;
            }

            closeModal();
            fetchApps();
        } catch {
            setError("Terjadi kesalahan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDetect = async () => {
        const target = (formData.loginUrl || "").trim();
        if (!target) {
            setDetectMsg({ type: "err", text: "Isi LOGIN URL terlebih dahulu." });
            return;
        }
        setDetecting(true);
        setDetectMsg(null);
        try {
            const res = await fetch("/api/portal-apps/detect-fields", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: target }),
            });
            const data = await res.json();
            if (!res.ok) {
                setDetectMsg({ type: "err", text: data.error || "Deteksi gagal" });
                return;
            }
            setFormData((prev) => ({
                ...prev,
                loginUrl: data.finalUrl || prev.loginUrl,
                usernameField: data.usernameField ?? prev.usernameField,
                passwordField: data.passwordField ?? prev.passwordField,
                httpMethod: data.httpMethod ?? prev.httpMethod,
                ssoMode: data.cookiePaired ? "VAULT" : prev.ssoMode,
                extraFields: Object.keys(data.extraFields || {}).length
                    ? JSON.stringify(data.extraFields, null, 2)
                    : prev.extraFields,
            }));
            const detectedInfo = [
                data.usernameField ? `User: ${data.usernameField}` : null,
                data.passwordField ? `Pass: ${data.passwordField}` : null,
            ].filter(Boolean).join(" | ");
            setDetectMsg({
                type: "ok",
                text: `Berhasil terdeteksi: ${detectedInfo}`,
                warnings: data.warnings,
            });
        } catch {
            setDetectMsg({ type: "err", text: "Terjadi kesalahan saat deteksi." });
        } finally {
            setDetecting(false);
        }
    };

    const handleDelete = async (app: PortalApp) => {
        if (!(await confirm({ title: "Hapus Aplikasi", message: `Hapus aplikasi "${app.name}"?`, variant: "danger" }))) return;

        try {
            const response = await fetch(`/api/portal-apps/${app.id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal menghapus", "error");
                return;
            }
            fetchApps();
            showToast("Aplikasi berhasil dihapus", "success");
        } catch {
            showToast("Terjadi kesalahan", "error");
        }
    };

    const openAddModal = () => {
        setEditingApp(null);
        setFormData(emptyForm);
        setError("");
        setShowModal(true);
    };

    const openEditModal = (app: PortalApp) => {
        let extraFieldsFormatted = "";
        if (app.extraFields) {
            if (typeof app.extraFields === "object") {
                extraFieldsFormatted = JSON.stringify(app.extraFields, null, 2);
            } else if (typeof app.extraFields === "string") {
                try {
                    extraFieldsFormatted = JSON.stringify(JSON.parse(app.extraFields), null, 2);
                } catch {
                    extraFieldsFormatted = app.extraFields;
                }
            }
        }

        setEditingApp(app);
        setFormData({
            name: app.name,
            slug: app.slug,
            description: app.description || "",
            url: app.url,
            loginUrl: app.loginUrl || "",
            ssoMode: app.ssoMode,
            httpMethod: app.httpMethod,
            usernameField: app.usernameField || "",
            passwordField: app.passwordField || "",
            extraFields: extraFieldsFormatted,
            category: app.category || "",
            isActive: app.isActive,
            isPublic: app.isPublic ?? true,
            displayOrder: app.displayOrder,
        });
        setError("");
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingApp(null);
        setFormData(emptyForm);
        setError("");
    };

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-7 w-48 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div className="h-10 w-40 animate-pulse rounded bg-surface-2" />
                </div>

                {/* Stats skeleton */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-card border border-border p-4 shadow-lvl-1">
                            <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-2" />
                            <div className="h-7 w-12 animate-pulse rounded bg-surface-2" />
                        </div>
                    ))}
                </div>

                {/* Ledger-shaped skeleton */}
                <div className="rounded-card border border-border shadow-lvl-1">
                    <div className="flex gap-4 border-b border-border px-4 py-3">
                        <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                                <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
                                <div className="h-6 w-16 animate-pulse rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const activeCount = apps.filter(a => a.isActive).length;
    const inactiveCount = apps.filter(a => !a.isActive).length;

    const columns: TableColumn[] = [
        { key: "name", header: "NAMA" },
        { key: "slug", header: "SLUG" },
        { key: "health", header: "SERVER HEALTH" },
        { key: "category", header: "KATEGORI" },
        { key: "ssoMode", header: "SSO MODE" },
        { key: "visibility", header: "VISIBILITAS" },
        { key: "status", header: "STATUS" },
        { key: "order", header: "URUTAN" },
        { key: "actions", header: "AKSI" },
    ];

    const rows = apps.map((app) => [
        <div key="name" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-border bg-surface-2">
                <GridFour size={14} className="text-text-2" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-1">{app.name}</p>
                {app.description && (
                    <p className="max-w-48 truncate text-xs text-text-3">{app.description}</p>
                )}
            </div>
        </div>,
        <span key="slug" className="font-mono text-xs tabular-nums text-text-2">{app.slug}</span>,
        <div key="health" className="flex items-center gap-1.5 text-xs">
            {app.healthStatus === "ONLINE" && (
                <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 font-semibold text-success border border-success/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Online{app.healthLatencyMs ? ` (${app.healthLatencyMs}ms)` : ""}
                </span>
            )}
            {app.healthStatus === "DEGRADED" && (
                <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 font-semibold text-warning border border-warning/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    Lambat{app.healthLatencyMs ? ` (${app.healthLatencyMs}ms)` : ""}
                </span>
            )}
            {app.healthStatus === "OFFLINE" && (
                <span className="inline-flex items-center gap-1 rounded bg-danger px-2 py-0.5 font-bold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    Gangguan
                </span>
            )}
            {(!app.healthStatus || app.healthStatus === "UNKNOWN") && (
                <span className="text-text-3 text-xs">-</span>
            )}
        </div>,
        app.category ? (
            <Badge key="category" tone="info">{app.category}</Badge>
        ) : (
            <span key="category" className="text-xs text-text-3">-</span>
        ),
        <Badge key="ssoMode" tone="neutral">{app.ssoMode}</Badge>,
        app.isPublic ? (
            <Badge key="visibility" tone="success">Publik</Badge>
        ) : (
            <Badge key="visibility" tone="neutral">
                <LockKey size={12} aria-hidden="true" />
                Terbatas
            </Badge>
        ),
        <Badge key="status" tone={app.isActive ? "success" : "neutral"}>
            {app.isActive ? "AKTIF" : "NONAKTIF"}
        </Badge>,
        <span key="order" className="font-mono text-xs tabular-nums text-text-2">{app.displayOrder}</span>,
        <div key="actions" className="inline-flex items-center gap-1">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openEditModal(app)}
                aria-label="Edit"
                title="Edit"
            >
                <PencilSimple size={14} />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(app)}
                aria-label="Hapus"
                title="Hapus"
                className="text-danger"
            >
                <Trash size={14} />
            </Button>
        </div>,
    ]);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold tracking-widest text-accent">PORTAL</p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Aplikasi Portal</h1>
                </div>
                <Button type="button" iconLeft={<Plus size={14} aria-hidden="true" />} onClick={openAddModal}>
                    Tambah Aplikasi
                </Button>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">TOTAL APLIKASI</p>
                    <p className="font-display text-2xl font-semibold text-text-1">{pagination?.total || apps.length}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">AKTIF</p>
                    <p className="font-display text-2xl font-semibold text-success">{activeCount}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">NONAKTIF</p>
                    <p className="font-display text-2xl font-semibold text-danger">{inactiveCount}</p>
                </Card>
            </div>

            {/* Table */}
            {apps.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-card border border-border p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-2">
                        <GridFour size={24} className="text-text-3" aria-hidden="true" />
                    </div>
                    <p className="text-text-3">Belum ada aplikasi.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                    <Table
                        columns={columns}
                        rows={rows}
                        ariaLabel="Daftar aplikasi portal"
                    />
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-xs tabular-nums text-text-3">
                        {((pagination.page - 1) * pagination.limit) + 1}–
                        {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            aria-label="Halaman sebelumnya"
                        >
                            <CaretLeft size={14} aria-hidden="true" />
                        </Button>
                        <span className="font-mono text-xs tabular-nums text-text-2">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            aria-label="Halaman berikutnya"
                        >
                            <CaretRight size={14} aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Modal — shell (portal, focus trap, Escape, kunci scroll) dari kit */}
            <Modal
                open={showModal}
                onClose={closeModal}
                title={editingApp ? "Edit Aplikasi" : "Tambah Aplikasi"}
                size="lg"
            >
                        {error && (
                            <div
                                className="mb-4 rounded-control border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="NAMA *"
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                                <Input
                                    label="SLUG *"
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    required
                                />
                            </div>

                            <Input
                                label="DESKRIPSI"
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="URL *"
                                    type="text"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    required
                                    placeholder="https://app.example.com"
                                />
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-text-1">LOGIN URL</span>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleDetect}
                                            disabled={detecting}
                                        >
                                            {detecting ? "Mendeteksi..." : "Deteksi Otomatis"}
                                        </Button>
                                    </div>
                                    <Input
                                        type="text"
                                        value={formData.loginUrl}
                                        onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                                        placeholder="https://app.example.com/login"
                                    />
                                    {detectMsg && (
                                        <div className="mt-1 space-y-1">
                                            <p className={`text-xs ${detectMsg.type === "ok" ? "text-success" : "text-danger"}`}>
                                                {detectMsg.text}
                                            </p>
                                            {detectMsg.warnings?.map((w, i) => (
                                                <p key={i} className="text-xs text-warning">
                                                    ⚠ {w}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Select
                                    label="SSO MODE"
                                    value={formData.ssoMode}
                                    onChange={(e) => setFormData({ ...formData, ssoMode: e.target.value })}
                                    options={[
                                        { value: "FORM", label: "FORM" },
                                        { value: "REDIRECT", label: "REDIRECT" },
                                        { value: "PROXY", label: "PROXY" },
                                        { value: "TOKEN", label: "TOKEN" },
                                        { value: "REROUTE", label: "REROUTE" },
                                        { value: "VAULT", label: "VAULT" },
                                    ]}
                                />
                                <Select
                                    label="HTTP METHOD"
                                    value={formData.httpMethod}
                                    onChange={(e) => setFormData({ ...formData, httpMethod: e.target.value })}
                                    options={[
                                        { value: "POST", label: "POST" },
                                        { value: "GET", label: "GET" },
                                    ]}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="USERNAME FIELD"
                                    type="text"
                                    value={formData.usernameField}
                                    onChange={(e) => setFormData({ ...formData, usernameField: e.target.value })}
                                    placeholder="username"
                                />
                                <Input
                                    label="PASSWORD FIELD"
                                    type="text"
                                    value={formData.passwordField}
                                    onChange={(e) => setFormData({ ...formData, passwordField: e.target.value })}
                                    placeholder="password"
                                />
                            </div>

                            <div>
                                <span className="mb-2 block text-sm font-semibold text-text-1">EXTRA FIELDS (JSON)</span>
                                <textarea
                                    value={formData.extraFields}
                                    onChange={(e) => setFormData({ ...formData, extraFields: e.target.value })}
                                    placeholder='{"key": "value"}'
                                    rows={3}
                                    className="w-full resize-y rounded-control border border-border bg-surface-1 px-3 py-2 font-mono text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <Input
                                    label="KATEGORI"
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                />
                                <Input
                                    label="URUTAN"
                                    type="number"
                                    value={formData.displayOrder}
                                    onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                                />
                                <div className="flex flex-col justify-end gap-2 pb-1">
                                    <label className="flex items-center gap-2 text-sm text-text-1">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="h-4 w-4 cursor-pointer accent-accent"
                                        />
                                        Aktif
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 text-sm text-text-1">
                                        <input
                                            type="checkbox"
                                            checked={formData.isPublic}
                                            onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                                            className="h-4 w-4 cursor-pointer accent-accent"
                                        />
                                        <span>Publik (berlaku untuk semua pengguna)</span>
                                    </label>
                                    <span className="text-xs text-text-3">
                                        — kosongkan untuk restricted (hanya user/grup berhak akses)
                                    </span>
                                </div>
                            </div>

                            {/* Aksi tetap di dalam <form> agar type="submit" bekerja. */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={closeModal}
                                    disabled={isSaving}
                                >
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? "Menyimpan..." : "Simpan"}
                                </Button>
                            </div>
                        </form>
            </Modal>
            <ConfirmDialog />
        </div>
    );
}