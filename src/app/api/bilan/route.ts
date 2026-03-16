import { NextResponse } from 'next/server';
import { getAllRaces, getParticipants, getTodayDateStr } from '@/lib/pmu-api';
import { analyzeRace, getMinutesUntilStart } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || getTodayDateStr();

  try {
    const races = await getAllRaces(date);

    // For finished races, get results
    const results = [];
    for (const race of races) {
      const minutesUntil = getMinutesUntilStart(race.heureDepart);

      if (minutesUntil < -10) { // Finished races
        try {
          const participants = await getParticipants(date, race.reunion, race.course);
          const analysis = analyzeRace(race, participants);

          if (analysis && analysis.favori) {
            // Check if favori finished in top 3
            const favoriResult = participants.find(p => p.numPmu === analysis.favori?.numPmu);
            const ordreArrivee = favoriResult?.ordreArrivee;

            results.push({
              courseInfo: race,
              favori: { numPmu: analysis.favori.numPmu, nom: analysis.favori.nom },
              recommandation: analysis.recommandation?.decision || '—',
              confiance: analysis.scoreConfiance?.score ?? 0,
              resultat: ordreArrivee === 1 ? 'GAGNANT' : (ordreArrivee && ordreArrivee <= 3) ? 'PLACE' : ordreArrivee ? 'PERDU' : 'INCONNU',
              ordreArrivee,
            });
          }
        } catch {
          // Skip races that fail
        }
      }
    }

    // Calculate summary stats
    const totalPlayed = results.filter(r => r.resultat !== 'INCONNU').length;
    const wins = results.filter(r => r.resultat === 'GAGNANT').length;
    const places = results.filter(r => r.resultat === 'PLACE').length;

    return NextResponse.json({
      success: true,
      date,
      summary: {
        totalRaces: races.length,
        totalPlayed,
        wins,
        places,
        losses: totalPlayed - wins - places,
      },
      results,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Bilan failed' }, { status: 500 });
  }
}
