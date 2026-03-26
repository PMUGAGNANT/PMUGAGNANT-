import { NextResponse } from "next/server";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import { analyzeRaceWithParameters, getMinutesUntilStart } from "@/lib/analysis";
import { attachFaultRates } from "@/lib/horse-faults";
import { loadAlgoParameters } from "@/lib/config";
import { badRequest, serverError } from "@/lib/api-response";
import { normalizeRequestedDate, parsePositiveInteger } from "@/lib/request-utils";
import { getRequestSubscriptionState } from "@/lib/subscription";
import type { Participant, RaceSummary } from "@/lib/types";

export const dynamic = 'force-dynamic';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reunion: string; course: string }> }
) {
  const { reunion, course } = await params;
  const { searchParams } = new URL(request.url);
  const date = normalizeRequestedDate(searchParams.get('date'), getTodayDateStr());
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

    // Get race info from programme
    const allRaces = await getAllRaces(date);
    const courseInfo = allRaces.find(r => r.reunion === rNum && r.course === cNum);

    if (!courseInfo) {
      return NextResponse.json({ success: false, error: 'Race not found' }, { status: 404 });
    }

    // Get participants and enrich them with historical risk signals.
    const participants = await attachFaultRates(await getParticipants(date, rNum, cNum));
    const officialArrival = buildOfficialArrival(participants);

    // Check if pronostic should be revealed (30 min before start)
    const minutesUntil = getMinutesUntilStart(courseInfo.heureDepart, courseInfo.dateStr);
    const isFinished = officialArrival.length > 0 || minutesUntil < -10;
    const pronoAvailable = isFinished || minutesUntil <= 30;

    let analysis = null;
    if (pronoAvailable && participants.length > 0) {
      const computedAnalysis = analyzeRaceWithParameters(
        courseInfo as RaceSummary,
        participants,
        algoParameters
      );
      analysis =
        isFinished || subscriptionState.isSubscribed
          ? computedAnalysis
          : null;

      return NextResponse.json({
        success: true,
        courseInfo,
        participants: participants.length,
        officialArrival,
        minutesUntilStart: minutesUntil,
        pronoAvailable,
        isFinished,
        analysis,
        paywall:
          !isFinished && !subscriptionState.isSubscribed
            ? {
                required: true,
                preview: {
                  lisibilite: computedAnalysis.prediction.lisibilite,
                  recommendation: computedAnalysis.recommandation?.decision ?? null,
                  favori: computedAnalysis.favori
                    ? {
                        numPmu: computedAnalysis.favori.numPmu,
                        nom: computedAnalysis.favori.nom,
                      }
                    : null,
                },
              }
            : null,
      });
    }

    return NextResponse.json({
      success: true,
      courseInfo,
      participants: participants.length,
      officialArrival,
      minutesUntilStart: minutesUntil,
      pronoAvailable,
      isFinished,
      analysis,
      paywall: null,
    });
  } catch (error) {
    return serverError("Analysis failed", error, { date, reunion: rNum, course: cNum });
  }
}
