import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import UpdateBanner from "@/components/admin/UpdateBanner";
import AdminMainContent from "@/components/admin/AdminMainContent";

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

            {/* Main Content - Uses client component for responsive margin */}
            <AdminMainContent>
                <UpdateBanner />
                {children}
            </AdminMainContent>
        </div>
    );
}
