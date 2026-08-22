export interface VerifySlot {
    count: number;
    resetAt: number;
}

/**
 * Rate limit percobaan uji login per admin (in-memory; reset saat server restart).
 * Mencegah endpoint verify-login dipakai sebagai alat menebak password.
 */
export function checkVerifyLimit(
    store: Map<string, VerifySlot>,
    key: string,
    max: number,
    windowMs: number,
    now = Date.now()
): { allowed: boolean; remaining: number } {
    const slot = store.get(key);
    if (!slot || now >= slot.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1 };
    }
    if (slot.count >= max) return { allowed: false, remaining: 0 };
    slot.count++;
    return { allowed: true, remaining: max - slot.count };
}