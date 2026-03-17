import { NextResponse } from 'next/server';
import { getAllRaces, getDefinitiveRapports, getParticipants, getTodayDateStr } from '@/lib/pmu-api';
import { analyzeRace } from '@/lib/analysis';
import {
  buildPredictionHistoryRecords,
  getActiveModelWeightProfile,
  storePredictionHistory,
} from '@/lib/learning';
import { hasSupabaseAdminConfig } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getParisNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
}

function parseDateStr(dateStr: string): Date {
  const day = Number(dateStr.slice(0, 2));
  const month = Number(dateStr.slice(2, 4)) - 1;
  const year = Number(dateStr.slice(4, 8));
  return new Date(year, month, day);
}

function getMinutesUntilStartForDate(dateStr: string, heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const parisNow = getParisNow();
  const parisTarget = parseDateStr(dateStr);
  parisTarget.setHours(hours, minutes, 0, 0);
  return (parisTarget.getTime() - parisNow.getTime()) / 60000;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || getTodayDateStr();
  const canStoreLearning = hasSupabaseAdminConfig();

  try {
    const races = await getAllRaces(date);
    const [flatWeights, trotWeights] = await Promise.all([
      getActiveModelWeightProfile('PLAT'),
      getActiveModelWeightProfile('TROT'),
    ]);
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
        finishedInfo: {
          arrivalTop3: number[];
          simpleOutcome: 'GAGNANT' | 'PLACE' | 'PERDU';
          recommendedArrival: number | null;
        } | null;
      }
    > = {};

    // Compute scores from 2 hours before departure, then keep updating
    const analyzableRaces = races.filter((r) => {
      const min = getMinutesUntilStartForDate(date, r.heureDepart);
      return min <= 120;
    });

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < analyzableRaces.length; i += batchSize) {
      const batch = analyzableRaces.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (race) => {
          const [participants, definitiveRapports] = await Promise.all([
            getParticipants(date, race.reunion, race.course),
            getDefinitiveRapports(date, race.reunion, race.course).catch(() => ({})),
          ]);
          const analysis = analyzeRace(
            race as Parameters<typeof analyzeRace>[0],
            participants,
            race.estPlat ? flatWeights : trotWeights
          );
          const key = `${race.reunion}-${race.course}`;
          const minutesUntil = getMinutesUntilStartForDate(date, race.heureDepart);
          const stage: 'preview_2h' | 'preview_1h' | 'final_30m' | 'finished' =
            minutesUntil < -10
              ? 'finished'
              : minutesUntil <= 30
                ? 'final_30m'
              : minutesUntil <= 60
                  ? 'preview_1h'
                  : 'preview_2h';

          if (canStoreLearning && stage === 'finished' && analysis.parisRecommandes.length > 0) {
            await storePredictionHistory(
              buildPredictionHistoryRecords(date, race, participants, analysis, definitiveRapports)
            ).catch(() => undefined);
          }

          const simpleRecommendation = analysis.parisRecommandes.find(
            (pari) => pari.type === 'SIMPLE_GAGNANT'
          );
          const arrivalTop3 = participants
            .filter((participant) => participant.ordreArrivee && participant.ordreArrivee > 0)
            .sort((a, b) => (a.ordreArrivee ?? 99) - (b.ordreArrivee ?? 99))
            .slice(0, 3)
            .map((participant) => participant.numPmu);
          const recommendedParticipant = simpleRecommendation?.chevaux?.[0]
            ? participants.find(
                (participant) =>
                  participant.numPmu === simpleRecommendation.chevaux[0].numPmu
              ) ?? null
            : null;
          const recommendedArrival = recommendedParticipant?.ordreArrivee ?? null;
          const simpleOutcome: 'GAGNANT' | 'PLACE' | 'PERDU' =
            recommendedArrival === 1
              ? 'GAGNANT'
              : recommendedArrival !== null && recommendedArrival <= 3
                ? 'PLACE'
                : 'PERDU';

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
            finishedInfo:
              stage === 'finished' && simpleRecommendation?.chevaux?.[0]
                ? {
                    arrivalTop3,
                    simpleOutcome,
                    recommendedArrival,
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
            finishedInfo: result.value.finishedInfo,
          };
        }
      }
    }

    return NextResponse.json({ success: true, scores });
  } catch {
    return NextResponse.json({ success: false, scores: {} });
  }
}
