"use client";

import { FiTrash2, FiEye, FiEyeOff, FiX } from "react-icons/fi";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

interface BulkActionBarProps {
    selectedCount: number;
    onClear: () => void;
    selectedIds: string[];
}

export default function BulkActionBar({ selectedCount, onClear, selectedIds }: BulkActionBarProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const router = useRouter();
    const { showToast } = useToast();

    const performBulkAction = async (action: "delete" | "publish" | "unpublish") => {
        if (action === "delete" && !confirm(`Yakin hapus ${selectedCount} pengumuman?`)) {
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
        } catch (error) {
            console.error("Bulk action error:", error);
            showToast("Terjadi kesalahan", "error");
        } finally {
            setIsLoading(false);
            setActionInProgress(null);
        }
    };

    if (selectedCount === 0) return null;

    return (
        <div
            style={{
                position: "fixed",
                bottom: "24px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 24px",
                backgroundColor: "#171717",
                border: "1px solid #262626",
                borderRadius: "12px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                zIndex: 100,
            }}
        >
            <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>
                {selectedCount} dipilih
            </span>

            <div style={{ width: "1px", height: "24px", backgroundColor: "#333" }} />

            <button
                onClick={() => performBulkAction("publish")}
                disabled={isLoading}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    backgroundColor: "#14532d",
                    border: "1px solid #22c55e",
                    color: "#22c55e",
                    fontSize: "13px",
                    fontWeight: 500,
                    borderRadius: "6px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading && actionInProgress !== "publish" ? 0.5 : 1,
                }}
            >
                <FiEye size={14} />
                {actionInProgress === "publish" ? "..." : "Publish"}
            </button>

            <button
                onClick={() => performBulkAction("unpublish")}
                disabled={isLoading}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    backgroundColor: "#78350f",
                    border: "1px solid #f59e0b",
                    color: "#f59e0b",
                    fontSize: "13px",
                    fontWeight: 500,
                    borderRadius: "6px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading && actionInProgress !== "unpublish" ? 0.5 : 1,
                }}
            >
                <FiEyeOff size={14} />
                {actionInProgress === "unpublish" ? "..." : "Unpublish"}
            </button>

            <button
                onClick={() => performBulkAction("delete")}
                disabled={isLoading}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    backgroundColor: "#7f1d1d",
                    border: "1px solid #ef4444",
                    color: "#ef4444",
                    fontSize: "13px",
                    fontWeight: 500,
                    borderRadius: "6px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading && actionInProgress !== "delete" ? 0.5 : 1,
                }}
            >
                <FiTrash2 size={14} />
                {actionInProgress === "delete" ? "..." : "Hapus"}
            </button>

            <div style={{ width: "1px", height: "24px", backgroundColor: "#333" }} />

            <button
                onClick={onClear}
                disabled={isLoading}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    backgroundColor: "transparent",
                    border: "1px solid #333",
                    color: "#737373",
                    borderRadius: "6px",
                    cursor: "pointer",
                }}
                aria-label="Batalkan seleksi"
            >
                <FiX size={16} />
            </button>
        </div>
    );
}
