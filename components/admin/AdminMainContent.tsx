"use client";

import { useEffect, useState } from "react";

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
            backgroundColor: '#0a0a0a',
            marginLeft: isDesktop ? '256px' : '0',
            paddingTop: isDesktop ? '0' : '60px', // Space for mobile menu button
            transition: 'margin-left 0.3s ease-in-out',
        }}>
            {children}
        </main>
    );
}
