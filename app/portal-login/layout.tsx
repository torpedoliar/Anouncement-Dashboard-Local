import NextAuthProvider from "@/components/providers/NextAuthProvider";

export const dynamic = "force-dynamic";

export default function PortalLoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <NextAuthProvider basePath="/api/portal-auth">
            {children}
        </NextAuthProvider>
    );
}
