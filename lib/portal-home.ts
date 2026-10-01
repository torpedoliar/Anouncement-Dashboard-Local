/**
 * Logika murni beranda portal (tanpa React/DB) — diuji scripts/test-portal-home.ts.
 * Satu app bisa muncul di beberapa grup, jadi semua pemilih di sini dedup per id.
 */

export type HealthBucket = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN";

export interface HomeApp {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    logoPath?: string | null;
    category?: string | null;
    groupName: string;
    credentialCount: number;
    healthStatus?: string | null;
    healthLatencyMs?: number | null;
    healthError?: string | null;
    /** ISO string — max(lastUsedAt) kredensial user untuk app ini. */
    lastUsedAt?: string | null;
}

export function greetingFor(hour: number): "Selamat pagi" | "Selamat siang" | "Selamat sore" | "Selamat malam" {
    if (hour >= 6 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
}

export function healthBucket(status: string | null | undefined): HealthBucket {
    return status === "ONLINE" || status === "DEGRADED" || status === "OFFLINE" ? status : "UNKNOWN";
}

function dedup(apps: HomeApp[]): HomeApp[] {
    const seen = new Set<string>();
    return apps.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

export function countHealth(apps: HomeApp[]): Record<HealthBucket, number> {
    const counts: Record<HealthBucket, number> = { ONLINE: 0, DEGRADED: 0, OFFLINE: 0, UNKNOWN: 0 };
    for (const a of dedup(apps)) counts[healthBucket(a.healthStatus)]++;
    return counts;
}

/** Favorit = app yang tampil DAN di-pin. Pin untuk app yang tak lagi accessible diabaikan. */
export function pickFavorites(apps: HomeApp[], pinnedIds: Set<string>): HomeApp[] {
    return dedup(apps).filter((a) => pinnedIds.has(a.id));
}

export function pickRecent(apps: HomeApp[], exclude: Set<string>, limit = 4): HomeApp[] {
    return dedup(apps)
        .filter((a) => a.lastUsedAt && !exclude.has(a.id))
        .sort((x, y) => (y.lastUsedAt! > x.lastUsedAt! ? 1 : y.lastUsedAt! < x.lastUsedAt! ? -1 : 0))
        .slice(0, limit);
}

/**
 * Skor: awal nama 100 > awal kata di nama 60 > substring nama 30 > kategori/grup 10.
 * Query kosong → [] (pemanggil menampilkan favorit + terakhir dipakai).
 */
export function rankApps(query: string, apps: HomeApp[]): HomeApp[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const score = (a: HomeApp): number => {
        const name = a.name.toLowerCase();
        if (name.startsWith(q)) return 100;
        if (name.split(/[\s\-_/.]+/).some((w) => w.startsWith(q))) return 60;
        if (name.includes(q)) return 30;
        if (`${a.category ?? ""} ${a.groupName}`.toLowerCase().includes(q)) return 10;
        return 0;
    };
    return dedup(apps)
        .map((a) => ({ a, s: score(a) }))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name))
        .map((x) => x.a);
}

// Palet ikon tanpa logo — semua lolos AA untuk huruf putih (≥ 4.5:1).
const ICON_COLORS = ["#1d4ed8", "#6d28d9", "#b45309", "#0e7490", "#047857", "#be185d", "#4338ca", "#475569", "#9333ea", "#c2410c"];

export function iconColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return ICON_COLORS[h % ICON_COLORS.length];
}

export function isPaletteShortcut(e: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    targetTag?: string;
    targetEditable?: boolean;
}): boolean {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return true;
    if (e.key !== "/" || e.ctrlKey || e.metaKey) return false;
    const tag = (e.targetTag ?? "").toUpperCase();
    return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !e.targetEditable;
}
