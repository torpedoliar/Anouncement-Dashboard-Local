import NextAuthProvider from "@/components/providers/NextAuthProvider";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <NextAuthProvider basePath="/api/auth">
            {children}
        </NextAuthProvider>
    );
}
