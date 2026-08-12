import AppCard from "@/components/portal/AppCard";

export interface GridApp {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logoPath?: string | null;
    category?: string | null;
    credentialCount: number;
}

export interface GridGroup {
    id: string;
    name: string;
    apps: GridApp[];
}

/**
 * Grid /portal: app dikelompokkan per-grup (name asc), grup "Lainnya" untuk app tanpa grup.
 */
export default function GroupedAppGrid({ groups }: { groups: GridGroup[] }) {
    if (groups.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {groups.map((g) => (
                <section key={g.id}>
                    <h2 style={{ color: "var(--text-secondary)", fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
                        {g.name}
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                        {g.apps.map((app) => (
                            <AppCard key={app.id} {...app} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}