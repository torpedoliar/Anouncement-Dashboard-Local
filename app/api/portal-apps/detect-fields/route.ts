import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectLoginFields } from "@/lib/portal-login-detect";

import https from "https";

// SSRF harden: cegah target non-routable / AWS/GCP metadata service
function isBlockedHost(hostname: string): boolean {
    const h = hostname.toLowerCase().trim();
    if (h === "0.0.0.0" || h === "169.254.169.254" || h === "metadata.google.internal") return true;
    return false;
}

class FetchError extends Error {
    constructor(
        message: string,
        public status: number
    ) {
        super(message);
    }
}

async function fetchHtml(url: string): Promise<string> {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new FetchError("URL harus menggunakan http:// atau https://", 400);
    }
    if (isBlockedHost(parsed.hostname)) {
        throw new FetchError("Host tidak diizinkan", 400);
    }

    try {
        const res = await fetch(url, {
            redirect: "follow",
            signal: AbortSignal.timeout(10000),
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PortalDetect/1.0",
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            cache: "no-store",
        });

        if (!res.ok) throw new FetchError(`Halaman login mengembalikan HTTP ${res.status} (${res.statusText})`, 422);
        const ct = res.headers.get("content-type") ?? "";
        if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml") && !ct.includes("text/plain")) {
            throw new FetchError("Respons bukan halaman web / HTML", 422);
        }

        const text = await res.text();
        return text.substring(0, 512 * 1024); // 512KB cap
    } catch (err: unknown) {
        // Fallback for internal corporate HTTPS with self-signed / private CA certs
        if (parsed.protocol === "https:") {
            try {
                return await new Promise<string>((resolve, reject) => {
                    const req = https.get(url, {
                        rejectUnauthorized: false,
                        timeout: 10000,
                        headers: {
                            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PortalDetect/1.0",
                            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        },
                    }, (res) => {
                        if (res.statusCode && res.statusCode >= 400) {
                            return reject(new FetchError(`Halaman login mengembalikan HTTP ${res.statusCode}`, 422));
                        }
                        let data = "";
                        res.setEncoding("utf8");
                        res.on("data", (chunk) => {
                            data += chunk;
                            if (data.length > 512 * 1024) req.destroy();
                        });
                        res.on("end", () => resolve(data.substring(0, 512 * 1024)));
                    });
                    req.on("error", (e) => reject(new FetchError(`Gagal mengakses target URL (${e.message})`, 422)));
                    req.on("timeout", () => {
                        req.destroy();
                        reject(new FetchError("Waktu pengambilan halaman habis (timeout)", 422));
                    });
                });
            } catch (fallbackErr: unknown) {
                if (fallbackErr instanceof FetchError) throw fallbackErr;
            }
        }

        const timedOut = err instanceof Error && err.name === "TimeoutError";
        const msg = err instanceof Error ? err.message : "Gagal mengakses halaman login";
        throw new FetchError(timedOut ? "Waktu pengambilan halaman habis (timeout)" : `Gagal mengakses target URL (${msg})`, 422);
    }
}

// POST /api/portal-apps/detect-fields — SuperAdmin & ADMIN. Body { url }
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const url = body?.url;
        if (typeof url !== "string" || url.length > 500) {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        let parsed: URL;
        try {
            parsed = new URL(url.trim());
        } catch {
            return NextResponse.json({ error: "Format URL tidak valid" }, { status: 400 });
        }

        const html = await fetchHtml(parsed.href);
        const result = detectLoginFields(html);
        if (!result.passwordField) {
            return NextResponse.json(
                { error: "Tidak ditemukan form login (input password) di halaman tersebut" },
                { status: 422 }
            );
        }
        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof FetchError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        console.error("POST /api/portal-apps/detect-fields:", err);
        return NextResponse.json({ error: "Gagal mengambil halaman login" }, { status: 422 });
    }
}
