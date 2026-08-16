"use client";

import { useState, useEffect } from "react";
import { Download, X, ArrowSquareOut, Info, Database } from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import Button, { buttonClasses } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

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
    const { showToast } = useToast();

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

            // Fetch remote version from GitHub (client-side) with cache-busting
            const remoteRes = await fetch(`${GITHUB_VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
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
                showToast(error.error || "Backup gagal", "error");
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
            showToast("Gagal membuat backup", "error");
        } finally {
            setIsBackingUp(false);
        }
    };

    if (!updateInfo || !updateInfo.hasUpdate || isDismissed) return null;

    return (
        <div className="bg-info border-b border-info/40 px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <Download weight="fill" size={20} className="text-info" />
                    <span className="text-text-1 text-sm">
                        Update tersedia: <strong>v{updateInfo.latestVersion}</strong>
                    </span>
                </div>

                {updateInfo.hasSchemaUpdate && (
                    <Badge tone="warning">
                        <Info size={12} />
                        Database Migration
                    </Badge>
                )}

                {updateInfo.releaseNotes && (
                    <span className="text-text-2 text-sm">
                        {updateInfo.releaseNotes.substring(0, 50)}...
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                <Button
                    onClick={handleBackup}
                    disabled={isBackingUp}
                    variant="secondary"
                    size="sm"
                    iconLeft={isBackingUp ? undefined : <Database size={14} />}
                >
                    {isBackingUp ? "Backing up..." : "Backup Dulu"}
                </Button>

                {/* Tampilan tombol diambil dari kit; <button> tidak boleh
                    disarangkan di dalam <a>, jadi ini memakai buttonClasses. */}
                <a
                    href="https://github.com/torpedoliar/Anouncement-Dashboard-Local"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({
                        variant: "secondary",
                        size: "sm",
                        className: "text-info",
                    })}
                >
                    <ArrowSquareOut size={14} aria-hidden="true" />
                    Lihat di GitHub
                    <span className="sr-only">(buka tab baru)</span>
                </a>

                <button
                    onClick={handleDismiss}
                    className="p-1.5 text-text-2 hover:text-text-1 hover:bg-surface-2 rounded-control transition-colors duration-150"
                    title="Dismiss for 24 hours"
                    aria-label="Dismiss update banner"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
