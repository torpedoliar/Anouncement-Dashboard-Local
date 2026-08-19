"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Pulse,
    ArrowCounterClockwise,
    Clock,
    DownloadSimple,
    ShieldCheck,
    ShieldWarning,
    Users,
    WarningCircle,
    MagnifyingGlass,
    CheckCircle,
    XCircle,
    Funnel,
    Buildings,
    Key,
    ArrowsClockwise,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

export default function PortalAuditPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("dashboard");

    // Filter states
    const [sharingSearch, setSharingSearch] = useState("");
    const [dormantSearch, setDormantSearch] = useState("");
    const [dormantAppFilter, setDormantAppFilter] = useState("ALL");
    const [matrixSearch, setMatrixSearch] = useState("");
    const [historySearch, setHistorySearch] = useState("");
    const [historyActionFilter, setHistoryActionFilter] = useState("ALL");

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
                const errData = await res.json().catch(() => null);
                setError(errData?.error || "Gagal memuat data audit portal.");
            }
        } catch (e) {
            console.error(e);
            setError("Terjadi kesalahan jaringan saat memuat data audit.");
        } finally {
            setIsLoading(false);
        }
    };

    const exportToCSV = (tableId: string, filename: string) => {
        const table = document.getElementById(tableId) as HTMLTableElement;
        if (!table) return;

        const csv: string[] = [];
        for (let i = 0; i < table.rows.length; i++) {
            const row: string[] = [];
            const cols = table.rows[i].querySelectorAll("td, th");
            for (let j = 0; j < cols.length; j++) {
                const text = (cols[j] as HTMLElement).innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
                row.push('"' + text.replace(/"/g, '""') + '"');
            }
            csv.push(row.join(","));
        }

        const csvString = csv.join("\n");
        const a = document.createElement("a");
        a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvString);
        a.target = "_blank";
        a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    // Filtered lists
    const filteredSharing = useMemo(() => {
        if (!data?.sharedAccounts) return [];
        const q = sharingSearch.toLowerCase().trim();
        if (!q) return data.sharedAccounts;
        return data.sharedAccounts.filter((item: any) =>
            item.app.name.toLowerCase().includes(q) ||
            item.appUsername.toLowerCase().includes(q) ||
            item.users.some((u: any) => u.name.toLowerCase().includes(q) || u.nik.toLowerCase().includes(q))
        );
    }, [data?.sharedAccounts, sharingSearch]);

    const filteredDormant = useMemo(() => {
        if (!data?.dormantAccounts) return [];
        const q = dormantSearch.toLowerCase().trim();
        return data.dormantAccounts.filter((item: any) => {
            const matchQuery = !q ||
                item.portalUser.name.toLowerCase().includes(q) ||
                item.portalUser.nik.toLowerCase().includes(q) ||
                item.app.name.toLowerCase().includes(q) ||
                item.appUsername.toLowerCase().includes(q);
            const matchApp = dormantAppFilter === "ALL" || item.app.id === dormantAppFilter;
            return matchQuery && matchApp;
        });
    }, [data?.dormantAccounts, dormantSearch, dormantAppFilter]);

    const filteredMatrix = useMemo(() => {
        if (!data?.accessMatrix) return [];
        const q = matrixSearch.toLowerCase().trim();
        if (!q) return data.accessMatrix;
        return data.accessMatrix.filter((user: any) =>
            user.name.toLowerCase().includes(q) ||
            user.nik.toLowerCase().includes(q) ||
            user.groups.some((g: string) => g.toLowerCase().includes(q))
        );
    }, [data?.accessMatrix, matrixSearch]);

    const filteredHistory = useMemo(() => {
        if (!data?.historicalRevokes) return [];
        const q = historySearch.toLowerCase().trim();
        return data.historicalRevokes.filter((item: any) => {
            const matchQuery = !q ||
                (item.portalUser?.name || "").toLowerCase().includes(q) ||
                (item.portalUser?.nik || "").toLowerCase().includes(q) ||
                item.actorName.toLowerCase().includes(q) ||
                item.details.toLowerCase().includes(q) ||
                item.actionLabel.toLowerCase().includes(q);
            const matchAction = historyActionFilter === "ALL" || item.action === historyActionFilter;
            return matchQuery && matchAction;
        });
    }, [data?.historicalRevokes, historySearch, historyActionFilter]);

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-8 w-64 animate-pulse rounded bg-surface-2" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-card bg-surface-1 border border-border" />
                    ))}
                </div>
                <div className="h-10 w-full animate-pulse rounded-card bg-surface-2" />
                <div className="h-96 w-full animate-pulse rounded-card bg-surface-1 border border-border" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <p className="mb-1 text-xs font-semibold tracking-widest text-accent">PORTAL KEPATUHAN</p>
                        <h1 className="font-display text-2xl font-semibold text-text-1">Portal Audit (ISO 27001)</h1>
                    </div>
                    <Button variant="secondary" size="sm" onClick={fetchData} className="gap-2">
                        <ArrowsClockwise size={16} /> Coba Lagi
                    </Button>
                </div>
                <div className="flex flex-col items-center gap-4 rounded-card border border-danger/30 bg-danger-subtle p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/20 text-danger">
                        <WarningCircle size={28} aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-text-1">Gagal Memuat Data Audit</h3>
                        <p className="mt-1 text-sm text-text-2">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    const { summary, trends, sharedAccounts, dormantAccounts, accessMatrix, historicalRevokes, apps } = data || {};

    const TAB_DEFS = [
        { key: "dashboard", label: "Ringkasan & KPI", icon: <Pulse size={16} aria-hidden="true" /> },
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

    const maxTrendLaunch = trends?.length ? Math.max(...trends.map((t: any) => t.launchCount), 1) : 1;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold tracking-widest text-accent">ISO 27001 COMPLIANCE</p>
                        <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent border border-accent/20">
                            A.9 Access Control
                        </span>
                    </div>
                    <h1 className="font-display text-2xl font-bold text-text-1">Portal Audit & Keamanan Akses</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={fetchData} className="gap-2">
                        <ArrowsClockwise size={14} /> Refresh
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
                    summary?.totalSharedAccounts > 0
                        ? "border-danger/40 bg-danger-subtle/30"
                        : "border-border bg-surface-1"
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-danger">Account Sharing</span>
                        <ShieldWarning size={18} className={summary?.totalSharedAccounts > 0 ? "text-danger" : "text-text-3"} />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-danger">{summary?.totalSharedAccounts ?? 0}</p>
                    <span className="text-[11px] text-text-3">Akun target dipakai multi-user</span>
                </div>

                <div className={`rounded-card border p-4 shadow-lvl-1 ${
                    summary?.totalDormantAccounts > 0
                        ? "border-warning/40 bg-warning-subtle/30"
                        : "border-border bg-surface-1"
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-warning">Unused Access</span>
                        <Clock size={18} className={summary?.totalDormantAccounts > 0 ? "text-warning" : "text-text-3"} />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-warning">{summary?.totalDormantAccounts ?? 0}</p>
                    <span className="text-[11px] text-text-3">&gt;90 hari tidak aktif</span>
                </div>

                <div className="rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-3">Histori Dicabut</span>
                        <ArrowCounterClockwise size={18} className="text-text-2" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-text-1">{summary?.totalHistoricalRevokes ?? 0}</p>
                    <span className="text-[11px] text-text-3">Dalam 90 hari terakhir</span>
                </div>

                <div className="rounded-card border border-border bg-surface-1 p-4 shadow-lvl-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-3">SSO Launch (30H)</span>
                        <Pulse size={18} className="text-success" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-text-1">{summary?.totalSsoLaunches30d ?? 0}</p>
                    <span className="text-[11px] text-text-3">Total sesi SSO berhasil</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-border">
                {TAB_DEFS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        aria-pressed={activeTab === tab.key}
                        className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-control px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                            activeTab === tab.key
                                ? "border-b-2 border-accent bg-accent-subtle/50 text-accent font-bold"
                                : "text-text-2 hover:bg-surface-2 hover:text-text-1"
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge && (
                            <span className={`ml-1 rounded-full px-2 py-0.2 text-[11px] font-bold ${
                                tab.badgeVariant === "danger"
                                    ? "bg-danger text-white"
                                    : "bg-warning text-surface-0 font-bold"
                            }`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ========================================================= */}
            {/* TAB: DASHBOARD (RINGKASAN & KPI) */}
            {/* ========================================================= */}
            {activeTab === "dashboard" && (
                <div className="space-y-6">
                    {/* High Risk Account Sharing Alert Section */}
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldWarning size={20} className="text-danger" />
                                <h2 className="text-lg font-bold text-text-1">Top Risiko Account Sharing</h2>
                            </div>
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
                            <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success-subtle/30 p-4 text-sm text-text-1">
                                <CheckCircle size={20} className="text-success" />
                                <span>Aman. Tidak terdeteksi indikasi account sharing pada kredensial portal app aktif.</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {sharedAccounts.slice(0, 6).map((item: any, i: number) => (
                                    <div
                                        key={i}
                                        className="relative rounded-card border border-danger/40 bg-surface-1 p-4 shadow-lvl-1 hover:border-danger transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="rounded bg-danger/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-danger border border-danger/30">
                                                    {item.riskLevel}
                                                </span>
                                                <h3 className="mt-2 font-bold text-text-1">{item.app.name}</h3>
                                            </div>
                                            <span className="font-mono text-xs font-bold text-danger bg-danger-subtle px-2 py-1 rounded">
                                                {item.userCount} Pengguna
                                            </span>
                                        </div>

                                        <div className="mt-3 rounded bg-surface-2/60 p-2 text-xs">
                                            <span className="text-text-3">Target Username: </span>
                                            <span className="font-mono font-bold text-danger">{item.appUsername}</span>
                                        </div>

                                        <div className="mt-3">
                                            <p className="text-[11px] font-semibold text-text-3">Pengguna yang Terhubung:</p>
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {item.users.map((u: any) => (
                                                    <span
                                                        key={u.id}
                                                        className="inline-flex items-center rounded-control bg-surface-2 px-2 py-0.5 text-[11px] text-text-2 border border-border"
                                                        title={`NIK: ${u.nik}`}
                                                    >
                                                        {u.name} <span className="ml-1 text-[10px] text-text-3">({u.nik})</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* App Usage Trends & Top Inactive Summary Grid */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* SSO Launch Trend 30 Days */}
                        <div className="rounded-card border border-border bg-surface-1 p-5 shadow-lvl-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Pulse size={20} className="text-accent" />
                                    <h3 className="font-bold text-text-1">Aplikasi Paling Sering Diakses (30 Hari)</h3>
                                </div>
                                <span className="text-xs text-text-3">Total {summary?.totalSsoLaunches30d ?? 0} kali</span>
                            </div>

                            {trends?.length === 0 ? (
                                <p className="py-8 text-center text-sm text-text-3">Belum ada aktivitas SSO Launch dalam 30 hari.</p>
                            ) : (
                                <div className="space-y-3">
                                    {trends.slice(0, 7).map((t: any, i: number) => {
                                        const pct = Math.round((t.launchCount / maxTrendLaunch) * 100);
                                        return (
                                            <div key={i} className="space-y-1">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-text-1">{t.appName}</span>
                                                    <span className="font-mono text-text-2">{t.launchCount} kali</span>
                                                </div>
                                                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                                                    <div
                                                        className="h-full rounded-full bg-accent transition-all duration-300"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Top Dormant Accounts Preview */}
                        <div className="rounded-card border border-border bg-surface-1 p-5 shadow-lvl-1">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Clock size={20} className="text-warning" />
                                    <h3 className="font-bold text-text-1">Akses Terbengkalai Kritis (&gt;90 Hari)</h3>
                                </div>
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
                                <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success-subtle/30 p-4 text-sm text-text-1">
                                    <CheckCircle size={20} className="text-success" />
                                    <span>Semua akun kredensial portal aktif digunakan secara berkala.</span>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {dormantAccounts.slice(0, 5).map((item: any, i: number) => (
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
                                    {filteredSharing.map((item: any, i: number) => (
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
                                                    {item.users.map((u: any) => (
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
                                                    : "Aman. Tidak ditemukan indikasi sharing akun di aplikasi portal."}
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
            {/* TAB: DORMANT (UNUSED ACCESS >90 HARI) */}
            {/* ========================================================= */}
            {activeTab === "dormant" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-64">
                                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                                <Input
                                    placeholder="Cari user, NIK, atau app..."
                                    value={dormantSearch}
                                    onChange={(e) => setDormantSearch(e.target.value)}
                                    className="pl-9 text-xs"
                                />
                            </div>
                            <select
                                value={dormantAppFilter}
                                onChange={(e) => setDormantAppFilter(e.target.value)}
                                className="h-9 rounded-control border border-border bg-surface-1 px-3 text-xs text-text-1 focus:border-accent"
                            >
                                <option value="ALL">Semua Aplikasi</option>
                                {apps?.map((a: any) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
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
                            <table id="dormant-table" className="w-full border-collapse text-sm" aria-label="Unused access account">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/60">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Portal User</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">NIK</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Aplikasi Target</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Target Username</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Terakhir Dipakai</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-3">Status Inaktivitas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredDormant.map((item: any, i: number) => (
                                        <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                                            <td className="px-4 py-3 font-semibold text-text-1">
                                                {item.portalUser.name}
                                                {item.portalUser.groups?.length > 0 && (
                                                    <span className="ml-2 text-[11px] font-normal text-text-3">
                                                        ({item.portalUser.groups.join(", ")})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-text-2 tabular-nums">{item.portalUser.nik}</td>
                                            <td className="px-4 py-3 text-text-1">{item.app.name}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-text-2">{item.appUsername}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-text-3 tabular-nums">
                                                {item.lastUsedAt
                                                    ? new Date(item.lastUsedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                                    : "Belum Pernah"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded px-2 py-0.5 font-mono text-[11px] font-bold border ${
                                                    item.status === "NEVER_USED"
                                                        ? "bg-danger-subtle text-danger border-danger/30"
                                                        : "bg-warning-subtle text-warning border-warning/30"
                                                }`}>
                                                    {item.status === "NEVER_USED" ? "Belum Pernah Dipakai" : `${item.daysInactive} Hari Tidak Aktif`}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredDormant.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-3">
                                                {dormantSearch || dormantAppFilter !== "ALL"
                                                    ? "Tidak ada akun tidak aktif yang sesuai filter."
                                                    : "Aman. Tidak ditemukan akses atau kredensial yang tidak aktif >90 hari."}
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
                                placeholder="Cari nama user, NIK, atau grup..."
                                value={matrixSearch}
                                onChange={(e) => setMatrixSearch(e.target.value)}
                                className="pl-9 text-xs"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => exportToCSV("matrix-table", "Access_Control_Matrix")}
                                className="gap-2"
                            >
                                <DownloadSimple size={16} /> Ekspor CSV
                            </Button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-1 px-4 py-2.5 text-xs text-text-2">
                        <span className="font-semibold text-text-1">Keterangan:</span>
                        <span className="inline-flex items-center gap-1.5 text-success">
                            <span className="h-2.5 w-2.5 rounded-full bg-success"></span> SSO Terhubung (Kredensial Siap)
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-warning">
                            <span className="h-2.5 w-2.5 rounded-full bg-warning"></span> Akses Diizinkan (Kredensial Belum Disimpan)
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-accent">
                            <span className="h-2.5 w-2.5 rounded-full bg-accent"></span> Akses Grup / Publik
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-text-3">
                            <span className="h-2.5 w-2.5 rounded-full bg-surface-3"></span> - Tidak Ada Akses
                        </span>
                    </div>

                    <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                        <div className="overflow-x-auto max-h-[600px]">
                            <table id="matrix-table" className="w-full border-collapse text-xs" aria-label="Access control matrix">
                                <thead className="sticky top-0 z-10 bg-surface-2 border-b border-border shadow-sm">
                                    <tr>
                                        <th className="sticky left-0 z-20 bg-surface-2 px-4 py-3 text-left font-bold text-text-1 whitespace-nowrap min-w-[200px] border-r border-border">
                                            Portal User (Nama & NIK)
                                        </th>
                                        {apps?.map((app: any) => (
                                            <th key={app.id} className="px-4 py-3 text-center font-bold text-text-1 whitespace-nowrap min-w-[130px]">
                                                {app.name}
                                                {app.isPublic && (
                                                    <span className="ml-1 rounded bg-accent/20 px-1 py-0.2 text-[9px] text-accent">Publik</span>
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredMatrix.map((user: any, i: number) => (
                                        <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                                            <td className="sticky left-0 z-10 bg-surface-1 px-4 py-2.5 font-medium text-text-1 border-r border-border whitespace-nowrap">
                                                <div className="font-semibold text-text-1">{user.name}</div>
                                                <div className="font-mono text-[10px] text-text-3">
                                                    NIK: {user.nik} {user.groups?.length > 0 && `\u2022 ${user.groups.join(", ")}`}
                                                </div>
                                            </td>
                                            {apps?.map((app: any) => {
                                                const userApp = user.apps?.find((a: any) => a.appId === app.id);
                                                if (!userApp || !userApp.isAllowed) {
                                                    return (
                                                        <td key={app.id} className="px-3 py-2 text-center text-text-3">
                                                            -
                                                        </td>
                                                    );
                                                }

                                                if (userApp.hasCredential) {
                                                    return (
                                                        <td key={app.id} className="px-3 py-2 text-center">
                                                            <span
                                                                className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success border border-success/30"
                                                                title={`Username: ${userApp.primaryUsername || "Tersimpan"}`}
                                                            >
                                                                <CheckCircle size={12} /> Ready ({userApp.primaryUsername || "1 Akun"})
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={app.id} className="px-3 py-2 text-center">
                                                        <span
                                                            className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning border border-warning/30"
                                                            title={userApp.accessType === "GROUP" ? `Grup: ${userApp.groupNames?.join(", ")}` : "Akses langsung"}
                                                        >
                                                            Akses ({userApp.accessType})
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {filteredMatrix.length === 0 && (
                                        <tr>
                                            <td colSpan={(apps?.length ?? 0) + 1} className="px-4 py-8 text-center text-sm text-text-3">
                                                Tidak ada pengguna yang cocok dengan pencarian.
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
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-64">
                                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                                <Input
                                    placeholder="Cari user, pelaksana, atau aksi..."
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="pl-9 text-xs"
                                />
                            </div>
                            <select
                                value={historyActionFilter}
                                onChange={(e) => setHistoryActionFilter(e.target.value)}
                                className="h-9 rounded-control border border-border bg-surface-1 px-3 text-xs text-text-1 focus:border-accent"
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
                                    {filteredHistory.map((item: any, i: number) => (
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