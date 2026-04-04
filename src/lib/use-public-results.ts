"use client";

import { useCallback, useEffect, useState } from "react";
import { getTodayDateStr } from "@/lib/date-utils";

export interface PublicResultsTrack {
  label: string;
  roi: number;
  sample: number;
}

export interface PublicResultsTimelinePoint {
  date: string;
  gain: number;
  stake: number;
  profit: number;
  cumulativeProfit: number;
}

export interface PublicResultsResult {
  courseInfo: {
    dateStr: string;
    reunion: number;
    course: number;
    hippodrome: string;
    heureDepart: string;
    discipline: string;
    nomCourse: string;
  };
  favori: {
    numPmu: number;
    nom: string;
    cotePmu: number | null;
    coteEstimee: number | null;
    jockey?: string | null;
  };
  recommandation: string;
  confiance: number;
  resultat: "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";
  ordreArrivee?: number | null;
}

export interface PublicResultsDashboardPayload {
  success: boolean;
  dashboard?: {
    available: boolean;
    globalRoi: number;
    algoSuccessRate: number;
    randomSuccessRate: number;
    totalBets: number;
    totalStake: number;
    totalGain: number;
    bestTracks: PublicResultsTrack[];
    timeline: PublicResultsTimelinePoint[];
  };
  results?: PublicResultsResult[];
}

type UsePublicResultsResult = {
  data: PublicResultsDashboardPayload | null;
  isLoading: boolean;
  error: string | null;
};

export function usePublicResultsData(): UsePublicResultsResult {
  const [data, setData] = useState<PublicResultsDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bilan?date=${getTodayDateStr()}&dashboard_days=90`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as PublicResultsDashboardPayload & {
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Impossible de charger les resultats publics.");
      }

      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les resultats publics."
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error };
}
