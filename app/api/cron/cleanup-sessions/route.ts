/**
 * Session Cleanup Cron Job
 * Deletes expired and inactive sessions
 * 
 * Scheduled to run daily at midnight via Vercel cron
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-sessions",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Delete expired sessions
        const result = await prisma.userSession.deleteMany({
            where: {
                OR: [
                    // Expired sessions
                    { expiresAt: { lt: new Date() } },
                    // Old sessions (older than 30 days)
                    {
                        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                    },
                ],
            },
        });

        console.log(`[SessionCleanup] Deleted ${result.count} expired/inactive sessions`);

        return NextResponse.json({
            success: true,
            deletedCount: result.count,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[SessionCleanup] Error:', error);
        return NextResponse.json(
            { error: 'Failed to cleanup sessions' },
            { status: 500 }
        );
    }
}
