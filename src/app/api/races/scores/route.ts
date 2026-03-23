import { NextResponse } from "next/server";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import { analyzeRaceWithParameters, getMinutesUntilStart } from "@/lib/analysis";
import { attachFaultRates } from "@/lib/horse-faults";
import { loadAlgoParameters } from "@/lib/config";
import type { RaceSummary } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || getTodayDateStr();

  try {
    const algoParameters = await loadAlgoParameters();
    const races = await getAllRaces(date);
    const scores: Record<
      string,
      {
        score: number;
        stage: 'preview_2h' | 'preview_1h' | 'final_30m' | 'finished';
      }
    > = {};

    // Compute from 2 hours before the start, then keep updating until finished.
    const analyzableRaces = races.filter((r: { heureDepart: string; dateStr: string }) => {
      const min = getMinutesUntilStart(r.heureDepart, r.dateStr);
      return min <= 120;
    });

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < analyzableRaces.length; i += batchSize) {
      const batch = analyzableRaces.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (race: { reunion: number; course: number; heureDepart: string; dateStr: string }) => {
          const participants = await attachFaultRates(
            await getParticipants(date, race.reunion, race.course)
          );
          const hasOfficialArrival = participants.some(
            (participant) => participant.ordreArrivee !== null && participant.ordreArrivee > 0
          );
          const analysis = analyzeRaceWithParameters(
            race as RaceSummary,
            participants,
            algoParameters
          );
          const key = `${race.reunion}-${race.course}`;
          const minutesUntil = getMinutesUntilStart(race.heureDepart, race.dateStr);
          const stage: 'preview_2h' | 'preview_1h' | 'final_30m' | 'finished' =
            hasOfficialArrival || minutesUntil < -10
              ? 'finished'
              : minutesUntil <= 30
                ? 'final_30m'
                : minutesUntil <= 60
                  ? 'preview_1h'
                  : 'preview_2h';

          return {
            key,
            score: analysis.scoreConfiance?.score ?? null,
            stage,
          };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.score !== null) {
          scores[result.value.key] = {
            score: result.value.score,
            stage: result.value.stage,
          };
        }
      }
    }

    return NextResponse.json({ success: true, scores });
  } catch (error) {
    console.error("Race scores error:", error);
    return NextResponse.json({ success: false, scores: {} });
  }
}
