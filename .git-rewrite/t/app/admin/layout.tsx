import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import UpdateBanner from "@/components/admin/UpdateBanner";

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
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#000000',
            display: 'flex',
        }}>
            {/* Sidebar */}
            <AdminSidebar
                userName={session.user?.name}
                userEmail={session.user?.email}
            />

            {/* Main Content */}
            <main style={{
                flex: 1,
                marginLeft: '256px',
                minHeight: '100vh',
                backgroundColor: '#0a0a0a',
            }}>
                <UpdateBanner />
                {children}
            </main>
        </div>
    );
}
