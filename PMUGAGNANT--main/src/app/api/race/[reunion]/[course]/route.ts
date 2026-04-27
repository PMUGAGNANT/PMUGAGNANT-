import { NextResponse } from "next/server";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import { analyzeRaceWithParameters, getMinutesUntilStart } from "@/lib/analysis";
import {
  buildAvisExpertFromAnalysis,
  fetchAvisExpertTop5,
} from "@/lib/avis-pipeline";
import {
  computeClientRaceScore,
  type ApiRaceScoreLite,
} from "@/lib/client-race-scoring";
import { attachFaultRates } from "@/lib/horse-faults";
import { detecterRoles } from "@/lib/horse-roles";
import { getLiveCotesSeries } from "@/lib/live-cotes";
import { fetchMeteoHippodrome } from "@/lib/meteo";
import { loadAlgoParameters } from "@/lib/config";
import { badRequest, serverError } from "@/lib/api-response";
import { listPredictionStageSnapshots } from "@/lib/prediction-store";
import { getRacePriorityBadge } from "@/lib/race-priority";
import { normalizeRequestedDate, parsePositiveInteger } from "@/lib/request-utils";
import { getRequestSubscriptionState } from "@/lib/subscription";
import type { Participant, RaceSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

function buildOfficialArrival(participants: Participant[]) {
  return participants
    .filter((participant) => participant.ordreArrivee !== null && participant.ordreArrivee > 0)
    .sort((left, right) => {
      if (left.ordreArrivee !== right.ordreArrivee) {
        return (left.ordreArrivee ?? 99) - (right.ordreArrivee ?? 99);
      }

      return left.numPmu - right.numPmu;
    })
    .map((participant) => ({
      position: participant.ordreArrivee ?? null,
      numPmu: participant.numPmu,
      nom: participant.nom,
      jockey: participant.jockey || participant.driver || null,
      entraineur: participant.entraineur || null,
    }));
}

function getRacePriorityPayload(input: {
  race: RaceSummary;
  minutesUntil: number;
  isFinished: boolean;
  score: number | null;
  scoreLocked: boolean;
  lisibilite: ApiRaceScoreLite["lisibilite"];
  decision: ApiRaceScoreLite["decision"];
  playable: boolean;
  pick:
    | {
        numPmu: number;
        nom: string;
        decision: string;
        betType: string;
        confidence: number;
        topFacteurs: string[];
      }
    | null;
}) {
  const stage: ApiRaceScoreLite["stage"] = input.isFinished
    ? "finished"
    : input.minutesUntil <= 30
      ? "final_30m"
      : input.minutesUntil <= 60
        ? "preview_1h"
        : "preview_2h";

  const playTier = computeClientRaceScore(
    input.race,
    {
      score: input.score,
      scoreDetailsLocked: input.scoreLocked,
      stage,
      lisibilite: input.lisibilite,
      decision: input.decision,
      playable: input.playable,
      pick: input.pick,
    },
    Math.max(0, Math.round(input.minutesUntil))
  ).playTier;

  return getRacePriorityBadge({
    race: input.race,
    status: playTier,
    decision: input.decision,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reunion: string; course: string }> }
) {
  const { reunion, course } = await params;
  const { searchParams } = new URL(request.url);
  const date = normalizeRequestedDate(searchParams.get("date"), getTodayDateStr());
  const rNum = parsePositiveInteger(reunion);
  const cNum = parsePositiveInteger(course);

  if (!date) {
    return badRequest("Invalid date format. Expected DDMMYYYY.");
  }

  if (!rNum || !cNum) {
    return badRequest("Invalid race identifier.");
  }

  try {
    const algoParameters = await loadAlgoParameters();
    const { state: subscriptionState } = await getRequestSubscriptionState(
      request.headers.get("authorization")
    );

    const allRaces = await getAllRaces(date);
    const courseInfo = allRaces.find((race) => race.reunion === rNum && race.course === cNum);

    if (!courseInfo) {
      return NextResponse.json({ success: false, error: "Race not found" }, { status: 404 });
    }

    const meteo = await fetchMeteoHippodrome(courseInfo.hippodrome, courseInfo.heureDepart);
    const participants = await attachFaultRates(await getParticipants(date, rNum, cNum));
    const officialArrival = buildOfficialArrival(participants);
    const timelineSnapshots = await listPredictionStageSnapshots(date, rNum, cNum).catch(() => []);
    const minutesUntil = getMinutesUntilStart(courseInfo.heureDepart, courseInfo.dateStr);
    const isFinished = officialArrival.length > 0 || minutesUntil < -10;
    const pronoAvailable = isFinished || minutesUntil <= 30 || subscriptionState.isSubscribed;

    let analysis = null;
    if (pronoAvailable && participants.length > 0) {
      const computedAnalysis = analyzeRaceWithParameters(
        courseInfo as RaceSummary,
        participants,
        algoParameters
      );
      const roles = detecterRoles(
        computedAnalysis.ranking.map((runner) => ({
          cheval_num: runner.numPmu,
          cheval_nom: runner.nom,
          cote_matin: runner.coteMatin ?? runner.cote ?? runner.coteDepart ?? Number.NaN,
          cote_depart: runner.coteDepart ?? runner.cote ?? null,
          score_cheval: runner.prediction.scoreCheval,
          confiance: runner.prediction.confiance,
          non_partant: Boolean(runner.nonPartant),
        })),
        computedAnalysis.prediction.lisibilite
      );
      analysis = isFinished || subscriptionState.isSubscribed ? computedAnalysis : null;
      const allowFullScore = subscriptionState.isSubscribed || isFinished;
      const storedAvis = allowFullScore ? await fetchAvisExpertTop5(date, rNum, cNum) : [];
      const avisExpert = allowFullScore
        ? buildAvisExpertFromAnalysis(
            computedAnalysis,
            participants,
            courseInfo as RaceSummary,
            storedAvis
          )
        : null;
      const liveCotes = allowFullScore
        ? await getLiveCotesSeries(
            date,
            courseInfo as RaceSummary,
            participants,
            computedAnalysis.top5.map((runner) => runner.numPmu)
          )
        : null;
      const decision = allowFullScore ? computedAnalysis.prediction.decisionCourse : "REJET";
      const score = allowFullScore ? computedAnalysis.scoreConfiance?.score ?? null : null;
      const scoreLocked = !allowFullScore;
      const playable =
        allowFullScore &&
        !isFinished &&
        computedAnalysis.prediction.lisibilite !== "LOTERIE" &&
        computedAnalysis.prediction.decisionCourse !== "REJET" &&
        Boolean(computedAnalysis.recommandation?.vautLeCoup);
      const pick =
        allowFullScore && computedAnalysis.favori
          ? {
              numPmu: computedAnalysis.favori.numPmu,
              nom: computedAnalysis.favori.nom,
              decision: computedAnalysis.favori.prediction.decision,
              betType: computedAnalysis.favori.prediction.typePariConseille,
              confidence: computedAnalysis.favori.prediction.confiance,
              topFacteurs: computedAnalysis.favori.prediction.topFacteurs,
            }
          : null;
      const refreshPriority = getRacePriorityPayload({
        race: courseInfo as RaceSummary,
        minutesUntil,
        isFinished,
        score,
        scoreLocked,
        lisibilite: computedAnalysis.prediction.lisibilite,
        decision,
        playable,
        pick,
      });

      return NextResponse.json({
        success: true,
        courseInfo,
        meteo,
        participants,
        officialArrival,
        minutesUntilStart: minutesUntil,
        pronoAvailable,
        isFinished,
        analysis,
        roles: allowFullScore ? roles : null,
        avisExpert,
        liveCotes,
        refreshPriority,
        timelineSnapshots: allowFullScore ? timelineSnapshots : [],
        paywall:
          !isFinished && !subscriptionState.isSubscribed
            ? {
                required: true,
                preview: {
                  lisibilite: computedAnalysis.prediction.lisibilite,
                  recommendation: null,
                  favori: null,
                  message: "Top 3, scores, mises, edge et analyse complete reserves aux abonnes PRO.",
                },
              }
            : null,
      });
    }

    return NextResponse.json({
      success: true,
      courseInfo,
      meteo,
      participants,
      officialArrival,
      minutesUntilStart: minutesUntil,
      pronoAvailable,
      isFinished,
      analysis,
      avisExpert: null,
      liveCotes: null,
      refreshPriority: null,
      timelineSnapshots: subscriptionState.isSubscribed || isFinished ? timelineSnapshots : [],
      paywall: null,
    });
  } catch (error) {
    return serverError("Analysis failed", error, { date, reunion: rNum, course: cNum });
  }
}
