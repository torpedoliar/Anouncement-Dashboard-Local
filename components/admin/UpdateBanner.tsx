"use client";

import { useState, useEffect } from "react";
import { FiDownload, FiX, FiExternalLink, FiAlertCircle, FiDatabase } from "react-icons/fi";

interface UpdateInfo {
    hasUpdate: boolean;
    hasSchemaUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    error?: string;
}

const GITHUB_VERSION_URL = "https://raw.githubusercontent.com/torpedoliar/Anouncement-Dashboard-Local/main/version.json";

// Compare semver versions: returns 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

export default function UpdateBanner() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);

    useEffect(() => {
        // Check localStorage for dismiss timestamp
        const dismissedData = localStorage.getItem("updateDismissed");
        if (dismissedData) {
            const { timestamp } = JSON.parse(dismissedData);
            const dismissTime = new Date(timestamp);
            const now = new Date();
            // Re-show after 24 hours or if new version
            if ((now.getTime() - dismissTime.getTime()) < 24 * 60 * 60 * 1000) {
                setIsDismissed(true);
            }
        }

        checkForUpdates();
    }, []);

    const checkForUpdates = async () => {
        try {
            // Fetch local version from API
            const localRes = await fetch("/api/version");
            const localVersion = await localRes.json();

            // Fetch remote version from GitHub (client-side)
            const remoteRes = await fetch(GITHUB_VERSION_URL, { cache: "no-store" });
            if (!remoteRes.ok) {
                throw new Error("Cannot connect to GitHub");
            }
            const remoteVersion = await remoteRes.json();

            // Compare versions
            const hasUpdate = compareVersions(remoteVersion.version, localVersion.version) > 0;
            const hasSchemaUpdate = parseInt(remoteVersion.schemaVersion || "1") > parseInt(localVersion.schemaVersion || "1");

            if (hasUpdate) {
                // Check if this version was already dismissed
                const dismissedData = localStorage.getItem("updateDismissed");
                if (dismissedData) {
                    const { version } = JSON.parse(dismissedData);
                    if (version === remoteVersion.version) {
                        setIsDismissed(true);
                    }
                }
                setUpdateInfo({
                    hasUpdate,
                    hasSchemaUpdate,
                    currentVersion: localVersion.version,
                    latestVersion: remoteVersion.version,
                    releaseNotes: remoteVersion.releaseNotes || "",
                });
            }
        } catch (error) {
            console.error("Failed to check for updates:", error);
        }
    };

    const handleDismiss = () => {
        if (updateInfo) {
            localStorage.setItem("updateDismissed", JSON.stringify({
                timestamp: new Date().toISOString(),
                version: updateInfo.latestVersion,
            }));
        }
        setIsDismissed(true);
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const response = await fetch("/api/backup");
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || "Backup gagal");
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `backup_${new Date().toISOString().split("T")[0]}.sql`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Backup error:", error);
            alert("Gagal membuat backup");
        } finally {
            setIsBackingUp(false);
        }
    };

    if (!updateInfo || !updateInfo.hasUpdate || isDismissed) return null;

    return (
        <div style={{
            background: "linear-gradient(90deg, #1e3a5f 0%, #1e40af 100%)",
            borderBottom: "1px solid #3b82f6",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <FiDownload color="#60a5fa" size={20} />
                    <span style={{ color: "#fff", fontSize: "14px" }}>
                        Update tersedia: <strong>v{updateInfo.latestVersion}</strong>
                    </span>
                </div>

                {updateInfo.hasSchemaUpdate && (
                    <span style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        backgroundColor: "rgba(234, 179, 8, 0.2)",
                        color: "#fbbf24",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "4px",
                    }}>
                        <FiAlertCircle size={14} />
                        Database Migration
                    </span>
                )}

                {updateInfo.releaseNotes && (
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                        {updateInfo.releaseNotes.substring(0, 50)}...
                    </span>
                )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                        border: "1px solid rgba(34, 197, 94, 0.4)",
                        color: "#4ade80",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: isBackingUp ? "not-allowed" : "pointer",
                        borderRadius: "4px",
                    }}
                >
                    <FiDatabase size={14} />
                    {isBackingUp ? "Backing up..." : "Backup Dulu"}
                </button>

                <a
                    href="https://github.com/torpedoliar/Anouncement-Dashboard-Local"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        backgroundColor: "rgba(59, 130, 246, 0.2)",
                        border: "1px solid rgba(59, 130, 246, 0.4)",
                        color: "#60a5fa",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                        borderRadius: "4px",
                    }}
                >
                    <FiExternalLink size={14} />
                    Lihat di GitHub
                </a>

                <button
                    onClick={handleDismiss}
                    style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        padding: "4px",
                    }}
                    title="Dismiss for 24 hours"
                >
                    <FiX size={18} />
                </button>
            </div>
        </div>
    );
}
