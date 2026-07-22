"use client";

import { useState, useEffect, useCallback } from "react";
import { FiActivity, FiFilter, FiChevronLeft, FiChevronRight, FiDownload, FiChevronDown, FiChevronUp } from "react-icons/fi";

interface AuditLogEntry {
    id: string;
    actorType: string;
    actorId: string | null;
    actorEmail: string | null;
    actorName: string | null;
    category: string;
    action: string;
    entityType: string;
    entityId: string | null;
    outcome: string;
    errorMessage: string | null;
    changes: string | null;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    severity: string;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function AuditTrailPage() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        actorType: "",
        category: "",
        outcome: "",
        severity: "",
        entityType: "",
        search: "",
        from: "",
        to: "",
    });

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: "20",
            });
            if (filters.actorType) params.set("actorType", filters.actorType);
            if (filters.category) params.set("category", filters.category);
            if (filters.outcome) params.set("outcome", filters.outcome);
            if (filters.severity) params.set("severity", filters.severity);
            if (filters.entityType) params.set("entityType", filters.entityType);
            if (filters.search) params.set("search", filters.search);
            if (filters.from) params.set("from", filters.from);
            if (filters.to) params.set("to", filters.to);

            const response = await fetch(`/api/audit-trail?${params}`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.data);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch audit trail:", err);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.page, filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = async (format: "csv" | "json") => {
        const params = new URLSearchParams({ export: format });
        if (filters.actorType) params.set("actorType", filters.actorType);
        if (filters.category) params.set("category", filters.category);
        if (filters.outcome) params.set("outcome", filters.outcome);
        if (filters.entityType) params.set("entityType", filters.entityType);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);

        const response = await fetch(`/api/audit-trail?${params}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleString("id-ID", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });

    const getActorBadge = (actorType: string) => {
        const styles: Record<string, { bg: string; color: string }> = {
            ADMIN_USER: { bg: "rgba(59, 130, 246, 0.2)", color: "#3b82f6" },
            PORTAL_USER: { bg: "rgba(168, 85, 247, 0.2)", color: "#a855f7" },
            SYSTEM: { bg: "rgba(234, 179, 8, 0.2)", color: "#eab308" },
        };
        return styles[actorType] || { bg: "rgba(115, 115, 115, 0.2)", color: "#737373" };
    };

    const getOutcomeBadge = (outcome: string) =>
        outcome === "SUCCESS"
            ? { bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" }
            : { bg: "rgba(220, 38, 38, 0.2)", color: "#dc2626" };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "WARNING": return "#eab308";
            case "ERROR": return "#dc2626";
            default: return "#737373";
        }
    };

    const parseJSON = (val: unknown) => {
        if (!val) return null;
        if (typeof val === "object") return val;
        try { return JSON.parse(val as string); } catch { return val; }
    };

    const resetFilters = () => {
        setFilters({ actorType: "", category: "", outcome: "", severity: "", entityType: "", search: "", from: "", to: "" });
        setPagination({ ...pagination, page: 1 });
    };

    const selectStyle: React.CSSProperties = {
        padding: "8px 12px", backgroundColor: "#111", border: "1px solid #262626",
        color: "#fff", fontSize: "13px", borderRadius: "4px",
    };

    return (
        <div style={{ padding: "32px" }}>
            {/* Header */}
            <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                        AUDIT TRAIL
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                        Audit Trail
                    </h1>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => handleExport("csv")} style={{
                        display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
                        backgroundColor: "transparent", border: "1px solid #262626", color: "#a1a1aa",
                        fontSize: "13px", cursor: "pointer", borderRadius: "4px",
                    }}>
                        <FiDownload size={14} /> CSV
                    </button>
                    <button onClick={() => handleExport("json")} style={{
                        display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
                        backgroundColor: "transparent", border: "1px solid #262626", color: "#a1a1aa",
                        fontSize: "13px", cursor: "pointer", borderRadius: "4px",
                    }}>
                        <FiDownload size={14} /> JSON
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{
                display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px",
                padding: "16px", backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px",
            }}>
                <FiFilter size={16} color="#737373" style={{ marginTop: "8px" }} />
                <select value={filters.actorType} onChange={(e) => { setFilters({ ...filters, actorType: e.target.value }); setPagination({ ...pagination, page: 1 }); }} style={selectStyle}>
                    <option value="">Semua Actor</option>
                    <option value="ADMIN_USER">Admin CMS</option>
                    <option value="PORTAL_USER">Portal User</option>
                    <option value="SYSTEM">System</option>
                </select>
                <select value={filters.category} onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPagination({ ...pagination, page: 1 }); }} style={selectStyle}>
                    <option value="">Semua Kategori</option>
                    <option value="AUTH">Auth</option>
                    <option value="CONTENT">Content</option>
                    <option value="USER_MGMT">User Mgmt</option>
                    <option value="PORTAL">Portal</option>
                    <option value="SECURITY">Security</option>
                    <option value="SYSTEM">System</option>
                    <option value="CONFIG">Config</option>
                </select>
                <select value={filters.outcome} onChange={(e) => { setFilters({ ...filters, outcome: e.target.value }); setPagination({ ...pagination, page: 1 }); }} style={selectStyle}>
                    <option value="">Semua Outcome</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILURE">Failure</option>
                </select>
                <select value={filters.severity} onChange={(e) => { setFilters({ ...filters, severity: e.target.value }); setPagination({ ...pagination, page: 1 }); }} style={selectStyle}>
                    <option value="">Semua Severity</option>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="ERROR">Error</option>
                </select>
                <select value={filters.entityType} onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPagination({ ...pagination, page: 1 }); }} style={selectStyle}>
                    <option value="">Semua Entity</option>
                    <option value="ANNOUNCEMENT">Announcement</option>
                    <option value="CATEGORY">Category</option>
                    <option value="COMMENT">Comment</option>
                    <option value="USER">User</option>
                    <option value="PORTAL_APP">Portal App</option>
                    <option value="PORTAL_USER">Portal User</option>
                    <option value="PORTAL_CREDENTIAL">Portal Credential</option>
                    <option value="SETTINGS">Settings</option>
                    <option value="SYSTEM">System</option>
                </select>
                <input
                    type="text"
                    placeholder="Cari email/aksi..."
                    value={filters.search}
                    onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPagination({ ...pagination, page: 1 }); }}
                    style={{ ...selectStyle, minWidth: "150px" }}
                />
                <input type="date" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPagination({ ...pagination, page: 1 }); }} style={selectStyle} />
                <input type="date" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPagination({ ...pagination, page: 1 }); }} style={selectStyle} />
                <button onClick={resetFilters} style={{
                    padding: "8px 16px", backgroundColor: "transparent", border: "1px solid #262626",
                    color: "#737373", fontSize: "13px", cursor: "pointer", borderRadius: "4px",
                }}>Reset</button>
            </div>

            {/* Table */}
            {isLoading ? (
                <div style={{ padding: "64px", textAlign: "center", color: "#525252" }}>Loading...</div>
            ) : logs.length === 0 ? (
                <div style={{ padding: "64px", textAlign: "center", backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px" }}>
                    <FiActivity size={48} color="#262626" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "#525252" }}>Belum ada audit log</p>
                </div>
            ) : (
                <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#111" }}>
                                {["WAKTU", "ACTOR", "KATEGORI", "AKSI", "ENTITY", "OUTCOME", "IP", "DETAIL"].map((h) => (
                                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "#a1a1aa", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => {
                                const actorBadge = getActorBadge(log.actorType);
                                const outcomeBadge = getOutcomeBadge(log.outcome);
                                const isExpanded = expandedId === log.id;
                                return (
                                    <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? "1px solid #262626" : "none" }}>
                                        <td style={{ padding: "14px 16px", color: "#71717a", fontSize: "13px", whiteSpace: "nowrap" }}>{formatDate(log.createdAt)}</td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                <span style={{ padding: "2px 8px", backgroundColor: actorBadge.bg, color: actorBadge.color, fontSize: "11px", fontWeight: 700, borderRadius: "4px", width: "fit-content" }}>{log.actorType}</span>
                                                <span style={{ color: "#fff", fontSize: "13px" }}>{log.actorName || "-"}</span>
                                                <span style={{ color: "#525252", fontSize: "12px" }}>{log.actorEmail || ""}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "14px 16px", color: "#a1a1aa", fontSize: "13px" }}>{log.category}</td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <span style={{ padding: "4px 10px", backgroundColor: "rgba(115, 115, 115, 0.2)", color: "#d4d4d4", fontSize: "12px", fontWeight: 600, borderRadius: "4px" }}>{log.action}</span>
                                        </td>
                                        <td style={{ padding: "14px 16px", color: "#a1a1aa", fontSize: "13px" }}>
                                            <div>{log.entityType}</div>
                                            {log.entityId && <div style={{ color: "#525252", fontSize: "12px" }}>{log.entityId.substring(0, 12)}...</div>}
                                        </td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <span style={{ padding: "4px 10px", backgroundColor: outcomeBadge.bg, color: outcomeBadge.color, fontSize: "12px", fontWeight: 700, borderRadius: "4px" }}>{log.outcome}</span>
                                            {log.severity !== "INFO" && (
                                                <span style={{ marginLeft: "6px", color: getSeverityColor(log.severity), fontSize: "11px", fontWeight: 600 }}>{log.severity}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "14px 16px", color: "#525252", fontSize: "12px" }}>{log.ipAddress || "-"}</td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <button onClick={() => setExpandedId(isExpanded ? null : log.id)} style={{
                                                background: "none", border: "1px solid #262626", color: "#737373",
                                                cursor: "pointer", padding: "4px 8px", borderRadius: "4px", fontSize: "12px",
                                                display: "flex", alignItems: "center", gap: "4px",
                                            }}>
                                                {isExpanded ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />} Detail
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Expanded detail rows */}
                    {logs.map((log) => {
                        if (expandedId !== log.id) return null;
                        const changes = parseJSON(log.changes);
                        const metadata = parseJSON(log.metadata);
                        return (
                            <div key={`detail-${log.id}`} style={{ padding: "20px", borderTop: "1px solid #262626", backgroundColor: "#0d0d0d" }}>
                                {log.errorMessage && (
                                    <div style={{ marginBottom: "12px" }}>
                                        <span style={{ color: "#dc2626", fontSize: "12px", fontWeight: 600 }}>Error: </span>
                                        <span style={{ color: "#fca5a5", fontSize: "13px" }}>{log.errorMessage}</span>
                                    </div>
                                )}
                                {changes && (
                                    <div style={{ marginBottom: "12px" }}>
                                        <span style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 600 }}>Changes:</span>
                                        <pre style={{
                                            marginTop: "6px", padding: "12px", backgroundColor: "#111", border: "1px solid #262626",
                                            borderRadius: "4px", color: "#d4d4d4", fontSize: "12px", overflowX: "auto",
                                            whiteSpace: "pre-wrap", wordBreak: "break-all",
                                        }}>{JSON.stringify(changes, null, 2)}</pre>
                                    </div>
                                )}
                                {metadata && (
                                    <div>
                                        <span style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 600 }}>Metadata:</span>
                                        <pre style={{
                                            marginTop: "6px", padding: "12px", backgroundColor: "#111", border: "1px solid #262626",
                                            borderRadius: "4px", color: "#d4d4d4", fontSize: "12px", overflowX: "auto",
                                            whiteSpace: "pre-wrap", wordBreak: "break-all",
                                        }}>{JSON.stringify(metadata, null, 2)}</pre>
                                    </div>
                                )}
                                {log.userAgent && (
                                    <div style={{ marginTop: "8px" }}>
                                        <span style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 600 }}>User-Agent: </span>
                                        <span style={{ color: "#525252", fontSize: "12px" }}>{log.userAgent}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderTop: "1px solid #1a1a1a" }}>
                            <span style={{ color: "#525252", fontSize: "13px" }}>
                                {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                            </span>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })} disabled={pagination.page === 1} style={{ padding: "8px 12px", backgroundColor: "transparent", border: "1px solid #262626", color: pagination.page === 1 ? "#333" : "#737373", cursor: pagination.page === 1 ? "not-allowed" : "pointer", borderRadius: "4px" }}>
                                    <FiChevronLeft size={14} />
                                </button>
                                <span style={{ color: "#525252", fontSize: "13px", padding: "8px 12px" }}>{pagination.page} / {pagination.totalPages}</span>
                                <button onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })} disabled={pagination.page === pagination.totalPages} style={{ padding: "8px 12px", backgroundColor: "transparent", border: "1px solid #262626", color: pagination.page === pagination.totalPages ? "#333" : "#737373", cursor: pagination.page === pagination.totalPages ? "not-allowed" : "pointer", borderRadius: "4px" }}>
                                    <FiChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
