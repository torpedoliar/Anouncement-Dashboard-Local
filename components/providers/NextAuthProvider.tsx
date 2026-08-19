"use client";

import { SessionProvider } from "next-auth/react";

export default function NextAuthProvider({ children, basePath }: { children: React.ReactNode; basePath?: string }) {
    return (
        <SessionProvider
            basePath={basePath}
            refetchInterval={60} // Validasi sesi berkala tiap 60 detik
            refetchOnWindowFocus={true} // Validasi saat tab browser dibuka/difokuskan kembali
        >
            {children}
        </SessionProvider>
    );
}
