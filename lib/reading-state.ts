/**
 * Status baca per perangkat untuk situs publik (tanpa akun). Logika murni —
 * pembacaan/penulisan localStorage dilakukan komponen dalam try/catch.
 */

export const READ_LIMIT = 200;

export const readKey = (siteSlug: string) => `site:${siteSlug}:read`;
export const lastVisitKey = (siteSlug: string) => `site:${siteSlug}:lastVisit`;

export function parseReadList(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const v: unknown = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
        return [];
    }
}

export function pushRead(list: string[], id: string, limit = READ_LIMIT): string[] {
    const next = list.filter((x) => x !== id);
    next.push(id);
    return next.length > limit ? next.slice(next.length - limit) : next;
}

export function isNew(createdAtIso: string, lastVisitIso: string | null, read: string[], id: string): boolean {
    if (!lastVisitIso || read.includes(id)) return false;
    const created = Date.parse(createdAtIso);
    const last = Date.parse(lastVisitIso);
    return Number.isFinite(created) && Number.isFinite(last) && created > last;
}

export function countNew(items: { id: string; createdAt: string }[], lastVisitIso: string | null, read: string[]): number {
    return items.filter((i) => isNew(i.createdAt, lastVisitIso, read, i.id)).length;
}

export function editionLabel(hour: number): "Edisi Pagi" | "Edisi Malam" {
    return hour >= 6 && hour < 18 ? "Edisi Pagi" : "Edisi Malam";
}

export type TimeBucket = "today" | "week" | "older";
export const TIME_BUCKET_LABEL: Record<TimeBucket, string> = {
    today: "Hari ini",
    week: "Minggu ini",
    older: "Sebelumnya",
};

/** Tanggal kalender (YYYY-MM-DD) di zona waktu tertentu. */
function dayKey(iso: string, timeZone: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function timeBucket(createdAtIso: string, nowIso: string, timeZone = "Asia/Jakarta"): TimeBucket {
    if (dayKey(createdAtIso, timeZone) === dayKey(nowIso, timeZone)) return "today";
    const days = (Date.parse(nowIso) - Date.parse(createdAtIso)) / 86_400_000;
    return days < 7 ? "week" : "older";
}
