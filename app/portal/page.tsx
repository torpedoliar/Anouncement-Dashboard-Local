import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getAccessiblePortalApps, hasCredential } from "@/lib/portal-access";
import AppCard from "@/components/portal/AppCard";
import { FiGrid } from "react-icons/fi";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
    const session = await getServerSession(portalAuthOptions);
    const userId = session!.user!.id as string;

    const apps = await getAccessiblePortalApps(userId);

    // Check credential status for each app (batch to avoid N+1)
    const credStatus = await Promise.all(
        apps.map((app) => hasCredential(userId, app.id))
    );

    return (
        <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: "32px" }}>
                <p style={{
                    color: "#dc2626",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.2em",
                    marginBottom: "8px",
                }}>PORTAL SSO</p>
                <h1 style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "#fff",
                    margin: 0,
                }}>Aplikasi Saya</h1>
            </div>

            {/* Grid */}
            {apps.length === 0 ? (
                <div style={{
                    padding: "64px",
                    textAlign: "center",
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                    borderRadius: "12px",
                }}>
                    <FiGrid size={48} color="#262626" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "#525252", fontSize: "15px" }}>
                        Anda belum punya akses ke aplikasi apapun. Hubungi administrator.
                    </p>
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "16px",
                }}>
                    {apps.map((app, i) => (
                        <AppCard
                            key={app.id}
                            id={app.id}
                            name={app.name}
                            slug={app.slug}
                            description={app.description}
                            logoPath={app.logoPath}
                            category={app.category}
                            hasCredential={credStatus[i]}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
