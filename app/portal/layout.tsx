import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { redirect } from "next/navigation";
import PortalHeader from "@/components/portal/PortalHeader";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(portalAuthOptions);
    if (!session?.user?.id) {
        redirect("/portal-login");
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#fff" }}>
            <PortalHeader userName={session.user?.name} />
            <main>{children}</main>
        </div>
    );
}
