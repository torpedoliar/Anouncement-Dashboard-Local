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
            backgroundColor: "#111",
            border: "1px solid #262626",
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
                        backgroundColor: "#262626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#737373",
                        fontSize: "18px",
                        fontWeight: 700,
                    }}>
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <h3 style={{ color: "#fff", fontSize: "15px", fontWeight: 600, margin: 0 }}>{name}</h3>
                    {category && (
                        <span style={{ color: "#525252", fontSize: "12px" }}>{category}</span>
                    )}
                </div>
            </div>

            {/* Description */}
            {description && (
                <p style={{ color: "#737373", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
                    {description.length > 100 ? description.substring(0, 100) + "..." : description}
                </p>
            )}

            {/* Health indicator */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: hasCredential ? "#22c55e" : "#eab308",
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
                        backgroundColor: "#dc2626",
                        color: "#fff",
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
                        backgroundColor: "#262626",
                        color: "#a1a1aa",
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
