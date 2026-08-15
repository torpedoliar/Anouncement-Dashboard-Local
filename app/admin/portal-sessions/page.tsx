"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowClockwise, CaretLeft, CaretRight, Clock, Monitor, Trash } from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import Table, { type TableColumn } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";

interface PortalUser {
    id: string;
    name: string;
    email: string;
}

interface PortalSession {
    id: string;
    portalUserId: string;
    ipAddress: string | null;
    userAgent: string | null;
    isRevoked: boolean;
    lastActiveAt: string;
    createdAt: string;
    expiresAt: string;
    portalUser: PortalUser;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export default function PortalSessionsPage() {
    const [sessions, setSessions] = useState<PortalSession[]>([]);
    const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [filterUserId, setFilterUserId] = useState("");
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchSessions = useCallback(async () => {
        try {
            let url = `/api/portal-sessions?page=${page}&limit=20`;
            if (filterUserId) {
                url += `&portalUserId=${filterUserId}`;
            }
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setSessions(data.data || data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Gagal memuat sesi portal:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page, filterUserId]);

    const fetchPortalUsers = async () => {
        try {
            const response = await fetch("/api/portal-users?limit=100");
            if (response.ok) {
                const data = await response.json();
                setPortalUsers(data.data || data);
            }
        } catch (err) {
            console.error("Gagal memuat pengguna portal:", err);
        }
    };

    useEffect(() => {
        fetchSessions();
        fetchPortalUsers();
    }, [fetchSessions]);

    const handleRevoke = async (sessionId: string) => {
        if (!(await confirm({ title: "Cabut Sesi", message: "Apakah Anda yakin ingin mencabut sesi ini?", variant: "danger" }))) return;

        try {
            const response = await fetch(`/api/portal-sessions?id=${sessionId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal mencabut sesi", "error");
                return;
            }

            fetchSessions();
        } catch {
            showToast("Terjadi kesalahan", "error");
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

    const getStatus = (session: PortalSession): { label: string; tone: BadgeTone } => {
        if (session.isRevoked) return { label: "DICABUT", tone: "neutral" };
        if (isExpired(session.expiresAt)) return { label: "KEDALUWARSA", tone: "warning" };
        return { label: "AKTIF", tone: "success" };
    };

    const getUserAgentDevice = (userAgent: string | null) => {
        if (!userAgent) return "Unknown";
        const ua = userAgent.toLowerCase();
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Mobile";
        if (ua.includes("tablet") || ua.includes("ipad")) return "Tablet";
        return "Desktop";
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
                    <div className="h-10 w-24 animate-pulse rounded bg-surface-2" />
                </div>

                {/* Stats skeleton */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-card border border-border p-4 shadow-lvl-1">
                            <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-2" />
                            <div className="h-7 w-16 animate-pulse rounded bg-surface-2" />
                        </div>
                    ))}
                </div>

                {/* Ledger-shaped skeleton */}
                <div className="rounded-card border border-border shadow-lvl-1">
                    <div className="flex gap-4 border-b border-border px-4 py-3">
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-36 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-36 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-36 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-36 animate-pulse rounded bg-surface-2" />
                                <div className="h-6 w-16 animate-pulse rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const activeCount = sessions.filter(s => !s.isRevoked && !isExpired(s.expiresAt)).length;
    const revokedOrExpiredCount = sessions.filter(s => s.isRevoked || isExpired(s.expiresAt)).length;

    const columns: TableColumn[] = [
        { key: "user", header: "PENGGUNA" },
        { key: "ip", header: "IP" },
        { key: "device", header: "DEVICE" },
        { key: "status", header: "STATUS" },
        { key: "lastActive", header: "TERAKTIF" },
        { key: "createdAt", header: "DIBUAT" },
        { key: "actions", header: "AKSI" },
    ];

    const rows = sessions.map((session) => {
        const status = getStatus(session);
        return [
            <div key="user" className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-border bg-surface-2">
                    <Monitor size={14} className="text-text-2" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-1">{session.portalUser.name}</p>
                    <p className="truncate text-xs text-text-3">{session.portalUser.email}</p>
                </div>
            </div>,
            <span key="ip" className="font-mono text-xs tabular-nums text-text-2">
                {session.ipAddress || "-"}
            </span>,
            <span key="device" className="inline-flex items-center gap-2 text-text-2">
                <Monitor size={14} />
                <span className="text-sm">{getUserAgentDevice(session.userAgent)}</span>
            </span>,
            <Badge key="status" tone={status.tone}>{status.label}</Badge>,
            <span key="lastActive" className="whitespace-nowrap font-mono text-xs tabular-nums text-text-3">
                {formatDate(session.lastActiveAt)}
            </span>,
            <span key="createdAt" className="whitespace-nowrap font-mono text-xs tabular-nums text-text-3">
                {formatDate(session.createdAt)}
            </span>,
            <div key="actions" className="inline-flex items-center gap-1">
                {!session.isRevoked && !isExpired(session.expiresAt) && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(session.id)}
                        aria-label={`Cabut sesi ${session.portalUser.name}`}
                        title="Cabut Sesi"
                        className="text-danger"
                    >
                        <Trash size={14} />
                    </Button>
                )}
            </div>,
        ];
    });

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-0.5 text-xs font-semibold tracking-widest text-accent">PORTAL</p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Sesi Portal</h1>
                </div>
                <Button type="button" variant="ghost" iconLeft={<ArrowClockwise size={14} aria-hidden="true" />} onClick={() => fetchSessions()}>
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">TOTAL SESI</p>
                    <p className="font-display text-2xl font-semibold text-text-1">{pagination?.total || sessions.length}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">SESI AKTIF</p>
                    <p className="font-display text-2xl font-semibold text-success">{activeCount}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">DICABUT/EXPIRED</p>
                    <p className="font-display text-2xl font-semibold text-text-1">{revokedOrExpiredCount}</p>
                </Card>
            </div>

            {/* Filter */}
            <div className="mb-6 flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-72">
                    <Select
                        label="FILTER PENGGUNA"
                        value={filterUserId}
                        onChange={(e) => { setFilterUserId(e.target.value); setPage(1); }}
                        options={[
                            { value: "", label: "Semua Pengguna" },
                            ...portalUsers.map(u => ({ value: u.id, label: `${u.name} (${u.email})` })),
                        ]}
                    />
                </div>
                {filterUserId && (
                    <Button type="button" variant="ghost" onClick={() => { setFilterUserId(""); setPage(1); }}>
                        Reset
                    </Button>
                )}
            </div>

            {/* Sessions Table */}
            {sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-card border border-border p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-2">
                        <Clock size={24} className="text-text-3" aria-hidden="true" />
                    </div>
                    <p className="text-text-3">Belum ada sesi.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                    <Table
                        columns={columns}
                        rows={rows}
                        ariaLabel="Daftar sesi portal"
                    />
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                </div>
            )}

            <ConfirmDialog />
        </div>
    );
}