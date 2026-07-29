import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // 1. App Usage Trends
        const trendsRaw = await prisma.auditLog.groupBy({
            by: ['appId'],
            where: {
                action: 'SSO_LAUNCH',
                category: 'SECURITY',
                createdAt: { gte: thirtyDaysAgo },
                appId: { not: null }
            },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });

        const apps = await prisma.portalApp.findMany({ select: { id: true, name: true, logoPath: true } });
        const appsMap = new Map(apps.map(a => [a.id, a]));

        const trends = trendsRaw.map(t => ({
            appId: t.appId,
            appName: t.appId ? appsMap.get(t.appId)?.name || 'Unknown' : 'Unknown',
            launchCount: t._count.id
        }));

        // 2. Account Sharing Detection
        const credentials = await prisma.portalUserAppCredential.findMany({
            where: { appUsername: { not: null } },
            include: {
                portalUser: { select: { id: true, name: true, nik: true } },
                app: { select: { id: true, name: true } }
            }
        });

        // Group by appId + appUsername
        const sharingMap = new Map<string, { app: any, appUsername: string, users: any[] }>();
        for (const cred of credentials) {
            if (!cred.appUsername) continue;
            const key = `${cred.appId}_${cred.appUsername}`;
            if (!sharingMap.has(key)) {
                sharingMap.set(key, { app: cred.app, appUsername: cred.appUsername, users: [] });
            }
            sharingMap.get(key)!.users.push(cred.portalUser);
        }

        const sharedAccounts = Array.from(sharingMap.values())
            .filter(item => item.users.length > 1)
            .sort((a, b) => b.users.length - a.users.length);

        // 3. Dormant Accounts (Not used in 90 days)
        const dormantAccounts = await prisma.portalUserAppCredential.findMany({
            where: {
                OR: [
                    { lastUsedAt: { lt: ninetyDaysAgo } },
                    { lastUsedAt: null, createdAt: { lt: ninetyDaysAgo } }
                ]
            },
            include: {
                portalUser: { select: { name: true, nik: true } },
                app: { select: { name: true } }
            },
            orderBy: { lastUsedAt: 'asc' }
        });

        // 4. Access Matrix
        const usersAccess = await prisma.portalUser.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                nik: true,
                appAccess: { include: { app: { select: { id: true, name: true } } } },
                credentials: { select: { appId: true } }
            }
        });

        const accessMatrix = usersAccess.map(u => ({
            id: u.id,
            name: u.name,
            nik: u.nik,
            apps: u.appAccess.map(acc => ({
                appId: acc.app.id,
                appName: acc.app.name,
                hasCredential: u.credentials.some(c => c.appId === acc.app.id)
            }))
        }));

        // 5. Historical Access Review
        const historicalRevokes = await prisma.auditLog.findMany({
            where: {
                category: 'SECURITY',
                action: { in: ['CREDENTIAL_DELETED', 'PORTAL_ACCESS_REMOVED'] },
                createdAt: { gte: ninetyDaysAgo }
            },
            select: {
                id: true,
                action: true,
                entityId: true,
                changes: true,
                createdAt: true,
                portalUser: { select: { name: true, nik: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            trends,
            sharedAccounts,
            dormantAccounts,
            accessMatrix,
            historicalRevokes,
            apps // Pass apps list for table headers in matrix
        });
    } catch (error) {
        console.error("Portal Audit Fetch Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
