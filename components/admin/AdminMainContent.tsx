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
    const marginLeft = isDesktop ? (collapsed ? '64px' : '256px') : '0';

    return (
        <main style={{
            flex: 1,
            minHeight: '100vh',
            backgroundColor: 'var(--bg-secondary)',
            marginLeft,
            paddingTop: isDesktop ? '0' : '60px', // Space for mobile menu button

        }}>
            <AdminTopbar />
            {children}
        </main>
    );
}
