"use client";

import { useState, useEffect, useCallback } from "react";
import { FiMessageSquare, FiSend, FiUser, FiMail, FiCornerDownRight } from "react-icons/fi";

interface Comment {
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
    replies?: Comment[];
}

interface CommentSectionProps {
    announcementId: string;
}

export default function CommentSection({ announcementId }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form state
    const [authorName, setAuthorName] = useState("");
    const [authorEmail, setAuthorEmail] = useState("");
    const [content, setContent] = useState("");
    const [replyTo, setReplyTo] = useState<string | null>(null);

    const fetchComments = useCallback(async () => {
        try {
            const response = await fetch(`/api/announcements/${announcementId}/comments`);
            if (response.ok) {
                const data = await response.json();
                setComments(data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch comments:", err);
        } finally {
            setIsLoading(false);
        }
    }, [announcementId]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(`/api/announcements/${announcementId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    authorName,
                    authorEmail,
                    content,
                    parentId: replyTo,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit comment");
            }

            setSuccess(data.message);
            setContent("");
            setReplyTo(null);

            // Refresh comments if auto-approved
            if (data.comment?.status === "APPROVED") {
                fetchComments();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit");
        } finally {
            setIsSubmitting(false);
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

    return (
        <section style={{
            marginTop: "64px",
            paddingTop: "48px",
            borderTop: "1px solid #262626",
        }}>
            <h2 style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontFamily: "Montserrat, sans-serif",
                fontSize: "24px",
                fontWeight: 700,
                color: "#fff",
                marginBottom: "32px",
            }}>
                <FiMessageSquare size={24} />
                Komentar ({comments.length})
            </h2>

            {/* Comment Form */}
            <form onSubmit={handleSubmit} style={{
                backgroundColor: "#0a0a0a",
                border: "1px solid #262626",
                padding: "24px",
                marginBottom: "32px",
            }}>
                <h3 style={{
                    color: "#fff",
                    fontSize: "16px",
                    fontWeight: 600,
                    marginBottom: "20px",
                }}>
                    {replyTo ? "Balas Komentar" : "Tulis Komentar"}
                    {replyTo && (
                        <button
                            type="button"
                            onClick={() => setReplyTo(null)}
                            style={{
                                marginLeft: "12px",
                                padding: "4px 8px",
                                fontSize: "12px",
                                backgroundColor: "#262626",
                                color: "#a3a3a3",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            Batal
                        </button>
                    )}
                </h3>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                }}>
                    <div>
                        <label style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#a3a3a3",
                            fontSize: "13px",
                            marginBottom: "6px",
                        }}>
                            <FiUser size={14} />
                            Nama *
                        </label>
                        <input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            placeholder="Nama Anda"
                            required
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                backgroundColor: "#111",
                                border: "1px solid #333",
                                color: "#fff",
                                fontSize: "14px",
                                outline: "none",
                            }}
                        />
                    </div>
                    <div>
                        <label style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#a3a3a3",
                            fontSize: "13px",
                            marginBottom: "6px",
                        }}>
                            <FiMail size={14} />
                            Email (opsional)
                        </label>
                        <input
                            type="email"
                            value={authorEmail}
                            onChange={(e) => setAuthorEmail(e.target.value)}
                            placeholder="email@example.com"
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                backgroundColor: "#111",
                                border: "1px solid #333",
                                color: "#fff",
                                fontSize: "14px",
                                outline: "none",
                            }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Tulis komentar Anda..."
                        required
                        rows={4}
                        style={{
                            width: "100%",
                            padding: "12px",
                            backgroundColor: "#111",
                            border: "1px solid #333",
                            color: "#fff",
                            fontSize: "14px",
                            outline: "none",
                            resize: "vertical",
                        }}
                    />
                </div>

                {error && (
                    <p style={{ color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>
                        {error}
                    </p>
                )}

                {success && (
                    <p style={{ color: "#22c55e", fontSize: "13px", marginBottom: "12px" }}>
                        {success}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        fontSize: "14px",
                        fontWeight: 600,
                        border: "none",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        opacity: isSubmitting ? 0.6 : 1,
                    }}
                >
                    <FiSend size={16} />
                    {isSubmitting ? "Mengirim..." : "Kirim Komentar"}
                </button>
            </form>

            {/* Comments List */}
            {isLoading ? (
                <div style={{ color: "#525252", textAlign: "center", padding: "32px" }}>
                    Memuat komentar...
                </div>
            ) : comments.length === 0 ? (
                <div style={{
                    color: "#525252",
                    textAlign: "center",
                    padding: "48px",
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                }}>
                    <FiMessageSquare size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                    <p>Belum ada komentar. Jadilah yang pertama!</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {comments.map((comment) => (
                        <CommentCard
                            key={comment.id}
                            comment={comment}
                            formatDate={formatDate}
                            onReply={() => setReplyTo(comment.id)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

interface CommentCardProps {
    comment: Comment;
    formatDate: (date: string) => string;
    onReply: () => void;
    isReply?: boolean;
}

function CommentCard({ comment, formatDate, onReply, isReply }: CommentCardProps) {
    return (
        <div style={{
            backgroundColor: isReply ? "#111" : "#0a0a0a",
            border: "1px solid #262626",
            padding: "20px",
            marginLeft: isReply ? "32px" : 0,
        }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "12px",
            }}>
                <div>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: "15px" }}>
                        {comment.authorName}
                    </span>
                    <span style={{ color: "#525252", fontSize: "13px", marginLeft: "12px" }}>
                        {formatDate(comment.createdAt)}
                    </span>
                </div>
                {!isReply && (
                    <button
                        onClick={onReply}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            backgroundColor: "transparent",
                            color: "#737373",
                            fontSize: "12px",
                            border: "1px solid #333",
                            cursor: "pointer",
                        }}
                    >
                        <FiCornerDownRight size={12} />
                        Balas
                    </button>
                )}
            </div>
            <p style={{ color: "#d4d4d4", fontSize: "14px", lineHeight: 1.6 }}>
                {comment.content}
            </p>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                    {comment.replies.map((reply) => (
                        <CommentCard
                            key={reply.id}
                            comment={reply}
                            formatDate={formatDate}
                            onReply={() => { }}
                            isReply
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
