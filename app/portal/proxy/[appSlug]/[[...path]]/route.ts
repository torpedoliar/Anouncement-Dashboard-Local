import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/portal-crypto";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, { params }: { params: Promise<{ appSlug: string; path?: string[] }> }) {
    // ponytail: Oracle uses self-signed certs, ignore TLS errors in proxy
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const { appSlug } = await params;
    
    try {
        const cookieStore = await cookies();
        const encryptedCookies = cookieStore.get(`portal_proxy_${appSlug}`);
        
        if (!encryptedCookies?.value) {
            return new NextResponse("Unauthorized or Session Expired", { status: 401 });
        }

        const targetCookies = decrypt(encryptedCookies.value);

        const app = await prisma.portalApp.findUnique({
            where: { slug: appSlug },
            select: { url: true, isActive: true, ssoMode: true }
        });

        if (!app || !app.isActive || app.ssoMode !== "REROUTE") {
            return new NextResponse("App not found or not in REROUTE mode", { status: 404 });
        }

        const targetOrigin = new URL(app.url).origin;

        const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const reqProto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
        const baseUrl = reqHost ? `${reqProto}://${reqHost}` : new URL(request.url).origin;
        
        // request.nextUrl.pathname will be /portal/proxy/appSlug or /portal/proxy/appSlug/OA_HTML/...
        const basePath = `/portal/proxy/${appSlug}`;
        let targetPath = request.nextUrl.pathname;
        if (targetPath.startsWith(basePath)) {
            targetPath = targetPath.substring(basePath.length);
        }
        if (!targetPath.startsWith("/")) {
            targetPath = "/" + targetPath;
        }
        
        const targetUrl = new URL(targetPath, targetOrigin);
        targetUrl.search = request.nextUrl.search;

        const headers = new Headers();
        
        // Copy original headers but skip problematic ones
        request.headers.forEach((val, key) => {
            const k = key.toLowerCase();
            if (!["host", "connection", "origin", "referer", "cookie", "accept-encoding", "content-length"].includes(k)) {
                headers.set(key, val);
            }
        });

        // ponytail: Do not manually set "Host", Node fetch/undici handles it and setting it manually can hang.
        headers.set("Origin", targetOrigin);
        headers.set("Referer", targetUrl.href);
        headers.set("Cookie", targetCookies);
        
        // Forward request
        const fetchOptions: RequestInit = {
            method: request.method,
            headers,
            redirect: "manual",
        };

        if (request.method !== "GET" && request.method !== "HEAD") {
            fetchOptions.body = await request.arrayBuffer();
        }

        const fetchRes = await fetch(targetUrl.toString(), fetchOptions);
        
        const responseHeaders = new Headers();
        fetchRes.headers.forEach((val, key) => {
            if (key.toLowerCase() !== 'content-encoding') {
                responseHeaders.set(key, val);
            }
        });

        let body: ArrayBuffer | string = await fetchRes.arrayBuffer();
        const contentType = fetchRes.headers.get("content-type") || "";

        // Rewrite absolute & root-relative URLs in text responses
        if (contentType.includes("text/") || contentType.includes("application/javascript") || contentType.includes("application/json") || contentType.includes("application/xml")) {
            let text = new TextDecoder("utf-8").decode(body);
            const proxyOrigin = `${baseUrl}/portal/proxy/${appSlug}`;
            
            // 1. Rewrite absolute origin URLs anywhere in the text
            text = text.replaceAll(targetOrigin, proxyOrigin);

            // 2. HTML specific rewrites
            if (contentType.includes("text/html")) {
                // Rewrite root-relative URLs in standard HTML attributes
                text = text.replace(/(href|src|action|data-url)=(["'])\/(?!\/|portal\/)/gi, `$1=$2/portal/proxy/${appSlug}/`);
                
                // Inject AJAX Interceptor (XMLHttpRequest & fetch) to catch relative API calls
                const interceptorScript = `
<script>
(function() {
    var proxyPath = "/portal/proxy/${appSlug}";
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.indexOf('/') === 0 && url.indexOf(proxyPath) !== 0) {
            url = proxyPath + url;
        }
        return open.apply(this, arguments);
    };
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === 'string' && input.indexOf('/') === 0 && input.indexOf(proxyPath) !== 0) {
            input = proxyPath + input;
        }
        return origFetch(input, init);
    };
})();
</script>
`;
                // Inject right after <head> or at the beginning of HTML if <head> is missing
                if (text.toLowerCase().includes("<head>")) {
                    text = text.replace(/<head>/i, `<head>${interceptorScript}`);
                } else {
                    text = interceptorScript + text;
                }
            }

            body = text;
            responseHeaders.set("content-length", new TextEncoder().encode(text).length.toString());
        }

        // Handle redirects from target
        if ([301, 302, 303, 307, 308].includes(fetchRes.status)) {
            const location = fetchRes.headers.get("location");
            if (location) {
                if (location.startsWith(targetOrigin)) {
                    const rewrittenLoc = location.replace(targetOrigin, `${baseUrl}/portal/proxy/${appSlug}`);
                    responseHeaders.set("location", rewrittenLoc);
                } else if (location.startsWith("/")) {
                    responseHeaders.set("location", `/portal/proxy/${appSlug}${location}`);
                }
            }
        }

        return new NextResponse(body, {
            status: fetchRes.status,
            headers: responseHeaders,
        });

    } catch (err) {
        console.error("Proxy error:", err);
        return new NextResponse("Internal Proxy Error", { status: 500 });
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
export const OPTIONS = proxy;
