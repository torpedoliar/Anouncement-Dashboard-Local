import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectLoginFields } from "@/lib/portal-login-detect";

const MAX_BODY = 64 * 1024; // 64KB cap

// SSRF harden dasar — tolak host internal/link-local
function isBlockedHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".localhost")) return true;
    // IPv4 privat / loopback / link-local / multicast
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (ipv4) {
        const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true;
        if (a >= 224) return true; // multicast/unspecified
    }
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
        throw new FetchError("URL harus http/https", 400);
    }
    if (isBlockedHost(parsed.hostname)) {
        throw new FetchError("Host tidak diizinkan", 400);
    }

    let res: Response;
    try {
        res = await fetch(url, {
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
            headers: { "user-agent": "PortalDetect/1.0", accept: "text/html,application/xhtml+xml" },
            cache: "no-store",
        });
    } catch (err) {
        const timedOut = err instanceof Error && err.name === "TimeoutError";
        throw new FetchError(timedOut ? "Waktu pengambilan habis" : "Gagal mengakses halaman login", 422);
    }

    if (!res.ok) throw new FetchError(`Halaman login mengembalikan HTTP ${res.status}`, 422);
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml")) {
        throw new FetchError("Respons bukan halaman HTML", 422);
    }

    // Cap body 64KB — hindari res.text() penuh
    const reader = res.body?.getReader();
    if (!reader) {
        const text = await res.text();
        return text.substring(0, MAX_BODY);
    }
    const buffer = new Uint8Array(MAX_BODY);
    let offset = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value ?? new Uint8Array(0);
        const remaining = MAX_BODY - offset;
        if (chunk.length >= remaining) {
            buffer.set(chunk.subarray(0, remaining), offset);
            offset += remaining;
            break;
        }
        buffer.set(chunk, offset);
        offset += chunk.length;
    }
    return new TextDecoder().decode(buffer.subarray(0, offset));
}

// POST /api/portal-apps/detect-fields — SuperAdmin only. Body { url }
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const url = body?.url;
        if (typeof url !== "string" || url.length > 500) {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
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
