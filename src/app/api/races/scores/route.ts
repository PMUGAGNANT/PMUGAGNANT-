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
        stage: 'preview_1h' | 'final_30m' | 'finished';
      }
    > = {};

    // Compute scores from 60 minutes before departure, then keep updating
    const analyzableRaces = races.filter((r: { heureDepart: string }) => {
      const min = getMinutesUntilStart(r.heureDepart);
      return min <= 60;
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
          const stage: 'preview_1h' | 'final_30m' | 'finished' =
            minutesUntil < -10
              ? 'finished'
              : minutesUntil <= 30
                ? 'final_30m'
                : 'preview_1h';

          return { key, score: analysis.scoreConfiance?.score ?? null, stage };
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
  } catch {
    return NextResponse.json({ success: false, scores: {} });
  }
}
