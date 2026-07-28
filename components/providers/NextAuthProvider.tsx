"use client";

import { SessionProvider } from "next-auth/react";

export default function NextAuthProvider({ children, basePath }: { children: React.ReactNode; basePath?: string }) {
    return <SessionProvider basePath={basePath}>{children}</SessionProvider>;
}
