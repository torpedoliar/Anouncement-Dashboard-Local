"use client";

import { useRef } from "react";
import { WarningCircle } from "@/components/ui/client-icons";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog konfirmasi.
 *
 * Mekanika overlay (portal, focus trap, Escape, kunci scroll, pengembalian
 * fokus) dulu ditulis langsung di sini. Sekarang tinggal di `Modal` supaya
 * seluruh dialog di aplikasi berperilaku sama — komponen ini fokus pada isi
 * konfirmasinya saja.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const isDanger = variant === "danger";

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      initialFocusRef={confirmButtonRef}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={isDanger ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {isDanger && (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-subtle"
            aria-hidden="true"
          >
            <WarningCircle size={20} weight="fill" className="text-danger" />
          </span>
        )}
        <p className="m-0 text-sm leading-relaxed text-text-2">{message}</p>
      </div>
    </Modal>
  );
}
