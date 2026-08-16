"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";

interface AdminShellProps {
    userName?: string | null;
    userEmail?: string | null;
    isSuperAdmin?: boolean;
    children: React.ReactNode;
}

/**
 * Pemilik tunggal state chrome admin (drawer mobile + rail desktop).
 *
 * Sebelumnya state ini tersebar: `AdminSidebar` dan `AdminMainContent`
 * masing-masing membaca `localStorage`, masing-masing memasang listener
 * `resize`, dan saling bicara lewat CustomEvent `admin:sidebar-collapse`.
 * Dua sumber kebenaran untuk satu geometri — dan keduanya salah sebelum
 * hydration. Sekarang:
 *
 *   - Geometri (lebar sidebar, offset konten, breakpoint 1024px) hidup di CSS
 *     (`.admin-shell` / `.admin-sidebar` / `.admin-main` di globals.css).
 *   - Mode rail dibaca dari `<html data-admin-sidebar>` yang sudah ditulis
 *     script pra-paint di `app/admin/layout.tsx`, jadi paint pertama benar.
 *   - Komponen ini hanya menyalakan atribut `data-admin-drawer` dan meneruskan
 *     handler. Tidak ada lagi listener `resize`.
 */
export default function AdminShell({
    userName,
    userEmail,
    isSuperAdmin,
    children,
}: AdminShellProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    // Nilai awal `false` cocok dengan render server. Nilai sebenarnya disalin
    // dari atribut <html> pada effect di bawah — atribut itu sudah dipakai CSS
    // untuk paint pertama, jadi tidak ada kedip walau state React menyusul.
    const [rail, setRail] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setRail(document.documentElement.dataset.adminSidebar === "rail");
    }, []);

    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    // Pindah halaman menutup drawer.
    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);

    // Drawer terbuka: kunci scroll body + Escape untuk menutup. Kunci scroll
    // memakai util ber-hitungan referensi supaya modal yang dibuka di atas
    // drawer tidak saling membuka kunci lebih awal.
    useEffect(() => {
        if (!drawerOpen) return;

        lockBodyScroll();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setDrawerOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);

        return () => {
            unlockBodyScroll();
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [drawerOpen]);

    const toggleRail = useCallback(() => {
        setRail((previous) => {
            const next = !previous;
            try {
                localStorage.setItem("adminSidebarCollapsed", next ? "1" : "0");
            } catch {
                // Mode privat / storage diblokir: rail tetap jalan untuk sesi ini.
            }
            document.documentElement.dataset.adminSidebar = next ? "rail" : "full";
            return next;
        });
    }, []);

    return (
        <div className="admin-shell flex" data-admin-drawer={drawerOpen ? "open" : "closed"}>
            {/* Scrim drawer mobile. aria-hidden karena Escape + tombol tutup
                sudah menyediakan jalan keluar yang bisa diakses keyboard. */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 z-scrim bg-black/60 lg:hidden"
                    onClick={closeDrawer}
                    aria-hidden="true"
                />
            )}

            <AdminSidebar
                userName={userName}
                userEmail={userEmail}
                isSuperAdmin={isSuperAdmin}
                rail={rail}
                onToggleRail={toggleRail}
                drawerOpen={drawerOpen}
                onCloseDrawer={closeDrawer}
            />

            <div className="admin-main">
                <AdminTopbar
                    drawerOpen={drawerOpen}
                    onToggleDrawer={() => setDrawerOpen((open) => !open)}
                />
                {children}
            </div>
        </div>
    );
}
