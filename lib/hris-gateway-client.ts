import prisma from "@/lib/prisma";
import { decryptCredential } from "@/lib/portal-crypto";

// ============================================================================
// HRIS Gateway client (TASK-29)
// Konsumsi REST API gateway HRIS (10.10.6.51:27080) per riset Kevin (TASK-27):
//   GET  /ping         →  { status: "ok" }
//   POST /auth/lookup  →  { valid, eligible, nama_karyawan, email, nik_hris, nik_santos }
//   POST /auth/verify  →  { valid, match }
// Pola: native fetch + timeout 10s + retry exponential backoff utk 5xx (max 3).
// JANGAN pernah log apiKey / password / NIK penuh (mask NIK).
// ============================================================================

export interface HrisLookupResult {
    valid: boolean;
    eligible: boolean;
    namaKaryawan?: string;
    email?: string;
    nikHris?: string;
    nikSantos?: string;
}

export interface HrisVerifyResult {
    valid: boolean;
    match: boolean;
}

export class HrisGatewayError extends Error {
    constructor(
        message: string,
        public status?: number,
        public code?: "TIMEOUT" | "NETWORK" | "HTTP" | "CONFIG"
    ) {
        super(message);
        this.name = "HrisGatewayError";
    }
}

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1_000, 2_000, 4_000]; // exponential backoff
const MAX_RATE_PER_MIN = 10; // throttle — jangan overload gateway (riset Kevin)

let rateWindowStart = 0;
let rateCount = 0;

/** Opsi request opsional (untuk mode bulk sync yang perlu lewati throttle module). */
export interface HrisRequestOptions {
    /** Skip throttle client-side (dipakai sync batch; caller mengatur delay sendiri). */
    throttle?: boolean;
}

/** Throttle client-side: max N request per menit per proses. */
function throttleCheck(throttle: boolean): void {
    if (!throttle) return;
    const now = Date.now();
    if (now - rateWindowStart >= 60_000) {
        rateWindowStart = now;
        rateCount = 0;
    }
    if (rateCount >= MAX_RATE_PER_MIN) {
        throw new HrisGatewayError(
            `Rate limit: maksimal ${MAX_RATE_PER_MIN} request per menit`,
            undefined,
            "NETWORK"
        );
    }
    rateCount++;
}

/** Ambil config HrisGatewayConfig dari DB + dekripsi apiKey. Throws HrisGatewayError("CONFIG"). */
async function getConfig(): Promise<{ baseUrl: string; apiKey: string }> {
    const cfg = await prisma.hrisGatewayConfig.findFirst();
    if (!cfg || !cfg.baseUrl || !cfg.apiKeyEncrypted) {
        throw new HrisGatewayError("Konfigurasi gateway HRIS belum disetel", undefined, "CONFIG");
    }
    let apiKey: string;
    try {
        // Config disimpan via encryptCredential (blob JSON) — decryptCredential yang benar (fix TASK-29b CRITICAL).
        apiKey = decryptCredential(cfg.apiKeyEncrypted).password;
    } catch {
        throw new HrisGatewayError("Gagal mendekripsi API key gateway HRIS", undefined, "CONFIG");
    }
    return { baseUrl: cfg.baseUrl.replace(/\/+$/, ""), apiKey };
}

/**
 * Mulai request ke Gateway HRIS dengan timeout + retry 5xx/network (exponential backoff).
 * Tidak pernah melempar kecuali gagal setelah retry; caller menangani HrisGatewayError.
 */
async function request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    opts: HrisRequestOptions = {}
): Promise<unknown> {
    const { baseUrl, apiKey } = await getConfig();
    throttleCheck(opts.throttle !== false);

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
        }
        try {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    "X-API-Key": apiKey,
                    "Content-Type": "application/json",
                },
                body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(TIMEOUT_MS),
                cache: "no-store",
            });

            if (res.status >= 500 || res.status === 0) {
                // Transient — retry
                throw new HrisGatewayError(`HTTP ${res.status}`, res.status, "HTTP");
            }
            if (!res.ok) {
                // 4xx / 404 — no retry (client error)
                throw new HrisGatewayError(`HTTP ${res.status}`, res.status, "HTTP");
            }
            // Deteksi response HTML (bukan JSON). Terjadi saat baseUrl menunjuk root
            // web app (mis. /api/v1 terlupa) — server balas SPA index.html 200.
            const contentType = res.headers.get("content-type") ?? "";
            if (contentType.includes("text/html")) {
                throw new HrisGatewayError(
                    "Gateway merespons HTML, bukan JSON. Periksa Base URL — kemungkinan butuh path API (mis. /api/v1).",
                    res.status,
                    "CONFIG",
                );
            }
            try {
                return await res.json();
            } catch {
                // res.json() gagal walau content-type bukan text/html (mis. body kosong / teks).
                throw new HrisGatewayError(
                    "Respons gateway bukan JSON valid. Periksa Base URL & endpoint.",
                    res.status,
                    "CONFIG",
                );
            }
        } catch (err: unknown) {
            // Timeout / network — retry juga (transient)
            if (err instanceof HrisGatewayError && err.status && err.status >= 500) {
                lastError = err;
                continue;
            }
            if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
                lastError = new HrisGatewayError("Waktu gateway HRIS habis (timeout)", undefined, "TIMEOUT");
                continue;
            }
            if (err instanceof HrisGatewayError) throw err; // 4xx/config — no retry
            lastError = err;
        }
    }
    throw new HrisGatewayError(
        lastError instanceof Error ? lastError.message : "Gagal menghubungi gateway HRIS",
        lastError instanceof HrisGatewayError ? lastError.status : undefined,
        "NETWORK"
    );
}

/** GET /ping — konektivitas gateway. */
export async function pingGateway(opts: HrisRequestOptions = {}): Promise<{ ok: boolean; status: string }> {
    const result = (await request("GET", "/ping", undefined, opts)) as { status?: string };
    return { ok: result?.status === "ok", status: result?.status ?? "unknown" };
}

/** POST /auth/lookup { nik } — cek validitas+eligible NIK; tidak pernah log NIK utuh. */
export async function lookupNIK(nik: string, opts: HrisRequestOptions = {}): Promise<HrisLookupResult> {
    const result = (await request("POST", "/auth/lookup", { nik }, opts)) as Record<string, unknown>;
    return {
        valid: Boolean(result?.valid),
        eligible: Boolean(result?.eligible ?? result?.valid),
        namaKaryawan: typeof result?.nama_karyawan === "string" ? result.nama_karyawan : undefined,
        email: typeof result?.email === "string" ? result.email : undefined,
        nikHris: typeof result?.nik_hris === "string" ? result.nik_hris : undefined,
        nikSantos: typeof result?.nik_santos === "string" ? result.nik_santos : undefined,
    };
}

/** POST /auth/verify — verifikasi password (NOT idempotent; hati-hati lockout HRIS). */
export async function verifyPass(nik: string, password: string, opts: HrisRequestOptions = {}): Promise<HrisVerifyResult> {
    const result = (await request("POST", "/auth/verify", { nik, password }, opts)) as Record<string, unknown>;
    return {
        valid: Boolean(result?.valid),
        match: Boolean(result?.match),
    };
}