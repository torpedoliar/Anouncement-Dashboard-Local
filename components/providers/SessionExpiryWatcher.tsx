"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

/**
 * SessionExpiryWatcher
 * Memantau status session secara real-time pada halaman admin:
 * 1. Jika NextAuth session berubah menjadi "unauthenticated", langsung redirect ke login dengan pesan sesi habis.
 * 2. Mengintersepsi window.fetch: jika ada request API admin yang mengembalikan HTTP 401, langsung redirect ke login.
 */
export default function SessionExpiryWatcher() {
    const { status } = useSession();
    const pathname = usePathname();
    const isRedirecting = useRef(false);

    // Stabil (useCallback + deps pathname): aman masuk deps effect tanpa
    // memicu re-run — hanya berganti bila path berubah, yang sudah jadi dep.
    const redirectToLogin = useCallback((reason = "SessionExpired") => {
        if (isRedirecting.current) return;
        isRedirecting.current = true;
        const currentPath = typeof window !== "undefined" ? window.location.pathname : pathname;
        const callbackUrl = encodeURIComponent(currentPath || "/admin");
        window.location.href = `/admin-login?error=${reason}&callbackUrl=${callbackUrl}`;
    }, [pathname]);

    // 1. Pantau status autentikasi dari NextAuth
    useEffect(() => {
        if (status === "unauthenticated" && pathname?.startsWith("/admin")) {
            redirectToLogin("SessionExpired");
        }
    }, [status, pathname, redirectToLogin]);

    // 2. Intersepsi fetch global untuk menangkap respon 401 Unauthorized
    useEffect(() => {
        if (typeof window === "undefined") return;

        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                if (response.status === 401 && window.location.pathname.startsWith("/admin")) {
                    console.warn("[Auth] 401 Unauthorized detected on API call. Redirecting to login...");
                    redirectToLogin("SessionExpired");
                }
                return response;
            } catch (error) {
                throw error;
            }
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [redirectToLogin]);

    return null;
}
