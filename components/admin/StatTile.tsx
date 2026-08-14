"use client";
import { CaretUp, CaretDown } from "@phosphor-icons/react";

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  delta?: number;                 // optional, percent or abs vs previous period
  deltaTone?: "success" | "danger";
}

export default function StatTile({ icon: Icon, label, value, delta, deltaTone = "success" }: StatTileProps) {
  const up = (delta ?? 0) >= 0;
  const shownTone = deltaTone === "danger" ? (up ? "danger" : "success") : up ? "success" : "danger";
  return (
    <div className="border-b border-border pb-4">
      <div className="flex items-center gap-2 text-text-3">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide">{label}</span>
      </div>
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-text-1">{Number(value).toLocaleString("id-ID")}</p>
      {typeof delta === "number" && (
        <p className={`mt-0.5 inline-flex items-center gap-1 font-mono text-xs tabular-nums ${shownTone === "danger" ? "text-danger" : "text-success"}`}>
          {up ? <CaretUp size={12} aria-hidden="true" /> : <CaretDown size={12} aria-hidden="true" />}
          {up ? "+" : ""}{delta}%
        </p>
      )}
    </div>
  );
}
