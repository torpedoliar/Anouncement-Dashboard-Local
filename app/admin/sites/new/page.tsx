"use client";

/**
 * Create New Site Page
 * Form to create a new site with optional cloning
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiGlobe, FiCopy, FiCheck } from "react-icons/fi";

interface Site {
    id: string;
    name: string;
    slug: string;
}

export default function CreateSitePage() {
    const router = useRouter();
    const [existingSites, setExistingSites] = useState<Site[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#ED1C24");
    const [cloneMode, setCloneMode] = useState<"blank" | "clone">("blank");
    const [cloneFromSiteId, setCloneFromSiteId] = useState("");

    useEffect(() => {
        fetchExistingSites();
    }, []);

    useEffect(() => {
        // Auto-generate slug from name
        if (name) {
            const generatedSlug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            setSlug(generatedSlug);
        }
    }, [name]);

    const fetchExistingSites = async () => {
        try {
            const res = await fetch("/api/sites");
            if (res.ok) {
                const data = await res.json();
                setExistingSites(data);
            }
        } catch (error) {
            console.error("Failed to fetch sites:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/sites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    slug,
                    description: description || null,
                    primaryColor,
                    cloneFromSiteId: cloneMode === "clone" ? cloneFromSiteId : null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create site");
            }

            const site = await res.json();
            router.push(`/admin/sites/${site.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create site");
        } finally {
            setIsSubmitting(false);
        }
    };

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
                <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
                    Create New Site
                </h1>
                <p style={{ color: "#888", fontSize: "14px" }}>
                    Add a new site to your multi-site network
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <div
                    style={{
                        backgroundColor: "#1a1a1a",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "24px",
                        marginBottom: "24px",
                    }}
                >
                    <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px" }}>
                        Basic Information
                    </h2>

                    {/* Name */}
                    <div style={{ marginBottom: "20px" }}>
                        <label
                            style={{
                                display: "block",
                                fontSize: "13px",
                                color: "#888",
                                marginBottom: "8px",
                            }}
                        >
                            Site Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Factory 1"
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
                        <label
                            style={{
                                display: "block",
                                fontSize: "13px",
                                color: "#888",
                                marginBottom: "8px",
                            }}
                        >
                            URL Slug *
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: "#666", fontSize: "14px" }}>/site/</span>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="factory-1"
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
                        <div style={{ color: "#666", fontSize: "11px", marginTop: "6px" }}>
                            Only lowercase letters, numbers, and hyphens
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: "20px" }}>
                        <label
                            style={{
                                display: "block",
                                fontSize: "13px",
                                color: "#888",
                                marginBottom: "8px",
                            }}
                        >
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this site..."
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
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: "13px",
                                color: "#888",
                                marginBottom: "8px",
                            }}
                        >
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
                </div>

                {/* Template Selection */}
                <div
                    style={{
                        backgroundColor: "#1a1a1a",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "24px",
                        marginBottom: "24px",
                    }}
                >
                    <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px" }}>
                        Template
                    </h2>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        {/* Blank Option */}
                        <button
                            type="button"
                            onClick={() => setCloneMode("blank")}
                            style={{
                                padding: "20px",
                                backgroundColor: cloneMode === "blank" ? "rgba(237,28,36,0.1)" : "rgba(255,255,255,0.03)",
                                border: `2px solid ${cloneMode === "blank" ? "#ED1C24" : "rgba(255,255,255,0.1)"}`,
                                borderRadius: "12px",
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "all 0.2s",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                                <FiGlobe size={24} color={cloneMode === "blank" ? "#ED1C24" : "#888"} />
                                <span style={{ fontWeight: 600, color: "#fff" }}>Blank Site</span>
                                {cloneMode === "blank" && <FiCheck color="#ED1C24" size={18} />}
                            </div>
                            <p style={{ color: "#888", fontSize: "13px" }}>
                                Start fresh with default settings
                            </p>
                        </button>

                        {/* Clone Option */}
                        <button
                            type="button"
                            onClick={() => setCloneMode("clone")}
                            disabled={existingSites.length === 0}
                            style={{
                                padding: "20px",
                                backgroundColor: cloneMode === "clone" ? "rgba(237,28,36,0.1)" : "rgba(255,255,255,0.03)",
                                border: `2px solid ${cloneMode === "clone" ? "#ED1C24" : "rgba(255,255,255,0.1)"}`,
                                borderRadius: "12px",
                                textAlign: "left",
                                cursor: existingSites.length === 0 ? "not-allowed" : "pointer",
                                opacity: existingSites.length === 0 ? 0.5 : 1,
                                transition: "all 0.2s",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                                <FiCopy size={24} color={cloneMode === "clone" ? "#ED1C24" : "#888"} />
                                <span style={{ fontWeight: 600, color: "#fff" }}>Clone Existing</span>
                                {cloneMode === "clone" && <FiCheck color="#ED1C24" size={18} />}
                            </div>
                            <p style={{ color: "#888", fontSize: "13px" }}>
                                Copy settings & categories from another site
                            </p>
                        </button>
                    </div>

                    {/* Clone Source Selector */}
                    {cloneMode === "clone" && existingSites.length > 0 && (
                        <div style={{ marginTop: "20px" }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: "13px",
                                    color: "#888",
                                    marginBottom: "8px",
                                }}
                            >
                                Clone From
                            </label>
                            <select
                                value={cloneFromSiteId}
                                onChange={(e) => setCloneFromSiteId(e.target.value)}
                                required={cloneMode === "clone"}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "8px",
                                    color: "#fff",
                                    fontSize: "14px",
                                }}
                            >
                                <option value="">Select a site...</option>
                                {existingSites.map((site) => (
                                    <option key={site.id} value={site.id}>
                                        {site.name} (/site/{site.slug})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div
                        style={{
                            padding: "12px 16px",
                            backgroundColor: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: "8px",
                            color: "#ef4444",
                            marginBottom: "24px",
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <div style={{ display: "flex", gap: "16px" }}>
                    <Link
                        href="/admin/sites"
                        style={{
                            padding: "14px 28px",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#fff",
                            textDecoration: "none",
                            fontWeight: 600,
                        }}
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            flex: 1,
                            padding: "14px 28px",
                            backgroundColor: "#ED1C24",
                            border: "none",
                            borderRadius: "8px",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: isSubmitting ? "not-allowed" : "pointer",
                            opacity: isSubmitting ? 0.7 : 1,
                        }}
                    >
                        {isSubmitting ? "Creating..." : "Create Site"}
                    </button>
                </div>
            </form>
        </div>
    );
}
