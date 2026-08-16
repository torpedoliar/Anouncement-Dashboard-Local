"use client";

import { useEffect, useState } from "react";
import AdminTopbar from "./AdminTopbar";

interface AdminMainContentProps {
    children: React.ReactNode;
}

export default function AdminMainContent({ children }: AdminMainContentProps) {
    const [isDesktop, setIsDesktop] = useState(true);
    const [collapsed, setCollapsed] = useState(() =>
        typeof window !== "undefined"
            ? localStorage.getItem("adminSidebarCollapsed") === "1"
            : false
    );

    const onCollapseChange = (e: Event) => {
        setCollapsed((e as CustomEvent<{ collapsed: boolean }>).detail.collapsed);
    };

    useEffect(() => {
        const checkScreenSize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        window.addEventListener('admin:sidebar-collapse', onCollapseChange);
        return () => {
            window.removeEventListener('resize', checkScreenSize);
            window.removeEventListener('admin:sidebar-collapse', onCollapseChange);
        };
    }, []);

    // Desktop margin follows sidebar rail state; mobile overlays so margin is 0.
    const marginLeftClass = isDesktop ? (collapsed ? "ml-16" : "ml-64") : "ml-0";

    return (
        <main className={`flex-1 min-h-screen bg-surface-1 ${marginLeftClass} ${isDesktop ? "" : "pt-[60px]"}`}>
            <AdminTopbar />
            {children}
        </main>
    );
}
