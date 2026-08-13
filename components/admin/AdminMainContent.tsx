"use client";

import { useEffect, useState } from "react";
import AdminTopbar from "./AdminTopbar";

interface AdminMainContentProps {
    children: React.ReactNode;
}

export default function AdminMainContent({ children }: AdminMainContentProps) {
    const [isDesktop, setIsDesktop] = useState(true);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    return (
        <main style={{
            flex: 1,
            minHeight: '100vh',
            backgroundColor: 'var(--bg-secondary)',
            marginLeft: isDesktop ? '256px' : '0',
            paddingTop: isDesktop ? '0' : '60px', // Space for mobile menu button

        }}>
            <AdminTopbar />
            {children}
        </main>
    );
}
