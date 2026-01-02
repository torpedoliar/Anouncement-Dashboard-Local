import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiting (resets on server restart)
const rateLimit = new Map<string, { count: number; timestamp: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimit.entries()) {
        if (now - value.timestamp > 60000) {
            rateLimit.delete(key);
        }
    }
}, 300000);

export function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const path = request.nextUrl.pathname;

    // Add security headers to all responses
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Rate limiting for API routes
    if (path.startsWith('/api/')) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const now = Date.now();
        const windowMs = 60000; // 1 minute window

        // Different limits for different endpoints
        let maxRequests = 300; // Default: 300 req/min
        if (path.includes('/auth') || path.includes('/login')) {
            maxRequests = 10; // Auth: 10 req/min (prevent brute force)
        } else if (path.includes('/backup')) {
            maxRequests = 5; // Backup: 5 req/min
        } else if (path.startsWith('/api/announcements') || path.startsWith('/api/settings')) {
            maxRequests = 1000; // Public read endpoints: 1000 req/min
        }

        const key = `${ip}:${path.split('/')[2]}`; // Group by IP and first path segment
        const current = rateLimit.get(key);

        if (current && now - current.timestamp < windowMs) {
            if (current.count >= maxRequests) {
                return NextResponse.json(
                    { error: 'Too many requests. Please try again later.' },
                    { status: 429 }
                );
            }
            current.count++;
        } else {
            rateLimit.set(key, { count: 1, timestamp: now });
        }
    }

    return response;
}

// Configure which paths the middleware applies to
export const config = {
    matcher: [
        '/api/:path*',
        '/admin/:path*',
    ],
};
