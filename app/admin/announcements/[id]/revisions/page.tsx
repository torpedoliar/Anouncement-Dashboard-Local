"use client";

import { useState, useEffect, useCallback, use } from "react";
import { FiClock, FiRotateCcw, FiUser, FiArrowLeft, FiGitCommit } from "react-icons/fi";
import Link from "next/link";

interface Revision {
    id: string;
    version: number;
    title: string;
    content: string;
    excerpt: string | null;
    imagePath: string | null;
    changeType: string;
    changeSummary: string | null;
    createdAt: string;
    author: {
        id: string;
        name: string;
        email: string;
    };
}

interface Pagination {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
}

export default function RevisionsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState<{ id: string; title: string } | null>(null);

    const fetchRevisions = useCallback(async () => {
        try {
            const response = await fetch(`/api/announcements/${id}/revisions`);
            if (response.ok) {
                const data = await response.json();
                setRevisions(data.data || []);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch revisions:", err);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    const fetchAnnouncement = useCallback(async () => {
        try {
            const response = await fetch(`/api/announcements/${id}`);
            if (response.ok) {
                const data = await response.json();
                setAnnouncement({ id: data.id, title: data.title });
            }
        } catch (err) {
            console.error("Failed to fetch announcement:", err);
        }
    }, [id]);

    useEffect(() => {
        fetchRevisions();
        fetchAnnouncement();
    }, [fetchRevisions, fetchAnnouncement]);

    const handleRestore = async (revisionId: string) => {
        if (!confirm("Apakah Anda yakin ingin memulihkan ke versi ini? Versi saat ini akan disimpan terlebih dahulu.")) {
            return;
        }

        setIsRestoring(revisionId);
        try {
            const response = await fetch(`/api/announcements/${id}/revisions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ revisionId }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || "Gagal memulihkan");
                return;
            }

            alert("Berhasil dipulihkan ke versi sebelumnya");
            fetchRevisions();
            fetchAnnouncement();
        } catch {
            alert("Terjadi kesalahan");
        } finally {
            setIsRestoring(null);
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

    const getChangeTypeBadge = (changeType: string) => {
        const styles: Record<string, { bg: string; color: string }> = {
            CREATE: { bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" },
            EDIT: { bg: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" },
            PUBLISH: { bg: "rgba(168, 85, 247, 0.2)", color: "#a855f7" },
            UNPUBLISH: { bg: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" },
            RESTORE: { bg: "rgba(236, 72, 153, 0.2)", color: "#ec4899" },
        };
        const style = styles[changeType] || styles.EDIT;
        return (
            <span style={{
                padding: "4px 10px",
                backgroundColor: style.bg,
                color: style.color,
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.05em",
            }}>
                {changeType}
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
            <div style={{ marginBottom: "32px" }}>
                <Link
                    href={`/admin/announcements/${id}/edit`}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#737373",
                        fontSize: "13px",
                        marginBottom: "16px",
                        textDecoration: "none",
                    }}
                >
                    <FiArrowLeft size={14} />
                    Kembali ke Editor
                </Link>
                <p style={{ color: "#dc2626", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    RIWAYAT REVISI
                </p>
                <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: "24px", fontWeight: 700, color: "#fff" }}>
                    {announcement?.title || "Loading..."}
                </h1>
                <p style={{ color: "#737373", fontSize: "14px", marginTop: "8px" }}>
                    {pagination?.total || 0} versi tersimpan
                </p>
            </div>

            {/* Revisions Timeline */}
            <div style={{ position: "relative" }}>
                {/* Timeline line */}
                <div style={{
                    position: "absolute",
                    left: "19px",
                    top: "0",
                    bottom: "0",
                    width: "2px",
                    backgroundColor: "#262626",
                }} />

                {revisions.length === 0 ? (
                    <div style={{
                        backgroundColor: "#0a0a0a",
                        border: "1px solid #262626",
                        padding: "48px",
                        textAlign: "center",
                        color: "#525252",
                        marginLeft: "40px",
                    }}>
                        <FiClock size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                        <p>Belum ada riwayat revisi</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {revisions.map((revision, index) => (
                            <div key={revision.id} style={{ display: "flex", gap: "16px" }}>
                                {/* Timeline dot */}
                                <div style={{
                                    width: "40px",
                                    display: "flex",
                                    justifyContent: "center",
                                    position: "relative",
                                    zIndex: 1,
                                }}>
                                    <div style={{
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        backgroundColor: index === 0 ? "#dc2626" : "#333",
                                        border: "2px solid #0a0a0a",
                                    }} />
                                </div>

                                {/* Revision card */}
                                <div style={{
                                    flex: 1,
                                    backgroundColor: "#0a0a0a",
                                    border: index === 0 ? "1px solid #dc2626" : "1px solid #262626",
                                    padding: "20px",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                                                <span style={{ color: "#fff", fontWeight: 600, fontSize: "15px" }}>
                                                    <FiGitCommit style={{ marginRight: "6px", verticalAlign: "middle" }} />
                                                    v{revision.version}
                                                </span>
                                                {getChangeTypeBadge(revision.changeType)}
                                                {index === 0 && (
                                                    <span style={{
                                                        padding: "4px 10px",
                                                        backgroundColor: "rgba(220, 38, 38, 0.2)",
                                                        color: "#f87171",
                                                        fontSize: "10px",
                                                        fontWeight: 700,
                                                    }}>
                                                        CURRENT
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ color: "#a1a1aa", fontSize: "14px", fontWeight: 500 }}>
                                                {revision.title}
                                            </p>
                                            {revision.changeSummary && (
                                                <p style={{ color: "#737373", fontSize: "13px", marginTop: "4px" }}>
                                                    {revision.changeSummary}
                                                </p>
                                            )}
                                        </div>
                                        {index > 0 && (
                                            <button
                                                onClick={() => handleRestore(revision.id)}
                                                disabled={isRestoring === revision.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    padding: "8px 14px",
                                                    backgroundColor: "transparent",
                                                    border: "1px solid #333",
                                                    color: "#a1a1aa",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    cursor: isRestoring ? "not-allowed" : "pointer",
                                                    opacity: isRestoring ? 0.5 : 1,
                                                }}
                                            >
                                                <FiRotateCcw size={12} />
                                                {isRestoring === revision.id ? "Restoring..." : "Restore"}
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#525252", fontSize: "12px" }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <FiUser size={12} />
                                            {revision.author.name}
                                        </span>
                                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <FiClock size={12} />
                                            {formatDate(revision.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
