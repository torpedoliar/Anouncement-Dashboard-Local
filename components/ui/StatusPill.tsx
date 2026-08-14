"use client";

import { ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import { PencilSimple, Clock, Broadcast, Square, Flag } from "@phosphor-icons/react";
import type { AnnouncementStatusValue } from "@/lib/announcement-status";

export type AnnouncementStatus =
  | AnnouncementStatusValue
  | "pending-approval";

const STATUS_META: Record<AnnouncementStatus, { tone: BadgeTone; label: string; icon: ReactNode }> = {
  draft: { tone: "neutral", label: "Draf", icon: <PencilSimple size={12} /> },
  scheduled: { tone: "warning", label: "Terjadwal", icon: <Clock size={12} /> },
  published: { tone: "success", label: "Terbit", icon: <Broadcast size={12} /> },
  "taken-down": { tone: "neutral", label: "Diturunkan", icon: <Square size={12} /> },
  "pending-approval": { tone: "info", label: "Perlu Persetujuan", icon: <Flag size={12} /> },
};

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export default function StatusPill({
  status,
  label,
}: {
  status: AnnouncementStatus;
  label?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} title={label ?? meta.label}>
      {meta.icon}
      {label ?? meta.label}
    </Badge>
  );
}