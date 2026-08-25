import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import UpdateBanner from "@/components/admin/UpdateBanner";
import AdminShell from "@/components/admin/AdminShell";

import NextAuthProvider from "@/components/providers/NextAuthProvider";
import SessionExpiryWatcher from "@/components/providers/SessionExpiryWatcher";
import AdminSiteThemeProvider from "@/components/admin/AdminSiteThemeProvider";
import CommandPalette from "@/components/admin/CommandPalette";

/**
 * Script pra-paint: menyalin preferensi tersimpan ke atribut <html> SEBELUM
 * browser melakukan paint pertama.
 *
 * Kenapa perlu: rail sidebar dulu diterapkan di `useEffect`, jadi pengguna
 * yang menyimpan "rail" selalu melihat satu frame tampilan penuh dulu, lalu
 * melompat. Atribut yang ditulis di sini langsung dibaca CSS
 * (`html[data-admin-sidebar="rail"]`), sehingga geometri sudah benar sejak
 * frame pertama.
 *
 * Tema terang TIDAK diatur di sini lagi — itu sekarang tugas script pra-paint
 * global di app/layout.tsx (kunci "theme", fallback prefers-color-scheme).
 */
const PREPAINT_SCRIPT = `
(function () {
  try {
    var root = document.documentElement;
    root.dataset.adminSidebar =
      localStorage.getItem('adminSidebarCollapsed') === '1' ? 'rail' : 'full';
  } catch (e) {
    document.documentElement.dataset.adminSidebar = 'full';
  }
})();
`;

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        redirect("/admin-login?error=SessionExpired");
    }

    return (
        <NextAuthProvider basePath="/api/auth">
            <SessionExpiryWatcher />
            <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
            <AdminSiteThemeProvider>
                <AdminShell
                    userName={session.user?.name}
                    userEmail={session.user?.email}
                    isSuperAdmin={session.user?.isSuperAdmin}
                >
                    <UpdateBanner />
                    {children}
                </AdminShell>
            </AdminSiteThemeProvider>
            <CommandPalette />
        </NextAuthProvider>
    );
}
