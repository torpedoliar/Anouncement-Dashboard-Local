"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    ReactNode,
} from "react";
import {
    CheckCircle,
    Info,
    Warning,
    WarningCircle,
    X,
} from "@phosphor-icons/react";
import { humanizeError } from "@/lib/error-humanize";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

export interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType) => void;
    showError: (error: unknown, fallback?: string) => void;
    hideToast: (id: string) => void;
    success: (message: string) => void;
    error: (error: unknown, fallback?: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
    toasts: [],
    showToast: () => { },
    showError: () => { },
    hideToast: () => { },
    success: () => { },
    error: () => { },
    warning: () => { },
    info: () => { },
});

export const useToast = () => useContext(ToastContext);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const hideToast = useCallback((id: string) => {
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
        setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string, type: ToastType = "info") => {
            const id =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

            const finalMessage = type === "error" ? humanizeError(message) : message;

            setToasts((previous) => [...previous, { id, message: finalMessage, type }]);

            const timer = setTimeout(() => {
                timers.current.delete(id);
                setToasts((previous) => previous.filter((toast) => toast.id !== id));
            }, AUTO_DISMISS_MS);
            timers.current.set(id, timer);
        },
        []
    );

    const showError = useCallback(
        (err: unknown, fallback?: string) => {
            const message = humanizeError(err, fallback);
            showToast(message, "error");
        },
        [showToast]
    );

    const success = useCallback((msg: string) => showToast(msg, "success"), [showToast]);
    const error = useCallback((err: unknown, fallback?: string) => showError(err, fallback), [showError]);
    const warning = useCallback((msg: string) => showToast(msg, "warning"), [showToast]);
    const info = useCallback((msg: string) => showToast(msg, "info"), [showToast]);

    // Bersihkan timer yang menggantung saat provider di-unmount.
    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((timer) => clearTimeout(timer));
            pending.clear();
        };
    }, []);

    return (
        <ToastContext.Provider
            value={{
                toasts,
                showToast,
                showError,
                hideToast,
                success,
                error,
                warning,
                info,
            }}
        >
            {children}
            {/*
              Live region di kontainer untuk aksesibilitas screen reader.
              Positioning di kanan bawah (bottom-6 right-6) sesuai standar desktop UI.
            */}
            <div
                className="pointer-events-none fixed bottom-6 right-6 z-toast flex w-[min(420px,calc(100vw-3rem))] flex-col gap-3"
                role="status"
                aria-live="polite"
                aria-atomic="false"
            >
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

const TONE: Record<ToastType, { border: string; icon: string; bg: string; Icon: typeof Info; label: string }> = {
    success: {
        border: "border-success/40",
        icon: "text-success",
        bg: "bg-success/5",
        Icon: CheckCircle,
        label: "Berhasil",
    },
    error: {
        border: "border-danger/40",
        icon: "text-danger",
        bg: "bg-danger/5",
        Icon: WarningCircle,
        label: "Gagal",
    },
    warning: {
        border: "border-warning/40",
        icon: "text-warning",
        bg: "bg-warning/5",
        Icon: Warning,
        label: "Peringatan",
    },
    info: {
        border: "border-info/40",
        icon: "text-info",
        bg: "bg-info/5",
        Icon: Info,
        label: "Informasi",
    },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const tone = TONE[toast.type];
    const { Icon } = tone;

    return (
        <div
            className={`animate-slide-in-right pointer-events-auto flex items-start gap-3 rounded-card border bg-surface-1 p-4 shadow-lvl-3 backdrop-blur-md ${tone.border} ${tone.bg}`}
        >
            <Icon size={20} className={`mt-0.5 shrink-0 ${tone.icon}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium leading-snug text-text-1">
                    <span className="sr-only">{tone.label}: </span>
                    {toast.message}
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="-m-1 shrink-0 cursor-pointer rounded-control p-1 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Tutup notifikasi"
            >
                <X size={16} aria-hidden="true" />
            </button>
        </div>
    );
}
