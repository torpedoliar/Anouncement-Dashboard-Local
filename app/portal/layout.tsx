import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { redirect } from "next/navigation";
import PortalHeader from "@/components/portal/PortalHeader";

import NextAuthProvider from "@/components/providers/NextAuthProvider";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(portalAuthOptions);
    if (!session?.user?.id) {
        redirect("/portal-login");
    }

    return (
        <NextAuthProvider basePath="/api/portal-auth">
            <div className="min-h-screen bg-surface-0 text-text-1">
                <PortalHeader userName={session.user?.name} />
                <main>{children}</main>
            </div>
        </NextAuthProvider>
    );
}
