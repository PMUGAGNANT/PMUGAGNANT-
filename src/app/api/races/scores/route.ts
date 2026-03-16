import { NextResponse } from 'next/server';
import { getAllRaces, getParticipants, getTodayDateStr } from '@/lib/pmu-api';
import { analyzeRace, getMinutesUntilStart } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const date = getTodayDateStr();

  try {
    const races = await getAllRaces(date);
    const scores: Record<string, number> = {};

    // Only compute for races where prono is available or finished
    const analyzableRaces = races.filter((r: { heureDepart: string }) => {
      const min = getMinutesUntilStart(r.heureDepart);
      return min <= 30; // prono_available or finished
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
          return { key, score: analysis.scoreConfiance?.score ?? null };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.score !== null) {
          scores[result.value.key] = result.value.score;
        }
      }
    }

    return NextResponse.json({ success: true, scores });
  } catch {
    return NextResponse.json({ success: false, scores: {} });
  }
}
