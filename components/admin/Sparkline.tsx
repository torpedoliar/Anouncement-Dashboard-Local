/**
 * Sparkline — grafik garis mini SVG murni (server component, tanpa JS).
 * Dipakai status strip dashboard. Recharts sengaja TIDAK dipakai di sini:
 * untuk polyline 14 titik, satu <svg> jauh lebih ringan dari chart library.
 */
export default function Sparkline({
    points,
    className = "",
}: {
    points: number[];
    className?: string;
}) {
    if (points.length < 2) return null;

    const w = 96;
    const h = 28;
    const max = Math.max(...points, 1);
    const step = w / (points.length - 1);
    const coords = points
        .map((p, i) => `${(i * step).toFixed(1)},${(h - (p / max) * (h - 4) - 2).toFixed(1)}`)
        .join(" ");

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className={className}
            aria-hidden="true"
        >
            <polygon
                points={`0,${h} ${coords} ${w},${h}`}
                fill="var(--site-primary-alpha, rgba(237, 28, 36, 0.1))"
            />
            <polyline
                points={coords}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
