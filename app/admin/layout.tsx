import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import UpdateBanner from "@/components/admin/UpdateBanner";
import AdminMainContent from "@/components/admin/AdminMainContent";

import NextAuthProvider from "@/components/providers/NextAuthProvider";
import AdminSiteThemeProvider from "@/components/admin/AdminSiteThemeProvider";
import CommandPalette from "@/components/admin/CommandPalette";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/admin-login");
    }

    return (
        <NextAuthProvider basePath="/api/auth">
            <AdminSiteThemeProvider>
            <div style={{
                minHeight: '100vh',
                backgroundColor: 'var(--bg-primary)',
                display: 'flex',
            }}>
                {/* Sidebar */}
                <AdminSidebar
                    userName={session.user?.name}
                    userEmail={session.user?.email}
                    isSuperAdmin={session.user?.isSuperAdmin}
                />

                {/* Main Content - Uses client component for responsive margin */}
                <AdminMainContent>
                    <UpdateBanner />
                    {children}
                </AdminMainContent>
            </div>
            </AdminSiteThemeProvider>
            <CommandPalette />
        </NextAuthProvider>
    );
}
