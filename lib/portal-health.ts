import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { fetchLoginPage, FetchError } from "@/lib/portal-fetch-html";

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

        // Pakai fetchLoginPage (bukan fetch polos) agar health check mewarisi pola yang
        // sama dengan deteksi & SSO: fallback TLS self-signed (khas internal seperti K2),
        // redirect manual dengan batas hop + deteksi loop.
        // Fetch polos memakai redirect:"follow" → loop redirect K2 menghabiskan batas,
        // TLS self-signed pun ikut melempar → server hidup dilaporkan OFFLINE.
        const page = await fetchLoginPage(targetUrl);

        const endTime = performance.now();
        latencyMs = Math.round(endTime - startTime);
        statusCode = page.statusCode;

        if (page.loopDetected) {
            status = latencyMs >= 2500 ? "DEGRADED" : "ONLINE";
            errorMessage =
                "Server merespon tapi URL berputar dalam loop redirect — host hidup, URL mungkin tidak menuju form login.";
        } else if (statusCode !== null && statusCode >= 200 && statusCode < 300) {
            status = latencyMs >= 2500 ? "DEGRADED" : "ONLINE";
            if (latencyMs >= 2500) errorMessage = `Latensi server lambat (${latencyMs}ms)`;
        } else if (statusCode !== null && statusCode >= 401 && statusCode <= 403) {
            // 401/403 = server web hidup dan form auth aktif
            status = latencyMs >= 2500 ? "DEGRADED" : "ONLINE";
        } else if (statusCode !== null) {
            // 3xx lain / 4xx / 5xx: server merespons tapi responnya bermasalah.
            status = "DEGRADED";
            errorMessage = `HTTP ${statusCode} — server hidup tapi respon tidak normal`;
        } else {
            // Kode null tanpa loop = kasus aneh, aman anggap hidup bila halaman terbaca.
            status = latencyMs >= 2500 ? "DEGRADED" : "ONLINE";
        }
    } catch (err: any) {
        const endTime = performance.now();
        latencyMs = Math.round(endTime - startTime);

        // FetchError bisa berarti dua hal yang harus dibedakan:
        // - "mengembalikan HTTP nnn" / "Respons bukan halaman web" → server menjawab
        //   (memberi 4xx/5xx atau respons berbeda dari HTML) → DIGRADED
        // - "Gagal mengakses" / timeout → server tidak terjawab → OFFLINE
        const serverResponded =
            err instanceof FetchError &&
            (/\bmengembalikan HTTP \d{3}\b/.test(err.message) || /Respons bukan halaman web/i.test(err.message));
        if (serverResponded) {
            status = "DEGRADED";
            statusCode = err.status && err.status >= 400 ? err.status : null;
            errorMessage = `Server menjawab namun respons bermasalah: ${err.message}`;
        } else {
            status = "OFFLINE";
        }

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
 * Interval minimum antar health check yang dipicu dari render halaman.
 * Health check menembak host eksternal, jadi jauh lebih longgar daripada
 * throttle scheduler (60 detik).
 */
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let lastHealthRun = 0;
let inFlight: Promise<HealthSummary> | null = null;

/**
 * Pemicu health check oportunistik dari server render (pola sama dengan runScheduler).
 * Proyek ini tidak memakai cron eksternal, jadi tanpa ini status app tidak pernah
 * diperbarui dan selamanya bernilai default migrasi 'UNKNOWN'.
 *
 * Sengaja TIDAK di-await oleh pemanggil: pengecekan menembak host eksternal dengan
 * timeout 5 detik per app, menunggunya akan menahan render halaman portal.
 * Halaman menampilkan hasil run sebelumnya dari DB; run ini menyegarkan untuk kunjungan berikutnya.
 */
export function triggerHealthCheckIfStale(): void {
    const now = Date.now();
    if (inFlight || now - lastHealthRun < HEALTH_CHECK_INTERVAL_MS) return;
    lastHealthRun = now;

    inFlight = checkAllPortalAppsHealth()
        .catch((err) => {
            console.error("[PortalHealth] Background health check gagal:", err);
            return null as unknown as HealthSummary;
        })
        .finally(() => {
            inFlight = null;
        }) as Promise<HealthSummary>;
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
