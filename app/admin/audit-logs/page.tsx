"use client";

import { useState, useEffect } from "react";
import { FiActivity, FiFilter, FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    changes: string | null;
    createdAt: string;
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

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: "",
        entityType: "",
    });

    useEffect(() => {
        fetchLogs();
    }, [pagination.page, filters]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: "20",
            });
            if (filters.action) params.set("action", filters.action);
            if (filters.entityType) params.set("entityType", filters.entityType);

            const response = await fetch(`/api/audit-logs?${params}`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.data);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case "CREATE": return { bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" };
            case "UPDATE": return { bg: "rgba(59, 130, 246, 0.2)", color: "#3b82f6" };
            case "DELETE": return { bg: "rgba(220, 38, 38, 0.2)", color: "#dc2626" };
            default: return { bg: "rgba(115, 115, 115, 0.2)", color: "#737373" };
        }
    };

    const getEntityTypeLabel = (type: string) => {
        switch (type) {
            case "ANNOUNCEMENT": return "Pengumuman";
            case "CATEGORY": return "Kategori";
            case "USER": return "User";
            case "SETTINGS": return "Pengaturan";
            default: return type;
        }
    };

    const parseChanges = (changes: string | null) => {
        if (!changes) return null;
        try {
            return JSON.parse(changes);
        } catch {
            return changes;
        }
    };

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{ marginBottom: "32px" }}>
                <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    AUDIT LOG
                </p>
                <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                    Log Aktivitas
                </h1>
            </div>

            {/* Filters */}
            <div style={{
                display: "flex",
                gap: "16px",
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: "#0a0a0a",
                border: "1px solid #1a1a1a",
            }}>
                <FiFilter size={16} color="#737373" />
                <select
                    value={filters.action}
                    onChange={(e) => {
                        setFilters({ ...filters, action: e.target.value });
                        setPagination({ ...pagination, page: 1 });
                    }}
                    style={{
                        padding: "8px 12px",
                        backgroundColor: "#111",
                        border: "1px solid #262626",
                        color: "#fff",
                        fontSize: "13px",
                    }}
                >
                    <option value="">Semua Aksi</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                </select>
                <select
                    value={filters.entityType}
                    onChange={(e) => {
                        setFilters({ ...filters, entityType: e.target.value });
                        setPagination({ ...pagination, page: 1 });
                    }}
                    style={{
                        padding: "8px 12px",
                        backgroundColor: "#111",
                        border: "1px solid #262626",
                        color: "#fff",
                        fontSize: "13px",
                    }}
                >
                    <option value="">Semua Entity</option>
                    <option value="ANNOUNCEMENT">Pengumuman</option>
                    <option value="CATEGORY">Kategori</option>
                    <option value="USER">User</option>
                    <option value="SETTINGS">Pengaturan</option>
                </select>
            </div>

            {/* Logs Table */}
            {isLoading ? (
                <div style={{ padding: "64px", textAlign: "center", color: "#525252" }}>Loading...</div>
            ) : logs.length === 0 ? (
                <div style={{
                    padding: "64px",
                    textAlign: "center",
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                }}>
                    <FiActivity size={48} color="#262626" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "#525252" }}>Belum ada log aktivitas</p>
                </div>
            ) : (
                <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#111" }}>
                                <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>WAKTU</th>
                                <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>USER</th>
                                <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>AKSI</th>
                                <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>ENTITY</th>
                                <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>PERUBAHAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, index) => {
                                const actionStyle = getActionColor(log.action);
                                const changes = parseChanges(log.changes);
                                return (
                                    <tr key={log.id} style={{ borderBottom: index < logs.length - 1 ? "1px solid #262626" : "none" }}>
                                        <td style={{ padding: "20px", color: "#71717a", fontSize: "14px", whiteSpace: "nowrap" }}>
                                            {formatDate(log.createdAt)}
                                        </td>
                                        <td style={{ padding: "20px", color: "#fff", fontSize: "15px", fontWeight: 500 }}>
                                            {log.user.name}
                                        </td>
                                        <td style={{ padding: "20px" }}>
                                            <span style={{
                                                padding: "6px 14px",
                                                backgroundColor: actionStyle.bg,
                                                color: actionStyle.color,
                                                fontSize: "12px",
                                                fontWeight: 700,
                                                letterSpacing: "0.05em",
                                                borderRadius: "4px",
                                            }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "14px" }}>
                                            {getEntityTypeLabel(log.entityType)}
                                        </td>
                                        <td style={{ padding: "20px", color: "#71717a", fontSize: "13px", maxWidth: "300px" }}>
                                            {changes && typeof changes === "object" ? (
                                                <code style={{
                                                    display: "block",
                                                    padding: "10px",
                                                    backgroundColor: "#111",
                                                    border: "1px solid #262626",
                                                    borderRadius: "4px",
                                                    overflowX: "auto",
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-all",
                                                }}>
                                                    {JSON.stringify(changes, null, 2)}
                                                </code>
                                            ) : (
                                                <span>{changes || "-"}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "16px",
                            borderTop: "1px solid #1a1a1a",
                        }}>
                            <span style={{ color: "#525252", fontSize: "13px" }}>
                                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                            </span>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                                    disabled={pagination.page === 1}
                                    style={{
                                        padding: "8px 12px",
                                        backgroundColor: "transparent",
                                        border: "1px solid #262626",
                                        color: pagination.page === 1 ? "#333" : "#737373",
                                        cursor: pagination.page === 1 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <FiChevronLeft size={14} />
                                </button>
                                <button
                                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                                    disabled={pagination.page === pagination.totalPages}
                                    style={{
                                        padding: "8px 12px",
                                        backgroundColor: "transparent",
                                        border: "1px solid #262626",
                                        color: pagination.page === pagination.totalPages ? "#333" : "#737373",
                                        cursor: pagination.page === pagination.totalPages ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <FiChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )
            }
        </div >
    );
}
