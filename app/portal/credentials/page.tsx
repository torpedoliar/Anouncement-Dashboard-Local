"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CaretDown, Eye, EyeSlash, Key, Plus, Trash } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";

interface AccountInfo {
    id: string;
    label: string;
    lastUsedAt: string | null;
}

interface CredentialStatus {
    appId: string;
    appName: string;
    appSlug: string;
    credentialCount: number;
    lastUsedAt: string | null;
    accounts: AccountInfo[];
}

export default function CredentialsPage() {
    const searchParams = useSearchParams();
    const highlightApp = searchParams.get("app");

    const [apps, setApps] = useState<CredentialStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedApp, setExpandedApp] = useState<string | null>(highlightApp);
    // Form per app: label + username + password (klik "Tambah Akun")
    const [formData, setFormData] = useState<Record<string, { label: string; username: string; password: string }>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [revealPass, setRevealPass] = useState<Record<string, boolean>>({});
    const [credToDelete, setCredToDelete] = useState<AccountInfo | null>(null);
    const { showToast } = useToast();

    const fetchCredentials = useCallback(async () => {
        try {
            const res = await fetch("/api/portal/credentials");
            if (res.ok) {
                const data = await res.json();
                setApps(data);
                const initial: Record<string, { label: string; username: string; password: string }> = {};
                data.forEach((app: CredentialStatus) => {
                    initial[app.appId] = { label: "", username: "", password: "" };
                });
                setFormData(initial);
            }
        } catch (err) {
            console.error("Failed to fetch credentials:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCredentials();
    }, [fetchCredentials]);

    useEffect(() => {
        if (highlightApp) {
            setExpandedApp(highlightApp);
        }
    }, [highlightApp]);

    const handleSave = async (appId: string) => {
        const data = formData[appId];
        if (!data?.label || !data?.username || !data?.password) {
            showToast("Label, username, dan password harus diisi", "error");
            return;
        }

        setSaving(appId);
        try {
            const res = await fetch("/api/portal/credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appId,
                    label: data.label,
                    username: data.username,
                    password: data.password,
                }),
            });

            if (res.ok) {
                setFormData((prev) => ({
                    ...prev,
                    [appId]: { label: "", username: "", password: "" },
                }));
                await fetchCredentials();
                showToast("Akun berhasil disimpan", "success");
            } else {
                const err = await res.json();
                showToast(err.error || "Gagal menyimpan akun", "error");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setSaving(null);
        }
    };

    const executeDelete = async (cred: AccountInfo) => {
        try {
            const res = await fetch(`/api/portal/credentials?credentialId=${cred.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchCredentials();
                showToast("Akun berhasil dihapus", "success");
            } else {
                showToast("Gagal menghapus akun", "error");
            }
        } catch {
            showToast("Gagal menghapus akun", "error");
        }
    };

    return (
        <div className="mx-auto max-w-[800px] p-8">
            <div className="mb-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">PORTAL SSO</p>
                <h1 className="font-display text-2xl font-semibold text-text-1">Kredensial</h1>
                <p className="mt-2 text-sm text-text-2">
                    Ketik password aplikasi target supaya portal bisa login untuk Anda. Kredensial Anda disimpan terenkripsi.
                </p>
            </div>

            {isLoading ? (
                <div className="py-16 text-center text-sm text-text-3">Loading...</div>
            ) : apps.length === 0 ? (
                <div className="mx-auto max-w-[400px] rounded-sheet border border-border bg-surface-1 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sheet bg-surface-2">
                        <Key size={24} className="text-text-2" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-sm text-text-2">Belum ada aplikasi yang di-assign ke Anda.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {apps.map((app) => {
                        const isExpanded = expandedApp === app.appId;
                        const data = formData[app.appId] || { label: "", username: "", password: "" };
                        const showPass = !!revealPass[app.appId];

                        return (
                            <Card key={app.appId} className="overflow-hidden">
                                {/* Header (klik untuk expand) */}
                                <button
                                    type="button"
                                    onClick={() => setExpandedApp(isExpanded ? null : app.appId)}
                                    aria-expanded={isExpanded}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-surface-3 text-sm font-semibold text-text-2">
                                            {app.appName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-text-1">{app.appName}</div>
                                            <div className={`mt-2 text-xs ${app.credentialCount > 0 ? "text-success" : "text-warning"}`}>
                                                {app.credentialCount > 0
                                                    ? <><span className="font-mono tabular-nums">{app.credentialCount}</span> akun tersimpan</>
                                                    : "Belum ada akun"}
                                            </div>
                                        </div>
                                    </div>
                                    <CaretDown
                                        size={16}
                                        className={`shrink-0 text-text-2 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                        aria-hidden="true"
                                    />
                                </button>

                                {/* Expanded: daftar akun + form tambah */}
                                {isExpanded && (
                                    <div className="border-t border-border p-4">
                                        {/* Daftar akun */}
                                        {app.accounts.length > 0 && (
                                            <div className="mb-4 flex flex-col gap-2">
                                                {app.accounts.map((acc) => (
                                                    <div key={acc.id} className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-0 px-4 py-3">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold text-text-1">{acc.label}</div>
                                                            <div className="mt-2 text-xs text-text-3">
                                                                {acc.lastUsedAt ? (
                                                                    <>
                                                                        Terakhir dipakai <span className="font-mono tabular-nums">{new Date(acc.lastUsedAt).toLocaleDateString()}</span>
                                                                    </>
                                                                ) : (
                                                                    "Belum pernah dipakai"
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={`/portal/app/${app.appSlug}?credentialId=${acc.id}`}
                                                                aria-label={`Buka ${app.appName} dengan akun ${acc.label}`}
                                                                className="inline-flex min-h-11 items-center justify-center rounded-control border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                                            >
                                                                Coba Buka
                                                            </a>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setCredToDelete(acc); }}
                                                                aria-label={`Hapus akun ${acc.label}`}
                                                                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control px-3 py-2 text-xs font-semibold text-danger transition-colors duration-150 hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                                            >
                                                                <Trash size={16} aria-hidden="true" /> Hapus
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Form tambah akun */}
                                        <div className="flex flex-col gap-4">
                                            <Input
                                                label="Label Akun"
                                                type="text"
                                                value={data.label}
                                                onChange={(e) => setFormData((prev) => ({
                                                    ...prev,
                                                    [app.appId]: { ...prev[app.appId], label: e.target.value },
                                                }))}
                                                placeholder="Mis. Akun Pusat / Akun Cabang"
                                            />
                                            <Input
                                                label="Username"
                                                type="text"
                                                value={data.username}
                                                onChange={(e) => setFormData((prev) => ({
                                                    ...prev,
                                                    [app.appId]: { ...prev[app.appId], username: e.target.value },
                                                }))}
                                                placeholder="Username aplikasi"
                                            />
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        label="Password"
                                                        type={showPass ? "text" : "password"}
                                                        value={data.password}
                                                        onChange={(e) => setFormData((prev) => ({
                                                            ...prev,
                                                            [app.appId]: { ...prev[app.appId], password: e.target.value },
                                                        }))}
                                                        placeholder="Password aplikasi"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setRevealPass((prev) => ({ ...prev, [app.appId]: !prev[app.appId] }))}
                                                    aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                                                    aria-pressed={showPass}
                                                    className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-text-1 hover:bg-surface-2"
                                                >
                                                    {showPass ? <EyeSlash size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            <div>
                                                <Button
                                                    variant="primary"
                                                    iconLeft={<Plus size={16} aria-hidden="true" />}
                                                    onClick={() => handleSave(app.appId)}
                                                    disabled={saving === app.appId}
                                                >
                                                    {saving === app.appId ? "Menyimpan..." : "Tambah Akun"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={!!credToDelete}
                title="Hapus Akun"
                message={credToDelete ? `Hapus akun "${credToDelete.label}" untuk aplikasi ini?` : ""}
                confirmLabel="Hapus"
                cancelLabel="Batal"
                variant="danger"
                onConfirm={() => {
                    if (credToDelete) executeDelete(credToDelete);
                    setCredToDelete(null);
                }}
                onCancel={() => setCredToDelete(null)}
            />
        </div>
    );
}