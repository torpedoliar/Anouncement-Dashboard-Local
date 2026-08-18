/**
 * Error Humanizer Utility for Santos Jaya Abadi Dashboard
 * Mengubah pesan error teknis, kode status HTTP, dan error database menjadi
 * kalimat Bahasa Indonesia yang ramah, jelas, dan mudah dipahami oleh pengguna.
 */

export interface ErrorMapOptions {
    fallback?: string;
    action?: string; // misal: "menyimpan pengumuman", "menghapus kategori"
}

// Kamus pesan status HTTP
const HTTP_STATUS_MESSAGES: Record<number, string> = {
    400: "Data yang dikirimkan kurang lengkap atau formatnya tidak sesuai.",
    401: "Sesi login Anda telah berakhir. Silakan masuk kembali.",
    403: "Anda tidak memiliki hak akses untuk melakukan tindakan ini.",
    404: "Data atau halaman yang Anda cari tidak ditemukan.",
    408: "Waktu permintaan habis. Mohon periksa koneksi internet Anda.",
    409: "Data ini sudah digunakan atau mengalami konflik dengan data yang ada.",
    413: "Ukuran file atau data terlalu besar. Harap perkecil ukuran file Anda.",
    422: "Format isian belum valid. Mohon periksa kembali formulir Anda.",
    429: "Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu beberapa detik.",
    500: "Terjadi gangguan pada server internal. Silakan coba beberapa saat lagi.",
    502: "Server sedang tidak dapat dijangkau. Mohon tunggu sebentar.",
    503: "Layanan sedang dalam pemeliharaan berkala. Silakan coba beberapa saat lagi.",
    504: "Koneksi ke server terputus karena batas waktu terlampaui.",
};

// Pola kata kunci teknis -> Kalimat ramah
const PATTERN_MESSAGES: Array<{ pattern: RegExp | string; message: string }> = [
    {
        pattern: /failed to fetch|network\s?error|fetch failed|econnrefused/i,
        message: "Gagal terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.",
    },
    {
        pattern: /unique constraint|p2002|already exists|duplicate key/i,
        message: "Data dengan nama atau kode ini sudah terdaftar. Silakan gunakan yang lain.",
    },
    {
        pattern: /record to (update|delete) not found|p2025/i,
        message: "Data yang ingin diperbarui atau dihapus sudah tidak tersedia.",
    },
    {
        pattern: /foreign key constraint|p2003/i,
        message: "Data ini tidak dapat diproses karena masih terhubung dengan data lain.",
    },
    {
        pattern: /invalid (credentials|email or password)|credentialssignin/i,
        message: "Email atau kata sandi yang Anda masukkan tidak sesuai.",
    },
    {
        pattern: /session (expired|revoked|invalid)|jwt (expired|malformed)/i,
        message: "Sesi aktif Anda telah selesai. Silakan login kembali untuk melanjutkan.",
    },
    {
        pattern: /payload too large|request entity too large/i,
        message: "Ukuran berkas melebihi batas maksimal yang diperbolehkan.",
    },
    {
        pattern: /unauthorized/i,
        message: "Akses ditolak. Silakan login dengan akun yang memiliki wewenang.",
    },
    {
        pattern: /forbidden/i,
        message: "Anda tidak diizinkan mengakses fitur ini.",
    },
    {
        pattern: /timeout|timed out/i,
        message: "Proses memakan waktu terlalu lama. Silakan coba kembali.",
    },
    {
        pattern: /aborted/i,
        message: "Permintaan dibatalkan.",
    },
];

/**
 * Menerjemahkan segala bentuk error menjadi pesan ramah dalam Bahasa Indonesia
 */
export function humanizeError(error: unknown, options?: ErrorMapOptions | string): string {
    const opts: ErrorMapOptions = typeof options === "string" ? { fallback: options } : (options || {});
    const fallback = opts.fallback || "Terjadi kendala yang tidak terduga. Silakan coba lagi.";

    if (!error) return fallback;

    // 1. Jika error adalah string sederhana
    if (typeof error === "string") {
        const trimmed = error.trim();
        for (const item of PATTERN_MESSAGES) {
            if (typeof item.pattern === "string" ? trimmed.toLowerCase().includes(item.pattern.toLowerCase()) : item.pattern.test(trimmed)) {
                return item.message;
            }
        }
        return trimmed.length > 0 ? trimmed : fallback;
    }

    // 2. Jika error memiliki status HTTP (misal custom error object atau Axios/Fetch response)
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.status === "number" && HTTP_STATUS_MESSAGES[errObj.status]) {
        return HTTP_STATUS_MESSAGES[errObj.status];
    }

    // 3. Jika error membawa message teknis
    const rawMessage =
        (typeof errObj.message === "string" && errObj.message) ||
        (typeof errObj.error === "string" && errObj.error) ||
        (typeof errObj.detail === "string" && errObj.detail) ||
        "";

    if (rawMessage) {
        for (const item of PATTERN_MESSAGES) {
            if (typeof item.pattern === "string" ? rawMessage.toLowerCase().includes(item.pattern.toLowerCase()) : item.pattern.test(rawMessage)) {
                return item.message;
            }
        }
        // Jika pesan sudah berupa kalimat bahasa Indonesia yang rapi (tidak mengandung kata teknis mencolok)
        if (!/^[a-zA-Z0-9_]+Error:/.test(rawMessage) && !/prisma|sql|jwt|postgres|syntax/i.test(rawMessage)) {
            return rawMessage;
        }
    }

    // 4. Jika format zod validation error array
    if (Array.isArray(errObj.errors) && errObj.errors.length > 0) {
        const firstErr = errObj.errors[0];
        if (typeof firstErr === "object" && firstErr && "message" in firstErr) {
            return String(firstErr.message);
        }
    }

    if (opts.action) {
        return `Gagal saat ${opts.action}. ${fallback}`;
    }

    return fallback;
}

/**
 * Helper untuk menangani Response dari `fetch()` secara aman
 */
export async function parseApiResponseError(response: Response, defaultMessage?: string): Promise<string> {
    const status = response.status;

    try {
        const data = await response.json();
        if (data) {
            if (data.message && typeof data.message === "string") {
                return humanizeError(data.message);
            }
            if (data.error && typeof data.error === "string") {
                return humanizeError(data.error);
            }
        }
    } catch {
        // Body bukan JSON, gunakan status code
    }

    if (HTTP_STATUS_MESSAGES[status]) {
        return HTTP_STATUS_MESSAGES[status];
    }

    return defaultMessage || `Terjadi kesalahan (Kode: ${status}). Silakan coba lagi.`;
}
