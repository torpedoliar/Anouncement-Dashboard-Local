/**
 * Skeleton loading generik — dipakai file loading.tsx per-route.
 * Pola baris tabel/kartu dengan animate-pulse; token-native, ikut tema.
 */
export default function ListSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="space-y-3 p-1" aria-hidden="true">
            {Array.from({ length: rows }, (_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 rounded-card border border-border bg-surface-1 px-4 py-3"
                    style={{ animationDelay: `${i * 40}ms` }}
                >
                    <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2 animate-pulse" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-1/3 rounded bg-surface-2 animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-surface-2 animate-pulse" />
                    </div>
                    <div className="hidden h-6 w-20 rounded-full bg-surface-2 sm:block animate-pulse" />
                </div>
            ))}
        </div>
    );
}
