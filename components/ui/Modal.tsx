"use client";

import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "@/components/ui/client-icons";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    /** Judul yang terlihat; dipakai juga sebagai nama aksesibel dialog. */
    title: string;
    /** Teks pendukung opsional di bawah judul (jadi aria-describedby). */
    description?: string;
    size?: ModalSize;
    /** Baris aksi di kaki dialog. */
    footer?: ReactNode;
    /** Elemen yang difokuskan saat dialog terbuka. Default: tombol tutup. */
    initialFocusRef?: RefObject<HTMLElement | null>;
    /** Setel false untuk alur yang tidak boleh ditutup dari luar panel. */
    closeOnBackdrop?: boolean;
    /** Sembunyikan tombol X (mis. dialog konfirmasi yang aksinya eksplisit). */
    hideCloseButton?: boolean;
    /**
     * Tanpa chrome panel (header/border/padding). Untuk overlay yang isinya
     * memang bukan formulir — misal lightbox media yang menampilkan gambar
     * penuh. Perilaku dialognya (portal, focus trap, Escape, kunci scroll)
     * tetap sama; `title` dipakai sebagai nama aksesibel yang disembunyikan.
     */
    bare?: boolean;
    /** Kelas tambahan untuk panel. Berguna bersama `bare`. */
    panelClassName?: string;
    children: ReactNode;
}

const SIZES: Record<ModalSize, string> = {
    sm: "max-w-[420px]",
    md: "max-w-[560px]",
    lg: "max-w-[760px]",
    xl: "max-w-[960px]",
};

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Satu dialog modal untuk seluruh aplikasi.
 *
 * Sebelum ini setiap halaman menulis shell modalnya sendiri —
 * `<div className="fixed inset-0 z-50 ...">` di users, portal-users (dua kali),
 * portal-groups, portal-apps, media, dan comments. Tidak satu pun di-portal ke
 * body, punya focus trap, mengunci scroll, atau menutup dengan Escape; jadi
 * pengguna keyboard bisa nge-tab keluar ke halaman di belakangnya dan latar
 * belakang tetap bisa di-scroll. Perilaku itu sekarang hidup di satu tempat.
 *
 * Yang ditangani di sini: portal ke document.body, focus trap dua arah,
 * pengembalian fokus ke pemicu, Escape, kunci scroll ber-hitungan (aman untuk
 * modal bertumpuk), backdrop klik, dan panel yang bisa di-scroll sendiri di
 * layar pendek supaya aksi di kaki dialog tidak pernah terpotong.
 */
export default function Modal({
    open,
    onClose,
    title,
    description,
    size = "md",
    footer,
    initialFocusRef,
    closeOnBackdrop = true,
    hideCloseButton = false,
    bare = false,
    panelClassName = "",
    children,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    // createPortal butuh document; render baru setelah mount.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Jaga referensi onClose terbaru agar handleKeyDown tidak perlu dibuat ulang tiap render
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current?.();
                return;
            }

            if (event.key !== "Tab" || !panelRef.current) return;

            const focusable = Array.from(
                panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
            ).filter((element) => element.offsetParent !== null);

            if (focusable.length === 0) {
                // Tidak ada yang bisa difokus: tahan fokus di panel.
                event.preventDefault();
                panelRef.current.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        },
        []
    );

    useEffect(() => {
        if (!open) return;

        previousFocusRef.current = document.activeElement as HTMLElement | null;

        const frame = requestAnimationFrame(() => {
            // Hanya fokuskan target awal saat modal terbuka jika fokus belum berada di dalam panel modal
            if (!panelRef.current?.contains(document.activeElement)) {
                const target =
                    initialFocusRef?.current ?? closeButtonRef.current ?? panelRef.current;
                target?.focus();
            }
        });

        document.addEventListener("keydown", handleKeyDown);
        lockBodyScroll();

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("keydown", handleKeyDown);
            unlockBodyScroll();
            previousFocusRef.current?.focus();
        };
    }, [open, handleKeyDown, initialFocusRef]);

    if (!open || !mounted) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-modal flex items-center justify-center overflow-y-auto p-4 ${
                bare ? "bg-black/90" : "bg-black/60"
            }`}
            onMouseDown={(event) => {
                // mousedown, bukan click: klik yang DIMULAI di dalam panel lalu
                // dilepas di backdrop (mis. seleksi teks) tidak ikut menutup.
                if (closeOnBackdrop && event.target === event.currentTarget) onCloseRef.current?.();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={
                    // `bare` sengaja hanya menyetel dasar minimal: posisi relatif
                    // (agar tombol tutup absolut punya jangkar) dan reset outline.
                    // Bentuk panel sepenuhnya milik pemanggil via panelClassName.
                    bare
                        ? `relative focus:outline-none ${panelClassName}`
                        : `flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-sheet border border-border bg-surface-1 text-text-1 shadow-lvl-3 focus:outline-none ${SIZES[size]} ${panelClassName}`
                }
            >
                {bare ? (
                    <>
                        <h2 id={titleId} className="sr-only">
                            {title}
                        </h2>
                        {!hideCloseButton && (
                            <button
                                type="button"
                                ref={closeButtonRef}
                                onClick={onClose}
                                className="absolute right-0 top-0 z-dropdown flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                aria-label="Tutup"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        )}
                        {children}
                    </>
                ) : (
                    <>
                <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
                    <div className="min-w-0">
                        <h2 id={titleId} className="m-0 text-base font-semibold text-text-1">
                            {title}
                        </h2>
                        {description && (
                            <p id={descriptionId} className="mt-1 text-sm text-text-2">
                                {description}
                            </p>
                        )}
                    </div>
                    {!hideCloseButton && (
                        <button
                            type="button"
                            ref={closeButtonRef}
                            onClick={onClose}
                            className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-control p-1.5 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-label="Tutup dialog"
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* Isi men-scroll sendiri supaya kaki dialog tetap terlihat di
                    layar pendek — modal lama memakai panel setinggi konten,
                    sehingga tombol simpan bisa keluar dari viewport. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

                {footer && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-6 py-4">
                        {footer}
                    </div>
                )}
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
