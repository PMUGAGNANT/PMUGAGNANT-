import { NextResponse } from 'next/server';
import { getAllRaces, getParticipants, getTodayDateStr } from '@/lib/pmu-api';
import { analyzeRace, getMinutesUntilStart } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const date = getTodayDateStr();

  try {
    const races = await getAllRaces(date);
    const scores: Record<
      string,
      {
        score: number;
        stage: 'preview_2h' | 'preview_1h' | 'final_30m' | 'finished';
        simpleReturn1Euro: number | null;
        simpleHorse: {
          numPmu: number;
          nom: string;
        } | null;
      }
    > = {};

    // Compute scores from 2 hours before departure, then keep updating
    const analyzableRaces = races.filter((r: { heureDepart: string }) => {
      const min = getMinutesUntilStart(r.heureDepart);
      return min <= 120;
    });

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < analyzableRaces.length; i += batchSize) {
      const batch = analyzableRaces.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (race: { reunion: number; course: number; heureDepart: string }) => {
          const participants = await getParticipants(date, race.reunion, race.course);
          const analysis = analyzeRace(
            race as Parameters<typeof analyzeRace>[0],
            participants
          );
          const key = `${race.reunion}-${race.course}`;
          const minutesUntil = getMinutesUntilStart(race.heureDepart);
          const stage: 'preview_2h' | 'preview_1h' | 'final_30m' | 'finished' =
            minutesUntil < -10
              ? 'finished'
              : minutesUntil <= 30
                ? 'final_30m'
                : minutesUntil <= 60
                  ? 'preview_1h'
                  : 'preview_2h';

          const simpleRecommendation = analysis.parisRecommandes.find(
            (pari) => pari.type === 'SIMPLE_GAGNANT'
          );

          return {
            key,
            score: analysis.scoreConfiance?.score ?? null,
            stage,
            simpleReturn1Euro:
              simpleRecommendation?.coteEstimee !== null &&
              simpleRecommendation?.coteEstimee !== undefined
                ? Number(simpleRecommendation.coteEstimee.toFixed(1))
                : null,
            simpleHorse:
              simpleRecommendation?.chevaux?.[0]
                ? {
                    numPmu: simpleRecommendation.chevaux[0].numPmu,
                    nom: simpleRecommendation.chevaux[0].nom,
                  }
                : null,
          };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.score !== null) {
          scores[result.value.key] = {
            score: result.value.score,
            stage: result.value.stage,
            simpleReturn1Euro: result.value.simpleReturn1Euro,
            simpleHorse: result.value.simpleHorse,
          };
        }
      }
    }

    return NextResponse.json({ success: true, scores });
  } catch {
    return NextResponse.json({ success: false, scores: {} });
  }
}
