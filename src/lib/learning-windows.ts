import type { LearningDatasetRole } from "@/lib/types";

export type LearningWindow = {
  role: LearningDatasetRole;
  startIso: string;
  endIso: string;
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function buildLearningWindows(referenceDate = new Date()): LearningWindow[] {
  const anchor = new Date(referenceDate.getTime());
  anchor.setUTCHours(0, 0, 0, 0);

  return [
    {
      role: "TRAIN",
      startIso: toIsoDate(shiftUtcDays(anchor, -730)),
      endIso: toIsoDate(shiftUtcDays(anchor, -181)),
    },
    {
      role: "TEST",
      startIso: toIsoDate(shiftUtcDays(anchor, -180)),
      endIso: toIsoDate(shiftUtcDays(anchor, -31)),
    },
    {
      role: "VALIDATION",
      startIso: toIsoDate(shiftUtcDays(anchor, -30)),
      endIso: toIsoDate(shiftUtcDays(anchor, -1)),
    },
  ];
}
