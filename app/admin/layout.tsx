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
        <div className="min-h-screen bg-black flex">
            {/* Sidebar */}
            <AdminSidebar
                userName={session.user?.name}
                userEmail={session.user?.email}
            />

            {/* Main Content */}
            <main className="flex-1 min-h-screen bg-[#0a0a0a] transition-all duration-300 lg:ml-64 w-full">
                <UpdateBanner />
                <div className="mt-14 lg:mt-0"> {/* Spacer for mobile menu button */}
                    {children}
                </div>
            </main>
        </div>
    );
}
