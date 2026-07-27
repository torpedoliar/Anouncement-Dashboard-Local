"use client";

import { useState, useCallback, useRef } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

interface ConfirmDialogState extends ConfirmOptions {
  open: boolean;
}

/**
 * Imperative confirm dialog hook.
 *
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   const ok = await confirm({ title: "Hapus?", message: "Yakin?", variant: "danger" });
 *   if (ok) { ... }
 *
 * Render `<ConfirmDialog />` once in your component JSX.
 */
export function useConfirm() {
  const [confirmDialogData, setConfirmDialogData] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    message: "",
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setConfirmDialogData({ ...options, open: true });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setConfirmDialogData((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setConfirmDialogData((prev) => ({ ...prev, open: false }));
  }, []);

  const Dialog = useCallback(
    () => (
      <ConfirmDialog
        open={confirmDialogData.open}
        title={confirmDialogData.title}
        message={confirmDialogData.message}
        confirmLabel={confirmDialogData.confirmLabel}
        cancelLabel={confirmDialogData.cancelLabel}
        variant={confirmDialogData.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [confirmDialogData, handleConfirm, handleCancel]
  );

  return { confirm, ConfirmDialog: Dialog };
}
