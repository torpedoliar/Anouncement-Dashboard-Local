"use client";

import { useState, useEffect, useCallback } from "react";
import { FiMonitor, FiRefreshCw, FiTrash2, FiUser } from "react-icons/fi";

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

export default function PortalSessionsPage() {
    const [sessions, setSessions] = useState<PortalSession[]>([]);
    const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [filterUserId, setFilterUserId] = useState("");

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
        if (!confirm("Apakah Anda yakin ingin mencabut sesi ini?")) return;

        try {
            const response = await fetch(`/api/portal-sessions?id=${sessionId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal mencabut sesi");
                return;
            }

            fetchSessions();
        } catch {
            alert("Terjadi kesalahan");
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

    const getStatus = (session: PortalSession) => {
        if (session.isRevoked) return { label: "REVOKED", bg: "rgba(239, 68, 68, 0.2)", color: "#ef4444" };
        if (isExpired(session.expiresAt)) return { label: "EXPIRED", bg: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" };
        return { label: "AKTIF", bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" };
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
            <div style={{ padding: "32px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <p style={{ color: "#525252" }}>Loading...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                <div>
                    <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                        PORTAL
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                        Sesi Portal
                    </h1>
                </div>
                <button
                    onClick={() => fetchSessions()}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        backgroundColor: "#1a1a1a",
                        color: "#fff",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "1px solid #333",
                        cursor: "pointer",
                    }}
                >
                    <FiRefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>TOTAL SESI</p>
                    <p style={{ color: "#fff", fontSize: "24px", fontWeight: 700 }}>{pagination?.total || sessions.length}</p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>SESI AKTIF</p>
                    <p style={{ color: "#22c55e", fontSize: "24px", fontWeight: 700 }}>
                        {sessions.filter(s => !s.isRevoked && !isExpired(s.expiresAt)).length}
                    </p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>DICABUT/EXPIRED</p>
                    <p style={{ color: "#ef4444", fontSize: "24px", fontWeight: 700 }}>
                        {sessions.filter(s => s.isRevoked || isExpired(s.expiresAt)).length}
                    </p>
                </div>
            </div>

            {/* Filter */}
            <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
                <label style={{ color: "#737373", fontSize: "13px", fontWeight: 600 }}>FILTER PENGGUNA:</label>
                <select
                    value={filterUserId}
                    onChange={(e) => { setFilterUserId(e.target.value); setPage(1); }}
                    style={{
                        padding: "10px 16px",
                        backgroundColor: "#111",
                        border: "1px solid #262626",
                        color: "#fff",
                        fontSize: "13px",
                        minWidth: "250px",
                    }}
                >
                    <option value="">Semua Pengguna</option>
                    {portalUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                </select>
                {filterUserId && (
                    <button
                        onClick={() => { setFilterUserId(""); setPage(1); }}
                        style={{
                            padding: "10px 16px",
                            backgroundColor: "transparent",
                            border: "1px solid #262626",
                            color: "#737373",
                            fontSize: "13px",
                            cursor: "pointer",
                        }}
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Sessions Table */}
            <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#111" }}>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>PENGGUNA</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>IP</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>DEVICE</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>STATUS</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>TERAKTIF</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>DIBUAT</th>
                            <th style={{ padding: "20px", textAlign: "right", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#525252" }}>
                                    Tidak ada sesi portal ditemukan
                                </td>
                            </tr>
                        ) : (
                            sessions.map((session, index) => {
                                const status = getStatus(session);
                                return (
                                    <tr key={session.id} style={{ borderBottom: index < sessions.length - 1 ? "1px solid #262626" : "none" }}>
                                        <td style={{ padding: "20px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{
                                                    width: "36px",
                                                    height: "36px",
                                                    backgroundColor: "#1a1a1a",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    borderRadius: "8px",
                                                }}>
                                                    <FiUser size={16} color="#737373" />
                                                </div>
                                                <div>
                                                    <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500 }}>{session.portalUser.name}</p>
                                                    <p style={{ color: "#737373", fontSize: "12px" }}>{session.portalUser.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "13px" }}>
                                            {session.ipAddress || "-"}
                                        </td>
                                        <td style={{ padding: "20px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#a1a1aa" }}>
                                                <FiMonitor size={14} />
                                                <span style={{ fontSize: "13px" }}>{getUserAgentDevice(session.userAgent)}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "20px" }}>
                                            <span style={{
                                                padding: "4px 12px",
                                                backgroundColor: status.bg,
                                                color: status.color,
                                                fontSize: "11px",
                                                fontWeight: 600,
                                            }}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: "20px", color: "#71717a", fontSize: "13px" }}>
                                            {formatDate(session.lastActiveAt)}
                                        </td>
                                        <td style={{ padding: "20px", color: "#71717a", fontSize: "13px" }}>
                                            {formatDate(session.createdAt)}
                                        </td>
                                        <td style={{ padding: "20px", textAlign: "right" }}>
                                            {!session.isRevoked && !isExpired(session.expiresAt) && (
                                                <button
                                                    onClick={() => handleRevoke(session.id)}
                                                    style={{
                                                        padding: "8px",
                                                        backgroundColor: "transparent",
                                                        border: "1px solid #262626",
                                                        color: "#dc2626",
                                                        cursor: "pointer",
                                                    }}
                                                    title="Cabut Sesi"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
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
                                backgroundColor: p === page ? "#dc2626" : "#1a1a1a",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
