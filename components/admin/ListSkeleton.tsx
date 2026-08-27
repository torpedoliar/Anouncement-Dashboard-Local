/**
 * Skeleton loading generik — dipakai file loading.tsx per-route.
 * Shimmer effect dengan staggered timing; token-native, ikut tema.
 */
export default function ListSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="space-y-3 p-1" aria-hidden="true">
            {Array.from({ length: rows }, (_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 rounded-card border border-border bg-surface-1 px-4 py-3 shimmer-skeleton"
                >
                    <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2 shimmer-delay-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-1/3 rounded bg-surface-2 shimmer-delay-1" />
                        <div className="h-3 w-2/3 rounded bg-surface-2 shimmer-delay-2" />
                    </div>
                    <div className="hidden h-6 w-20 rounded-full bg-surface-2 sm:block shimmer-delay-3" />
                </div>
            ))}
        </div>
    );
}
