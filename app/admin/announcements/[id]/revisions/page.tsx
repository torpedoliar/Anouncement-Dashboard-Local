"use client";

import { useState, useEffect, useCallback, use } from "react";
import { Clock, ArrowCounterClockwise, User, ArrowLeft, GitCommit } from "@phosphor-icons/react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";

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
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

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
        if (!(await confirm({ title: "Pulihkan Versi", message: "Apakah Anda yakin ingin memulihkan ke versi ini? Versi saat ini akan disimpan terlebih dahulu.", variant: "default" }))) {
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
                showToast(data.error || "Gagal memulihkan", "error");
                return;
            }

            showToast("Berhasil dipulihkan ke versi sebelumnya", "success");
            fetchRevisions();
            fetchAnnouncement();
        } catch {
            showToast("Terjadi kesalahan", "error");
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
        const toneMap: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
            CREATE: "success",
            EDIT: "info",
            PUBLISH: "warning",
            UNPUBLISH: "danger",
            RESTORE: "neutral",
        };
        const tone = toneMap[changeType] ?? "info";
        return <Badge tone={tone}>{changeType}</Badge>;
    };

    // Skeleton loading — pola ListSkeleton (animate-pulse + surface token), bentuk
    // meniru header + kartu timeline di bawahnya supaya layout tidak melompat.
    if (isLoading) {
        return (
            <div className="p-8">
                <div aria-hidden="true">
                    <div className="mb-8 space-y-3">
                        <div className="h-2.5 w-28 rounded bg-surface-2 animate-pulse" />
                        <div className="h-6 w-72 max-w-full rounded bg-surface-2 animate-pulse" />
                        <div className="h-3.5 w-32 rounded bg-surface-2 animate-pulse" />
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 4 }, (_, i) => (
                            <div
                                key={i}
                                className="ml-10 flex items-center gap-4 rounded-card border border-border bg-surface-1 px-5 py-5"
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                <div className="size-3 shrink-0 rounded-full bg-surface-3 animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 w-1/3 rounded bg-surface-2 animate-pulse" />
                                    <div className="h-3 w-2/3 rounded bg-surface-2 animate-pulse" />
                                </div>
                                <div className="hidden h-8 w-24 rounded-control bg-surface-2 sm:block animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href={`/admin/announcements/${id}/edit`}
                    className="inline-flex items-center gap-1.5 mb-4 text-[13px] text-text-3 hover:text-text-1"
                >
                    <ArrowLeft size={14} />
                    Kembali ke Editor
                </Link>
                <p className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-accent">
                    RIWAYAT REVISI
                </p>
                <h1 className="text-2xl font-bold text-text-1">
                    {announcement?.title || "Loading..."}
                </h1>
                <p className="mt-2 text-sm text-text-3">
                    {pagination?.total || 0} versi tersimpan
                </p>
            </div>

            {/* Revisions Timeline */}
            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />

                {revisions.length === 0 ? (
                    <div className="ml-10 rounded-card border border-border bg-surface-1 p-12 text-center text-text-3">
                        <Clock size={32} className="mb-3 mx-auto opacity-50" />
                        <p>Belum ada riwayat revisi</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {revisions.map((revision, index) => (
                            <div key={revision.id} className="flex gap-4">
                                {/* Timeline dot */}
                                <div className="relative z-[1] flex w-10 justify-center">
                                    {/* Titik pertama memakai aksen brand, sisanya netral border-strong */}
                                    <div
                                        className={`size-3 rounded-full border-2 border-surface-1 ${
                                            index === 0 ? "bg-accent" : "bg-border-strong"
                                        }`}
                                    />
                                </div>

                                {/* Revision card */}
                                <div
                                    className={`flex-1 rounded-card border bg-surface-1 p-5 ${
                                        index === 0 ? "border-accent" : "border-border"
                                    }`}
                                >
                                    <div className="mb-3 flex items-start justify-between">
                                        <div>
                                            <div className="mb-2 flex items-center gap-3">
                                                <span className="text-[15px] font-semibold text-text-1">
                                                    <GitCommit className="mr-1.5 inline-block align-middle" />
                                                    v{revision.version}
                                                </span>
                                                {getChangeTypeBadge(revision.changeType)}
                                                {index === 0 && (
                                                    <Badge tone="danger">CURRENT</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-text-2">
                                                {revision.title}
                                            </p>
                                            {revision.changeSummary && (
                                                <p className="mt-1 text-[13px] text-text-3">
                                                    {revision.changeSummary}
                                                </p>
                                            )}
                                        </div>
                                        {index > 0 && (
                                            <button
                                                onClick={() => handleRestore(revision.id)}
                                                disabled={isRestoring === revision.id}
                                                className={`inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-transparent px-3.5 py-2 text-xs font-semibold transition-colors duration-150 ${
                                                    isRestoring
                                                        ? "cursor-not-allowed opacity-50"
                                                        : "cursor-pointer hover:bg-surface-2 hover:text-text-1"
                                                }`}
                                            >
                                                <ArrowCounterClockwise size={12} />
                                                {isRestoring === revision.id ? "Restoring..." : "Restore"}
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-text-3">
                                        <span className="flex items-center gap-1">
                                            <User size={12} />
                                            {revision.author.name}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {formatDate(revision.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <ConfirmDialog />
        </div>
    );
}
