"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
    toasts: [],
    showToast: () => { },
    hideToast: () => { },
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "info") => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = { id, message, type };

        setToasts((prev) => [...prev, newToast]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
            {children}
            {/* Toast Container */}
            <div
                style={{
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxWidth: "400px",
                }}
            >
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const bgColors: Record<ToastType, string> = {
        success: "#14532d",
        error: "#7f1d1d",
        warning: "#78350f",
        info: "#1e3a5f",
    };

    const borderColors: Record<ToastType, string> = {
        success: "#22c55e",
        error: "#ef4444",
        warning: "#f59e0b",
        info: "#3b82f6",
    };

    const icons: Record<ToastType, string> = {
        success: "✓",
        error: "✕",
        warning: "⚠",
        info: "ℹ",
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "16px",
                backgroundColor: bgColors[toast.type],
                border: `1px solid ${borderColors[toast.type]}`,
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                animation: "slideInRight 0.3s ease-out",
            }}
            role="alert"
            aria-live="polite"
        >
            <span
                style={{
                    fontSize: "16px",
                    color: borderColors[toast.type],
                    fontWeight: "bold",
                }}
            >
                {icons[toast.type]}
            </span>
            <p style={{ flex: 1, color: "#fff", fontSize: "14px", margin: 0 }}>
                {toast.message}
            </p>
            <button
                onClick={onClose}
                style={{
                    background: "none",
                    border: "none",
                    color: "#a3a3a3",
                    cursor: "pointer",
                    fontSize: "18px",
                    padding: "0",
                    lineHeight: 1,
                }}
                aria-label="Tutup notifikasi"
            >
                ×
            </button>
        </div>
    );
}
