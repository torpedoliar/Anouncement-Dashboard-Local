"use client";

import { useState, useEffect, useCallback } from "react";
import { FiMail, FiUserPlus, FiTrash2, FiDownload, FiRefreshCw, FiSearch } from "react-icons/fi";

interface Subscriber {
    id: string;
    email: string;
    name: string | null;
    source: string;
    isActive: boolean;
    subscribedAt: string;
    unsubscribedAt: string | null;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function NewsletterPage() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [activeOnly, setActiveOnly] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchSubscribers = useCallback(async () => {
        setIsLoading(true);
        try {
            let url = `/api/newsletter?page=${page}&limit=50`;
            if (activeOnly) url += "&active=true";

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setSubscribers(data.data || []);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch subscribers:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page, activeOnly]);

    useEffect(() => {
        fetchSubscribers();
    }, [fetchSubscribers]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const handleExport = () => {
        const activeSubscribers = subscribers.filter(s => s.isActive);
        const csv = [
            ["Email", "Name", "Source", "Subscribed Date"].join(","),
            ...activeSubscribers.map(s => [
                s.email,
                s.name || "",
                s.source,
                formatDate(s.subscribedAt),
            ].join(","))
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `subscribers-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const filteredSubscribers = subscribers.filter(s =>
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading && subscribers.length === 0) {
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
                        NEWSLETTER
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                        Subscribers
                    </h1>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                    <button
                        onClick={() => fetchSubscribers()}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 16px",
                            backgroundColor: "#1a1a1a",
                            color: "#fff",
                            fontSize: "13px",
                            border: "1px solid #333",
                            cursor: "pointer",
                        }}
                    >
                        <FiRefreshCw size={14} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 16px",
                            backgroundColor: "#dc2626",
                            color: "#fff",
                            fontSize: "13px",
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        <FiDownload size={14} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>TOTAL SUBSCRIBERS</p>
                    <p style={{ color: "#fff", fontSize: "24px", fontWeight: 700 }}>{pagination?.total || 0}</p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>ACTIVE</p>
                    <p style={{ color: "#22c55e", fontSize: "24px", fontWeight: 700 }}>
                        {subscribers.filter(s => s.isActive).length}
                    </p>
                </div>
                <div style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                    <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>UNSUBSCRIBED</p>
                    <p style={{ color: "#ef4444", fontSize: "24px", fontWeight: 700 }}>
                        {subscribers.filter(s => !s.isActive).length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                <div style={{ flex: 1, position: "relative" }}>
                    <FiSearch size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#525252" }} />
                    <input
                        type="text"
                        placeholder="Cari email atau nama..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "12px 12px 12px 40px",
                            backgroundColor: "#111",
                            border: "1px solid #333",
                            color: "#fff",
                            fontSize: "14px",
                        }}
                    />
                </div>
                <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "0 16px",
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    color: "#a1a1aa",
                    fontSize: "13px",
                    cursor: "pointer",
                }}>
                    <input
                        type="checkbox"
                        checked={activeOnly}
                        onChange={(e) => setActiveOnly(e.target.checked)}
                        style={{ width: "16px", height: "16px" }}
                    />
                    Aktif saja
                </label>
            </div>

            {/* Subscribers Table */}
            <div style={{ backgroundColor: "#0a0a0a", border: "2px solid #333", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#111" }}>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>EMAIL</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>NAMA</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>SOURCE</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>SUBSCRIBED</th>
                            <th style={{ padding: "20px", textAlign: "left", color: "#a1a1aa", fontSize: "13px", fontWeight: 700 }}>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSubscribers.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#525252" }}>
                                    <FiMail size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                                    <p>Tidak ada subscriber ditemukan</p>
                                </td>
                            </tr>
                        ) : (
                            filteredSubscribers.map((subscriber, index) => (
                                <tr key={subscriber.id} style={{ borderBottom: index < filteredSubscribers.length - 1 ? "1px solid #262626" : "none" }}>
                                    <td style={{ padding: "20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div style={{
                                                width: "32px",
                                                height: "32px",
                                                backgroundColor: "#1a1a1a",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "4px",
                                            }}>
                                                <FiMail size={14} color="#737373" />
                                            </div>
                                            <span style={{ color: "#fff", fontSize: "14px" }}>{subscriber.email}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "20px", color: "#a1a1aa", fontSize: "14px" }}>
                                        {subscriber.name || "-"}
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        <span style={{
                                            padding: "4px 10px",
                                            backgroundColor: "#1a1a1a",
                                            color: "#737373",
                                            fontSize: "11px",
                                            fontWeight: 600,
                                        }}>
                                            {subscriber.source}
                                        </span>
                                    </td>
                                    <td style={{ padding: "20px", color: "#71717a", fontSize: "13px" }}>
                                        {formatDate(subscriber.subscribedAt)}
                                    </td>
                                    <td style={{ padding: "20px" }}>
                                        {subscriber.isActive ? (
                                            <span style={{
                                                padding: "4px 12px",
                                                backgroundColor: "rgba(34, 197, 94, 0.2)",
                                                color: "#22c55e",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                            }}>
                                                ACTIVE
                                            </span>
                                        ) : (
                                            <span style={{
                                                padding: "4px 12px",
                                                backgroundColor: "rgba(239, 68, 68, 0.2)",
                                                color: "#ef4444",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                            }}>
                                                INACTIVE
                                            </span>
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
