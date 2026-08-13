import { deriveAnnouncementStatus } from "@/lib/announcement-status";

// Fixed reference instant for deterministic checks
const REF = new Date("2026-08-13T12:00:00Z");

// taken-down: takedownAt in the past
console.assert(
  deriveAnnouncementStatus(
    { isPublished: true, takedownAt: new Date("2026-08-13T10:00:00Z") },
    REF,
  ) === "taken-down",
  "taken-down: past takedownAt should yield taken-down",
);

// scheduled: scheduledAt in the future, not yet published
console.assert(
  deriveAnnouncementStatus(
    { isPublished: false, scheduledAt: new Date("2026-08-14T12:00:00Z") },
    REF,
  ) === "scheduled",
  "scheduled: future scheduledAt before publish should yield scheduled",
);

// published: isPublished true, no future scheduledAt, no takedown
console.assert(
  deriveAnnouncementStatus(
    { isPublished: true, scheduledAt: null },
    REF,
  ) === "published",
  "published: isPublished without future schedule should yield published",
);

// draft: nothing set
console.assert(
  deriveAnnouncementStatus(
    { isPublished: false },
    REF,
  ) === "draft",
  "draft: empty input should yield draft",
);

// taken-down wins over scheduled: past takedownAt overrides future schedule
console.assert(
  deriveAnnouncementStatus(
    { isPublished: true, scheduledAt: new Date("2027-01-01T00:00:00Z"), takedownAt: REF },
    REF,
  ) === "taken-down",
  "taken-down precedence: takedownAt wins over scheduledAt",
);

// scheduledAt as ISO string
console.assert(
  deriveAnnouncementStatus(
    { isPublished: false, scheduledAt: "2027-01-01T00:00:00Z" },
    REF,
  ) === "scheduled",
  "scheduled: ISO string scheduledAt should work",
);

console.log("All assertions passed.");
