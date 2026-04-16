import { NextResponse } from "next/server";
import { getAllRaces, getParticipants, getTodayDateStr, isEligiblePmuFranceRace } from "@/lib/pmu-api";
import { analyzeRaceWithParameters, getMinutesUntilStart } from "@/lib/analysis";
import { attachFaultRates } from "@/lib/horse-faults";
import { detecterRoles, type RoleCheval } from "@/lib/horse-roles";
import { loadAlgoParameters } from "@/lib/config";
import { badRequest, serverError } from "@/lib/api-response";
import { normalizeRequestedDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import { getRequestSubscriptionState } from "@/lib/subscription";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";

export const dynamic = 'force-dynamic';

type ComboCandidatePayload = {
  cheval_num: number;
  cheval_nom: string;
  cote: number;
  role: "PEPITE" | "OUTSIDER";
  confiance: number;
  score_cheval: number;
};

function isComboRole(role: RoleCheval): role is RoleCheval & { role: ComboCandidatePayload["role"] } {
  return role.role === "PEPITE" || role.role === "OUTSIDER";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = normalizeRequestedDate(searchParams.get("date"), getTodayDateStr());
  if (!date) {
    return badRequest("Invalid date format. Expected DDMMYYYY.");
  }

  try {
    const algoParameters = await loadAlgoParameters();
    const { state: subscriptionState } = await getRequestSubscriptionState(
      request.headers.get("authorization")
    );
    const races = (await getAllRaces(date)).filter(isEligiblePmuFranceRace);
    const scores: Record<
      string,
      {
        score: number | null;
        scoreLocked: boolean;
        stage: "preview_2h" | "preview_1h" | "final_30m" | "finished";
        lisibilite: Lisibilite;
        decision: PredictionDecision;
        playable: boolean;
        recommendation: string | null;
        pick:
          | {
              numPmu: number;
              nom: string;
              decision: PredictionDecision;
              betType: string;
              confidence: number;
              cote: number | null;
              topFacteurs: string[];
            }
          | null;
        pepiteDuJour:
          | {
              numPmu: number;
              nom: string;
              confidence: number;
              cote: number | null;
              topFacteurs: string[];
            }
          | null;
        comboCandidate: ComboCandidatePayload | null;
      }
    > = {};

    // Keep combo candidates visible on the list without forcing users to open each race.
    const analyzableRaces = races;

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
          const roles = detecterRoles(
            analysis.ranking.map((runner) => ({
              cheval_num: runner.numPmu,
              cheval_nom: runner.nom,
              cote_matin: runner.coteMatin ?? runner.cote ?? runner.coteDepart ?? Number.NaN,
              cote_depart: runner.coteDepart ?? runner.cote ?? null,
              score_cheval: runner.prediction.scoreCheval,
              confiance: runner.prediction.confiance,
              non_partant: Boolean(runner.nonPartant),
            })),
            analysis.prediction.lisibilite
          );
          const comboRole = roles.find(isComboRole);
          const comboCandidate: ComboCandidatePayload | null = comboRole
            ? {
                cheval_num: comboRole.cheval_num,
                cheval_nom: comboRole.cheval_nom,
                cote: comboRole.cote,
                role: comboRole.role,
                confiance: comboRole.confiance,
                score_cheval: comboRole.score_cheval,
              }
            : null;
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

          const allowFullScore = subscriptionState.isSubscribed || stage === "finished";

          const score = allowFullScore ? analysis.scoreConfiance?.score ?? null : null;
          const scoreLocked = !allowFullScore;
          const canExposeComboCandidate = stage !== "finished";

          return {
            key,
            score,
            scoreLocked,
            stage,
            lisibilite: analysis.prediction.lisibilite,
            decision: allowFullScore ? analysis.prediction.decisionCourse : "REJET",
            playable:
              allowFullScore &&
              stage !== "finished" &&
              analysis.prediction.lisibilite !== "LOTERIE" &&
              analysis.prediction.decisionCourse !== "REJET" &&
              Boolean(analysis.recommandation?.vautLeCoup),
            recommendation: allowFullScore ? analysis.recommandation?.decision ?? null : null,
            pick:
              allowFullScore && analysis.favori
                ? {
                    numPmu: analysis.favori.numPmu,
                    nom: analysis.favori.nom,
                    decision: analysis.favori.prediction.decision,
                    betType: analysis.favori.prediction.typePariConseille,
                    confidence: analysis.favori.prediction.confiance,
                    cote: analysis.favori.cote ?? analysis.favori.coteDepart ?? null,
                    topFacteurs: analysis.favori.prediction.topFacteurs,
                  }
                : null,
            pepiteDuJour:
              allowFullScore && analysis.pepiteDuJour
                ? {
                    numPmu: analysis.pepiteDuJour.numPmu,
                    nom: analysis.pepiteDuJour.nom,
                    confidence: analysis.pepiteDuJour.prediction.confiance,
                    cote: analysis.pepiteDuJour.cote,
                    topFacteurs: analysis.pepiteDuJour.prediction.topFacteurs,
                  }
                : null,
            comboCandidate: canExposeComboCandidate ? comboCandidate : null,
          };
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          const v = result.value;
          scores[v.key] = {
            score: v.score,
            scoreLocked: v.scoreLocked,
            stage: v.stage,
            lisibilite: v.lisibilite,
            decision: v.decision,
            playable: v.playable,
            recommendation: v.recommendation,
            pick: v.pick,
            pepiteDuJour: v.pepiteDuJour,
            comboCandidate: v.comboCandidate,
          };
        } else if (result.status === "rejected") {
          logger.warn("race_scores.batch_item_failed", {
            date,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }
    }

    const scoresList = Object.entries(scores).map(([key, entry]) => {
      const [reunionStr, courseStr] = key.split("-");
      const reunion = Number(reunionStr);
      const course = Number(courseStr);
      return {
        dateStr: date,
        reunion,
        course,
        ...entry,
      };
    });

    return NextResponse.json({ success: true, scores: scoresList });
  } catch (error) {
    return serverError("Race scores failed", error, { date });
  }
}
