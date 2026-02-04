"use client";

/**
 * Edit Site Page
 * Edit existing site details and manage users
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiSave, FiTrash2, FiUsers, FiCheck, FiX } from "react-icons/fi";
import { use } from "react";

interface Site {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    primaryColor: string;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function EditSitePage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const [site, setSite] = useState<Site | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#ED1C24");
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        fetchSite();
    }, [id]);

    const fetchSite = async () => {
        try {
            const res = await fetch(`/api/sites/${id}`);
            if (res.ok) {
                const data = await res.json();
                setSite(data);
                setName(data.name);
                setSlug(data.slug);
                setDescription(data.description || "");
                setPrimaryColor(data.primaryColor);
                setIsActive(data.isActive);
            } else {
                setError("Site not found");
            }
        } catch (error) {
            console.error("Failed to fetch site:", error);
            setError("Failed to load site");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setIsSaving(true);

        try {
            const res = await fetch(`/api/sites/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    slug,
                    description: description || null,
                    primaryColor,
                    isActive,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update site");
            }

            setSuccess("Site updated successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update site");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${name}"? This will delete ALL content on this site!`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete site");
            }
            router.push("/admin/sites");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete site");
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ color: "#888" }}>Loading site...</div>
            </div>
        );
    }

    if (!site) {
        return (
            <div style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ color: "#ef4444" }}>{error || "Site not found"}</div>
                <Link href="/admin/sites" style={{ color: "#888", marginTop: "16px", display: "inline-block" }}>
                    Back to Sites
                </Link>
            </div>
        );
    }

    return (
        <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: "32px" }}>
                <Link
                    href="/admin/sites"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#888",
                        textDecoration: "none",
                        marginBottom: "16px",
                    }}
                >
                    <FiArrowLeft size={16} />
                    Back to Sites
                </Link>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
                            Edit Site
                        </h1>
                        <p style={{ color: "#888", fontSize: "14px" }}>
                            Manage site details and settings
                        </p>
                    </div>
                    {site.isDefault && (
                        <span style={{
                            fontSize: "11px",
                            padding: "6px 12px",
                            backgroundColor: "rgba(237,28,36,0.1)",
                            color: "#ED1C24",
                            borderRadius: "6px",
                            fontWeight: 600,
                        }}>
                            DEFAULT SITE
                        </span>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{
                display: "flex",
                gap: "12px",
                marginBottom: "24px",
            }}>
                <Link
                    href={`/admin/sites/${id}/settings`}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 16px",
                        backgroundColor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: "13px",
                    }}
                >
                    Site Settings
                </Link>
                <Link
                    href={`/admin/sites/${id}/users`}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 16px",
                        backgroundColor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: "13px",
                    }}
                >
                    <FiUsers size={14} />
                    Manage Users
                </Link>
            </div>

            {/* Form */}
            <form onSubmit={handleSave}>
                <div style={{
                    backgroundColor: "#1a1a1a",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    padding: "24px",
                    marginBottom: "24px",
                }}>
                    <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px" }}>
                        Basic Information
                    </h2>

                    {/* Name */}
                    <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", fontSize: "13px", color: "#888", marginBottom: "8px" }}>
                            Site Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            style={{
                                width: "100%",
                                padding: "12px 16px",
                                backgroundColor: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                color: "#fff",
                                fontSize: "14px",
                            }}
                        />
                    </div>

                    {/* Slug */}
                    <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", fontSize: "13px", color: "#888", marginBottom: "8px" }}>
                            URL Slug *
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: "#666", fontSize: "14px" }}>/site/</span>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                required
                                pattern="[a-z0-9-]+"
                                style={{
                                    flex: 1,
                                    padding: "12px 16px",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "8px",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", fontSize: "13px", color: "#888", marginBottom: "8px" }}>
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            style={{
                                width: "100%",
                                padding: "12px 16px",
                                backgroundColor: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                color: "#fff",
                                fontSize: "14px",
                                resize: "vertical",
                            }}
                        />
                    </div>

                    {/* Primary Color */}
                    <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", fontSize: "13px", color: "#888", marginBottom: "8px" }}>
                            Primary Color
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                style={{
                                    width: "48px",
                                    height: "48px",
                                    borderRadius: "8px",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            />
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                style={{
                                    width: "120px",
                                    padding: "12px 16px",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "8px",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            />
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div>
                        <label style={{ display: "block", fontSize: "13px", color: "#888", marginBottom: "8px" }}>
                            Site Status
                        </label>
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "12px 16px",
                                backgroundColor: isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                border: `1px solid ${isActive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                                borderRadius: "8px",
                                cursor: "pointer",
                            }}
                        >
                            {isActive ? (
                                <>
                                    <FiCheck color="#22c55e" />
                                    <span style={{ color: "#22c55e", fontWeight: 600 }}>Active</span>
                                </>
                            ) : (
                                <>
                                    <FiX color="#ef4444" />
                                    <span style={{ color: "#ef4444", fontWeight: 600 }}>Inactive</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div style={{
                        padding: "12px 16px",
                        backgroundColor: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: "8px",
                        color: "#ef4444",
                        marginBottom: "24px",
                    }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        padding: "12px 16px",
                        backgroundColor: "rgba(34,197,94,0.1)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: "8px",
                        color: "#22c55e",
                        marginBottom: "24px",
                    }}>
                        {success}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting || site.isDefault}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "14px 28px",
                            backgroundColor: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: "8px",
                            color: "#ef4444",
                            fontWeight: 600,
                            cursor: isDeleting || site.isDefault ? "not-allowed" : "pointer",
                            opacity: isDeleting || site.isDefault ? 0.5 : 1,
                        }}
                    >
                        <FiTrash2 size={16} />
                        {isDeleting ? "Deleting..." : "Delete Site"}
                    </button>

                    <button
                        type="submit"
                        disabled={isSaving}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "14px 28px",
                            backgroundColor: "#ED1C24",
                            border: "none",
                            borderRadius: "8px",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: isSaving ? "not-allowed" : "pointer",
                            opacity: isSaving ? 0.7 : 1,
                        }}
                    >
                        <FiSave size={16} />
                        {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
