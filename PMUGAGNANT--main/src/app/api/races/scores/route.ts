import { NextResponse } from "next/server";
import { getMinutesUntilStart } from "@/lib/analysis";
import { badRequest, serverError } from "@/lib/api-response";
import { getAllRaces, getTodayDateStr, isEligiblePmuFranceRace } from "@/lib/pmu-api";
import {
  getRacePredictions,
  listLatestRunnerScoreSnapshotsForRace,
  listPredictionStageSnapshots,
} from "@/lib/prediction-store";
import { normalizeRequestedDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import { getRequestSubscriptionState } from "@/lib/subscription";
import type {
  Lisibilite,
  PredictionDecision,
  PredictionRow,
  PredictionStageSnapshotRow,
  RaceSummary,
  RunnerScoreSnapshotRow,
  ScoreStage,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type HomeScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";

type ComboCandidatePayload = {
  cheval_num: number;
  cheval_nom: string;
  cote: number;
  role: "PEPITE" | "OUTSIDER";
  confiance: number;
  score_cheval: number;
};

type ScorePayload = {
  score: number | null;
  scoreLocked: boolean;
  stage: HomeScoreStage;
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
        stake: number | null;
        edge: number | null;
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
  access: {
    level: "FREE" | "PRO";
    locked: boolean;
    message: string;
  };
};

const STAGE_PRIORITY: Record<ScoreStage, number> = {
  MATIN: 1,
  T10: 2,
  RESULTAT: 3,
};

function firstFiniteNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getUnknownNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeScore10(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(10, value > 10 ? value / 10 : value));
}

function normalizeScore100(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value > 10 ? value : value * 10));
}

function getSnapshotV10(snapshot: RunnerScoreSnapshotRow | null | undefined) {
  const payload = getRecord(snapshot?.blend_payload);
  const v101 = getRecord(payload?.v101);
  const v10 = getRecord(payload?.v10);
  const model = v101 ?? v10;
  const market = getRecord(payload?.market);
  const role = getString(model?.role);

  return {
    role:
      role === "PEPITE" || role === "OUTSIDER" || role === "CHOIX" || role === "PODIUM"
        ? role
        : null,
    roleLabel: getString(model?.roleLabel),
    betType:
      model?.betType === "GAGNANT" || model?.betType === "PLACE"
        ? String(model.betType)
        : snapshot?.bet_type ?? "GAGNANT",
    cote: firstFiniteNumber(
      getUnknownNumber(market?.coteDepart),
      getUnknownNumber(market?.coteMatin)
    ),
    score: firstFiniteNumber(snapshot?.score_v10_1, getUnknownNumber(model?.score), snapshot?.score_v10),
  };
}

function getLatestStageSnapshot(rows: PredictionStageSnapshotRow[]) {
  return [...rows].sort((left, right) => {
    const stageDelta = STAGE_PRIORITY[left.stage] - STAGE_PRIORITY[right.stage];
    if (stageDelta !== 0) return stageDelta;
    return (left.updated_at ?? "").localeCompare(right.updated_at ?? "");
  })[rows.length - 1] ?? null;
}

function inferStage(
  race: Pick<RaceSummary, "heureDepart" | "dateStr">,
  snapshot: PredictionStageSnapshotRow | null
): HomeScoreStage {
  if (snapshot?.stage === "RESULTAT") return "finished";
  const minutesUntil = getMinutesUntilStart(race.heureDepart, race.dateStr);
  if (minutesUntil < -10) return "finished";
  if (minutesUntil <= 30) return "final_30m";
  if (minutesUntil <= 60) return "preview_1h";
  return "preview_2h";
}

function getPredictionScore(row: PredictionRow) {
  return firstFiniteNumber(row.score_blended, row.score_cheval, row.score_final_pari) ?? 0;
}

function getPredictionConfidence(row: PredictionRow) {
  return normalizeScore10(row.confiance) ?? normalizeScore10(getPredictionScore(row)) ?? 0;
}

function sortPredictionRows(rows: PredictionRow[]) {
  return [...rows].sort((left, right) => {
    const leftPriority = left.decision === "VALIDE" ? 2 : left.decision === "SURVEILLANCE" ? 1 : 0;
    const rightPriority = right.decision === "VALIDE" ? 2 : right.decision === "SURVEILLANCE" ? 1 : 0;
    return rightPriority - leftPriority || getPredictionScore(right) - getPredictionScore(left);
  });
}

function choosePrediction(rows: PredictionRow[], selectionNum: number | null | undefined) {
  if (selectionNum != null) {
    const selected = rows.find((row) => row.cheval_num === selectionNum);
    if (selected) return selected;
  }
  return sortPredictionRows(rows).find((row) => row.decision !== "REJET" && !row.non_partant) ?? null;
}

function chooseSnapshot(
  snapshots: RunnerScoreSnapshotRow[],
  selectionNum: number | null | undefined
) {
  if (selectionNum != null) {
    const selected = snapshots.find((snapshot) => snapshot.cheval_num === selectionNum);
    if (selected) return selected;
  }
  return [...snapshots].sort((left, right) => {
    const leftScore = firstFiniteNumber(left.confidence_score, left.score_v10_1, left.score_v10, left.score_lisibilite_adjusted) ?? 0;
    const rightScore = firstFiniteNumber(right.confidence_score, right.score_v10_1, right.score_v10, right.score_lisibilite_adjusted) ?? 0;
    return rightScore - leftScore;
  })[0] ?? null;
}

function getSnapshotName(snapshot: RunnerScoreSnapshotRow, predictions: PredictionRow[]) {
  return predictions.find((row) => row.cheval_num === snapshot.cheval_num)?.cheval_nom ?? `N ${snapshot.cheval_num}`;
}

function getReasonCodes(
  snapshot: RunnerScoreSnapshotRow | null,
  prediction: PredictionRow | null
) {
  if (snapshot?.reason_codes?.length) {
    return snapshot.reason_codes.slice(0, 3);
  }
  return prediction?.avis_texte ? [prediction.avis_texte] : [];
}

function buildPick(input: {
  stageSnapshot: PredictionStageSnapshotRow | null;
  selectedSnapshot: RunnerScoreSnapshotRow | null;
  selectedPrediction: PredictionRow | null;
  predictions: PredictionRow[];
}) {
  const { stageSnapshot, selectedSnapshot, selectedPrediction, predictions } = input;
  const num =
    stageSnapshot?.selection_num ??
    selectedPrediction?.cheval_num ??
    selectedSnapshot?.cheval_num ??
    null;

  if (num === null) return null;

  const name =
    stageSnapshot?.selection_nom ??
    selectedPrediction?.cheval_nom ??
    (selectedSnapshot ? getSnapshotName(selectedSnapshot, predictions) : null) ??
    `N ${num}`;
  const confidence =
    normalizeScore10(selectedSnapshot?.confidence_score) ??
    normalizeScore10(stageSnapshot?.selection_confiance) ??
    (selectedPrediction ? getPredictionConfidence(selectedPrediction) : 0);
  const decision =
    stageSnapshot?.selection_decision ??
    selectedSnapshot?.decision ??
    selectedPrediction?.decision ??
    "REJET";
  const v10 = getSnapshotV10(selectedSnapshot);
  const cote = firstFiniteNumber(
    stageSnapshot?.selection_cote,
    selectedPrediction?.cote_depart,
    selectedPrediction?.cote_matin,
    v10.cote
  );

  return {
    numPmu: num,
    nom: name,
    decision,
    betType:
      stageSnapshot?.selection_pari ??
      selectedSnapshot?.bet_type ??
      selectedPrediction?.pari_conseille ??
      v10.betType,
    confidence,
    cote,
    stake: firstFiniteNumber(selectedSnapshot?.stake_final, selectedPrediction?.mise_simulee),
    edge: firstFiniteNumber(selectedSnapshot?.market_edge, selectedPrediction?.value),
    topFacteurs: getReasonCodes(selectedSnapshot, selectedPrediction),
  };
}

function buildPepite(
  snapshots: RunnerScoreSnapshotRow[],
  predictions: PredictionRow[]
) {
  const peppite = snapshots.find((snapshot) => getSnapshotV10(snapshot).role === "PEPITE");
  if (!peppite) return null;
  const prediction = predictions.find((row) => row.cheval_num === peppite.cheval_num) ?? null;
  const v10 = getSnapshotV10(peppite);
  return {
    numPmu: peppite.cheval_num,
    nom: prediction?.cheval_nom ?? getSnapshotName(peppite, predictions),
    confidence: normalizeScore10(peppite.confidence_score) ?? 0,
    cote: firstFiniteNumber(prediction?.cote_depart, prediction?.cote_matin, v10.cote),
    topFacteurs: getReasonCodes(peppite, prediction),
  };
}

function buildComboCandidate(
  snapshots: RunnerScoreSnapshotRow[],
  predictions: PredictionRow[]
): ComboCandidatePayload | null {
  const candidate = snapshots.find((snapshot) => {
    const role = getSnapshotV10(snapshot).role;
    return role === "PEPITE" || role === "OUTSIDER";
  });
  if (!candidate) return null;
  const prediction = predictions.find((row) => row.cheval_num === candidate.cheval_num) ?? null;
  const v10 = getSnapshotV10(candidate);
  const role = v10.role === "OUTSIDER" ? "OUTSIDER" : "PEPITE";
  const cote = firstFiniteNumber(prediction?.cote_depart, prediction?.cote_matin, v10.cote);
  if (cote === null) return null;

  return {
    cheval_num: candidate.cheval_num,
    cheval_nom: prediction?.cheval_nom ?? getSnapshotName(candidate, predictions),
    cote,
    role,
    confiance: normalizeScore10(candidate.confidence_score) ?? 0,
    score_cheval: normalizeScore100(v10.score ?? candidate.score_lisibilite_adjusted),
  };
}

function buildRaceScore(input: {
  race: RaceSummary;
  subscribed: boolean;
  stageSnapshots: PredictionStageSnapshotRow[];
  scoreSnapshots: RunnerScoreSnapshotRow[];
  predictions: PredictionRow[];
}): ScorePayload {
  const stageSnapshot = getLatestStageSnapshot(input.stageSnapshots);
  const stage = inferStage(input.race, stageSnapshot);
  const allowFullScore = input.subscribed || stage === "finished";
  const selectedPrediction = choosePrediction(input.predictions, stageSnapshot?.selection_num);
  const selectedSnapshot = chooseSnapshot(
    input.scoreSnapshots,
    stageSnapshot?.selection_num ?? selectedPrediction?.cheval_num
  );
  const pick = buildPick({
    stageSnapshot,
    selectedSnapshot,
    selectedPrediction,
    predictions: input.predictions,
  });
  const lisibilite =
    stageSnapshot?.lisibilite ?? selectedPrediction?.lisibilite ?? "COMPLEXE";
  const unlockedDecision =
    stageSnapshot?.decision_course ??
    pick?.decision ??
    selectedPrediction?.decision ??
    selectedSnapshot?.decision ??
    "REJET";
  const score =
    normalizeScore10(selectedSnapshot?.confidence_score) ??
    normalizeScore10(stageSnapshot?.selection_confiance) ??
    (selectedPrediction ? getPredictionConfidence(selectedPrediction) : null);
  const playable =
    allowFullScore &&
    stage !== "finished" &&
    lisibilite !== "LOTERIE" &&
    unlockedDecision !== "REJET" &&
    Boolean(pick) &&
    ((pick?.stake ?? 0) > 0 || pick?.decision === "VALIDE");

  return {
    score: allowFullScore ? score : null,
    scoreLocked: !allowFullScore,
    stage,
    lisibilite,
    decision: allowFullScore ? unlockedDecision : "REJET",
    playable,
    recommendation: allowFullScore ? stageSnapshot?.notes?.[0] ?? null : null,
    pick: allowFullScore ? pick : null,
    pepiteDuJour: allowFullScore ? buildPepite(input.scoreSnapshots, input.predictions) : null,
    comboCandidate:
      allowFullScore && stage !== "finished"
        ? buildComboCandidate(input.scoreSnapshots, input.predictions)
        : null,
    access: {
      level: allowFullScore ? "PRO" : "FREE",
      locked: !allowFullScore,
      message: allowFullScore
        ? "Acces complet : scores, mises, edge et analyse exposes."
        : "Acces gratuit : top 3 et details PRO masques.",
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = normalizeRequestedDate(searchParams.get("date"), getTodayDateStr());
  if (!date) {
    return badRequest("Invalid date format. Expected DDMMYYYY.");
  }

  try {
    const { state: subscriptionState } = await getRequestSubscriptionState(
      request.headers.get("authorization")
    );
    const races = (await getAllRaces(date)).filter(isEligiblePmuFranceRace);
    const scores: Array<
      ScorePayload & {
        dateStr: string;
        reunion: number;
        course: number;
      }
    > = [];

    const batchSize = 5;
    for (let i = 0; i < races.length; i += batchSize) {
      const batch = races.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (race) => {
          const [stageSnapshots, scoreSnapshots, predictions] = await Promise.all([
            listPredictionStageSnapshots(date, race.reunion, race.course).catch(() => []),
            listLatestRunnerScoreSnapshotsForRace(date, race.reunion, race.course).catch(() => []),
            getRacePredictions(date, race.reunion, race.course).catch(() => []),
          ]);

          return {
            dateStr: date,
            reunion: race.reunion,
            course: race.course,
            ...buildRaceScore({
              race,
              subscribed: subscriptionState.isSubscribed,
              stageSnapshots,
              scoreSnapshots,
              predictions,
            }),
          };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          scores.push(result.value);
        } else {
          logger.warn("race_scores.snapshot_item_failed", {
            date,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }
    }

    return NextResponse.json({ success: true, scores });
  } catch (error) {
    return serverError("Race scores failed", error, { date });
  }
}
