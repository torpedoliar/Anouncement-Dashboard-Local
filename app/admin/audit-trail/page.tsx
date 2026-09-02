"use client";

import { useState, useEffect, useCallback } from "react";
import {
    CaretDown,
    CaretLeft,
    CaretRight,
    DownloadSimple,
    Info,
    ListChecks,
    MagnifyingGlass,
    SlidersHorizontal,
    Warning,
    WarningCircle,
} from "@phosphor-icons/react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface AuditLogEntry {
    id: string;
    actorType: string;
    actorId: string | null;
    actorEmail: string | null;
    actorName: string | null;
    category: string;
    action: string;
    entityType: string;
    entityId: string | null;
    outcome: string;
    errorMessage: string | null;
    changes: string | null;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    severity: string;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const ACTOR_OPTIONS = [
    { value: "", label: "Semua Actor" },
    { value: "ADMIN_USER", label: "Admin CMS" },
    { value: "PORTAL_USER", label: "Portal User" },
    { value: "SYSTEM", label: "System" },
];

const CATEGORY_OPTIONS = [
    { value: "", label: "Semua Kategori" },
    { value: "AUTH", label: "Auth" },
    { value: "CONTENT", label: "Content" },
    { value: "USER_MGMT", label: "User Mgmt" },
    { value: "PORTAL", label: "Portal" },
    { value: "SECURITY", label: "Security" },
    { value: "SYSTEM", label: "System" },
    { value: "CONFIG", label: "Config" },
];

const OUTCOME_OPTIONS = [
    { value: "", label: "Semua Outcome" },
    { value: "SUCCESS", label: "Success" },
    { value: "FAILURE", label: "Failure" },
];

const SEVERITY_OPTIONS = [
    { value: "", label: "Semua Severity" },
    { value: "INFO", label: "Info" },
    { value: "WARNING", label: "Warning" },
    { value: "ERROR", label: "Error" },
];

const ENTITY_OPTIONS = [
    { value: "", label: "Semua Entity" },
    { value: "ANNOUNCEMENT", label: "Announcement" },
    { value: "CATEGORY", label: "Category" },
    { value: "COMMENT", label: "Comment" },
    { value: "USER", label: "User" },
    { value: "PORTAL_APP", label: "Portal App" },
    { value: "PORTAL_USER", label: "Portal User" },
    { value: "PORTAL_CREDENTIAL", label: "Portal Credential" },
    { value: "SETTINGS", label: "Settings" },
    { value: "SYSTEM", label: "System" },
];

const ACTOR_LABELS: Record<string, string> = {
    ADMIN_USER: "Admin CMS",
    PORTAL_USER: "Portal User",
    SYSTEM: "System",
};

function actorTone(actorType: string): BadgeTone {
    switch (actorType) {
        case "ADMIN_USER": return "info";
        case "PORTAL_USER": return "warning";
        default: return "neutral";
    }
}

function severityElement(severity: string) {
    if (severity === "WARNING") {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                <Warning size={14} aria-hidden="true" /> Warning
            </span>
        );
    }
    if (severity === "ERROR") {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                <WarningCircle size={14} aria-hidden="true" /> Error
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-text-3">
            <Info size={14} aria-hidden="true" /> Info
        </span>
    );
}

export default function AuditTrailPage() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        actorType: "",
        category: "",
        outcome: "",
        severity: "",
        entityType: "",
        search: "",
        from: "",
        to: "",
    });

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: "20",
            });
            if (filters.actorType) params.set("actorType", filters.actorType);
            if (filters.category) params.set("category", filters.category);
            if (filters.outcome) params.set("outcome", filters.outcome);
            if (filters.severity) params.set("severity", filters.severity);
            if (filters.entityType) params.set("entityType", filters.entityType);
            if (filters.search) params.set("search", filters.search);
            if (filters.from) params.set("from", filters.from);
            if (filters.to) params.set("to", filters.to);

            const response = await fetch(`/api/audit-trail?${params}`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.data);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch audit trail:", err);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.page, filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = async (format: "csv" | "json") => {
        const params = new URLSearchParams({ export: format });
        if (filters.actorType) params.set("actorType", filters.actorType);
        if (filters.category) params.set("category", filters.category);
        if (filters.outcome) params.set("outcome", filters.outcome);
        if (filters.entityType) params.set("entityType", filters.entityType);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);

        const response = await fetch(`/api/audit-trail?${params}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleString("id-ID", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });

    const parseJSON = (val: unknown) => {
        if (!val) return null;
        if (typeof val === "object") return val;
        try { return JSON.parse(val as string); } catch { return val; }
    };

    const resetFilters = () => {
        setFilters({ actorType: "", category: "", outcome: "", severity: "", entityType: "", search: "", from: "", to: "" });
        setPagination({ ...pagination, page: 1 });
    };

    const updateFilter = (key: keyof typeof filters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPagination((p) => ({ ...p, page: 1 }));
    };

    const truncateId = (id: string) =>
        id.length > 12 ? `${id.substring(0, 12)}...` : id;

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-7 w-48 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-10 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-10 w-20 animate-pulse rounded bg-surface-2" />
                    </div>
                </div>

                {/* Filter skeleton */}
                <div className="mb-6 rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1">
                    <div className="mb-3 flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-10 w-full animate-pulse rounded-control bg-surface-2 sm:w-44" />
                        ))}
                    </div>
                </div>

                {/* Ledger skeleton */}
                <div className="overflow-hidden rounded-card border border-border shadow-lvl-1">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-[1.25rem] w-px border-l border-border" aria-hidden="true" />
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-0 sm:flex-row sm:gap-6">
                                <div className="flex shrink-0 items-center pl-4 sm:w-44">
                                    <span className="absolute left-[1.25rem] h-2 w-2 animate-pulse rounded-full bg-surface-2" />
                                    <div className="h-3 w-28 animate-pulse rounded bg-surface-2" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        <div className="h-5 w-24 animate-pulse rounded bg-surface-2" />
                                        <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
                                        <div className="h-5 w-28 animate-pulse rounded bg-surface-2" />
                                        <div className="h-5 w-14 animate-pulse rounded bg-surface-2" />
                                    </div>
                                    <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-text-1">Audit Trail</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        iconLeft={<DownloadSimple size={16} aria-hidden="true" />}
                        onClick={() => handleExport("csv")}
                    >
                        CSV
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        iconLeft={<DownloadSimple size={16} aria-hidden="true" />}
                        onClick={() => handleExport("json")}
                    >
                        JSON
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1">
                <div className="mb-3 flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-text-3" aria-hidden="true" />
                    <span className="text-xs font-semibold tracking-widest text-text-3">FILTER</span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full sm:w-44">
                        <Select
                            label="Actor"
                            value={filters.actorType}
                            onChange={(e) => updateFilter("actorType", e.target.value)}
                            options={ACTOR_OPTIONS}
                        />
                    </div>
                    <div className="w-full sm:w-44">
                        <Select
                            label="Kategori"
                            value={filters.category}
                            onChange={(e) => updateFilter("category", e.target.value)}
                            options={CATEGORY_OPTIONS}
                        />
                    </div>
                    <div className="w-full sm:w-44">
                        <Select
                            label="Outcome"
                            value={filters.outcome}
                            onChange={(e) => updateFilter("outcome", e.target.value)}
                            options={OUTCOME_OPTIONS}
                        />
                    </div>
                    <div className="w-full sm:w-44">
                        <Select
                            label="Severity"
                            value={filters.severity}
                            onChange={(e) => updateFilter("severity", e.target.value)}
                            options={SEVERITY_OPTIONS}
                        />
                    </div>
                    <div className="w-full sm:w-44">
                        <Select
                            label="Entity"
                            value={filters.entityType}
                            onChange={(e) => updateFilter("entityType", e.target.value)}
                            options={ENTITY_OPTIONS}
                        />
                    </div>
                    <div className="relative w-full sm:w-56">
                        <MagnifyingGlass
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3"
                            aria-hidden="true"
                        />
                        <Input
                            label="Pencarian"
                            type="text"
                            placeholder="Cari email/aksi..."
                            value={filters.search}
                            onChange={(e) => updateFilter("search", e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="w-full sm:w-44">
                        <Input
                            label="Dari"
                            type="date"
                            value={filters.from}
                            onChange={(e) => updateFilter("from", e.target.value)}
                        />
                    </div>
                    <div className="w-full sm:w-44">
                        <Input
                            label="Sampai"
                            type="date"
                            value={filters.to}
                            onChange={(e) => updateFilter("to", e.target.value)}
                        />
                    </div>
                    <div className="flex items-end pb-px">
                        <Button type="button" variant="ghost" onClick={resetFilters}>
                            Reset
                        </Button>
                    </div>
                </div>
            </div>

            {/* Timeline / Empty */}
            {logs.length === 0 ? (
                <div className="rounded-card border border-border bg-surface-1 p-14 text-center shadow-lvl-1">
                    <ListChecks size={32} className="mx-auto mb-3 text-text-3" aria-hidden="true" />
                    <p className="text-sm text-text-2">Belum ada audit log</p>
                    <p className="mt-1 text-xs text-text-3">Belum ada aktivitas yang tercatat di sistem.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                    <div className="relative">
                        {/* Timeline rail */}
                        <div
                            className="pointer-events-none absolute inset-y-0 left-[1.25rem] w-px border-l border-border"
                            aria-hidden="true"
                        />
                        <ul className="divide-y divide-border">
                            {logs.map((log) => {
                                const isExpanded = expandedId === log.id;
                                const changes = parseJSON(log.changes);
                                const metadata = parseJSON(log.metadata);
                                const actorLabel = ACTOR_LABELS[log.actorType] || log.actorType;
                                return (
                                    <li key={log.id}>
                                        <div className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-2/60 sm:flex-row sm:items-start sm:gap-6">
                                            {/* Timestamp column */}
                                            <div className="relative shrink-0 pl-4 sm:w-44">
                                                <span
                                                    className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-border"
                                                    aria-hidden="true"
                                                />
                                                <time className="whitespace-nowrap font-mono text-xs tabular-nums text-text-3">
                                                    {formatDate(log.createdAt)}
                                                </time>
                                            </div>

                                            {/* Content */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                                    <Badge tone={actorTone(log.actorType)}>
                                                        {actorLabel}
                                                    </Badge>
                                                    <span className="text-sm font-medium text-text-1">
                                                        {log.actorName || "-"}
                                                    </span>
                                                    <span className="text-text-3" aria-hidden="true">·</span>
                                                    <Badge tone="neutral">{log.action}</Badge>
                                                    <span className="font-mono text-xs tabular-nums text-text-2">
                                                        {log.entityType}
                                                    </span>
                                                    {log.entityId && (
                                                        <span className="font-mono text-xs tabular-nums text-text-3">
                                                            {truncateId(log.entityId)}
                                                        </span>
                                                    )}
                                                    <Badge
                                                        tone={log.outcome === "SUCCESS" ? "success" : "danger"}
                                                    >
                                                        {log.outcome}
                                                    </Badge>
                                                    {severityElement(log.severity)}
                                                </div>
                                                {(log.category || log.ipAddress || log.actorEmail) && (
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-3">
                                                        {log.category && <span>{log.category}</span>}
                                                        {log.ipAddress && (
                                                            <span className="font-mono tabular-nums">{log.ipAddress}</span>
                                                        )}
                                                        {log.actorEmail && <span className="break-all">{log.actorEmail}</span>}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Toggle detail */}
                                            <div className="shrink-0 sm:pt-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                                    aria-expanded={isExpanded}
                                                    aria-controls={`audit-detail-${log.id}`}
                                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-border px-2.5 py-1 text-xs font-medium text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                                >
                                                    <span>{isExpanded ? "Tutup" : "Detail"}</span>
                                                    {isExpanded
                                                        ? <CaretDown size={12} aria-hidden="true" />
                                                        : <CaretRight size={12} aria-hidden="true" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div
                                                id={`audit-detail-${log.id}`}
                                                className="border-t border-border px-4 pb-4 pt-3 sm:pl-[12.5rem]"
                                            >
                                                {log.errorMessage && (
                                                    <div className="mb-3 flex items-start gap-2 rounded-control border border-danger-subtle bg-danger-subtle px-3 py-2 text-sm text-danger">
                                                        <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                                                        <span className="break-all">{log.errorMessage}</span>
                                                    </div>
                                                )}
                                                {changes && (
                                                    <div className="mt-3">
                                                        <p className="mb-1.5 text-xs font-medium text-text-3">CHANGES</p>
                                                        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-control border border-border bg-surface-1 p-3 font-mono text-xs leading-relaxed tabular-nums text-text-2">
                                                            {JSON.stringify(changes, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                                {metadata && (
                                                    <div className="mt-3">
                                                        <p className="mb-1.5 text-xs font-medium text-text-3">METADATA</p>
                                                        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-control border border-border bg-surface-1 p-3 font-mono text-xs leading-relaxed tabular-nums text-text-2">
                                                            {JSON.stringify(metadata, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                                {log.userAgent && (
                                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                                        <span className="text-xs font-medium text-text-3">USER-AGENT</span>
                                                        <span className="break-all text-xs text-text-2">{log.userAgent}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-mono text-xs tabular-nums text-text-3">
                                {((pagination.page - 1) * pagination.limit) + 1}–
                                {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                                    disabled={pagination.page === 1}
                                    aria-label="Halaman sebelumnya"
                                >
                                    <CaretLeft size={14} aria-hidden="true" />
                                </Button>
                                <span className="font-mono text-xs tabular-nums text-text-2">
                                    {pagination.page} / {pagination.totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                                    disabled={pagination.page === pagination.totalPages}
                                    aria-label="Halaman berikutnya"
                                >
                                    <CaretRight size={14} aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}