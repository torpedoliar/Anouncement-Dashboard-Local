"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    ArrowClockwise,
    CaretLeft,
    CaretRight,
    DeviceMobile,
    Monitor,
    Trash,
    User,
} from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table, { type TableColumn } from "@/components/ui/Table";

interface UserSession {
    id: string;
    userId: string;
    sessionToken: string;
    ipAddress: string | null;
    userAgent: string | null;
    deviceInfo: string | null;
    createdAt: string;
    lastActiveAt: string;
    expiresAt: string;
    isRevoked: boolean;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const COLUMNS: TableColumn[] = [
    { key: "user", header: "Pengguna" },
    { key: "device", header: "Perangkat", hideBelow: "sm" },
    { key: "lastActive", header: "Terakhir aktif", hideBelow: "md" },
    { key: "status", header: "Status" },
    { key: "actions", header: "Aksi", align: "right" },
];

export default function SessionsPage() {
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchSessions = useCallback(async () => {
        try {
            const response = await fetch(`/api/sessions?page=${page}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                setSessions(data.data || []);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const handleRevoke = async (sessionId: string) => {
        if (
            !(await confirm({
                title: "Cabut Sesi",
                message: "Sesi ini akan langsung berakhir dan pengguna harus masuk lagi. Lanjutkan?",
                confirmLabel: "Cabut",
                variant: "danger",
            }))
        ) {
            return;
        }

        try {
            const response = await fetch(`/api/sessions?id=${sessionId}`, { method: "DELETE" });

            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal mencabut sesi", "error");
                return;
            }

            showToast("Sesi berhasil dicabut", "success");
            fetchSessions();
        } catch {
            showToast("Terjadi kesalahan", "error");
        }
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const getDeviceIcon = (userAgent: string | null) => {
        const ua = userAgent?.toLowerCase() ?? "";
        const isMobile =
            ua.includes("mobile") || ua.includes("android") || ua.includes("iphone");
        return isMobile ? (
            <DeviceMobile size={16} aria-hidden="true" />
        ) : (
            <Monitor size={16} aria-hidden="true" />
        );
    };

    const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

    const counts = useMemo(() => {
        let active = 0;
        let inactive = 0;
        for (const session of sessions) {
            if (session.isRevoked || isExpired(session.expiresAt)) inactive += 1;
            else active += 1;
        }
        return { active, inactive };
    }, [sessions]);

    const rows = sessions.map((session) => {
        const expired = isExpired(session.expiresAt);
        const revoked = session.isRevoked;

        return [
            <div key="user" className="flex items-center gap-3">
                <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-3"
                    aria-hidden="true"
                >
                    <User size={16} />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text-1">
                        {session.user.name}
                    </span>
                    <span className="block truncate text-xs text-text-3">
                        {session.user.email}
                    </span>
                </span>
            </div>,
            <span key="device" className="flex items-center gap-2 text-text-2">
                {getDeviceIcon(session.userAgent)}
                <span className="mono text-[13px]">{session.ipAddress || "Tidak diketahui"}</span>
            </span>,
            <span key="lastActive" className="mono text-[13px] text-text-2">
                {formatDate(session.lastActiveAt)}
            </span>,
            revoked ? (
                <Badge key="status" tone="danger">
                    Dicabut
                </Badge>
            ) : expired ? (
                <Badge key="status" tone="warning">
                    Kedaluwarsa
                </Badge>
            ) : (
                <Badge key="status" tone="success">
                    Aktif
                </Badge>
            ),
            <span key="actions" className="flex justify-end">
                {!revoked && !expired && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(session.id)}
                        className="text-danger hover:bg-danger-subtle hover:text-danger"
                        aria-label={`Cabut sesi ${session.user.name}`}
                        title="Cabut sesi"
                    >
                        <Trash size={14} aria-hidden="true" />
                    </Button>
                )}
            </span>,
        ];
    });

    return (
        <div className="p-6 md:p-8">
            {/* Header */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-bold text-text-1">Sesi Pengguna</h1>
                    <p className="mt-1 text-sm text-text-2">
                        Pantau dan cabut sesi login admin yang sedang berjalan.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    onClick={() => fetchSessions()}
                    iconLeft={<ArrowClockwise size={16} aria-hidden="true" />}
                >
                    Muat ulang
                </Button>
            </div>

            {/* Stats */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { label: "Total sesi", value: pagination?.total ?? 0, tone: "text-text-1" },
                    { label: "Sesi aktif", value: counts.active, tone: "text-success" },
                    { label: "Dicabut / kedaluwarsa", value: counts.inactive, tone: "text-danger" },
                ].map((stat) => (
                    <Card key={stat.label} className="p-5">
                        <p className="text-xs font-medium text-text-3">{stat.label}</p>
                        <p className={`mono mt-2 text-2xl font-bold ${stat.tone}`}>
                            {isLoading ? "—" : stat.value}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Tabel */}
            <Card className="overflow-hidden">
                {isLoading ? (
                    // Skeleton, bukan spinner: tinggi baris dipertahankan supaya
                    // tabel tidak melompat saat data tiba.
                    <div className="divide-y divide-border" aria-busy="true" aria-live="polite">
                        <span className="sr-only">Memuat daftar sesi…</span>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="flex items-center gap-3 px-4 py-3.5">
                                <span className="h-9 w-9 shrink-0 animate-pulse rounded-control bg-surface-2" />
                                <span className="h-4 w-40 animate-pulse rounded-control bg-surface-2" />
                                <span className="ml-auto h-4 w-20 animate-pulse rounded-control bg-surface-2" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <Table
                        columns={COLUMNS}
                        rows={rows}
                        ariaLabel="Daftar sesi pengguna"
                        emptyState={
                            <div className="mx-auto max-w-sm">
                                <p className="text-sm font-medium text-text-1">Belum ada sesi</p>
                                <p className="mt-1 text-sm text-text-2">
                                    Sesi akan muncul di sini setelah ada admin yang masuk.
                                </p>
                            </div>
                        }
                    />
                )}
            </Card>

            {/* Pagination — sebelumnya merender satu tombol per halaman, yang
                meledak jadi puluhan tombol saat sesi banyak. */}
            {pagination && pagination.totalPages > 1 && (
                <nav
                    className="mt-6 flex items-center justify-center gap-3"
                    aria-label="Navigasi halaman"
                >
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1}
                        iconLeft={<CaretLeft size={14} aria-hidden="true" />}
                    >
                        Sebelumnya
                    </Button>
                    <span className="mono text-sm text-text-2" aria-current="page">
                        {page} / {pagination.totalPages}
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                            setPage((current) => Math.min(pagination.totalPages, current + 1))
                        }
                        disabled={page >= pagination.totalPages}
                        iconRight={<CaretRight size={14} aria-hidden="true" />}
                    >
                        Berikutnya
                    </Button>
                </nav>
            )}

            <ConfirmDialog />
        </div>
    );
}
