"use client";
/* Recharts <Tooltip content={<ChartTooltip />} /> — styled to the shell, mono values. */

// Bentuk minimal yang dipakai Recharts v2 saat memanggil custom tooltip content.
interface TooltipEntry {
    dataKey?: string | number;
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: {
        fill?: string;
        primaryColor?: string;
    };
}

interface ChartTooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string | number;
    valueFormatter?: (value: number | string) => React.ReactNode;
}

export default function ChartTooltip({ active, payload, label, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sheet border border-border bg-surface-1 px-3 py-2 shadow-lvl-2">
      {label != null && <p className="mb-1 text-xs text-text-3">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-mono text-sm tabular-nums text-text-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.payload?.fill || p.payload?.primaryColor }} aria-hidden="true" />
          <span className="text-text-3">{p.name}:</span>
          {(valueFormatter ? valueFormatter(p.value ?? "") : (p.value as number)?.toLocaleString("id-ID"))}
        </p>
      ))}
    </div>
  );
}
