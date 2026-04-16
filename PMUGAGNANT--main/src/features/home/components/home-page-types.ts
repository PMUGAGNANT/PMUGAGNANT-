import type { BoardSectionKey, FeaturedRace } from "@/features/home/lib/home-page-model";

export type HomeStats = {
  total: number;
  meetings: number;
  playable: number;
  active: number;
};

export type HomeLane = {
  key: BoardSectionKey;
  items: FeaturedRace[];
};

export type QuickFilter = "all" | "top3" | "jouable" | "urgent" | "quinte" | "allocation";

export type QuickFilterOption = {
  value: QuickFilter;
  label: string;
  description: string;
  count: number;
};

export const QUICK_FILTER_STORAGE_KEY = "pmu-quick-filter";
export const URGENT_MINUTES_LIMIT = 45;
export const BIG_ALLOCATION_LIMIT = 50000;

export function isQuickFilter(value: string | null): value is QuickFilter {
  return (
    value === "all" ||
    value === "top3" ||
    value === "jouable" ||
    value === "urgent" ||
    value === "quinte" ||
    value === "allocation"
  );
}
