"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createLiveStatsSnapshot,
  EMPTY_LIVE_STATS,
  type LiveStatsSnapshot,
} from "@/lib/live-stats";

const LIVE_STATS_REFRESH_MS = 5 * 60 * 1000;

type UseLiveStatsResult = {
  data: LiveStatsSnapshot;
  isLoading: boolean;
  isRefreshing: boolean;
  retry: () => Promise<void>;
};

export function useLiveStats(): UseLiveStatsResult {
  const [data, setData] = useState<LiveStatsSnapshot>(EMPTY_LIVE_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/live-stats", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`live-stats-${response.status}`);
      }

      const payload = (await response.json()) as Partial<LiveStatsSnapshot>;
      setData(createLiveStatsSnapshot(payload));
    } catch {
      setData(createLiveStatsSnapshot());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);

    const intervalId = window.setInterval(() => {
      void load(true);
    }, LIVE_STATS_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [load]);

  return {
    data,
    isLoading,
    isRefreshing,
    retry: () => load(false),
  };
}
