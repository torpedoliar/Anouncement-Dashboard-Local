"use client";

import { useState, useEffect, useCallback } from "react";
import { FiMonitor, FiSmartphone, FiTrash2, FiRefreshCw, FiUser } from "react-icons/fi";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";

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
        if (!(await confirm({ title: "Cabut Sesi", message: "Apakah Anda yakin ingin mencabut sesi ini?", variant: "danger" }))) return;

        try {
            const response = await fetch(`/api/sessions?id=${sessionId}`, {
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

    const getDeviceIcon = (userAgent: string | null) => {
        if (!userAgent) return <FiMonitor size={16} />;
        const ua = userAgent.toLowerCase();
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
            return <FiSmartphone size={16} />;
        }
        return <FiMonitor size={16} />;
    };

    const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

    if (isLoading) {
        return (
            <div style={{ padding: "32px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <p style={{ color: "var(--text-tertiary)" }}>Loading...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                <div>
                    <p style={{ color: "var(--brand-red)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                        SESI
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>
                        Sesi Pengguna
                    </h1>
                </div>
                <button
                    onClick={() => fetchSessions()}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        backgroundColor: "var(--bg-tertiary)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "1px solid var(--border-strong)",
                        cursor: "pointer",
                    }}
                >
                    <FiRefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "20px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "8px" }}>TOTAL SESI</p>
                    <p style={{ color: "var(--text-primary)", fontSize: "24px", fontWeight: 700 }}>{pagination?.total || 0}</p>
                </div>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "20px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "8px" }}>SESI AKTIF</p>
                    <p style={{ color: "var(--color-success)", fontSize: "24px", fontWeight: 700 }}>
                        {sessions.filter(s => !s.isRevoked && !isExpired(s.expiresAt)).length}
                    </p>
                </div>
                <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "20px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "8px" }}>DICABUT/EXPIRED</p>
                    <p style={{ color: "var(--color-error)", fontSize: "24px", fontWeight: 700 }}>
                        {sessions.filter(s => s.isRevoked || isExpired(s.expiresAt)).length}
                    </p>
                </div>
            </div>

            {/* Sessions Table */}
            <div style={{ backgroundColor: "var(--bg-secondary)", border: "2px solid var(--border-strong)", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid var(--border-strong)", backgroundColor: "var(--bg-card)" }}>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>USER</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>DEVICE</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>LAST ACTIVE</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>STATUS</th>
                            <th style={{ padding: "20px", textAlign: "right", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 700 }}>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "var(--text-tertiary)" }}>
                                    Tidak ada sesi ditemukan
                                </td>
                            </tr>
                        ) : (
                            sessions.map((session, index) => (
                                <tr key={session.id} style={{ borderBottom: index < sessions.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                                    <td style={{ padding: "20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                backgroundColor: "var(--bg-tertiary)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "8px",
                                            }}>
                                                <FiUser size={16} color="#737373" />
                                            </div>
                                            <div>
                                                <p style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 500 }}>{session.user.name}</p>
                                                <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>{session.user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                                            {getDeviceIcon(session.userAgent)}
                                            <span style={{ fontSize: "13px" }}>
                                                {session.ipAddress || "Unknown"}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "20px", color: "#71717a", fontSize: "13px" }}>
                                        {formatDate(session.lastActiveAt)}
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        {session.isRevoked ? (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(239, 68, 68, 0.2)", color: "var(--color-error)", fontSize: "11px", fontWeight: 600 }}>
                                                REVOKED
                                            </span>
                                        ) : isExpired(session.expiresAt) ? (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(251, 191, 36, 0.2)", color: "#fbbf24", fontSize: "11px", fontWeight: 600 }}>
                                                EXPIRED
                                            </span>
                                        ) : (
                                            <span style={{ padding: "4px 12px", backgroundColor: "rgba(34, 197, 94, 0.2)", color: "var(--color-success)", fontSize: "11px", fontWeight: 600 }}>
                                                ACTIVE
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: "20px", textAlign: "right" }}>
                                        {!session.isRevoked && !isExpired(session.expiresAt) && (
                                            <button
                                                onClick={() => handleRevoke(session.id)}
                                                style={{
                                                    padding: "8px",
                                                    backgroundColor: "transparent",
                                                    border: "1px solid var(--border-color)",
                                                    color: "var(--brand-red)",
                                                    cursor: "pointer",
                                                }}
                                                title="Revoke Session"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: p === page ? "var(--brand-red)" : "var(--bg-tertiary)",
                                color: "var(--text-primary)",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}
            <ConfirmDialog />
        </div>
    );
}
