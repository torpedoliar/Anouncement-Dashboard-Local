"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export default function NextAuthProvider({
    children,
    basePath,
    session,
}: {
    children: React.ReactNode;
    basePath?: string;
    session?: Session | null;
}) {
    return (
        <SessionProvider
            session={session}
            basePath={basePath}
            refetchInterval={60} // Validasi sesi berkala tiap 60 detik
            refetchOnWindowFocus={true} // Validasi saat tab browser dibuka/difokuskan kembali
        >
            {children}
        </SessionProvider>
    );
}
