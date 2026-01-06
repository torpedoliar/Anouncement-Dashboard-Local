"use client";

import { useState, useEffect, useCallback } from "react";
import { FiMessageSquare, FiCheck, FiX, FiTrash2, FiFilter, FiExternalLink } from "react-icons/fi";
import Link from "next/link";

interface Comment {
    id: string;
    authorName: string;
    authorEmail: string | null;
    content: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "SPAM";
    createdAt: string;
    moderatedAt: string | null;
    announcement: {
        id: string;
        title: string;
        slug: string;
    };
    moderator: {
        id: string;
        name: string;
    } | null;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function CommentsPage() {
    const [comments, setComments] = useState<Comment[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>("");

    const fetchComments = useCallback(async () => {
        try {
            let url = `/api/comments?page=${page}&limit=20`;
            if (statusFilter) url += `&status=${statusFilter}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setComments(data.data || []);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch comments:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleModerate = async (commentId: string, status: "APPROVED" | "REJECTED" | "SPAM") => {
        try {
            const response = await fetch(`/api/comments/${commentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal memperbarui komentar");
                return;
            }

            fetchComments();
        } catch {
            alert("Terjadi kesalahan");
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus komentar ini?")) return;

        try {
            const response = await fetch(`/api/comments/${commentId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal menghapus komentar");
                return;
            }

            fetchComments();
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

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; color: string }> = {
            PENDING: { bg: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" },
            APPROVED: { bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" },
            REJECTED: { bg: "rgba(239, 68, 68, 0.2)", color: "#ef4444" },
            SPAM: { bg: "rgba(156, 163, 175, 0.2)", color: "#9ca3af" },
        };
        const style = styles[status] || styles.PENDING;
        return (
            <span style={{
                padding: "4px 12px",
                backgroundColor: style.bg,
                color: style.color,
                fontSize: "11px",
                fontWeight: 600,
            }}>
                {status}
            </span>
        );
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
                        KOMENTAR
                    </p>
                    <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
                        Moderasi Komentar
                    </h1>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <FiFilter size={16} color="#737373" />
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        style={{
                            padding: "10px 16px",
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #333",
                            color: "#fff",
                            fontSize: "13px",
                        }}
                    >
                        <option value="">Semua Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="SPAM">Spam</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
                {["PENDING", "APPROVED", "REJECTED", "SPAM"].map((status) => (
                    <div key={status} style={{ backgroundColor: "#0a0a0a", border: "1px solid #262626", padding: "20px" }}>
                        <p style={{ color: "#737373", fontSize: "12px", marginBottom: "8px" }}>{status}</p>
                        <p style={{ color: getStatusBadge(status).props.style.color, fontSize: "24px", fontWeight: 700 }}>
                            {comments.filter(c => c.status === status).length}
                        </p>
                    </div>
                ))}
            </div>

            {/* Comments List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {comments.length === 0 ? (
                    <div style={{
                        backgroundColor: "#0a0a0a",
                        border: "1px solid #262626",
                        padding: "48px",
                        textAlign: "center",
                        color: "#525252",
                    }}>
                        <FiMessageSquare size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                        <p>Tidak ada komentar ditemukan</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} style={{
                            backgroundColor: "#0a0a0a",
                            border: "1px solid #262626",
                            padding: "20px",
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                                        <span style={{ color: "#fff", fontWeight: 600 }}>{comment.authorName}</span>
                                        {comment.authorEmail && (
                                            <span style={{ color: "#737373", fontSize: "13px" }}>{comment.authorEmail}</span>
                                        )}
                                        {getStatusBadge(comment.status)}
                                    </div>
                                    <Link
                                        href={`/${comment.announcement.slug}`}
                                        target="_blank"
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            color: "#60a5fa",
                                            fontSize: "13px",
                                            textDecoration: "none",
                                        }}
                                    >
                                        {comment.announcement.title}
                                        <FiExternalLink size={12} />
                                    </Link>
                                </div>
                                <span style={{ color: "#525252", fontSize: "12px" }}>{formatDate(comment.createdAt)}</span>
                            </div>

                            <p style={{ color: "#d4d4d4", fontSize: "14px", lineHeight: 1.6, marginBottom: "16px" }}>
                                {comment.content}
                            </p>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    {comment.status === "PENDING" && (
                                        <>
                                            <button
                                                onClick={() => handleModerate(comment.id, "APPROVED")}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    padding: "8px 16px",
                                                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                                                    color: "#22c55e",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    border: "none",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <FiCheck size={14} />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleModerate(comment.id, "REJECTED")}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    padding: "8px 16px",
                                                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                                                    color: "#ef4444",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    border: "none",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <FiX size={14} />
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleModerate(comment.id, "SPAM")}
                                                style={{
                                                    padding: "8px 16px",
                                                    backgroundColor: "#1a1a1a",
                                                    color: "#737373",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    border: "1px solid #333",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Spam
                                            </button>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(comment.id)}
                                    style={{
                                        padding: "8px",
                                        backgroundColor: "transparent",
                                        border: "1px solid #262626",
                                        color: "#dc2626",
                                        cursor: "pointer",
                                    }}
                                    title="Delete"
                                >
                                    <FiTrash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
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
