"use client";

import { useState, useEffect } from "react";
import {
    Pulse,
    ArrowCounterClockwise,
    Clock,
    DownloadSimple,
    ShieldCheck,
    Users,
    WarningCircle,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Table, { type TableColumn } from "@/components/ui/Table";

export default function PortalAuditPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("dashboard");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/admin/portal-audit");
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setError(null);
            } else {
                setError("Terjadi kesalahan. Silakan coba lagi.");
            }
        } catch (e) {
            console.error(e);
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    };

    const exportToCSV = (tableId: string, filename: string) => {
        const table = document.getElementById(tableId) as HTMLTableElement;
        if (!table) return;

        const csv = [];
        for (let i = 0; i < table.rows.length; i++) {
            const row = [];
            const cols = table.rows[i].querySelectorAll("td, th");
            for (let j = 0; j < cols.length; j++) {
                row.push('"' + (cols[j] as HTMLElement).innerText.replace(/"/g, '""') + '"');
            }
            csv.push(row.join(","));
        }

        const csvString = csv.join("\n");
        const a = document.createElement("a");
        a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvString);
        a.target = "_blank";
        a.download = filename + ".csv";
        a.click();
    };

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-6">
                    <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                    <div className="h-7 w-64 animate-pulse rounded bg-surface-2" />
                </div>

                {/* Tab skeleton */}
                <div className="mb-6 flex gap-4 border-b border-border px-4 py-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-6 w-32 animate-pulse rounded bg-surface-2" />
                    ))}
                </div>

                {/* Ledger-shaped skeleton */}
                <div className="rounded-card border border-border shadow-lvl-1">
                    <div className="flex gap-4 border-b border-border px-4 py-3">
                        <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                                <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <p className="mb-1 text-xs font-semibold tracking-widest text-accent">PORTAL</p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Portal Audit (ISO 27001)</h1>
                </div>
                <div className="flex flex-col items-center gap-4 rounded-card border border-danger/30 bg-danger-subtle p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-danger-subtle">
                        <WarningCircle size={24} className="text-danger" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-danger">{error}</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <p className="mb-1 text-xs font-semibold tracking-widest text-accent">PORTAL</p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Portal Audit (ISO 27001)</h1>
                </div>
                <div className="flex flex-col items-center gap-4 rounded-card border border-border p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-2">
                        <ShieldCheck size={24} className="text-text-3" aria-hidden="true" />
                    </div>
                    <p className="text-text-3">Belum ada data audit.</p>
                </div>
            </div>
        );
    }

    const { trends, sharedAccounts, dormantAccounts, accessMatrix, historicalRevokes, apps } = data;

    const TAB_DEFS = [
        { key: "dashboard", label: "Ringkasan", icon: <Pulse size={14} aria-hidden="true" /> },
        { key: "sharing", label: "Deteksi Account Sharing", icon: <ShieldCheck size={14} aria-hidden="true" /> },
        { key: "dormant", label: "Unused Access (90 Hari)", icon: <Clock size={14} aria-hidden="true" /> },
        { key: "matrix", label: "Access Control Matrix", icon: <Users size={14} aria-hidden="true" /> },
        { key: "history", label: "Histori Pencabutan", icon: <ArrowCounterClockwise size={14} aria-hidden="true" /> },
    ];

    const renderExport = (tableId: string, filename: string) => (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Export CSV"
            title="Export CSV"
            onClick={() => exportToCSV(tableId, filename)}
        >
            <DownloadSimple size={14} aria-hidden="true" />
        </Button>
    );

    const tableShell = "overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1";
    const thClass = "px-4 py-3 text-left text-xs font-semibold text-text-3 whitespace-nowrap";
    const tdClass = "px-4 py-3 text-text-1";

    const trendsColumns: TableColumn[] = [
        { key: "app", header: "Aplikasi" },
        { key: "count", header: "Jumlah SSO Launch" },
    ];

    const trendsRows = trends.map((t: any, i: number) => [
        <span key={i} className="text-text-1">{t.appName}</span>,
        <span key={`${i}-c`} className="font-mono text-xs tabular-nums text-text-1">{t.launchCount} kali</span>,
    ]);

    return (
        <div className="p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold tracking-widest text-accent">PORTAL</p>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Portal Audit (ISO 27001)</h1>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
                {TAB_DEFS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        aria-pressed={activeTab === tab.key}
                        className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-control px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                            activeTab === tab.key
                                ? "bg-accent-subtle text-accent"
                                : "text-text-2 hover:bg-surface-2 hover:text-text-1"
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB: DASHBOARD */}
            {activeTab === "dashboard" && (
                <div>
                    <h2 className="mb-4 text-xl font-semibold text-text-1">Top 5 Risiko Account Sharing</h2>
                    {sharedAccounts.length === 0 ? (
                        <p className="text-sm text-text-3">Tidak ditemukan indikasi account sharing.</p>
                    ) : (
                        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {sharedAccounts.slice(0, 5).map((item: any, i: number) => (
                                <div key={i} className="rounded-card border border-danger-subtle bg-surface-1 p-4 shadow-lvl-1">
                                    <div className="mb-2 text-xs font-semibold text-danger">RISIKO TINGGI</div>
                                    <div className="font-semibold text-text-1">{item.app.name}</div>
                                    <div className="mt-1 text-sm text-text-2">
                                        Target Username: <strong className="text-text-1">{item.appUsername}</strong>
                                    </div>
                                    <div className="mt-3 text-xs text-text-3">
                                        Dipakai oleh <span className="font-mono tabular-nums">{item.users.length}</span> pengguna (NIK: {item.users.map((u: any) => u.nik).join(", ")})
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <h2 className="mb-4 text-xl font-semibold text-text-1">Trend Penggunaan Aplikasi (30 Hari)</h2>
                    <div className={tableShell}>
                        <Table
                            columns={trendsColumns}
                            rows={trendsRows}
                            ariaLabel="Trend penggunaan aplikasi"
                        />
                        {trends.length === 0 && (
                            <p className="border-t border-border px-4 py-6 text-center text-sm text-text-3">
                                Belum ada data SSO dalam 30 hari terakhir.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: SHARING */}
            {activeTab === "sharing" && (
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-text-1">Deteksi Account Sharing</h2>
                        {renderExport("sharing-table", "Account_Sharing_Audit")}
                    </div>
                    <div className={tableShell}>
                        <div className="overflow-x-auto">
                            <table id="sharing-table" className="w-full border-collapse text-sm" aria-label="Deteksi account sharing">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className={thClass}>Aplikasi</th>
                                        <th className={thClass}>Target Username</th>
                                        <th className={thClass}>Jumlah Portal User</th>
                                        <th className={thClass}>Detail Portal User (Nama / NIK)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sharedAccounts.map((item: any, i: number) => (
                                        <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                                            <td className={tdClass}>{item.app.name}</td>
                                            <td className={`${tdClass} font-semibold text-danger`}>{item.appUsername}</td>
                                            <td className={`${tdClass} font-mono text-xs tabular-nums`}>{item.users.length}</td>
                                            <td className={tdClass}>{item.users.map((u: any) => `${u.name} (${u.nik})`).join(", ")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {sharedAccounts.length === 0 && (
                            <p className="border-t border-border px-4 py-6 text-center text-sm text-text-3">
                                Aman. Tidak ditemukan indikasi sharing akun.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: DORMANT */}
            {activeTab === "dormant" && (
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-text-1">Unused Access (&gt;90 Hari)</h2>
                        {renderExport("dormant-table", "Dormant_Accounts_Audit")}
                    </div>
                    <div className={tableShell}>
                        <div className="overflow-x-auto">
                            <table id="dormant-table" className="w-full border-collapse text-sm" aria-label="Unused access account">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className={thClass}>Portal User</th>
                                        <th className={thClass}>NIK</th>
                                        <th className={thClass}>Aplikasi</th>
                                        <th className={thClass}>Terakhir Dipakai</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dormantAccounts.map((item: any, i: number) => (
                                        <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                                            <td className={tdClass}>{item.portalUser.name}</td>
                                            <td className={`${tdClass} font-mono text-xs tabular-nums text-text-2`}>{item.portalUser.nik}</td>
                                            <td className={tdClass}>{item.app.name}</td>
                                            <td className={`${tdClass} whitespace-nowrap font-mono text-xs tabular-nums text-text-3`}>
                                                {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString("id-ID") : "Tidak Pernah"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {dormantAccounts.length === 0 && (
                            <p className="border-t border-border px-4 py-6 text-center text-sm text-text-3">
                                Tidak ada akun terbengkalai.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: MATRIX */}
            {activeTab === "matrix" && (
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-text-1">Access Control Matrix</h2>
                        {renderExport("matrix-table", "Access_Matrix_Audit")}
                    </div>
                    <div className={tableShell}>
                        <div className="overflow-x-auto">
                            <table id="matrix-table" className="w-full border-collapse text-sm" aria-label="Access control matrix">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className={thClass}>Portal User</th>
                                        {apps.map((app: any) => (
                                            <th key={app.id} className={thClass}>{app.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {accessMatrix.map((user: any, i: number) => (
                                        <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                                            <td className={tdClass}>
                                                {user.name} <span className="text-xs text-text-3">({user.nik})</span>
                                            </td>
                                            {apps.map((app: any) => {
                                                const userApp = user.apps.find((a: any) => a.appId === app.id);
                                                return (
                                                    <td key={app.id} className={`${tdClass} text-center`}>
                                                        {userApp ? (userApp.hasCredential ? "✅ Terhubung" : "⚠️ Akses (Kosong)") : "-"}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: HISTORY */}
            {activeTab === "history" && (
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-text-1">Histori Pencabutan Akses (90 Hari)</h2>
                        {renderExport("history-table", "Historical_Access_Audit")}
                    </div>
                    <div className={tableShell}>
                        <div className="overflow-x-auto">
                            <table id="history-table" className="w-full border-collapse text-sm" aria-label="Histori pencabutan akses">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className={thClass}>Waktu</th>
                                        <th className={thClass}>Portal User</th>
                                        <th className={thClass}>Aksi</th>
                                        <th className={thClass}>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historicalRevokes?.map((item: any, i: number) => {
                                        let details = item.action;
                                        if (item.changes) {
                                            try {
                                                const c = JSON.parse(item.changes);
                                                details = `App ID: ${c.appId || item.entityId}`;
                                            } catch {
                                                details = item.entityId;
                                            }
                                        }
                                        return (
                                            <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                                                <td className={`${tdClass} whitespace-nowrap font-mono text-xs tabular-nums text-text-3`}>
                                                    {new Date(item.createdAt).toLocaleString("id-ID")}
                                                </td>
                                                <td className={tdClass}>
                                                    {item.portalUser?.name || "Unknown"} ({item.portalUser?.nik || "-"})
                                                </td>
                                                <td className={`${tdClass} font-semibold text-danger`}>
                                                    {item.action === "CREDENTIAL_DELETED" ? "Hapus Kredensial" : "Cabut Akses"}
                                                </td>
                                                <td className={`${tdClass} text-text-2`}>{details}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {(!historicalRevokes || historicalRevokes.length === 0) && (
                            <p className="border-t border-border px-4 py-6 text-center text-sm text-text-3">
                                Tidak ada histori pencabutan dalam 90 hari terakhir.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}