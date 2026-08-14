"use client";
/* Recharts <Tooltip content={<ChartTooltip />} /> — styled to the shell, mono values. */
export default function ChartTooltip({ active, payload, label, valueFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sheet border border-border bg-surface-1 px-3 py-2 shadow-lvl-2">
      {label != null && <p className="mb-1 text-xs text-text-3">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-mono text-sm tabular-nums text-text-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.payload?.fill }} aria-hidden="true" />
          <span className="text-text-3">{p.name}:</span>
          {(valueFormatter ? valueFormatter(p.value) : p.value?.toLocaleString("id-ID"))}
        </p>
      ))}
    </div>
  );
}
