"use client";

/**
 * Create New Site Page
 * Form to create a new site with optional cloning
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Copy, Check } from "@phosphor-icons/react";
import Input from "@/components/ui/Input";
import Button, { buttonClasses } from "@/components/ui/Button";

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
        // Auto-generate slug dari name
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
        <div className="mx-auto max-w-3xl p-6">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/admin/sites"
                    className="mb-4 inline-flex items-center gap-2 text-sm text-text-2 transition-colors duration-150 hover:text-text-1"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back to Sites
                </Link>
                <h1 className="text-2xl font-bold">Create New Site</h1>
                <p className="mt-1 text-sm text-text-3">
                    Add a new site to your multi-site network
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="rounded-card border border-border bg-surface-1 p-6">
                    <h2 className="mb-5 text-lg font-semibold">Basic Information</h2>

                    <div className="space-y-5">
                        <Input
                            label="Site Name *"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Factory 1"
                            required
                        />

                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-text-1">URL Slug *</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-text-3">/site/</span>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="factory-1"
                                    required
                                    pattern="[a-z0-9-]+"
                                    className="h-11 flex-1 rounded-control border border-border bg-surface-1 px-3 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                />
                            </div>
                            <span className="mt-1.5 block text-xs text-text-3">
                                Only lowercase letters, numbers, and hyphens
                            </span>
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-text-1">Description</span>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of this site..."
                                rows={3}
                                className="w-full rounded-control border border-border bg-surface-1 px-3 py-2.5 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            />
                        </label>

                        {/* Primary Color */}
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-text-1">Primary Color</span>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    aria-label="Pilih warna utama"
                                    className="h-12 w-12 cursor-pointer rounded-control border border-border bg-surface-1"
                                />
                                <input
                                    type="text"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    aria-label="Kode warna utama"
                                    className="h-11 w-32 rounded-control border border-border bg-surface-1 px-3 text-sm text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                />
                            </div>
                        </label>
                    </div>
                </section>

                {/* Template Selection */}
                <section className="rounded-card border border-border bg-surface-1 p-6">
                    <h2 className="mb-5 text-lg font-semibold">Template</h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Blank Option */}
                        <button
                            type="button"
                            onClick={() => setCloneMode("blank")}
                            aria-pressed={cloneMode === "blank"}
                            className={`rounded-sheet border-2 p-5 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                                cloneMode === "blank"
                                    ? "border-accent bg-accent-subtle"
                                    : "border-border bg-surface-0 hover:border-border-strong"
                            }`}
                        >
                            <div className="mb-2 flex items-center gap-3">
                                <Globe size={24} color={cloneMode === "blank" ? "var(--accent)" : "var(--text-3)"} aria-hidden="true" />
                                <span className="font-semibold">Blank Site</span>
                                {cloneMode === "blank" && (
                                    <Check size={18} color="var(--accent)" aria-hidden="true" />
                                )}
                            </div>
                            <p className="text-[13px] text-text-3">
                                Start fresh with default settings
                            </p>
                        </button>

                        {/* Clone Option */}
                        <button
                            type="button"
                            onClick={() => setCloneMode("clone")}
                            disabled={existingSites.length === 0}
                            aria-pressed={cloneMode === "clone"}
                            className={`rounded-sheet border-2 p-5 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                                cloneMode === "clone"
                                    ? "border-accent bg-accent-subtle"
                                    : "border-border bg-surface-0 hover:border-border-strong"
                            }`}
                        >
                            <div className="mb-2 flex items-center gap-3">
                                <Copy size={24} color={cloneMode === "clone" ? "var(--accent)" : "var(--text-3)"} aria-hidden="true" />
                                <span className="font-semibold">Clone Existing</span>
                                {cloneMode === "clone" && (
                                    <Check size={18} color="var(--accent)" aria-hidden="true" />
                                )}
                            </div>
                            <p className="text-[13px] text-text-3">
                                Copy settings &amp; categories from another site
                            </p>
                        </button>
                    </div>

                    {/* Clone Source Selector */}
                    {cloneMode === "clone" && existingSites.length > 0 && (
                        <label className="mt-5 block">
                            <span className="mb-1.5 block text-sm font-medium text-text-1">Clone From</span>
                            <select
                                value={cloneFromSiteId}
                                onChange={(e) => setCloneFromSiteId(e.target.value)}
                                required={cloneMode === "clone"}
                                className="h-11 w-full rounded-control border border-border bg-surface-1 px-3 text-sm text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                                <option value="">Select a site...</option>
                                {existingSites.map((site) => (
                                    <option key={site.id} value={site.id}>
                                        {site.name} (/site/{site.slug})
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </section>

                {/* Error */}
                {error && (
                    <div
                        role="alert"
                        className="rounded-control border border-danger/20 bg-danger-subtle px-4 py-3 text-sm text-danger"
                    >
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-4">
                    <Link href="/admin/sites" className={buttonClasses({ variant: "secondary" })}>
                        Cancel
                    </Link>
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                        {isSubmitting ? "Creating..." : "Create Site"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
