"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Pulse,
    ArrowCounterClockwise,
    Clock,
    DownloadSimple,
    ShieldWarning,
    Users,
    WarningCircle,
    MagnifyingGlass,
    CheckCircle,
    Buildings,
    ArrowsClockwise,
    Heartbeat,
    Warning,
    Globe,
    Check,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/contexts/ToastContext";

// Bentuk payload GET /api/admin/portal-audit (mirror app/api/admin/portal-audit/route.ts).
// Field tanggal berupa string ISO karena sudah melewati serialisasi JSON NextResponse.

interface AuditSummary {
    totalPortalUsers: number;
    totalApps: number;
    totalSharedAccounts: number;
    totalDormantAccounts: number;
    totalSsoLaunches30d: number;
    totalOnlineApps: number;
    totalOfflineApps: number;
    averageLatencyMs: number;
    globalUptimePercent: number;
}

interface SsoTrendItem {
    appId: string;
    appName: string;
    launchCount: number;
}

interface SharedAccountUser {
    id: string;
    name: string;
    nik: string;
    isActive: boolean;
    groups: string[];
}

interface SharedAccountItem {
    app: { id: string; name: string; logoPath: string | null };
    appUsername: string;
    users: SharedAccountUser[];
    userCount: number;
    riskLevel: "CRITICAL" | "HIGH" | "MEDIUM";
}

interface DormantAccountItem {
    id: string;
    portalUser: { id: string; name: string; nik: string; isActive: boolean; groups: string[] };
    app: { id: string; name: string; logoPath: string | null };
    appUsername: string;
    label: string;
    lastUsedAt: string | null;
    createdAt: string;
    daysInactive: number;
    status: "INACTIVE" | "NEVER_USED";
}

interface MatrixAppAccess {
    appId: string;
    appName: string;
    hasAccess: boolean;
    accessType: "PUBLIC" | "DIRECT" | "GROUP" | "ADMIN" | "NONE";
    groupNames: string[];
    hasCredential: boolean;
    credentialsCount: number;
    username: string | null;
}

interface AccessMatrixEntry {
    user: { id: string; name: string; nik: string; role: string; groups: string[] };
    apps: Record<string, MatrixAppAccess>;
}

interface RevokeHistoryItem {
    id: string;
    action: string;
    actionLabel: string;
    category: string;
    actorName: string;
    portalUser: { id: string; name: string; nik: string } | null;
    details: string;
    targetApp: string | null;
    createdAt: string;
}

interface DowntimeIncident {
    id: string;
    action: string;
    actionLabel: string;
    severity: "INFO" | "WARNING" | "ERROR";
    appId: string | null;
    appName: string;
    url: string;
    statusCode: number | null;
    latencyMs: number | null;
    errorMessage: string;
    createdAt: string;
}

interface PortalAppHealthItem {
    id: string;
    name: string;
    slug: string;
    url: string;
    loginUrl: string | null;
    logoPath: string | null;
    isPublic: boolean;
    isActive: boolean;
    category: string | null;
    healthStatus: "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN" | null;
    healthStatusCode: number | null;
    healthLatencyMs: number | null;
    healthCheckedAt: string | null;
    healthError: string | null;
}

interface PortalAuditData {
    summary: AuditSummary;
    trends: SsoTrendItem[];
    sharedAccounts: SharedAccountItem[];
    dormantAccounts: DormantAccountItem[];
    accessMatrix: AccessMatrixEntry[];
    historicalRevokes: RevokeHistoryItem[];
    downtimeIncidents: DowntimeIncident[];
    apps: PortalAppHealthItem[];
}

export default function PortalAuditPage() {
    const [data, setData] = useState<PortalAuditData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [checkingAppId, setCheckingAppId] = useState<string | null>(null);

    // Filter states
    const [sharingSearch, setSharingSearch] = useState("");
    const [dormantSearch, setDormantSearch] = useState("");
    const [dormantAppFilter, setDormantAppFilter] = useState("ALL");
    const [matrixSearch, setMatrixSearch] = useState("");
    const [historySearch, setHistorySearch] = useState("");
    const [historyActionFilter, setHistoryActionFilter] = useState("ALL");

    // Health filter states
    const [healthSearch, setHealthSearch] = useState("");
    const [healthStatusFilter, setHealthStatusFilter] = useState("ALL");
    const [incidentSearch, setIncidentSearch] = useState("");

    const { showToast } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/admin/portal-audit");
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setError(null);
            } else {
                setError("Gagal memuat data portal audit.");
            }
        } catch {
            setError("Terjadi kesalahan jaringan saat memuat audit.");
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger on-demand health check untuk semua aplikasi
    const handleTriggerAllHealthCheck = async () => {
        setIsCheckingHealth(true);
        try {
            const res = await fetch("/api/portal-apps/health-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const json = await res.json();
            if (res.ok) {
                showToast(
                    `Pemeriksaan selesai: ${json.summary?.onlineCount ?? 0} Online, ${json.summary?.offlineCount ?? 0} Down`,
                    "success"
                );
                await fetchData();
            } else {
                showToast(json.error || "Gagal memeriksa kesehatan server", "error");
            }
        } catch {
            showToast("Terjadi kesalahan jaringan saat health check", "error");
        } finally {
            setIsCheckingHealth(false);
        }
    };

    // Trigger health check single app
    const handleCheckSingleApp = async (appId: string, appName: string) => {
        setCheckingAppId(appId);
        try {
            const res = await fetch("/api/portal-apps/health-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ appId }),
            });
            const json = await res.json();
            if (res.ok && json.result) {
                const r = json.result;
                showToast(`${appName}: ${r.status} (${r.latencyMs}ms)`, r.status === "OFFLINE" ? "error" : "success");
                await fetchData();
            } else {
                showToast(json.error || `Gagal memeriksa ${appName}`, "error");
            }
        } catch {
            showToast(`Gagal memeriksa ${appName}`, "error");
        } finally {
            setCheckingAppId(null);
        }
    };

    // Helper export CSV
    const exportToCSV = (tableId: string, filename: string) => {
        const table = document.getElementById(tableId);
        if (!table) return;

        const csv: string[] = [];
        const rows = table.querySelectorAll("tr");
        for (let i = 0; i < rows.length; i++) {
            const row = [];
            const cols = rows[i].querySelectorAll("td, th");
            for (let j = 0; j < cols.length; j++) {
                let data = cols[j].textContent || "";
                data = data.replace(/(\r\n|\n|\r)/gm, " ").trim();
                data = data.replace(/"/g, '""');
                row.push(`"${data}"`);
            }
            csv.push(row.join(","));
        }

        const csvString = csv.join("\n");
        const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.setAttribute("href", url);
        a.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Laporan CSV "${filename}" berhasil diunduh`, "success");
    };

    // Filter logic
    const filteredSharing = useMemo(() => {
        if (!data?.sharedAccounts) return [];
        if (!sharingSearch) return data.sharedAccounts;
        const q = sharingSearch.toLowerCase();
        return data.sharedAccounts.filter((item) =>
            item.app.name.toLowerCase().includes(q) ||
            item.appUsername.toLowerCase().includes(q) ||
            item.users.some((u) => u.name.toLowerCase().includes(q) || u.nik.toLowerCase().includes(q))
        );
    }, [data?.sharedAccounts, sharingSearch]);

    const filteredDormant = useMemo(() => {
        if (!data?.dormantAccounts) return [];
        return data.dormantAccounts.filter((item) => {
            const matchApp = dormantAppFilter === "ALL" || item.app.id === dormantAppFilter;
            const q = dormantSearch.toLowerCase();
            const matchQuery = !dormantSearch ||
                item.portalUser.name.toLowerCase().includes(q) ||
                item.portalUser.nik.toLowerCase().includes(q) ||
                item.app.name.toLowerCase().includes(q) ||
                item.label.toLowerCase().includes(q);
            return matchApp && matchQuery;
        });
    }, [data?.dormantAccounts, dormantSearch, dormantAppFilter]);

    const filteredMatrix = useMemo(() => {
        if (!data?.accessMatrix) return [];
        if (!matrixSearch) return data.accessMatrix;
        const q = matrixSearch.toLowerCase();
        return data.accessMatrix.filter((item) => {
            const u = item?.user;
            if (!u) return false;
            return (
                (u.name?.toLowerCase().includes(q) ?? false) ||
                (u.nik?.toLowerCase().includes(q) ?? false) ||
                (u.groups ?? []).some((g: string) => g.toLowerCase().includes(q))
            );
        });
    }, [data?.accessMatrix, matrixSearch]);

    const filteredHistory = useMemo(() => {
        if (!data?.historicalRevokes) return [];
        return data.historicalRevokes.filter((item) => {
            const matchAction = historyActionFilter === "ALL" || item.action === historyActionFilter;
            const q = historySearch.toLowerCase();
            const matchQuery = !historySearch ||
                (item.actorName && item.actorName.toLowerCase().includes(q)) ||
                (item.portalUser?.name && item.portalUser.name.toLowerCase().includes(q)) ||
                (item.portalUser?.nik && item.portalUser.nik.toLowerCase().includes(q)) ||
                (item.details && item.details.toLowerCase().includes(q)) ||
                (item.targetApp && item.targetApp.toLowerCase().includes(q));
            return matchAction && matchQuery;
        });
    }, [data?.historicalRevokes, historySearch, historyActionFilter]);

    const filteredHealthApps = useMemo(() => {
        if (!data?.apps) return [];
        return data.apps.filter((app) => {
            const matchStatus = healthStatusFilter === "ALL" || (app.healthStatus || "UNKNOWN") === healthStatusFilter;
            const q = healthSearch.toLowerCase();
            const matchQuery = !healthSearch ||
                app.name.toLowerCase().includes(q) ||
                (app.url && app.url.toLowerCase().includes(q)) ||
                (app.category && app.category.toLowerCase().includes(q));
            return matchStatus && matchQuery;
        });
    }, [data?.apps, healthSearch, healthStatusFilter]);

    const filteredIncidents = useMemo(() => {
        if (!data?.downtimeIncidents) return [];
        if (!incidentSearch) return data.downtimeIncidents;
        const q = incidentSearch.toLowerCase();
        return data.downtimeIncidents.filter((inc) =>
            inc.appName.toLowerCase().includes(q) ||
            (inc.url && inc.url.toLowerCase().includes(q)) ||
            (inc.errorMessage && inc.errorMessage.toLowerCase().includes(q)) ||
            inc.actionLabel.toLowerCase().includes(q)
        );
    }, [data?.downtimeIncidents, incidentSearch]);

    if (isLoading) {
        return (
            <div className="flex h-[450px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    <p className="text-sm font-medium text-text-2">Mengumpulkan data audit ISO 27001 & status sistem...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="flex items-center gap-3 rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                    <WarningCircle size={20} className="shrink-0" />
                    <span>{error}</span>
                    <Button variant="secondary" size="sm" onClick={fetchData} className="ml-auto">
                        Coba Lagi
                    </Button>
                </div>
            </div>
        );
    }

    // Render hanya tercapai saat isLoading/error false, artinya data sudah payload penuh.
    const { summary, trends, sharedAccounts, dormantAccounts, apps } = (data || {}) as PortalAuditData;

    const TAB_DEFS = [
        { key: "dashboard", label: "Ringkasan & KPI", icon: <Pulse size={16} aria-hidden="true" /> },
        {
            key: "health",
            label: "Health & Uptime Server",
            icon: <Heartbeat size={16} aria-hidden="true" />,
            badge: summary?.totalOfflineApps > 0 ? `${summary.totalOfflineApps} Down` : null,
            badgeVariant: "danger" as const,
        },
        {
            key: "sharing",
            label: "Deteksi Account Sharing",
            icon: <ShieldWarning size={16} aria-hidden="true" />,
            badge: sharedAccounts?.length ? `${sharedAccounts.length}` : null,
            badgeVariant: "danger" as const,
        },
        {
            key: "dormant",
            label: "Unused Access (>90 Hari)",
            icon: <Clock size={16} aria-hidden="true" />,
            badge: dormantAccounts?.length ? `${dormantAccounts.length}` : null,
            badgeVariant: "warning" as const,
        },
        { key: "matrix", label: "Access Control Matrix", icon: <Users size={16} aria-hidden="true" /> },
        { key: "history", label: "Histori Pencabutan", icon: <ArrowCounterClockwise size={16} aria-hidden="true" /> },
    ];

    const maxTrendLaunch = trends?.length ? Math.max(...trends.map((t) => t.launchCount), 1) : 1;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent border border-accent/20">
                            ISO 27001 — A.9 Access Control & A.12 Operations Security
                        </span>
                    </div>
                    <h1 className="font-display text-2xl font-bold text-text-1">Portal Audit & Monitoring Sistem</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={fetchData} className="gap-2">
                        <ArrowsClockwise size={14} /> Refresh Data
                    </Button>
                </div>
            </div>

            {/* KPI Metric Stat Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-3">Pengguna Portal</span>
                        <Users size={18} className="text-text-2" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-text-1">{summary?.totalPortalUsers ?? 0}</p>
                    <span className="text-[11px] text-text-3">User aktif terdaftar</span>
                </div>

                <div className="rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-3">Total Aplikasi</span>
                        <Buildings size={18} className="text-text-2" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-text-1">{summary?.totalApps ?? 0}</p>
                    <span className="text-[11px] text-text-3">Aplikasi terintegrasi</span>
                </div>

                <div className={`rounded-card border p-4 shadow-lvl-1 ${
                    summary?.totalOfflineApps > 0
                        ? "border-danger/40 bg-danger/10"
                        : "border-border bg-surface-1"
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-3">Server Status</span>
                        <Heartbeat size={18} className={summary?.totalOfflineApps > 0 ? "text-danger" : "text-success"} />
                    </div>
                    <p className={`mt-2 text-2xl font-bold ${summary?.totalOfflineApps > 0 ? "text-danger" : "text-success"}`}>
                        {summary?.totalOnlineApps ?? 0} <span className="text-xs font-normal text-text-3">/ {summary?.totalApps ?? 0} Online</span>
                    </p>
                    <span className="text-[11px] text-text-3">
                        {summary?.totalOfflineApps > 0 ? `${summary.totalOfflineApps} aplikasi offline` : "Semua server normal"}
                    </span>
                </div>

                <div className={`rounded-card border p-4 shadow-lvl-1 ${
                    summary?.totalSharedAccounts > 0
                        ? "border-danger/40 bg-danger/10"
                        : "border-border bg-surface-1"
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-danger">Account Sharing</span>
                        <ShieldWarning size={18} className={summary?.totalSharedAccounts > 0 ? "text-danger" : "text-text-3"} />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-danger">{summary?.totalSharedAccounts ?? 0}</p>
                    <span className="text-[11px] text-text-3">Akun target multi-user</span>
                </div>

                <div className={`rounded-card border p-4 shadow-lvl-1 ${
                    summary?.totalDormantAccounts > 0
                        ? "border-warning/40 bg-warning/10"
                        : "border-border bg-surface-1"
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-warning">Unused Access</span>
                        <Clock size={18} className={summary?.totalDormantAccounts > 0 ? "text-warning" : "text-text-3"} />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-warning">{summary?.totalDormantAccounts ?? 0}</p>
                    <span className="text-[11px] text-text-3">Inaktif &gt; 90 hari</span>
                </div>

                <div className="rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-3">Uptime Global</span>
                        <Pulse size={18} className="text-accent" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-accent">{summary?.globalUptimePercent ?? 100}%</p>
                    <span className="text-[11px] text-text-3">Rata-rata: {summary?.averageLatencyMs ?? 0}ms</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="tablist">
                {TAB_DEFS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setActiveTab(tab.key)}
                            className={`inline-flex items-center gap-2 rounded-control px-3.5 py-2 text-xs font-semibold transition-all ${
                                isActive
                                    ? "bg-accent text-white shadow-sm"
                                    : "bg-surface-1 text-text-2 hover:bg-surface-2 hover:text-text-1 border border-border"
                            }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                    isActive
                                        ? "bg-white text-accent"
                                        : tab.badgeVariant === "danger"
                                            ? "bg-danger text-white"
                                            : "bg-warning text-surface-0"
                                }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ========================================================= */}
            {/* TAB: DASHBOARD (RINGKASAN & KPI) */}
            {/* ========================================================= */}
            {activeTab === "dashboard" && (
                <div className="space-y-6">
                    {/* SSO Usage Trends in 30 Days */}
                    <div className="rounded-card border border-border bg-surface-1 p-5 shadow-lvl-1">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-text-1">Aktivitas Peluncuran SSO (30 Hari Terakhir)</h3>
                                <p className="text-xs text-text-3">Total {summary?.totalSsoLaunches30d ?? 0} kali akses via SSO Portal</p>
                            </div>
                        </div>

                        {trends?.length === 0 ? (
                            <div className="py-8 text-center text-sm text-text-3">Belum ada aktivitas SSO tercatat dalam 30 hari terakhir.</div>
                        ) : (
                            <div className="space-y-3">
                                {trends.map((t) => {
                                    const percent = Math.round((t.launchCount / maxTrendLaunch) * 100);
                                    return (
                                        <div key={t.appId} className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-text-1">{t.appName}</span>
                                                <span className="font-mono text-text-3">{t.launchCount} launches</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                                                <div
                                                    className="h-full rounded-full bg-accent transition-all duration-300"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Quick Warning Panels */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Quick Sharing Warning */}
                        <div className="rounded-card border border-border bg-surface-1 p-5 shadow-lvl-1">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-text-1 flex items-center gap-2">
                                    <ShieldWarning size={18} className="text-danger" />
                                    Akun Target dengan Risiko Sharing
                                </h3>
                                {sharedAccounts?.length > 0 && (
                                    <button
                                        onClick={() => setActiveTab("sharing")}
                                        className="text-xs font-semibold text-accent hover:underline"
                                    >
                                        Lihat Semua ({sharedAccounts.length}) &rarr;
                                    </button>
                                )}
                            </div>

                            {sharedAccounts?.length === 0 ? (
                                <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success/10 p-4 text-sm text-text-1">
                                    <CheckCircle size={20} className="text-success" />
                                    <span>Tidak ditemukan account sharing. Semua kredensial unik per user.</span>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {sharedAccounts.slice(0, 5).map((item, i) => (
                                        <div key={i} className="py-2.5 flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-semibold text-text-1">{item.app.name}</p>
                                                <p className="text-[11px] text-text-3 font-mono">Username: <strong className="text-danger">{item.appUsername}</strong></p>
                                            </div>
                                            <span className="rounded bg-danger/15 px-2 py-0.5 font-mono text-[11px] font-bold text-danger border border-danger/30">
                                                {item.userCount} User Pakai Bersama
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Dormant Warning */}
                        <div className="rounded-card border border-border bg-surface-1 p-5 shadow-lvl-1">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-text-1 flex items-center gap-2">
                                    <Clock size={18} className="text-warning" />
                                    Akses Terbengkalai (&gt; 90 Hari)
                                </h3>
                                {dormantAccounts?.length > 0 && (
                                    <button
                                        onClick={() => setActiveTab("dormant")}
                                        className="text-xs font-semibold text-accent hover:underline"
                                    >
                                        Lihat Semua ({dormantAccounts.length}) &rarr;
                                    </button>
                                )}
                            </div>

                            {dormantAccounts?.length === 0 ? (
                                <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success/10 p-4 text-sm text-text-1">
                                    <CheckCircle size={20} className="text-success" />
                                    <span>Semua akun kredensial portal aktif digunakan secara berkala.</span>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {dormantAccounts.slice(0, 5).map((item, i) => (
                                        <div key={i} className="py-2.5 flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-semibold text-text-1">{item.portalUser.name}</p>
                                                <p className="text-[11px] text-text-3">
                                                    NIK: {item.portalUser.nik} &bull; App: <strong className="text-text-2">{item.app.name}</strong>
                                                </p>
                                            </div>
                                            <span className="rounded bg-warning/15 px-2 py-0.5 font-mono text-[11px] font-bold text-warning border border-warning/30">
                                                {item.status === "NEVER_USED" ? "Belum Pernah Dipakai" : `${item.daysInactive} Hari`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB: HEALTH & UPTIME SERVER */}
            {/* ========================================================= */}
            {activeTab === "health" && (
                <div className="space-y-6">
                    {/* Health Action Bar */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-full max-w-xs">
                                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                                <Input
                                    placeholder="Cari nama aplikasi, URL, atau kategori..."
                                    value={healthSearch}
                                    onChange={(e) => setHealthSearch(e.target.value)}
                                    className="pl-9 text-xs"
                                />
                            </div>
                            <select
                                value={healthStatusFilter}
                                onChange={(e) => setHealthStatusFilter(e.target.value)}
                                className="rounded-control border border-border bg-surface-1 px-3 py-2 text-xs text-text-1 focus-visible:outline-2 focus-visible:outline-accent"
                            >
                                <option value="ALL">Semua Status Health</option>
                                <option value="ONLINE">🟢 Online Normal</option>
                                <option value="DEGRADED">🟡 Degraded / Lambat</option>
                                <option value="OFFLINE">🔴 Offline / Gangguan</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleTriggerAllHealthCheck}
                                disabled={isCheckingHealth}
                                className="gap-2"
                            >
                                <Heartbeat size={16} className={isCheckingHealth ? "animate-spin" : ""} />
                                {isCheckingHealth ? "Memeriksa Seluruh Server..." : "Periksa Semua Sekarang"}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => exportToCSV("health-table", "Audit_Server_Health_Matrix")}
                                className="gap-2"
                            >
                                <DownloadSimple size={16} /> Ekspor CSV
                            </Button>
                        </div>
                    </div>

                    {/* Real-time Server Health Matrix Table */}
                    <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                        <div className="border-b border-border bg-surface-2/40 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
                                <Globe size={16} className="text-accent" /> Matrix Ketersediaan & Kesehatan Server Aplikasi ({filteredHealthApps.length})
                            </h3>
                            <span className="text-[11px] text-text-3 font-mono">
                                Timeout threshold: 5000ms &bull; Degraded: &ge; 2500ms
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table id="health-table" className="w-full border-collapse text-sm" aria-label="Health matrix aplikasi">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/60">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Status Kesehatan</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Nama Aplikasi</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Target Endpoint URL</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Latensi Respon</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">HTTP Code</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Pengecekan Terakhir</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-3">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredHealthApps.map((app) => {
                                        const isAppChecking = checkingAppId === app.id;
                                        const status = app.healthStatus || "UNKNOWN";
                                        return (
                                            <tr key={app.id} className="hover:bg-surface-2/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    {status === "ONLINE" && (
                                                        <span className="inline-flex items-center gap-1.5 rounded bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success border border-success/30">
                                                            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                                                            ONLINE
                                                        </span>
                                                    )}
                                                    {status === "DEGRADED" && (
                                                        <span className="inline-flex items-center gap-1.5 rounded bg-warning/15 px-2.5 py-0.5 text-xs font-bold text-warning border border-warning/30">
                                                            <span className="h-2 w-2 rounded-full bg-warning" />
                                                            LAMBAT
                                                        </span>
                                                    )}
                                                    {status === "OFFLINE" && (
                                                        <span className="inline-flex items-center gap-1.5 rounded bg-danger px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                                                            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                                                            GANGGUAN
                                                        </span>
                                                    )}
                                                    {status === "UNKNOWN" && (
                                                        <span className="inline-flex items-center gap-1.5 rounded bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-text-3 border border-border">
                                                            BELUM DICEK
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-text-1">
                                                    {app.name}
                                                    {app.category && (
                                                        <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.2 text-[10px] text-text-3">
                                                            {app.category}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-text-3 max-w-xs truncate" title={app.url}>
                                                    {app.url}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs tabular-nums">
                                                    {app.healthLatencyMs ? (
                                                        <span className={app.healthLatencyMs >= 2500 ? "text-warning font-bold" : "text-success font-bold"}>
                                                            {app.healthLatencyMs} ms
                                                        </span>
                                                    ) : (
                                                        <span className="text-text-3">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs font-semibold">
                                                    {app.healthStatusCode ? (
                                                        <span className={app.healthStatusCode < 400 ? "text-success" : "text-danger"}>
                                                            HTTP {app.healthStatusCode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-danger">{app.healthError || "-"}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-text-3 whitespace-nowrap tabular-nums">
                                                    {app.healthCheckedAt ? (
                                                        new Date(app.healthCheckedAt).toLocaleString("id-ID", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            second: "2-digit",
                                                        })
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handleCheckSingleApp(app.id, app.name)}
                                                        disabled={isAppChecking || isCheckingHealth}
                                                        className="text-xs py-1 px-2.5"
                                                    >
                                                        {isAppChecking ? "Ping..." : "Test Ping"}
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredHealthApps.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-3">
                                                Tidak ada aplikasi yang sesuai dengan filter.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tabel Riwayat Insiden Downtime (90 Hari) */}
                    <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                        <div className="border-b border-border bg-surface-2/40 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
                                    <Warning size={16} className="text-danger" /> Log Riwayat Insiden Downtime & Pemulihan (90 Hari)
                                </h3>
                                <p className="text-[11px] text-text-3">Dicatat otomatis oleh sistem monitoring ketersediaan</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative w-48">
                                    <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
                                    <Input
                                        placeholder="Cari insiden..."
                                        value={incidentSearch}
                                        onChange={(e) => setIncidentSearch(e.target.value)}
                                        className="pl-8 text-xs py-1"
                                    />
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => exportToCSV("incident-table", "Audit_Downtime_Incidents_90Days")}
                                    className="gap-1 text-xs py-1"
                                >
                                    <DownloadSimple size={14} /> Ekspor CSV
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table id="incident-table" className="w-full border-collapse text-sm" aria-label="Riwayat insiden downtime">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/60">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Waktu (WIB)</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Aplikasi Terdampak</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Jenis Insiden / Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Detail Kode HTTP / Error</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Tingkat Keparahan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredIncidents.map((inc, i) => (
                                        <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-text-3 whitespace-nowrap tabular-nums">
                                                {new Date(inc.createdAt).toLocaleString("id-ID", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                })}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-text-1">
                                                {inc.appName}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold border ${
                                                    inc.action === "APP_DOWNTIME_DETECTED"
                                                        ? "bg-danger text-white border-danger"
                                                        : "bg-success/15 text-success border-success/30"
                                                }`}>
                                                    {inc.action === "APP_DOWNTIME_DETECTED" ? <Warning size={12} /> : <Check size={12} />}
                                                    {inc.actionLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-text-2">
                                                {inc.errorMessage}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                                    inc.severity === "ERROR"
                                                        ? "bg-danger/20 text-danger"
                                                        : "bg-surface-2 text-text-3"
                                                }`}>
                                                    {inc.severity}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredIncidents.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-3">
                                                {incidentSearch
                                                    ? "Tidak ada data insiden yang sesuai pencarian."
                                                    : "Belum ada insiden downtime yang tercatat dalam 90 hari terakhir. Sistem berjalan stabil."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB: SHARING (DETEKSI ACCOUNT SHARING) */}
            {/* ========================================================= */}
            {activeTab === "sharing" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full max-w-sm">
                            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                            <Input
                                placeholder="Cari aplikasi, username, NIK, atau nama..."
                                value={sharingSearch}
                                onChange={(e) => setSharingSearch(e.target.value)}
                                className="pl-9 text-xs"
                            />
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => exportToCSV("sharing-table", "Audit_Account_Sharing")}
                            className="gap-2"
                        >
                            <DownloadSimple size={16} /> Ekspor CSV
                        </Button>
                    </div>

                    <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                        <div className="overflow-x-auto">
                            <table id="sharing-table" className="w-full border-collapse text-sm" aria-label="Deteksi account sharing">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/60">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Tingkat Risiko</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Aplikasi Target</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Target Username (Shared)</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Jumlah Pengguna</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Daftar Portal User (Nama / NIK / Grup)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredSharing.map((item, i) => (
                                        <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold border ${
                                                    item.riskLevel === "CRITICAL"
                                                        ? "bg-danger text-white border-danger"
                                                        : "bg-danger-subtle text-danger border-danger/30"
                                                }`}>
                                                    {item.riskLevel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-text-1">{item.app.name}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-danger">{item.appUsername}</td>
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-text-1 tabular-nums">{item.userCount} user</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.users.map((u) => (
                                                        <span
                                                            key={u.id}
                                                            className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-xs text-text-2 border border-border"
                                                        >
                                                            <span className="font-medium text-text-1">{u.name}</span>
                                                            <span className="font-mono text-[10px] text-text-3">({u.nik})</span>
                                                            {u.groups?.length > 0 && (
                                                                <span className="rounded bg-surface-3 px-1 py-0.2 text-[9px] text-accent">
                                                                    {u.groups.join(", ")}
                                                                </span>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSharing.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-3">
                                                {sharingSearch
                                                    ? "Tidak ada data sharing akun yang sesuai dengan kata kunci."
                                                    : "Aman! Tidak ditemukan pola penggunaan akun sharing di seluruh aplikasi portal."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB: DORMANT (UNUSED ACCESS > 90 HARI) */}
            {/* ========================================================= */}
            {activeTab === "dormant" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-full max-w-xs">
                                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                                <Input
                                    placeholder="Cari user, NIK, atau label..."
                                    value={dormantSearch}
                                    onChange={(e) => setDormantSearch(e.target.value)}
                                    className="pl-9 text-xs"
                                />
                            </div>
                            <select
                                value={dormantAppFilter}
                                onChange={(e) => setDormantAppFilter(e.target.value)}
                                className="rounded-control border border-border bg-surface-1 px-3 py-2 text-xs text-text-1 focus-visible:outline-2 focus-visible:outline-accent"
                            >
                                <option value="ALL">Semua Aplikasi</option>
                                {apps?.map((app) => (
                                    <option key={app.id} value={app.id}>{app.name}</option>
                                ))}
                            </select>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => exportToCSV("dormant-table", "Audit_Unused_Access_90Days")}
                            className="gap-2"
                        >
                            <DownloadSimple size={16} /> Ekspor CSV
                        </Button>
                    </div>

                    <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                        <div className="overflow-x-auto">
                            <table id="dormant-table" className="w-full border-collapse text-sm" aria-label="Unused access table">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/60">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Status Inaktivitas</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Nama Pengguna (NIK)</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Aplikasi Target</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Label Akun & Username</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Terakhir Dipakai via SSO</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredDormant.map((item, i) => (
                                        <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded bg-warning/15 px-2 py-0.5 font-mono text-xs font-bold text-warning border border-warning/30">
                                                    {item.status === "NEVER_USED" ? "Belum Pernah Dipakai" : `${item.daysInactive} Hari Tidak Aktif`}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-text-1">
                                                {item.portalUser.name} <span className="font-mono text-xs font-normal text-text-3">({item.portalUser.nik})</span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-text-1">{item.app.name}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-text-2">
                                                {item.label} <span className="text-text-3 font-normal">({item.appUsername})</span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-text-3">
                                                {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString("id-ID") : "Belum Pernah"}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredDormant.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-3">
                                                {dormantSearch || dormantAppFilter !== "ALL"
                                                    ? "Tidak ada data akses inaktif yang sesuai filter."
                                                    : "Semua akun kredensial aktif digunakan dalam 90 hari terakhir."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB: MATRIX (ACCESS CONTROL MATRIX) */}
            {/* ========================================================= */}
            {activeTab === "matrix" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full max-w-sm">
                            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                            <Input
                                placeholder="Cari nama pengguna, NIK, atau grup..."
                                value={matrixSearch}
                                onChange={(e) => setMatrixSearch(e.target.value)}
                                className="pl-9 text-xs"
                            />
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => exportToCSV("matrix-table", "Audit_Access_Control_Matrix")}
                            className="gap-2"
                        >
                            <DownloadSimple size={16} /> Ekspor CSV Matrix
                        </Button>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface-1 p-3 text-xs text-text-2">
                        <span className="font-semibold text-text-1">Keterangan:</span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-success" />
                            <span>SSO Ready (Kredensial Tersedia)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                            <span>Akses Terbuka (Kredensial Belum Diisi)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-surface-3 border border-border" />
                            <span>Tidak Berhak Akses</span>
                        </span>
                    </div>

                    <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                        <div className="overflow-x-auto">
                            <table id="matrix-table" className="w-full border-collapse text-xs" aria-label="Access control matrix">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/60">
                                        <th className="sticky left-0 z-10 bg-surface-2 px-4 py-3 text-left font-semibold text-text-3">
                                            Pengguna (NIK)
                                        </th>
                                        <th className="px-3 py-3 text-left font-semibold text-text-3">Grup</th>
                                        {apps?.map((app) => (
                                            <th key={app.id} className="px-3 py-3 text-center font-semibold text-text-3 whitespace-nowrap min-w-[120px]">
                                                {app.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredMatrix.map((item) => (
                                        <tr key={item.user.id} className="hover:bg-surface-2/40 transition-colors">
                                            <td className="sticky left-0 z-10 bg-surface-1 px-4 py-2.5 font-semibold text-text-1 whitespace-nowrap">
                                                {item.user.name} <span className="font-mono text-[11px] font-normal text-text-3">({item.user.nik})</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-text-3 whitespace-nowrap">
                                                {item.user.groups?.join(", ") || "-"}
                                            </td>
                                            {apps?.map((app) => {
                                                const appAccess = item.apps[app.id];
                                                if (!appAccess || !appAccess.hasAccess) {
                                                    return (
                                                        <td key={app.id} className="px-3 py-2.5 text-center text-text-3/40">
                                                            &minus;
                                                        </td>
                                                    );
                                                }

                                                if (appAccess.hasCredential) {
                                                    return (
                                                        <td key={app.id} className="px-3 py-2.5 text-center">
                                                            <span
                                                                className="inline-flex items-center gap-1 rounded bg-success-subtle px-2 py-0.5 font-mono text-[11px] font-bold text-success border border-success/30"
                                                                title={`Username: ${appAccess.username}`}
                                                            >
                                                                <CheckCircle size={12} /> {appAccess.username}
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={app.id} className="px-3 py-2.5 text-center">
                                                        <span
                                                            className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning border border-warning/20"
                                                            title="Akses diizinkan, kredensial belum tersimpan"
                                                        >
                                                            Akses Diizinkan
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {filteredMatrix.length === 0 && (
                                        <tr>
                                            <td colSpan={(apps?.length || 0) + 2} className="px-4 py-8 text-center text-sm text-text-3">
                                                Tidak ada data pengguna yang sesuai dengan pencarian.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB: HISTORY (HISTORI PENCABUTAN) */}
            {/* ========================================================= */}
            {activeTab === "history" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-full max-w-xs">
                                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                                <Input
                                    placeholder="Cari pelaksana, user, atau detail..."
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="pl-9 text-xs"
                                />
                            </div>
                            <select
                                value={historyActionFilter}
                                onChange={(e) => setHistoryActionFilter(e.target.value)}
                                className="rounded-control border border-border bg-surface-1 px-3 py-2 text-xs text-text-1 focus-visible:outline-2 focus-visible:outline-accent"
                            >
                                <option value="ALL">Semua Tipe Aksi</option>
                                <option value="ACCESS_REVOKED">Pencabutan Hak Akses</option>
                                <option value="CREDENTIAL_DELETED">Penghapusan Kredensial</option>
                                <option value="SESSION_REVOKED">Pembatalan Sesi</option>
                                <option value="PORTAL_USER_DEACTIVATED">Deaktivasi User</option>
                            </select>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => exportToCSV("history-table", "Histori_Pencabutan_Akses_90Days")}
                            className="gap-2"
                        >
                            <DownloadSimple size={16} /> Ekspor CSV
                        </Button>
                    </div>

                    <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                        <div className="overflow-x-auto">
                            <table id="history-table" className="w-full border-collapse text-sm" aria-label="Histori pencabutan akses">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/60">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Waktu (WIB)</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Pelaksana (Actor)</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Target Portal User</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Jenis Tindakan</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Detail Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredHistory.map((item, i) => (
                                        <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-text-3 whitespace-nowrap tabular-nums">
                                                {new Date(item.createdAt).toLocaleString("id-ID", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium text-text-2">
                                                {item.actorName}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.portalUser ? (
                                                    <span className="font-semibold text-text-1">
                                                        {item.portalUser.name} <span className="font-mono text-xs font-normal text-text-3">({item.portalUser.nik})</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-text-3">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded bg-danger/15 px-2 py-0.5 text-xs font-bold text-danger border border-danger/30">
                                                    {item.actionLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-text-2 font-mono">{item.details}</td>
                                        </tr>
                                    ))}
                                    {filteredHistory.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-3">
                                                {historySearch || historyActionFilter !== "ALL"
                                                    ? "Tidak ada histori pencabutan yang sesuai filter."
                                                    : "Tidak ada histori pencabutan dalam 90 hari terakhir."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}