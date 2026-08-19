"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    CaretDown,
    Eye,
    EyeSlash,
    Key,
    Plus,
    Trash,
    PencilSimple,
    Copy,
    Check,
    LockKey,
    ArrowsClockwise,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";

interface AccountInfo {
    id: string;
    label: string;
    username: string;
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

    // Form per app untuk tambah akun baru
    const [formData, setFormData] = useState<Record<string, { label: string; username: string; password: string }>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [revealNewPass, setRevealNewPass] = useState<Record<string, boolean>>({});

    // State untuk akun yang di-reveal (plaintext password tersimpan di memori client setelah verifikasi)
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // State Modal Re-Authentication (Cek Password Portal)
    const [reAuthTarget, setReAuthTarget] = useState<{ account: AccountInfo; appName: string } | null>(null);
    const [portalPassword, setPortalPassword] = useState("");
    const [showPortalPass, setShowPortalPass] = useState(false);
    const [reAuthError, setReAuthError] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    // State Modal Edit Kredensial
    const [editTarget, setEditTarget] = useState<{ account: AccountInfo; appId: string; appName: string } | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [editUsername, setEditUsername] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [showEditPass, setShowEditPass] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editError, setEditError] = useState("");

    // State Hapus Akun
    const [credToDelete, setCredToDelete] = useState<{ account: AccountInfo; appName: string } | null>(null);

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

    // Tambah akun baru
    const handleSaveNew = async (appId: string) => {
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
                showToast("Akun baru berhasil disimpan", "success");
            } else {
                const err = await res.json();
                showToast(err.error || "Gagal menyimpan akun", "error");
            }
        } catch {
            showToast("Terjadi kesalahan jaringan", "error");
        } finally {
            setSaving(null);
        }
    };

    // Buka modal verifikasi untuk reveal password
    const handleRequestReveal = (account: AccountInfo, appName: string) => {
        if (revealedPasswords[account.id]) {
            // Jika sudah terungkap, toggle sembunyikan kembali
            setRevealedPasswords((prev) => {
                const copy = { ...prev };
                delete copy[account.id];
                return copy;
            });
            return;
        }

        setReAuthTarget({ account, appName });
        setPortalPassword("");
        setShowPortalPass(false);
        setReAuthError("");
    };

    // Eksekusi verifikasi password portal & reveal password
    const handleVerifyAndReveal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reAuthTarget) return;
        if (!portalPassword) {
            setReAuthError("Masukkan password login portal Anda");
            return;
        }

        setIsVerifying(true);
        setReAuthError("");

        try {
            const res = await fetch("/api/portal/credentials/reveal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    credentialId: reAuthTarget.account.id,
                    portalPassword,
                }),
            });

            const data = await res.json();
            if (res.ok && data.password) {
                setRevealedPasswords((prev) => ({
                    ...prev,
                    [reAuthTarget.account.id]: data.password,
                }));
                showToast(`Password untuk "${reAuthTarget.account.label}" berhasil dibuka`, "success");
                setReAuthTarget(null);
            } else {
                setReAuthError(data.error || "Password login portal salah");
            }
        } catch {
            setReAuthError("Terjadi kesalahan verifikasi");
        } finally {
            setIsVerifying(false);
        }
    };

    // Salin password ke clipboard
    const handleCopyPassword = (credId: string, pass: string) => {
        navigator.clipboard.writeText(pass);
        setCopiedId(credId);
        showToast("Password disalin ke clipboard", "success");
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Buka modal edit akun
    const handleOpenEdit = (account: AccountInfo, appId: string, appName: string) => {
        setEditTarget({ account, appId, appName });
        setEditLabel(account.label);
        setEditUsername(account.username || "");
        setEditPassword(revealedPasswords[account.id] || "");
        setShowEditPass(false);
        setEditError("");
    };

    // Simpan perubahan edit akun
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;

        if (!editLabel.trim() || !editUsername.trim()) {
            setEditError("Label dan username tidak boleh kosong");
            return;
        }

        setIsUpdating(true);
        setEditError("");

        try {
            const res = await fetch("/api/portal/credentials", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    credentialId: editTarget.account.id,
                    label: editLabel.trim(),
                    username: editUsername.trim(),
                    password: editPassword.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                if (editPassword.trim()) {
                    setRevealedPasswords((prev) => ({
                        ...prev,
                        [editTarget.account.id]: editPassword.trim(),
                    }));
                }
                await fetchCredentials();
                showToast("Kredensial berhasil diperbarui", "success");
                setEditTarget(null);
            } else {
                setEditError(data.error || "Gagal memperbarui kredensial");
            }
        } catch {
            setEditError("Terjadi kesalahan jaringan");
        } finally {
            setIsUpdating(false);
        }
    };

    // Eksekusi hapus akun
    const executeDelete = async (cred: AccountInfo) => {
        try {
            const res = await fetch(`/api/portal/credentials?credentialId=${cred.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setRevealedPasswords((prev) => {
                    const copy = { ...prev };
                    delete copy[cred.id];
                    return copy;
                });
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
        <div className="mx-auto max-w-[840px] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">PORTAL SSO</p>
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-3 border border-border">
                            Enkripsi AES-256-GCM
                        </span>
                    </div>
                    <h1 className="font-display text-2xl font-bold text-text-1">Manajemen Kredensial Aplikasi</h1>
                    <p className="mt-1 text-sm text-text-2">
                        Kelola akun dan password aplikasi target Anda. Kredensial tersimpan secara terenkripsi dan otomatis digunakan saat SSO.
                    </p>
                </div>
                <Button variant="secondary" size="sm" onClick={fetchCredentials} className="gap-2 shrink-0">
                    <ArrowsClockwise size={14} /> Refresh
                </Button>
            </div>

            {isLoading ? (
                <div className="py-16 text-center text-sm text-text-3 space-y-3">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    <p>Memuat kredensial aplikasi...</p>
                </div>
            ) : apps.length === 0 ? (
                <div className="mx-auto max-w-[440px] rounded-sheet border border-border bg-surface-1 p-10 text-center shadow-lvl-1">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
                        <Key size={26} className="text-text-2" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-text-1">Belum Ada Aplikasi Terkait</h3>
                    <p className="mt-1 text-sm text-text-3">
                        Anda belum memiliki aplikasi yang di-assign. Hubungi administrator HRIS/IT untuk mendapatkan hak akses.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {apps.map((app) => {
                        const isExpanded = expandedApp === app.appId;
                        const data = formData[app.appId] || { label: "", username: "", password: "" };
                        const showNewPass = !!revealNewPass[app.appId];

                        return (
                            <Card key={app.appId} className="overflow-hidden border border-border transition-shadow hover:shadow-lvl-1">
                                {/* Header (klik untuk expand/collapse) */}
                                <button
                                    type="button"
                                    onClick={() => setExpandedApp(isExpanded ? null : app.appId)}
                                    aria-expanded={isExpanded}
                                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-accent hover:bg-surface-2/40 transition-colors"
                                >
                                    <div className="flex min-w-0 items-center gap-3.5">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-3 text-base font-bold text-accent border border-border">
                                            {app.appName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-base font-semibold text-text-1">{app.appName}</div>
                                            <div className={`mt-0.5 text-xs font-medium ${app.credentialCount > 0 ? "text-success" : "text-warning"}`}>
                                                {app.credentialCount > 0
                                                    ? <><span className="font-mono font-bold tabular-nums">{app.credentialCount}</span> akun tersimpan</>
                                                    : "Belum ada akun tersimpan"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {app.lastUsedAt && (
                                            <span className="hidden sm:inline text-xs text-text-3">
                                                Terakhir SSO: <span className="font-mono text-text-2">{new Date(app.lastUsedAt).toLocaleDateString("id-ID")}</span>
                                            </span>
                                        )}
                                        <CaretDown
                                            size={18}
                                            className={`shrink-0 text-text-2 transition-transform duration-200 ${isExpanded ? "rotate-180 text-accent" : ""}`}
                                            aria-hidden="true"
                                        />
                                    </div>
                                </button>

                                {/* Expanded: daftar akun tersimpan + form tambah akun baru */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-surface-0/50 p-5 space-y-5">
                                        {/* Daftar Akun yang Tersimpan */}
                                        {app.accounts.length > 0 && (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-text-3">
                                                    Daftar Akun Tersimpan ({app.accounts.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {app.accounts.map((acc) => {
                                                        const isRevealed = !!revealedPasswords[acc.id];
                                                        const revealedPass = revealedPasswords[acc.id];

                                                        return (
                                                            <div
                                                                key={acc.id}
                                                                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1"
                                                            >
                                                                {/* Account Info Details */}
                                                                <div className="min-w-0 space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="truncate text-sm font-bold text-text-1">{acc.label}</span>
                                                                        <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-mono text-text-3 border border-border">
                                                                            ID: {acc.id.slice(-6)}
                                                                        </span>
                                                                    </div>

                                                                    {/* Username & Password Display */}
                                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-text-3">Username:</span>
                                                                            <span className="font-mono font-semibold text-text-1 bg-surface-2 px-2 py-0.5 rounded border border-border">
                                                                                {acc.username || "-"}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-text-3">Password:</span>
                                                                            <span className="font-mono font-semibold text-text-1 bg-surface-2 px-2 py-0.5 rounded border border-border">
                                                                                {isRevealed ? revealedPass : "••••••••"}
                                                                            </span>

                                                                            {/* Tombol Lihat/Sembunyikan Password */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRequestReveal(acc, app.appName)}
                                                                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold border transition-colors ${
                                                                                    isRevealed
                                                                                        ? "bg-accent text-white border-accent"
                                                                                        : "bg-surface-2 text-text-2 border-border hover:text-text-1"
                                                                                }`}
                                                                                title={isRevealed ? "Sembunyikan password" : "Verifikasi password portal untuk melihat"}
                                                                            >
                                                                                {isRevealed ? <EyeSlash size={13} /> : <Eye size={13} />}
                                                                                {isRevealed ? "Tutup" : "Lihat"}
                                                                            </button>

                                                                            {/* Tombol Salin jika sudah ter-reveal */}
                                                                            {isRevealed && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleCopyPassword(acc.id, revealedPass)}
                                                                                    className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-2 border border-border hover:text-text-1 transition-colors"
                                                                                    title="Salin password"
                                                                                >
                                                                                    {copiedId === acc.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                                                                                    {copiedId === acc.id ? "Disalin!" : "Salin"}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="text-[11px] text-text-3">
                                                                        {acc.lastUsedAt ? (
                                                                            <>Terakhir SSO: <span className="font-mono tabular-nums text-text-2">{new Date(acc.lastUsedAt).toLocaleString("id-ID")}</span></>
                                                                        ) : (
                                                                            "Belum pernah digunakan via SSO"
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Action Buttons */}
                                                                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                                                                    <a
                                                                        href={`/portal/app/${app.appSlug}?credentialId=${acc.id}`}
                                                                        aria-label={`Buka ${app.appName} dengan akun ${acc.label}`}
                                                                        className="inline-flex min-h-9 items-center justify-center rounded-control bg-accent px-3 text-xs font-bold text-white hover:bg-accent-hover transition-colors shadow-sm"
                                                                    >
                                                                        Buka SSO
                                                                    </a>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEdit(acc, app.appId, app.appName)}
                                                                        aria-label={`Edit akun ${acc.label}`}
                                                                        className="inline-flex min-h-9 items-center gap-1 rounded-control border border-border bg-surface-1 px-2.5 py-1.5 text-xs font-semibold text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors"
                                                                        title="Edit Akun"
                                                                    >
                                                                        <PencilSimple size={15} /> Edit
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCredToDelete({ account: acc, appName: app.appName })}
                                                                        aria-label={`Hapus akun ${acc.label}`}
                                                                        className="inline-flex min-h-9 items-center justify-center rounded-control border border-danger/30 bg-danger-subtle/40 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors"
                                                                        title="Hapus Akun"
                                                                    >
                                                                        <Trash size={15} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Form Tambah Akun Baru */}
                                        <div className="rounded-card border border-border bg-surface-1 p-4 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-1.5">
                                                <Plus size={14} className="text-accent" /> Tambah Akun Baru untuk {app.appName}
                                            </h4>

                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <Input
                                                    label="Label Akun"
                                                    type="text"
                                                    value={data.label}
                                                    onChange={(e) => setFormData((prev) => ({
                                                        ...prev,
                                                        [app.appId]: { ...prev[app.appId], label: e.target.value },
                                                    }))}
                                                    placeholder="Mis. Akun Pusat / Cabang"
                                                />
                                                <Input
                                                    label="Username Aplikasi"
                                                    type="text"
                                                    value={data.username}
                                                    onChange={(e) => setFormData((prev) => ({
                                                        ...prev,
                                                        [app.appId]: { ...prev[app.appId], username: e.target.value },
                                                    }))}
                                                    placeholder="Username / NIK / ID"
                                                />
                                                <div>
                                                    <label className="mb-2 block text-xs font-semibold text-text-2">Password Aplikasi</label>
                                                    <div className="relative">
                                                        <Input
                                                            type={showNewPass ? "text" : "password"}
                                                            value={data.password}
                                                            onChange={(e) => setFormData((prev) => ({
                                                                ...prev,
                                                                [app.appId]: { ...prev[app.appId], password: e.target.value },
                                                            }))}
                                                            placeholder="Password target"
                                                            className="pr-10"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setRevealNewPass((prev) => ({ ...prev, [app.appId]: !prev[app.appId] }))}
                                                            aria-label={showNewPass ? "Sembunyikan password" : "Lihat password"}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
                                                        >
                                                            {showNewPass ? <EyeSlash size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    iconLeft={<Plus size={15} aria-hidden="true" />}
                                                    onClick={() => handleSaveNew(app.appId)}
                                                    disabled={saving === app.appId}
                                                >
                                                    {saving === app.appId ? "Menyimpan..." : "Simpan Akun Baru"}
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

            {/* ========================================================================= */}
            {/* MODAL: VERIFIKASI PASSWORD PORTAL UNTUK LIHAT PASSWORD TERSIMPAN */}
            {/* ========================================================================= */}
            <Modal
                open={!!reAuthTarget}
                onClose={() => setReAuthTarget(null)}
                title="Verifikasi Keamanan Password"
                description="Untuk alasan keamanan ISO 27001, masukkan password login Portal SJA Anda untuk melihat password akun yang tersimpan."
                size="sm"
            >
                <form onSubmit={handleVerifyAndReveal} className="space-y-4">
                    <div className="rounded bg-surface-2 p-3 text-xs space-y-1 border border-border">
                        <div className="text-text-3">Aplikasi: <strong className="text-text-1">{reAuthTarget?.appName}</strong></div>
                        <div className="text-text-3">Label Akun: <strong className="text-text-1">{reAuthTarget?.account.label}</strong> ({reAuthTarget?.account.username})</div>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold text-text-2">
                            Password Login Portal SJA Anda
                        </label>
                        <div className="relative">
                            <Input
                                type={showPortalPass ? "text" : "password"}
                                value={portalPassword}
                                onChange={(e) => setPortalPassword(e.target.value)}
                                placeholder="Masukkan password portal Anda"
                                required
                                autoFocus
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPortalPass(!showPortalPass)}
                                aria-label={showPortalPass ? "Sembunyikan password" : "Lihat password"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
                            >
                                {showPortalPass ? <EyeSlash size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {reAuthError && (
                            <p className="mt-1.5 text-xs font-medium text-danger">{reAuthError}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setReAuthTarget(null)}>
                            Batal
                        </Button>
                        <Button type="submit" variant="primary" disabled={isVerifying} iconLeft={<LockKey size={16} />}>
                            {isVerifying ? "Memverifikasi..." : "Verifikasi & Buka"}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL: EDIT / UPDATE KREDENSIAL */}
            {/* ========================================================================= */}
            <Modal
                open={!!editTarget}
                onClose={() => setEditTarget(null)}
                title={`Edit Kredensial - ${editTarget?.appName}`}
                description="Perbarui label, username, atau password akun yang tersimpan."
                size="md"
            >
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <Input
                        label="Label Akun"
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Mis. Akun Utama / Cabang"
                        required
                    />

                    <Input
                        label="Username Aplikasi Target"
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder="Username aplikasi"
                        required
                    />

                    <div>
                        <label className="mb-2 block text-xs font-semibold text-text-2">
                            Password Baru (Opsional)
                        </label>
                        <div className="relative">
                            <Input
                                type={showEditPass ? "text" : "password"}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="Kosongkan jika tidak ingin mengubah password"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowEditPass(!showEditPass)}
                                aria-label={showEditPass ? "Sembunyikan password" : "Lihat password"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
                            >
                                {showEditPass ? <EyeSlash size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <span className="mt-1 block text-[11px] text-text-3">
                            Biarkan kosong bila ingin tetap menggunakan password yang tersimpan sebelumnya.
                        </span>
                        {editError && (
                            <p className="mt-1.5 text-xs font-medium text-danger">{editError}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
                            Batal
                        </Button>
                        <Button type="submit" variant="primary" disabled={isUpdating}>
                            {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Dialog Konfirmasi Hapus Akun */}
            <ConfirmDialog
                open={!!credToDelete}
                title="Hapus Kredensial Akun"
                message={credToDelete ? `Hapus akun "${credToDelete.account.label}" (${credToDelete.account.username}) pada ${credToDelete.appName}? Tindakan ini tidak dapat dibatalkan.` : ""}
                confirmLabel="Hapus Akun"
                cancelLabel="Batal"
                variant="danger"
                onConfirm={() => {
                    if (credToDelete) executeDelete(credToDelete.account);
                    setCredToDelete(null);
                }}
                onCancel={() => setCredToDelete(null)}
            />
        </div>
    );
}