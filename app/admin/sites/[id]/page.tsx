"use client";

/**
 * Edit Site Page
 * Edit existing site details and manage users
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FloppyDisk, Trash, Users, Check, X } from "@phosphor-icons/react";
import { use } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

/** Kit Button visual applied to <Link> — the kit Button renders a <button>, which cannot nest inside an <a>. */
const ACTION_LINK_SECONDARY =
    "inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface-1 px-4 py-2.5 text-[13px] font-medium text-text-1 transition-colors duration-150 hover:bg-surface-2";

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
    const { confirm, ConfirmDialog } = useConfirm();

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
        if (!(await confirm({ title: 'Hapus Site', message: `Are you sure you want to delete "${name}"? This will delete ALL content on this site!`, variant: 'danger' }))) {
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
            <div className="flex min-h-[40vh] items-center justify-center p-6">
                <p className="text-text-3">Loading site...</p>
            </div>
        );
    }

    if (!site) {
        return (
            <div className="p-10 text-center">
                <p className="text-danger">{error || "Site not found"}</p>
                <Link href="/admin/sites" className="mt-4 inline-block text-text-3 hover:text-text-1">
                    Back to Sites
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[800px] p-6">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/admin/sites"
                    className="mb-4 inline-flex items-center gap-2 text-text-3 transition-colors duration-150 hover:text-text-1"
                >
                    <ArrowLeft size={16} />
                    Back to Sites
                </Link>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="font-display text-2xl font-semibold text-text-1">
                            Edit Site
                        </h1>
                        <p className="mt-1 text-text-3">
                            Manage site details and settings
                        </p>
                    </div>
                    {site.isDefault && (
                        <Badge tone="danger" className="uppercase tracking-wide">
                            Default Site
                        </Badge>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-6 flex flex-wrap gap-3">
                <Link
                    href={`/admin/sites/${id}/settings`}
                    className={ACTION_LINK_SECONDARY}
                >
                    Site Settings
                </Link>
                <Link
                    href={`/admin/sites/${id}/users`}
                    className={ACTION_LINK_SECONDARY}
                >
                    <Users size={14} weight="bold" />
                    Manage Users
                </Link>
            </div>

            {/* Form */}
            <form onSubmit={handleSave}>
                <div className="mb-6 rounded-card border border-border bg-surface-1 p-6">
                    <h2 className="mb-5 font-display text-lg font-semibold text-text-1">
                        Basic Information
                    </h2>

                    {/* Name */}
                    <div className="mb-5">
                        <label className="mb-2 block text-[13px] text-text-3">
                            Site Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full rounded-control border border-border bg-surface-1 px-4 py-3 text-sm text-text-1 placeholder:text-text-3"
                        />
                    </div>

                    {/* Slug */}
                    <div className="mb-5">
                        <label className="mb-2 block text-[13px] text-text-3">
                            URL Slug *
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-text-3">/site/</span>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                required
                                pattern="[a-z0-9-]+"
                                className="flex-1 rounded-control border border-border bg-surface-1 px-4 py-3 text-sm text-text-1 placeholder:text-text-3"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-5">
                        <label className="mb-2 block text-[13px] text-text-3">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full resize-y rounded-control border border-border bg-surface-1 px-4 py-3 text-sm text-text-1 placeholder:text-text-3"
                        />
                    </div>

                    {/* Primary Color */}
                    <div className="mb-5">
                        <label className="mb-2 block text-[13px] text-text-3">
                            Primary Color
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="h-12 w-12 cursor-pointer rounded-card border-none"
                            />
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="w-32 rounded-control border border-border bg-surface-1 px-4 py-3 text-sm text-text-1 placeholder:text-text-3"
                            />
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div>
                        <label className="mb-2 block text-[13px] text-text-3">
                            Site Status
                        </label>
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={
                                isActive
                                    ? "flex items-center gap-3 rounded-control border border-success bg-success-subtle px-4 py-3"
                                    : "flex items-center gap-3 rounded-control border border-danger bg-danger-subtle px-4 py-3"
                            }
                        >
                            {isActive ? (
                                <>
                                    <Check size={16} weight="bold" className="text-success" />
                                    <span className="font-semibold text-success">Active</span>
                                </>
                            ) : (
                                <>
                                    <X size={16} weight="bold" className="text-danger" />
                                    <span className="font-semibold text-danger">Inactive</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div
                        className="mb-6 rounded-control border border-danger bg-danger-subtle px-4 py-3 text-danger"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 rounded-control border border-success bg-success-subtle px-4 py-3 text-success">
                        {success}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between gap-4">
                    <Button
                        type="button"
                        variant="danger"
                        onClick={handleDelete}
                        disabled={isDeleting || site.isDefault}
                        iconLeft={<Trash size={16} weight="bold" />}
                    >
                        {isDeleting ? "Deleting..." : "Delete Site"}
                    </Button>

                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isSaving}
                        iconLeft={<FloppyDisk size={16} weight="bold" />}
                    >
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
            <ConfirmDialog />
        </div>
    );
}