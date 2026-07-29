"use client";

import { useState, useEffect } from "react";
import { FiActivity, FiShield, FiUsers, FiClock, FiDownload, FiRefreshCcw } from "react-icons/fi";

export default function PortalAuditPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
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
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const exportToCSV = (tableId: string, filename: string) => {
        const table = document.getElementById(tableId) as HTMLTableElement;
        if (!table) return;

        let csv = [];
        for (let i = 0; i < table.rows.length; i++) {
            let row = [], cols = table.rows[i].querySelectorAll("td, th");
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
        return <div style={{ padding: "24px", color: "var(--text-primary)" }}>Memuat data audit...</div>;
    }

    if (!data) {
        return <div style={{ padding: "24px", color: "var(--brand-red)" }}>Gagal memuat data.</div>;
    }

    const { trends, sharedAccounts, dormantAccounts, accessMatrix, historicalRevokes, apps } = data;

    const renderTabs = () => (
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", overflowX: "auto" }}>
            <button
                onClick={() => setActiveTab("dashboard")}
                style={{
                    padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", fontWeight: 600,
                    backgroundColor: activeTab === "dashboard" ? "var(--brand-red)" : "transparent",
                    color: activeTab === "dashboard" ? "#fff" : "var(--text-secondary)"
                }}
            >
                <FiActivity /> Ringkasan
            </button>
            <button
                onClick={() => setActiveTab("sharing")}
                style={{
                    padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", fontWeight: 600,
                    backgroundColor: activeTab === "sharing" ? "var(--brand-red)" : "transparent",
                    color: activeTab === "sharing" ? "#fff" : "var(--text-secondary)"
                }}
            >
                <FiShield /> Deteksi Account Sharing
            </button>
            <button
                onClick={() => setActiveTab("dormant")}
                style={{
                    padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", fontWeight: 600,
                    backgroundColor: activeTab === "dormant" ? "var(--brand-red)" : "transparent",
                    color: activeTab === "dormant" ? "#fff" : "var(--text-secondary)"
                }}
            >
                <FiClock /> Unused Access (90 Hari)
            </button>
            <button
                onClick={() => setActiveTab("matrix")}
                style={{
                    padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", fontWeight: 600,
                    backgroundColor: activeTab === "matrix" ? "var(--brand-red)" : "transparent",
                    color: activeTab === "matrix" ? "#fff" : "var(--text-secondary)"
                }}
            >
                <FiUsers /> Access Control Matrix
            </button>
            <button
                onClick={() => setActiveTab("history")}
                style={{
                    padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", fontWeight: 600,
                    backgroundColor: activeTab === "history" ? "var(--brand-red)" : "transparent",
                    color: activeTab === "history" ? "#fff" : "var(--text-secondary)"
                }}
            >
                <FiRefreshCcw /> Histori Pencabutan
            </button>
        </div>
    );

    return (
        <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Portal Audit (ISO 27001)</h1>
            </div>

            {renderTabs()}

            {/* TAB: DASHBOARD */}
            {activeTab === "dashboard" && (
                <div>
                    <h2 style={{ color: "var(--text-primary)", fontSize: "18px", marginBottom: "16px" }}>Top 5 Risiko Account Sharing</h2>
                    {sharedAccounts.length === 0 ? (
                        <p style={{ color: "var(--text-muted)" }}>Tidak ditemukan indikasi account sharing.</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", marginBottom: "32px" }}>
                            {sharedAccounts.slice(0, 5).map((item: any, i: number) => (
                                <div key={i} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--brand-red)", borderRadius: "12px", padding: "16px" }}>
                                    <div style={{ fontSize: "12px", color: "var(--brand-red)", fontWeight: 700, marginBottom: "8px" }}>RISIKO TINGGI</div>
                                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.app.name}</div>
                                    <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
                                        Target Username: <strong>{item.appUsername}</strong>
                                    </div>
                                    <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
                                        Dipakai oleh {item.users.length} pengguna (NIK: {item.users.map((u:any) => u.nik).join(", ")})
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <h2 style={{ color: "var(--text-primary)", fontSize: "18px", marginBottom: "16px" }}>Trend Penggunaan Aplikasi (30 Hari)</h2>
                    <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "var(--bg-card)", borderRadius: "12px", overflow: "hidden" }}>
                        <thead>
                            <tr style={{ backgroundColor: "var(--bg-hover)", borderBottom: "1px solid var(--border-color)" }}>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Aplikasi</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Jumlah SSO Launch</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trends.map((t: any, i: number) => (
                                <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>{t.appName}</td>
                                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>{t.launchCount} kali</td>
                                </tr>
                            ))}
                            {trends.length === 0 && (
                                <tr>
                                    <td colSpan={2} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>Belum ada data SSO dalam 30 hari terakhir.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB: SHARING */}
            {activeTab === "sharing" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "18px", margin: 0 }}>Deteksi Account Sharing</h2>
                        <button onClick={() => exportToCSV("sharing-table", "Account_Sharing_Audit")} style={{ background: "transparent", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "6px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FiDownload /> Export CSV
                        </button>
                    </div>
                    <table id="sharing-table" style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "var(--bg-card)", borderRadius: "12px", overflow: "hidden" }}>
                        <thead>
                            <tr style={{ backgroundColor: "var(--bg-hover)", borderBottom: "1px solid var(--border-color)" }}>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Aplikasi</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Target Username</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Jumlah Portal User</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Detail Portal User (Nama / NIK)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sharedAccounts.map((item: any, i: number) => (
                                <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>{item.app.name}</td>
                                    <td style={{ padding: "12px", color: "var(--brand-red)", fontWeight: 600 }}>{item.appUsername}</td>
                                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>{item.users.length}</td>
                                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>
                                        {item.users.map((u:any) => `${u.name} (${u.nik})`).join(", ")}
                                    </td>
                                </tr>
                            ))}
                            {sharedAccounts.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>Aman. Tidak ditemukan indikasi sharing akun.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB: DORMANT */}
            {activeTab === "dormant" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "18px", margin: 0 }}>Unused Access (&gt;90 Hari)</h2>
                        <button onClick={() => exportToCSV("dormant-table", "Dormant_Accounts_Audit")} style={{ background: "transparent", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "6px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FiDownload /> Export CSV
                        </button>
                    </div>
                    <table id="dormant-table" style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "var(--bg-card)", borderRadius: "12px", overflow: "hidden" }}>
                        <thead>
                            <tr style={{ backgroundColor: "var(--bg-hover)", borderBottom: "1px solid var(--border-color)" }}>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Portal User</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>NIK</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Aplikasi</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Terakhir Dipakai</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dormantAccounts.map((item: any, i: number) => (
                                <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>{item.portalUser.name}</td>
                                    <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{item.portalUser.nik}</td>
                                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>{item.app.name}</td>
                                    <td style={{ padding: "12px", color: "var(--brand-red)" }}>
                                        {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString("id-ID") : "Tidak Pernah"}
                                    </td>
                                </tr>
                            ))}
                            {dormantAccounts.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>Tidak ada akun terbengkalai.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB: MATRIX */}
            {activeTab === "matrix" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "18px", margin: 0 }}>Access Control Matrix</h2>
                        <button onClick={() => exportToCSV("matrix-table", "Access_Matrix_Audit")} style={{ background: "transparent", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "6px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FiDownload /> Export CSV
                        </button>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table id="matrix-table" style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "var(--bg-card)", borderRadius: "12px" }}>
                            <thead>
                                <tr style={{ backgroundColor: "var(--bg-hover)", borderBottom: "1px solid var(--border-color)" }}>
                                    <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)", minWidth: "200px" }}>Portal User</th>
                                    {apps.map((app: any) => (
                                        <th key={app.id} style={{ padding: "12px", textAlign: "center", color: "var(--text-secondary)" }}>
                                            {app.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {accessMatrix.map((user: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                        <td style={{ padding: "12px", color: "var(--text-primary)" }}>
                                            {user.name} <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>({user.nik})</span>
                                        </td>
                                        {apps.map((app: any) => {
                                            const userApp = user.apps.find((a: any) => a.appId === app.id);
                                            return (
                                                <td key={app.id} style={{ padding: "12px", textAlign: "center", color: "var(--text-primary)" }}>
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
            )}

            {/* TAB: HISTORY */}
            {activeTab === "history" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "18px", margin: 0 }}>Histori Pencabutan Akses (90 Hari)</h2>
                        <button onClick={() => exportToCSV("history-table", "Historical_Access_Audit")} style={{ background: "transparent", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "6px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FiDownload /> Export CSV
                        </button>
                    </div>
                    <table id="history-table" style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "var(--bg-card)", borderRadius: "12px", overflow: "hidden" }}>
                        <thead>
                            <tr style={{ backgroundColor: "var(--bg-hover)", borderBottom: "1px solid var(--border-color)" }}>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Waktu</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Portal User</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Aksi</th>
                                <th style={{ padding: "12px", textAlign: "left", color: "var(--text-secondary)" }}>Keterangan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historicalRevokes?.map((item: any, i: number) => {
                                let details = item.action;
                                if (item.changes) {
                                    try {
                                        const c = JSON.parse(item.changes);
                                        details = `App ID: ${c.appId || item.entityId}`;
                                    } catch (e) {
                                        details = item.entityId;
                                    }
                                }
                                return (
                                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                        <td style={{ padding: "12px", color: "var(--text-primary)" }}>{new Date(item.createdAt).toLocaleString("id-ID")}</td>
                                        <td style={{ padding: "12px", color: "var(--text-primary)" }}>{item.portalUser?.name || "Unknown"} ({item.portalUser?.nik || "-"})</td>
                                        <td style={{ padding: "12px", color: "var(--brand-red)", fontWeight: 600 }}>{item.action === "CREDENTIAL_DELETED" ? "Hapus Kredensial" : "Cabut Akses"}</td>
                                        <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{details}</td>
                                    </tr>
                                )
                            })}
                            {(!historicalRevokes || historicalRevokes.length === 0) && (
                                <tr>
                                    <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>Tidak ada histori pencabutan dalam 90 hari terakhir.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
