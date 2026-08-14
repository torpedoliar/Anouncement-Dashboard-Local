"use client";

import { Trash, Eye, EyeSlash, X } from "@phosphor-icons/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface BulkActionBarProps {
    selectedCount: number;
    onClear: () => void;
    selectedIds: string[];
}

export default function BulkActionBar({ selectedCount, onClear, selectedIds }: BulkActionBarProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    const performBulkAction = async (action: "delete" | "publish" | "unpublish") => {
        if (action === "delete" && !showConfirmDialog) {
            setShowConfirmDialog(true);
            return;
        }

        setIsLoading(true);
        setActionInProgress(action);

        try {
            const response = await fetch("/api/announcements/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds, action }),
            });

            const data = await response.json();

            if (response.ok) {
                const messages = {
                    delete: `${data.affected} pengumuman dihapus`,
                    publish: `${data.affected} pengumuman dipublish`,
                    unpublish: `${data.affected} pengumuman di-unpublish`,
                };
                showToast(messages[action], "success");
                onClear();
                router.refresh();
            } else {
                showToast(data.error || "Gagal melakukan aksi", "error");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setIsLoading(false);
            setActionInProgress(null);
        }
    };

    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap items-center gap-3 px-5 py-3 bg-surface-1 border border-border rounded-card shadow-3 z-50">
            <span className="text-sm font-medium text-text-1 tabular-nums">
                {selectedCount} dipilih
            </span>

            <span className="w-px h-6 bg-border" />

            <button
                onClick={() => performBulkAction("publish")}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-success-subtle text-success rounded-control border border-success hover:bg-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Publish terpilih"
            >
                <Eye size={14} />
                {actionInProgress === "publish" ? "..." : "Publish"}
            </button>

            <button
                onClick={() => performBulkAction("unpublish")}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-warning-subtle text-warning rounded-control border border-warning hover:bg-warning/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Unpublish terpilih"
            >
                <EyeSlash size={14} />
                {actionInProgress === "unpublish" ? "..." : "Unpublish"}
            </button>

            <button
                onClick={() => performBulkAction("delete")}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-danger-subtle text-danger rounded-control border border-danger hover:bg-danger/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Hapus terpilih"
            >
                <Trash size={14} />
                {actionInProgress === "delete" ? "..." : "Hapus"}
            </button>

            <span className="w-px h-6 bg-border" />

            <button
                onClick={onClear}
                disabled={isLoading}
                className="inline-flex items-center justify-center w-8 h-8 text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-control border border-border transition-colors disabled:opacity-50"
                aria-label="Batalkan seleksi"
            >
                <X size={16} />
            </button>

            <ConfirmDialog
                open={showConfirmDialog}
                title="Hapus Pengumuman"
                message={`Yakin hapus ${selectedCount} pengumuman yang dipilih?`}
                confirmLabel="Hapus"
                cancelLabel="Batal"
                variant="danger"
                onConfirm={() => {
                    setShowConfirmDialog(false);
                    performBulkAction("delete");
                }}
                onCancel={() => setShowConfirmDialog(false)}
            />
        </div>
    );
}
