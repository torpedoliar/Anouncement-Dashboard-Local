"use client";

import Link from "next/link";

interface AppCardProps {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logoPath?: string | null;
    category?: string | null;
    hasCredential: boolean;
}

export default function AppCard({ name, slug, description, logoPath, category, hasCredential }: AppCardProps) {
    return (
        <div style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
        }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {logoPath ? (
                    <img
                        src={logoPath}
                        alt={name}
                        style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }}
                    />
                ) : (
                    <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        backgroundColor: "var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                        fontSize: "18px",
                        fontWeight: 700,
                    }}>
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <h3 style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: 600, margin: 0 }}>{name}</h3>
                    {category && (
                        <span style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>{category}</span>
                    )}
                </div>
            </div>

            {/* Description */}
            {description && (
                <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
                    {description.length > 100 ? description.substring(0, 100) + "..." : description}
                </p>
            )}

            {/* Health indicator */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: hasCredential ? "var(--color-success)" : "var(--color-warning)",
            }}>
                {hasCredential ? "✓ Kredensial tersimpan" : "⚠ Belum ada kredensial"}
            </div>

            {/* Action */}
            {hasCredential ? (
                <Link
                    href={`/portal/app/${slug}`}
                    style={{
                        display: "block",
                        textAlign: "center",
                        padding: "10px",
                        backgroundColor: "var(--brand-red)",
                        color: "var(--text-primary)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                        textDecoration: "none",
                    }}
                >
                    Buka Aplikasi
                </Link>
            ) : (
                <Link
                    href={`/portal/credentials?app=${slug}`}
                    style={{
                        display: "block",
                        textAlign: "center",
                        padding: "10px",
                        backgroundColor: "var(--border-color)",
                        color: "var(--text-secondary)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 500,
                        textDecoration: "none",
                    }}
                >
                    Simpan Kredensial
                </Link>
            )}
        </div>
    );
}
