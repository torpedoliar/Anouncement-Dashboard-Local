import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        // 1. All Portal Apps
        const apps = await prisma.portalApp.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
                url: true,
                loginUrl: true,
                logoPath: true,
                isPublic: true,
                isActive: true,
                category: true,
                healthStatus: true,
                healthStatusCode: true,
                healthLatencyMs: true,
                healthCheckedAt: true,
                healthError: true,
            },
            orderBy: { displayOrder: "asc" },
        });
        const appsMap = new Map(apps.map((a) => [a.id, a]));

        // Total active portal users count
        const totalPortalUsers = await prisma.portalUser.count({ where: { isActive: true } });

        // Health & Uptime Metrics
        const onlineApps = apps.filter((a) => a.healthStatus === "ONLINE");
        const degradedApps = apps.filter((a) => a.healthStatus === "DEGRADED");
        const offlineApps = apps.filter((a) => a.healthStatus === "OFFLINE");
        const totalLatency = apps.reduce((sum, a) => sum + (a.healthLatencyMs || 0), 0);
        const countWithLatency = apps.filter((a) => (a.healthLatencyMs || 0) > 0).length;
        const averageLatencyMs = countWithLatency > 0 ? Math.round(totalLatency / countWithLatency) : 0;
        const globalUptimePercent = apps.length > 0 ? Math.round(((onlineApps.length + degradedApps.length) / apps.length) * 1000) / 10 : 100;

        // 2. App Usage Trends & Total SSO Launch in 30 days
        const trendsRaw = await prisma.auditLog.groupBy({
            by: ["appId"],
            where: {
                action: "SSO_LAUNCH",
                category: "SECURITY",
                createdAt: { gte: thirtyDaysAgo },
                appId: { not: null },
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
        });

        const totalSsoLaunches30d = trendsRaw.reduce((sum, t) => sum + t._count.id, 0);

        const trends = trendsRaw.map((t) => ({
            appId: t.appId,
            appName: t.appId ? appsMap.get(t.appId)?.name || "Unknown" : "Unknown",
            launchCount: t._count.id,
        }));

        // 3. Account Sharing Detection (Case-insensitive & trimmed username grouping)
        const credentials = await prisma.portalUserAppCredential.findMany({
            where: { appUsername: { not: null } },
            include: {
                portalUser: {
                    select: {
                        id: true,
                        name: true,
                        nik: true,
                        isActive: true,
                        groups: { include: { group: { select: { name: true } } } },
                    },
                },
                app: { select: { id: true, name: true, logoPath: true } },
            },
        });

        const sharingMap = new Map<string, {
            app: { id: string; name: string; logoPath: string | null };
            appUsername: string;
            users: Array<{ id: string; name: string; nik: string; isActive: boolean; groups: string[] }>;
        }>();

        for (const cred of credentials) {
            if (!cred.appUsername || !cred.appUsername.trim()) continue;
            const normalizedUsername = cred.appUsername.trim();
            const key = `${cred.appId}_${normalizedUsername.toLowerCase()}`;
            if (!sharingMap.has(key)) {
                sharingMap.set(key, {
                    app: cred.app,
                    appUsername: normalizedUsername,
                    users: [],
                });
            }
            const entry = sharingMap.get(key)!;
            if (!entry.users.some((u) => u.id === cred.portalUser.id)) {
                entry.users.push({
                    id: cred.portalUser.id,
                    name: cred.portalUser.name,
                    nik: cred.portalUser.nik,
                    isActive: cred.portalUser.isActive,
                    groups: cred.portalUser.groups.map((g) => g.group.name),
                });
            }
        }

        const sharedAccounts = Array.from(sharingMap.values())
            .filter((item) => item.users.length > 1)
            .map((item) => ({
                ...item,
                userCount: item.users.length,
                riskLevel: item.users.length >= 4 ? "CRITICAL" : item.users.length >= 2 ? "HIGH" : "MEDIUM",
            }))
            .sort((a, b) => b.userCount - a.userCount);

        // 4. Dormant Accounts (Unused Access >90 Days)
        const dormantCredentials = await prisma.portalUserAppCredential.findMany({
            where: {
                OR: [
                    { lastUsedAt: { lt: ninetyDaysAgo } },
                    { lastUsedAt: null, createdAt: { lt: ninetyDaysAgo } },
                ],
            },
            include: {
                portalUser: {
                    select: {
                        id: true,
                        name: true,
                        nik: true,
                        isActive: true,
                        groups: { include: { group: { select: { name: true } } } },
                    },
                },
                app: { select: { id: true, name: true, logoPath: true } },
            },
            orderBy: { lastUsedAt: "asc" },
        });

        const dormantAccounts = dormantCredentials.map((item) => {
            const referenceDate = item.lastUsedAt ?? item.createdAt;
            const daysInactive = Math.floor((now.getTime() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24));
            return {
                id: item.id,
                portalUser: {
                    id: item.portalUser.id,
                    name: item.portalUser.name,
                    nik: item.portalUser.nik,
                    isActive: item.portalUser.isActive,
                    groups: item.portalUser.groups.map((g) => g.group.name),
                },
                app: item.app,
                appUsername: item.appUsername || "-",
                label: item.label,
                lastUsedAt: item.lastUsedAt,
                createdAt: item.createdAt,
                daysInactive,
                status: item.lastUsedAt ? "INACTIVE" : "NEVER_USED",
            };
        });

        // 5. Access Control Matrix (Direct + Group + Public Access)
        const usersWithAccess = await prisma.portalUser.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                nik: true,
                role: true,
                appAccess: { include: { app: { select: { id: true, name: true } } } },
                groups: {
                    include: {
                        group: {
                            include: {
                                apps: { include: { app: { select: { id: true, name: true } } } },
                            },
                        },
                    },
                },
                credentials: {
                    select: {
                        id: true,
                        appId: true,
                        appUsername: true,
                        label: true,
                        lastUsedAt: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        const accessMatrix = usersWithAccess.map((u) => {
            const userAppAccessMap = new Map<string, { role?: string }>();
            for (const acc of u.appAccess) {
                userAppAccessMap.set(acc.app.id, { role: acc.role });
            }

            const userGroupAppsMap = new Map<string, string[]>();
            for (const userGroup of u.groups) {
                if (!userGroup.group.isActive) continue;
                for (const groupApp of userGroup.group.apps) {
                    const existing = userGroupAppsMap.get(groupApp.appId) || [];
                    existing.push(userGroup.group.name);
                    userGroupAppsMap.set(groupApp.appId, existing);
                }
            }

            const userCredsMap = new Map<string, Array<{ id: string; appUsername: string | null; label: string; lastUsedAt: Date | null }>>();
            for (const cred of u.credentials) {
                const existing = userCredsMap.get(cred.appId) || [];
                existing.push(cred);
                userCredsMap.set(cred.appId, existing);
            }

            const appStatuses = apps.map((app) => {
                const hasDirect = userAppAccessMap.has(app.id);
                const groupNames = userGroupAppsMap.get(app.id) || [];
                const hasGroup = groupNames.length > 0;
                const isPortalAdmin = u.role === "PORTAL_ADMIN";
                const isAllowed = app.isPublic || hasDirect || hasGroup || isPortalAdmin;

                const creds = userCredsMap.get(app.id) || [];
                const hasCredential = creds.length > 0;

                let accessType: "PUBLIC" | "DIRECT" | "GROUP" | "ADMIN" | "NONE" = "NONE";
                if (isAllowed) {
                    if (isPortalAdmin) accessType = "ADMIN";
                    else if (hasDirect) accessType = "DIRECT";
                    else if (hasGroup) accessType = "GROUP";
                    else if (app.isPublic) accessType = "PUBLIC";
                }

                return {
                    appId: app.id,
                    appName: app.name,
                    isAllowed,
                    accessType,
                    groupNames,
                    hasCredential,
                    credentialsCount: creds.length,
                    primaryUsername: creds[0]?.appUsername || null,
                };
            });

            return {
                id: u.id,
                name: u.name,
                nik: u.nik,
                role: u.role,
                groups: u.groups.map((g) => g.group.name),
                apps: appStatuses,
            };
        });

        // 6. Historical Access Review (Comprehensive Revocation Events)
        const historicalRevokesRaw = await prisma.auditLog.findMany({
            where: {
                OR: [
                    { category: "SECURITY", action: { in: ["CREDENTIAL_DELETED", "PORTAL_ACCESS_REMOVED", "SESSION_REVOKED", "PORTAL_SESSION_REVOKED"] } },
                    { category: "USER_MGMT", action: { in: ["ACCESS_REVOKED", "PORTAL_USER_DEACTIVATED", "USER_DEACTIVATED", "PORTAL_ACCESS_REMOVED", "GROUP_MEMBER_REMOVED", "GROUP_APP_REMOVED"] } },
                    { action: { in: ["ACCESS_REVOKED", "CREDENTIAL_DELETED", "PORTAL_ACCESS_REMOVED", "SESSION_REVOKED", "PORTAL_SESSION_REVOKED", "PORTAL_USER_DEACTIVATED"] } },
                ],
                createdAt: { gte: ninetyDaysAgo },
            },
            select: {
                id: true,
                action: true,
                category: true,
                actorType: true,
                actorName: true,
                actorEmail: true,
                entityId: true,
                entityType: true,
                appId: true,
                changes: true,
                createdAt: true,
                portalUser: { select: { id: true, name: true, nik: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
        });

        const historicalRevokes = historicalRevokesRaw.map((item) => {
            let details = item.action;
            let targetApp = item.appId ? appsMap.get(item.appId)?.name : null;

            if (item.changes) {
                try {
                    const parsed = typeof item.changes === "string" ? JSON.parse(item.changes) : item.changes;
                    if (parsed.appId && !targetApp) {
                        targetApp = appsMap.get(parsed.appId)?.name || parsed.appId;
                    }
                    if (parsed.label) {
                        details = `Label: "${parsed.label}"${targetApp ? ` (${targetApp})` : ""}`;
                    } else if (targetApp) {
                        details = `Aplikasi: ${targetApp}`;
                    } else if (parsed.reason) {
                        details = `Alasan: ${parsed.reason}`;
                    }
                } catch {
                    details = item.entityId || "-";
                }
            }

            let actionLabel = item.action;
            if (item.action === "ACCESS_REVOKED" || item.action === "PORTAL_ACCESS_REMOVED") actionLabel = "Pencabutan Hak Akses";
            else if (item.action === "CREDENTIAL_DELETED") actionLabel = "Penghapusan Kredensial";
            else if (item.action === "SESSION_REVOKED" || item.action === "PORTAL_SESSION_REVOKED") actionLabel = "Pembatalan Sesi Aktif";
            else if (item.action === "PORTAL_USER_DEACTIVATED" || item.action === "USER_DEACTIVATED") actionLabel = "Deaktivasi Akun User";
            else if (item.action === "GROUP_MEMBER_REMOVED") actionLabel = "Dikeluarkan dari Grup";

            return {
                id: item.id,
                action: item.action,
                actionLabel,
                category: item.category,
                actorName: item.actorName || item.actorEmail || (item.actorType === "SYSTEM" ? "Sistem" : "Admin"),
                portalUser: item.portalUser,
                details,
                targetApp,
                createdAt: item.createdAt,
            };
        });

        // 6. Downtime Incidents (Logs in last 90 days)
        const downtimeAuditLogs = await prisma.auditLog.findMany({
            where: {
                category: "SYSTEM",
                action: { in: ["APP_DOWNTIME_DETECTED", "APP_RECOVERED"] },
                createdAt: { gte: ninetyDaysAgo },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        const downtimeIncidents = downtimeAuditLogs.map((log) => {
            const changes = (log.changes as any) || {};
            const targetApp = log.appId ? appsMap.get(log.appId) : null;
            return {
                id: log.id,
                action: log.action,
                actionLabel: log.action === "APP_DOWNTIME_DETECTED" ? "Gangguan Server (Downtime)" : "Server Pulih Normal",
                severity: log.severity,
                appId: log.appId || changes.appId,
                appName: changes.appName || targetApp?.name || "Aplikasi",
                url: changes.url || targetApp?.url || "",
                statusCode: changes.statusCode ?? null,
                latencyMs: changes.latencyMs ?? null,
                errorMessage: changes.error || log.errorMessage || "-",
                createdAt: log.createdAt,
            };
        });

        const summary = {
            totalPortalUsers,
            totalApps: apps.length,
            totalSharedAccounts: sharedAccounts.length,
            totalDormantAccounts: dormantAccounts.length,
            totalHistoricalRevokes: historicalRevokes.length,
            totalSsoLaunches30d,
            totalOnlineApps: onlineApps.length,
            totalDegradedApps: degradedApps.length,
            totalOfflineApps: offlineApps.length,
            averageLatencyMs,
            globalUptimePercent,
        };

        return NextResponse.json({
            summary,
            trends,
            sharedAccounts,
            dormantAccounts,
            accessMatrix,
            historicalRevokes,
            downtimeIncidents,
            apps,
        });
    } catch (error) {
        console.error("Portal Audit Fetch Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

