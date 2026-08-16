"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import Badge from "@/components/ui/Badge";

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
        sites: {
            site: {
                slug: string;
            };
        }[];
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

/* --- Phosphor Bold icons (inline, no deps) --- */
function IconMessage({ size = 16, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" {...rest}><path d="M215.8,50.64A87.93,87.93,0,0,0,128,24C74.76,24,32,63.8,24.33,116L8,232l104.61-28.78A88,88,0,0,0,232,128,86.59,86.59,0,0,0,215.8,50.64ZM128,196a16,16,0,0,1-4.24-.58L40.1,219.25l16.16-81.24A15.66,15.66,0,0,1,56,128a72,72,0,0,1,72-72,70.78,70.78,0,0,1,26.2,5A72,72,0,0,1,128,196Z"/></svg>
    );
}
function IconCheck({ size = 16, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" {...rest}><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Z"/></svg>
    );
}
function IconX({ size = 16, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" {...rest}><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,71.66,194.66a8,8,0,0,1-11.32-11.32l56-56-56-56A8,8,0,0,1,71.66,59.34L128,114.69l56-55.35a8,8,0,0,1,11.32,11.32l-56,56,56,56Z"/></svg>
    );
}
function IconFlag({ size = 16, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" {...rest}><path d="M216,48H176V32a16,16,0,0,0-32,0V48H64A32,32,0,0,0,32,80v128a32,32,0,0,0,32,32H192a32,32,0,0,0,32-32V64A32,32,0,0,0,216,48ZM96,208V64h48V48h16v128a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16V64H64v128a16,16,0,0,0,16,16H96Z"/></svg>
    );
}
function IconTrash({ size = 16, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" {...rest}><path d="M216,48V208a16,16,0,0,1-16,16H56A16,16,0,0,1,40,208V48H24V32H208V48ZM104,120v72a8,8,0,0,0,16,0V120a8,8,0,0,0-16,0Zm48,0v72a8,8,0,0,0,16,0V120a8,8,0,0,0-16,0Z"/></svg>
    );
}
function IconMagnifyingGlass({ size = 16, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" {...rest}><path d="M229.66,218.34,175.02,163.7A87.9,87.9,0,1,0,163.7,175.02l54.64,54.64a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>
    );
}
function IconArrowSquareOut({ size = 12, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" {...rest}><path d="M224,32v128a8,8,0,0,1-16,0V68.69L95.34,177.36a8,8,0,0,1-11.32-11.32L196.69,56H160a8,8,0,0,1,0-16h48A32,32,0,0,1,240,72V160a8,8,0,0,1-16,0V32A8,8,0,0,0,216,24h-48a8,8,0,0,1,0-16h48A32,32,0,0,1,240,40V160a8,8,0,0,1-16,0ZM64,88H16a8,8,0,0,0,0,16h48V144a8,8,0,0,0,16,0V104h40a8,8,0,0,0,0-16H80V48a8,8,0,0,0-16,0Z"/></svg>
    );
}
/* --- Status helper: tone + icon + label --- */
type ActionKey = "APPROVED" | "REJECTED" | "SPAM";

const STATUS_META: Record<Comment["status"], { tone: "warning" | "success" | "danger" | "info"; Icon: React.FC<{ size?: number }>; label: string }> = {
    PENDING: { tone: "warning", Icon: IconMessage, label: "Menunggu" },
    APPROVED: { tone: "success", Icon: IconCheck, label: "Disetujui" },
    REJECTED: { tone: "danger", Icon: IconX, label: "Ditolak" },
    SPAM: { tone: "info", Icon: IconFlag, label: "Spam" },
};

/* --- Comment actions that update a single comment --- */
type CommentAction = { type: "approve" } | { type: "reject" } | { type: "spam" } | { type: "delete" };

/* --- Page --- */
export default function CommentsPage() {
    const [comments, setComments] = useState<Comment[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [pendingComment, setPendingComment] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<CommentAction | null>(null);

    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

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

    /* --- Inline moderation handlers --- */
    const handleModerate = async (commentId: string, status: ActionKey) => {
        setPendingComment(commentId);
        setPendingAction({ type: status.toLowerCase() as Exclude<CommentAction["type"], "delete"> });
        try {
            const response = await fetch(`/api/comments/${commentId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal memperbarui komentar", "error");
            } else {
                fetchComments();
                showToast("Komentar berhasil diperbarui", "success");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setPendingComment(null);
            setPendingAction(null);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!(await confirm({ title: "Hapus Komentar", message: "Apakah Anda yakin ingin menghapus komentar ini?", variant: "danger" }))) return;
        setPendingComment(commentId);
        setPendingAction({ type: "delete" });
        try {
            const response = await fetch(`/api/comments/${commentId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal menghapus komentar", "error");
            } else {
                fetchComments();
                showToast("Komentar berhasil dihapus", "success");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setPendingComment(null);
            setPendingAction(null);
        }
    };

    /* --- Konfirmasi aksi moderasi ---
       Dulu halaman ini punya shell modal sendiri (state modalAction/
       modalCommentId + ~45 baris markup ber-style inline) padahal `useConfirm`
       sudah dipakai di file yang sama untuk hapus. Satu kosakata konfirmasi
       untuk semua aksi: portal, focus trap, Escape, kunci scroll ikut gratis. */
    const MODERATE_COPY: Record<
        "approve" | "reject" | "spam",
        { title: string; message: string; confirmLabel: string; status: ActionKey }
    > = {
        approve: {
            title: "Setujui Komentar",
            message: "Komentar akan tampil di halaman publik. Lanjutkan?",
            confirmLabel: "Setujui",
            status: "APPROVED",
        },
        reject: {
            title: "Tolak Komentar",
            message: "Komentar tidak akan ditampilkan di halaman publik. Lanjutkan?",
            confirmLabel: "Tolak",
            status: "REJECTED",
        },
        spam: {
            title: "Tandai Sebagai Spam",
            message: "Komentar akan ditandai spam dan disembunyikan. Lanjutkan?",
            confirmLabel: "Tandai Spam",
            status: "SPAM",
        },
    };

    const showConfirmAction = async (action: CommentAction, commentId: string) => {
        if (action.type === "delete") return;

        const copy = MODERATE_COPY[action.type];
        const confirmed = await confirm({
            title: copy.title,
            message: copy.message,
            confirmLabel: copy.confirmLabel,
            variant: action.type === "approve" ? "default" : "danger",
        });
        if (!confirmed) return;

        await handleModerate(commentId, copy.status);
    };

    /* --- Helpers --- */
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    const handlePageChange = (newPage: number) => { setPage(newPage); };

    /* --- Render --- */
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]" style={{ padding: "32px" }}>
                <p className="text-text-3">Memuat komentar...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto" style={{ padding: "32px" }}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: "var(--brand-red)" }}>
                        KOMENTAR
                    </p>
                    <h1 className="text-[28px] font-bold" style={{ fontFamily: "Montserrat, sans-serif", color: "var(--text-primary)" }}>
                        Moderasi Komentar
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <IconMagnifyingGlass size={16} />
                    <label htmlFor="status-filter" className="sr-only">Filter status</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="rounded-md px-3 py-2 text-sm border"
                        style={{
                            padding: "10px 16px",
                            backgroundColor: "var(--bg-tertiary)",
                            border: "1px solid var(--border-strong)",
                            color: "var(--text-primary)",
                        }}
                    >
                        <option value="">Semua Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Disetujui</option>
                        <option value="REJECTED">Ditolak</option>
                        <option value="SPAM">Spam</option>
                    </select>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {(["PENDING", "APPROVED", "REJECTED", "SPAM"] as const).map((status) => {
                    const meta = STATUS_META[status];
                    const count = comments.filter((c) => c.status === status).length;
                    const toneColor = meta.tone === "warning" ? "var(--color-warning)" : meta.tone === "success" ? "var(--color-success)" : meta.tone === "danger" ? "var(--color-error)" : "var(--text-tertiary)";
                    return (
                        <div key={status} className="rounded-lg p-5 border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
                            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{status}</p>
                            <p className="text-[24px] font-bold" style={{ color: toneColor }}>
                                {count}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Comment ledger */}
            {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-lg border" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
                    <IconMessage size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                    <p className="text-text-3">Tidak ada komentar ditemukan</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {comments.map((comment) => {
                        const meta = STATUS_META[comment.status];
                        const isPending = pendingComment === comment.id;
                        const StatusIcon = meta.Icon;
                        return (
                            <div
                                key={comment.id}
                                className="rounded-lg border transition-opacity"
                                style={{
                                    backgroundColor: "var(--bg-secondary)",
                                    borderColor: "var(--border-color)",
                                    opacity: isPending ? 0.6 : 1,
                                }}
                            >
                                <div className="p-4">
                                    {/* Row header: author + email + status + time */}
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{comment.authorName}</span>
                                        {comment.authorEmail && (
                                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{comment.authorEmail}</span>
                                        )}
                                        <Badge tone={meta.tone}>
                                            <StatusIcon size={12} />
                                            {meta.label}
                                        </Badge>
                                        <span className="text-xs ml-auto font-mono tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                                            {formatDate(comment.createdAt)}
                                        </span>
                                    </div>

                                    {/* Announcement link */}
                                    <Link
                                        href={`/site/${comment.announcement.sites[0]?.site.slug || "santos-jaya-abadi"}/${comment.announcement.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs mb-2 hover:underline"
                                        style={{ color: "var(--color-info)" }}
                                    >
                                        {comment.announcement.title}
                                        <IconArrowSquareOut size={12} />
                                    </Link>

                                    {/* Content excerpt */}
                                    <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-2)" }}>
                                        {comment.content.length > 200
                                            ? comment.content.slice(0, 200) + "…"
                                            : comment.content}
                                    </p>

                                    {/* Action buttons — only for PENDING */}
                                    {comment.status === "PENDING" && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                onClick={() => showConfirmAction({ type: "approve" }, comment.id)}
                                                disabled={isPending}
                                                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                                style={{
                                                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                                                    color: "var(--color-success)",
                                                }}
                                                aria-label={isPending ? "Menyetujui komentar" : "Setujui komentar"}
                                            >
                                                {isPending && pendingAction?.type === "approve" ? (
                                                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <IconCheck size={14} />
                                                )}
                                                {isPending && pendingAction?.type === "approve" ? "Menyetujui..." : "Setujui"}
                                            </button>
                                            <button
                                                onClick={() => showConfirmAction({ type: "reject" }, comment.id)}
                                                disabled={isPending}
                                                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                                style={{
                                                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                                                    color: "var(--color-error)",
                                                }}
                                                aria-label={isPending ? "Menolak komentar" : "Tolak komentar"}
                                            >
                                                {isPending && pendingAction?.type === "reject" ? (
                                                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <IconX size={14} />
                                                )}
                                                {isPending && pendingAction?.type === "reject" ? "Menolak..." : "Tolak"}
                                            </button>
                                            <button
                                                onClick={() => showConfirmAction({ type: "spam" }, comment.id)}
                                                disabled={isPending}
                                                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                                style={{
                                                    backgroundColor: "var(--bg-tertiary)",
                                                    color: "var(--text-muted)",
                                                    borderColor: "var(--border-strong)",
                                                }}
                                                aria-label={isPending ? "Menandai sebagai spam" : "Tandai sebagai spam"}
                                            >
                                                {isPending && pendingAction?.type === "spam" ? (
                                                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <IconFlag size={14} />
                                                )}
                                                {isPending && pendingAction?.type === "spam" ? "Menandai..." : "Spam"}
                                            </button>
                                        </div>
                                    )}

                                    {/* Delete button */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            disabled={isPending}
                                            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                            style={{
                                                backgroundColor: "transparent",
                                                borderColor: "var(--border-color)",
                                                color: "var(--brand-red)",
                                            }}
                                            aria-label={isPending ? "Menghapus komentar" : "Hapus komentar"}
                                        >
                                            {isPending && pendingAction?.type === "delete" ? (
                                                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <IconTrash size={14} />
                                            )}
                                            {isPending && pendingAction?.type === "delete" ? "Menghapus..." : "Hapus"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            onClick={() => handlePageChange(p)}
                            className="rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            style={{
                                backgroundColor: p === page ? "var(--brand-red)" : "var(--bg-tertiary)",
                                color: "var(--text-primary)",
                            }}
                            aria-label={`Halaman ${p}`}
                            disabled={p === page}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Satu host dialog untuk hapus maupun moderasi (lihat useConfirm). */}
            <ConfirmDialog />
        </div>
    );
}
