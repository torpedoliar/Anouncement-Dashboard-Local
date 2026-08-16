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

            setToasts((previous) => [...previous, { id, message, type }]);

            const timer = setTimeout(() => {
                timers.current.delete(id);
                setToasts((previous) => previous.filter((toast) => toast.id !== id));
            }, AUTO_DISMISS_MS);
            timers.current.set(id, timer);
        },
        []
    );

    // Bersihkan timer yang menggantung saat provider di-unmount.
    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((timer) => clearTimeout(timer));
            pending.clear();
        };
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
            {children}
            {/*
              Live region dipasang di kontainer, bukan di tiap toast. Screen
              reader hanya mengumumkan perubahan pada region yang SUDAH ada di
              DOM; sebelumnya `aria-live` menempel pada elemen toast yang baru
              disisipkan, sehingga pesan sering tidak terbaca sama sekali.

              pointer-events-none di kontainer supaya area kosong di sekitar
              toast tidak memblokir klik pada konten di bawahnya.
            */}
            <div
                className="pointer-events-none fixed bottom-6 right-6 z-toast flex w-[min(400px,calc(100vw-3rem))] flex-col gap-3"
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

const TONE: Record<ToastType, { border: string; icon: string; Icon: typeof Info; label: string }> = {
    success: {
        border: "border-success/40",
        icon: "text-success",
        Icon: CheckCircle,
        label: "Berhasil",
    },
    error: {
        border: "border-danger/40",
        icon: "text-danger",
        Icon: WarningCircle,
        label: "Gagal",
    },
    warning: {
        border: "border-warning/40",
        icon: "text-warning",
        Icon: Warning,
        label: "Peringatan",
    },
    info: {
        border: "border-info/40",
        icon: "text-info",
        Icon: Info,
        label: "Informasi",
    },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const tone = TONE[toast.type];
    const { Icon } = tone;

    return (
        <div
            className={`animate-slide-in-right pointer-events-auto flex items-start gap-3 rounded-card border bg-surface-1 p-4 shadow-lvl-3 ${tone.border}`}
        >
            <Icon size={18} className={`mt-px shrink-0 ${tone.icon}`} aria-hidden="true" />
            <p className="m-0 min-w-0 flex-1 text-sm text-text-1">
                <span className="sr-only">{tone.label}: </span>
                {toast.message}
            </p>
            <button
                type="button"
                onClick={onClose}
                className="-m-1 shrink-0 cursor-pointer rounded-control p-1 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Tutup notifikasi"
            >
                <X size={14} aria-hidden="true" />
            </button>
        </div>
    );
}
