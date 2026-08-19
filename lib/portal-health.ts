import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export interface HealthCheckResult {
    appId: string;
    appName: string;
    url: string;
    status: "ONLINE" | "DEGRADED" | "OFFLINE";
    statusCode: number | null;
    latencyMs: number;
    checkedAt: Date;
    errorMessage: string | null;
}

export interface HealthSummary {
    totalApps: number;
    onlineCount: number;
    degradedCount: number;
    offlineCount: number;
    averageLatencyMs: number;
    globalUptimePercent: number;
    checkedAt: Date;
    results: HealthCheckResult[];
}

/**
 * Lakukan health check ke single Portal App
 */
export async function checkAppHealth(app: {
    id: string;
    name: string;
    url: string;
    loginUrl?: string | null;
    healthStatus?: string | null;
}): Promise<HealthCheckResult> {
    const targetUrl = (app.loginUrl && app.loginUrl.trim()) ? app.loginUrl.trim() : app.url.trim();
    const startTime = performance.now();
    const checkedAt = new Date();

    let status: "ONLINE" | "DEGRADED" | "OFFLINE" = "OFFLINE";
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    let latencyMs = 0;

    try {
        const urlObj = new URL(targetUrl);
        if (!urlObj.protocol.startsWith("http")) {
            throw new Error(`Protokol URL tidak didukung: ${urlObj.protocol}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let response: Response;
        try {
            // Coba HTTP HEAD terlebih dahulu untuk efisiensi token & bandwidth
            response = await fetch(targetUrl, {
                method: "HEAD",
                signal: controller.signal,
                headers: {
                    "User-Agent": "SJA-Portal-HealthCheck/1.0",
                },
                redirect: "follow",
            });
        } catch {
            // Jika server menolak method HEAD (mis. 405 Method Not Allowed), coba fallback GET
            response = await fetch(targetUrl, {
                method: "GET",
                signal: controller.signal,
                headers: {
                    "User-Agent": "SJA-Portal-HealthCheck/1.0",
                },
                redirect: "follow",
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const endTime = performance.now();
        latencyMs = Math.round(endTime - startTime);
        statusCode = response.status;

        if (response.ok || (response.status >= 200 && response.status < 400)) {
            // HTTP 200..399 dianggap online
            if (latencyMs >= 2500) {
                status = "DEGRADED"; // Respon lambat
                errorMessage = `Latensi server lambat (${latencyMs}ms)`;
            } else {
                status = "ONLINE";
            }
        } else if (response.status === 401 || response.status === 403) {
            // Status 401/403 menandakan server web hidup dan form auth aktif
            status = latencyMs >= 2500 ? "DEGRADED" : "ONLINE";
        } else {
            status = "OFFLINE";
            errorMessage = `HTTP ${response.status} ${response.statusText || "Server Error"}`;
        }
    } catch (err: any) {
        const endTime = performance.now();
        latencyMs = Math.round(endTime - startTime);
        status = "OFFLINE";

        if (err.name === "AbortError" || latencyMs >= 5000) {
            errorMessage = "Koneksi Timeout (> 5000ms)";
        } else if (err.code === "ECONNREFUSED") {
            errorMessage = "Koneksi Ditolak (Server Tidak Aktif)";
        } else if (err.code === "ENOTFOUND") {
            errorMessage = "Domain / Host Tidak Ditemukan";
        } else {
            errorMessage = err.message || "Gagal Terhubung ke Server";
        }
    }

    const previousStatus = app.healthStatus;

    // 1. Simpan status terkini ke PortalApp
    try {
        await prisma.portalApp.update({
            where: { id: app.id },
            data: {
                healthStatus: status,
                healthStatusCode: statusCode,
                healthLatencyMs: latencyMs,
                healthCheckedAt: checkedAt,
                healthError: errorMessage,
            },
        });

        // 2. Simpan log histori pengecekan
        await prisma.portalAppHealthLog.create({
            data: {
                appId: app.id,
                status,
                statusCode,
                latencyMs,
                errorMessage,
                checkedAt,
            },
        });

        // 3. Catat audit insiden downtime jika status berubah menjadi OFFLINE
        if (previousStatus && previousStatus !== "OFFLINE" && status === "OFFLINE") {
            await logAudit({
                actorType: "SYSTEM",
                category: "SYSTEM",
                action: "APP_DOWNTIME_DETECTED",
                severity: "ERROR",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id,
                changes: {
                    appName: app.name,
                    url: targetUrl,
                    statusCode,
                    latencyMs,
                    error: errorMessage,
                },
            }).catch(() => {});
        } else if (previousStatus === "OFFLINE" && (status === "ONLINE" || status === "DEGRADED")) {
            // Catat audit pemulihan aplikasi
            await logAudit({
                actorType: "SYSTEM",
                category: "SYSTEM",
                action: "APP_RECOVERED",
                severity: "INFO",
                entityType: "PORTAL_APP",
                entityId: app.id,
                appId: app.id,
                changes: {
                    appName: app.name,
                    url: targetUrl,
                    statusCode,
                    latencyMs,
                    recoveredAt: checkedAt,
                },
            }).catch(() => {});
        }
    } catch (dbErr) {
        console.error(`Gagal menyimpan health log untuk app ${app.name}:`, dbErr);
    }

    return {
        appId: app.id,
        appName: app.name,
        url: targetUrl,
        status,
        statusCode,
        latencyMs,
        checkedAt,
        errorMessage,
    };
}

/**
 * Lakukan health check untuk semua aplikasi aktif secara paralel
 */
export async function checkAllPortalAppsHealth(): Promise<HealthSummary> {
    const apps = await prisma.portalApp.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            url: true,
            loginUrl: true,
            healthStatus: true,
        },
        orderBy: { displayOrder: "asc" },
    });

    const checkedAt = new Date();
    if (apps.length === 0) {
        return {
            totalApps: 0,
            onlineCount: 0,
            degradedCount: 0,
            offlineCount: 0,
            averageLatencyMs: 0,
            globalUptimePercent: 100,
            checkedAt,
            results: [],
        };
    }

    const checkPromises = apps.map((app) => checkAppHealth(app));
    const settleResults = await Promise.allSettled(checkPromises);

    const results: HealthCheckResult[] = [];
    let onlineCount = 0;
    let degradedCount = 0;
    let offlineCount = 0;
    let totalLatency = 0;
    let validLatencyCount = 0;

    for (let i = 0; i < settleResults.length; i++) {
        const item = settleResults[i];
        if (item.status === "fulfilled") {
            const res = item.value;
            results.push(res);
            if (res.status === "ONLINE") onlineCount++;
            else if (res.status === "DEGRADED") degradedCount++;
            else offlineCount++;

            if (res.status !== "OFFLINE" && res.latencyMs > 0) {
                totalLatency += res.latencyMs;
                validLatencyCount++;
            }
        } else {
            const app = apps[i];
            offlineCount++;
            results.push({
                appId: app.id,
                appName: app.name,
                url: app.loginUrl || app.url,
                status: "OFFLINE",
                statusCode: null,
                latencyMs: 0,
                checkedAt,
                errorMessage: item.reason?.message || "Health check failed",
            });
        }
    }

    const averageLatencyMs = validLatencyCount > 0 ? Math.round(totalLatency / validLatencyCount) : 0;
    const globalUptimePercent = apps.length > 0 ? Math.round(((onlineCount + degradedCount) / apps.length) * 1000) / 10 : 100;

    return {
        totalApps: apps.length,
        onlineCount,
        degradedCount,
        offlineCount,
        averageLatencyMs,
        globalUptimePercent,
        checkedAt,
        results,
    };
}
