export type AnnouncementStatusValue = "draft" | "scheduled" | "published" | "taken-down";

export function deriveAnnouncementStatus(input: {
  isPublished: boolean;
  scheduledAt?: Date | string | null;
  takedownAt?: Date | string | null;
}, now = new Date()): AnnouncementStatusValue {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const takedownAt = input.takedownAt ? new Date(input.takedownAt) : null;
  if (takedownAt && takedownAt <= now) return "taken-down";
  if (scheduledAt && scheduledAt > now) return "scheduled";
  if (input.isPublished) return "published";
  return "draft";
}
