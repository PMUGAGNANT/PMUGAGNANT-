import { loadAlgoParameters } from "@/lib/config";
import { genererAvisJour } from "@/lib/avis-pipeline";
import {
  computeClientRaceScore,
  type ApiRaceScoreLite,
} from "@/lib/client-race-scoring";
import { getMinutesUntilStart, getTodayDateStr as getTodayDateStrFromUtils, parsePmuDate } from "@/lib/date-utils";
import { attachFaultRates, upsertFaultRates } from "@/lib/horse-faults";
import { getAllRaces, getFinalReports, getParticipants } from "@/lib/pmu-api";
import { fetchMeteoHippodrome } from "@/lib/meteo";
import { snapshotLiveCotes } from "@/lib/live-cotes";
import {
  getPreRaceRefreshDecision,
  getResultRefreshDecision,
  type RefreshPriorityHints,
} from "@/lib/race-refresh-policy";
import {
  buildCourseRecord,
  buildPredictionStageSnapshot,
  buildPredictionRows,
  buildRaceEngineRunRow,
  buildRunnerFeatureSnapshots,
  buildRunnerMarketSnapshots,
  buildRunnerOutcomeRows,
  buildRunnerScoreSnapshots,
  completeRaceEngineRun,
  createRaceEngineRun,
  failRaceEngineRun,
  getRacePredictions,
  listPredictionsByDate,
  upsertRunnerFeatureSnapshots,
  upsertRunnerMarketSnapshots,
  upsertRunnerOutcomes,
  upsertRunnerScoreSnapshots,
  upsertCourseRecord,
  upsertPredictionStageSnapshot,
  upsertPredictions,
} from "@/lib/prediction-store";
import { analyzeRaceWithParameters } from "@/lib/predictions";
import { loadElitePerformers } from "@/lib/predictions/signals";
import {
  formatMorningTelegram,
  formatPreRaceTelegram,
  alerteTerrainChange,
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/lib/telegram";
import type {
  AlgoParameters,
  Participant,
  PredictionDecision,
  PredictionRow,
  RaceAnalysis,
  RaceSummary,
  SignalVariation,
} from "@/lib/types";

const BATCH_SIZE = 4;

interface ProcessedRace {
  race: RaceSummary;
  participants: Participant[];
  analysis: RaceAnalysis;
  rows: PredictionRow[];
  instrumentation: {
    runId: string;
    featureSnapshots: ReturnType<typeof buildRunnerFeatureSnapshots>;
    marketSnapshots: ReturnType<typeof buildRunnerMarketSnapshots>;
  };
}

interface SelectionAlert {
  reunion: number;
  course: number;
  hippodrome: string;
  chevalNum: number;
  chevalNom: string;
  confiance: number;
  decision: PredictionDecision;
}

interface PreRaceAlert {
  reunion: number;
  course: number;
  chevalNum: number;
  chevalNom: string;
  variation: number | null;
  decision: PredictionDecision;
  confiance: number;
  extra: string[];
}

interface RangeOptions {
  reunion?: number | null;
  course?: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeVariationSignal(
  variation: number | null,
  hasVariationData: boolean
): SignalVariation {
  if (!hasVariationData) {
    return "DONNEE_INDISPONIBLE";
  }

  if (variation === null || Number.isNaN(variation)) {
    return "DONNEE_INDISPONIBLE";
  }

  if (variation <= -20) {
    return "FORTE_BAISSE";
  }

  if (variation < -5) {
    return "BAISSE";
  }

  if (variation >= 30) {
    return "FORTE_HAUSSE";
  }

  if (variation > 10) {
    return "HAUSSE";
  }

  return "STABLE";
}

function keepRace(race: RaceSummary, options: RangeOptions) {
  if (options.reunion !== null && options.reunion !== undefined && race.reunion !== options.reunion) {
    return false;
  }

  if (options.course !== null && options.course !== undefined && race.course !== options.course) {
    return false;
  }

  return true;
}

function getRaceKey(reunion: number, course: number) {
  return `${reunion}-${course}`;
}

function getCourseDecision(rows: PredictionRow[]): PredictionDecision {
  if (rows.some((row) => row.decision === "VALIDE")) {
    return "VALIDE";
  }

  if (rows.some((row) => row.decision === "SURVEILLANCE")) {
    return "SURVEILLANCE";
  }

  return "REJET";
}

function getPrimaryRaceRow(rows: PredictionRow[]) {
  return (
    rows.find((row) => row.decision === "VALIDE") ??
    rows.find((row) => row.decision === "SURVEILLANCE") ??
    rows[0] ??
    null
  );
}

function getHomeScoreStage(
  dateStr: string,
  race: RaceSummary
): ApiRaceScoreLite["stage"] {
  const minutesUntilStart = getMinutesUntilStart(race.heureDepart, dateStr);

  if (minutesUntilStart < -10) {
    return "finished";
  }

  if (minutesUntilStart <= 30) {
    return "final_30m";
  }

  if (minutesUntilStart <= 60) {
    return "preview_1h";
  }

  return "preview_2h";
}

function hasStrongOddsVariation(row: PredictionRow) {
  if (
    row.signal_variation === "FORTE_BAISSE" ||
    row.signal_variation === "FORTE_HAUSSE"
  ) {
    return true;
  }

  return row.variation_cote !== null && Math.abs(row.variation_cote) >= 20;
}

function hasBoardGreenSignal(dateStr: string, race: RaceSummary, rows: PredictionRow[]) {
  const primaryRow = getPrimaryRaceRow(rows);
  if (!primaryRow) {
    return false;
  }

  const courseDecision = getCourseDecision(rows);
  const stage = getHomeScoreStage(dateStr, race);
  const playable =
    stage !== "finished" &&
    primaryRow.lisibilite !== "LOTERIE" &&
    courseDecision !== "REJET" &&
    rows.some((row) => row.decision === "VALIDE");
  const apiLite: ApiRaceScoreLite = {
    score: null,
    scoreDetailsLocked: false,
    stage,
    lisibilite: primaryRow.lisibilite,
    decision: courseDecision,
    playable,
    pick: {
      numPmu: primaryRow.cheval_num,
      nom: primaryRow.cheval_nom,
      confidence: primaryRow.confiance,
      betType: primaryRow.pari_conseille ?? null,
      topFacteurs: null,
    },
  };

  return (
    computeClientRaceScore(
      race,
      apiLite,
      Math.round(getMinutesUntilStart(race.heureDepart, dateStr))
    ).playTier === "jouable"
  );
}

function buildRefreshHintsByRace(dateStr: string, races: RaceSummary[], rows: PredictionRow[]) {
  const hintsByRace = new Map<string, RefreshPriorityHints>();
  const raceByKey = new Map(
    races.map((race) => [getRaceKey(race.reunion, race.course), race] as const)
  );
  const rowsByRace = new Map<string, PredictionRow[]>();

  for (const row of rows) {
    const key = getRaceKey(row.reunion, row.course);
    const current = rowsByRace.get(key) ?? [];

    current.push(row);
    rowsByRace.set(key, current);
  }

  for (const [key, raceRows] of rowsByRace) {
    const race = raceByKey.get(key);
    const current = hintsByRace.get(key) ?? {};

    if (race && hasBoardGreenSignal(dateStr, race, raceRows)) {
      current.hasBoardGreenSignal = true;
    }

    if (raceRows.some((row) => row.decision === "VALIDE")) {
      current.hasPlayableSignal = true;
    }

    if (raceRows.some((row) => row.decision === "SURVEILLANCE")) {
      current.hasWatchSignal = true;
    }

    if (raceRows.some((row) => hasStrongOddsVariation(row))) {
      current.hasStrongOddsVariation = true;
    }

    hintsByRace.set(key, current);
  }

  return hintsByRace;
}

async function processRace(
  dateStr: string,
  race: RaceSummary,
  parameters: AlgoParameters,
  stage: "MATIN" | "T10" | "RESULTAT"
): Promise<ProcessedRace> {
  const participants = await attachFaultRates(
    await getParticipants(dateStr, race.reunion, race.course)
  );

  await upsertFaultRates(participants);
  const run = await createRaceEngineRun(
    buildRaceEngineRunRow(dateStr, race, stage, parameters, participants.length)
  );
  const runId = run.id;

  if (!runId) {
    throw new Error("Race engine run id missing after insert.");
  }

  try {
    await loadElitePerformers();
    const analysis = analyzeRaceWithParameters(race, participants, parameters);
    const rows = buildPredictionRows(dateStr, race, analysis, stage);

    return {
      race,
      participants,
      analysis,
      rows,
      instrumentation: {
        runId,
        featureSnapshots: buildRunnerFeatureSnapshots(
          runId,
          dateStr,
          race,
          stage,
          participants,
          analysis
        ),
        marketSnapshots: buildRunnerMarketSnapshots(dateStr, race, stage, participants),
      },
    };
  } catch (error) {
    await failRaceEngineRun(
      runId,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

function getPrimarySelection(processed: ProcessedRace): SelectionAlert | null {
  const primary =
    processed.rows.find((row) => row.decision === "VALIDE") ??
    processed.rows.find((row) => row.decision === "SURVEILLANCE") ??
    null;

  if (!primary) {
    return null;
  }

  return {
    reunion: processed.race.reunion,
    course: processed.race.course,
    hippodrome: processed.race.hippodrome,
    chevalNum: primary.cheval_num,
    chevalNom: primary.cheval_nom,
    confiance: primary.confiance,
    decision: primary.decision,
  };
}

async function processInBatches<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const all: R[] = [];

  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const batch = items.slice(index, index + BATCH_SIZE);
    const results = await Promise.all(batch.map((item) => worker(item)));
    all.push(...results);
  }

  return all;
}

async function persistProcessedRace(
  dateStr: string,
  processed: ProcessedRace,
  rows: PredictionRow[],
  extra?: {
    outcomeRows?: ReturnType<typeof buildRunnerOutcomeRows>;
    stageSnapshotNotes?: string[];
  }
) {
  try {
    await upsertCourseRecord(buildCourseRecord(dateStr, processed.race, processed.analysis));
    await upsertPredictions(rows);
    await upsertPredictionStageSnapshot(
      buildPredictionStageSnapshot(
        dateStr,
        processed.race,
        processed.analysis,
        rows,
        rows[0]?.stage ?? "MATIN",
        extra?.stageSnapshotNotes ?? []
      )
    );
    await upsertRunnerMarketSnapshots(processed.instrumentation.marketSnapshots);
    await upsertRunnerFeatureSnapshots(processed.instrumentation.featureSnapshots);
    await upsertRunnerScoreSnapshots(
      buildRunnerScoreSnapshots(processed.instrumentation.runId, rows, processed.analysis)
    );

    if (extra?.outcomeRows && extra.outcomeRows.length > 0) {
      await upsertRunnerOutcomes(extra.outcomeRows);
    }

    await completeRaceEngineRun(processed.instrumentation.runId, processed.analysis);
  } catch (error) {
    try {
      await failRaceEngineRun(
        processed.instrumentation.runId,
        error instanceof Error ? error.message : String(error)
      );
    } catch {
      /* ignore */
    }
    throw error;
  }
}

function adjustDecisionAfterPreRace(
  row: PredictionRow,
  parameters: AlgoParameters
): PredictionDecision {
  if (row.non_partant || row.lisibilite === "LOTERIE") {
    return "REJET";
  }

  if (
    row.confiance >= parameters.validation.confianceMin &&
    row.qualite >= parameters.validation.qualiteMin
  ) {
    return "VALIDE";
  }

  if (
    row.confiance >= parameters.validation.confianceMin - 0.6 ||
    row.qualite >= parameters.validation.qualiteMin - 6
  ) {
    return "SURVEILLANCE";
  }

  return "REJET";
}

function applyPreRaceSecondPass(
  rows: PredictionRow[],
  baselineRows: PredictionRow[],
  parameters: AlgoParameters
) {
  const baselineByHorse = new Map(
    baselineRows.map((row) => [row.cheval_num, row] as const)
  );

  const alerts: PreRaceAlert[] = [];
  const updatedRows = rows.map((row) => {
    const baseline = baselineByHorse.get(row.cheval_num);
    const notes: string[] = [];
    const coteMatin = baseline?.cote_matin ?? row.cote_matin ?? null;
    const coteActuelle = row.cote_depart ?? row.cote_matin ?? null;
    const hasVariationData = coteMatin !== null && coteActuelle !== null && coteMatin > 0;
    const variation =
      hasVariationData
        ? round2(((coteActuelle - coteMatin) / coteMatin) * 100)
        : row.variation_cote ?? null;

    let confiance = row.confiance;
    let decision = row.decision;

    if (variation !== null && variation <= parameters.preRace.strongDropPct) {
      confiance = round1(clamp(confiance + parameters.preRace.strongBonus, 0, 10));
      notes.push(`baisse forte ${variation}%`);
    }

    if (variation !== null && variation >= parameters.preRace.negativeRisePct) {
      confiance = round1(clamp(confiance - parameters.preRace.riseMalus, 0, 10));
      notes.push(`hausse ${variation}%`);
    }

    if (row.non_partant) {
      decision = "REJET";
      confiance = 0;
      notes.push("non partant");
    }

    if (
      baseline?.ferrure_ref &&
      row.ferrure_t10 &&
      baseline.ferrure_ref !== row.ferrure_t10
    ) {
      notes.push(`ferrure ${baseline.ferrure_ref} -> ${row.ferrure_t10}`);
    }

    const nextRow: PredictionRow = {
      ...row,
      cote_matin: coteMatin,
      cote_depart: coteActuelle,
      variation_cote: variation,
      confiance,
      decision,
      stage: "T10",
      signal_variation: normalizeVariationSignal(variation, hasVariationData),
    };

    nextRow.decision = adjustDecisionAfterPreRace(nextRow, parameters);

    if (
      variation !== null &&
      variation >= parameters.preRace.negativeRisePct &&
      nextRow.confiance < parameters.preRace.retractDecisionBelowConfidence
    ) {
      nextRow.decision = "REJET";
      if (!notes.includes("retrait validation")) {
        notes.push("retrait validation");
      }
    }

    if (
      nextRow.outsider &&
      nextRow.mise_simulee > 0 &&
      nextRow.pari_conseille === "GAGNANT"
    ) {
      nextRow.pari_conseille = "PLACE";
      nextRow.mise_simulee = Math.max(
        1,
        Math.round(nextRow.mise_simulee * parameters.outsiders.miseReductionFactor)
      );
      notes.push("outsider bascule place");
    }

    const confidenceDelta = baseline ? Math.abs((baseline.confiance ?? 0) - nextRow.confiance) : 0;
    const decisionChanged = baseline ? baseline.decision !== nextRow.decision : nextRow.decision !== "REJET";
    if (notes.length > 0 || decisionChanged || confidenceDelta >= 0.8) {
      alerts.push({
        reunion: nextRow.reunion,
        course: nextRow.course,
        chevalNum: nextRow.cheval_num,
        chevalNom: nextRow.cheval_nom,
        variation,
        decision: nextRow.decision,
        confiance: nextRow.confiance,
        extra: notes,
      });
    }

    return nextRow;
  });

  return { updatedRows, alerts };
}

function likesLightGround(value?: string | null) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return ["bon", "leger", "rapide", "sec", "firm", "good"].some((token) =>
    normalized.includes(token)
  );
}

function settlePredictionRow(
  row: PredictionRow,
  participant: Participant | undefined,
  reports: Awaited<ReturnType<typeof getFinalReports>>
) {
  const ordreArrivee =
    typeof participant?.ordreArrivee === "number" ? participant.ordreArrivee : null;
  const resultatGagnant = ordreArrivee === 1;
  const resultatPlace = ordreArrivee !== null && ordreArrivee <= 3;
  const rapportGagnant = reports.simpleGagnant[row.cheval_num] ?? null;
  const rapportPlace = reports.simplePlace[row.cheval_num] ?? null;
  const nonPartant = Boolean(participant?.nonPartant ?? row.non_partant);

  let gainSimule = 0;
  if (nonPartant && row.decision !== "REJET") {
    gainSimule = row.mise_simulee;
  } else if (row.pari_conseille === "GAGNANT" && resultatGagnant && rapportGagnant) {
    gainSimule = row.mise_simulee * rapportGagnant;
  } else if (row.pari_conseille === "PLACE" && resultatPlace && rapportPlace) {
    gainSimule = row.mise_simulee * rapportPlace;
  }

  return {
    ...row,
    cote_depart: participant?.cote ?? row.cote_depart,
    ferrure_t10: participant?.ferrure ?? row.ferrure_t10 ?? row.ferrure_ref ?? null,
    non_partant: nonPartant,
    resultat_place: resultatPlace,
    resultat_gagnant: resultatGagnant,
    rapport_place: rapportPlace,
    rapport_gagnant: rapportGagnant,
    gain_simule: round2(gainSimule),
    stage: "RESULTAT" as const,
  };
}

export async function runMorningAnalysis(dateStr: string) {
  const parameters = await loadAlgoParameters();
  const races = await getAllRaces(dateStr);
  const processed = await processInBatches(races, async (race) => {
    const current = await processRace(dateStr, race, parameters, "MATIN");
    await persistProcessedRace(dateStr, current, current.rows);
    return current;
  });

  const selections = processed
    .map(getPrimarySelection)
    .filter((selection): selection is SelectionAlert => selection !== null);

  if (isTelegramConfigured()) {
    await sendTelegramMessage(formatMorningTelegram(dateStr, selections));
  }

  try {
    await genererAvisJour(dateStr);
    console.log("Avis expert generes");
  } catch (error) {
    console.error("Erreur generation avis:", error);
  }

  return {
    success: true,
    date: dateStr,
    racesProcessed: processed.length,
    predictionsStored: processed.reduce((sum, race) => sum + race.rows.length, 0),
    validated: selections.filter((selection) => selection.decision === "VALIDE").length,
    surveillance: selections.filter((selection) => selection.decision === "SURVEILLANCE").length,
    selections,
  };
}

export async function runPreRaceSecondPass(
  dateStr: string,
  options: RangeOptions = {}
) {
  const parameters = await loadAlgoParameters();
  const explicitTarget =
    (options.reunion !== null && options.reunion !== undefined) ||
    (options.course !== null && options.course !== undefined);
  const candidateRaces = (await getAllRaces(dateStr)).filter((race) =>
    keepRace(race, options)
  );
  const now = new Date();
  const refreshHintsByRace = explicitTarget
    ? new Map<string, RefreshPriorityHints>()
    : buildRefreshHintsByRace(
        dateStr,
        candidateRaces,
        await listPredictionsByDate(dateStr)
      );
  const scheduledRaces = candidateRaces.map((race) => ({
    race,
    refresh: getPreRaceRefreshDecision(
      race,
      now,
      refreshHintsByRace.get(getRaceKey(race.reunion, race.course))
    ),
  }));
  const races = explicitTarget
    ? candidateRaces
    : scheduledRaces.filter((entry) => entry.refresh.due).map((entry) => entry.race);

  const processed = await processInBatches(races, async (race) => {
    const baselineRows = await getRacePredictions(dateStr, race.reunion, race.course);
    const current = await processRace(dateStr, race, parameters, "T10");
    const { updatedRows, alerts } = applyPreRaceSecondPass(
      current.rows,
      baselineRows,
      parameters
    );

    await persistProcessedRace(dateStr, current, updatedRows, {
      stageSnapshotNotes: alerts.slice(0, 3).map((alert) => {
        const details = alert.extra.length > 0 ? ` (${alert.extra.join(", ")})` : "";
        return `#${alert.chevalNum} ${alert.chevalNom} -> ${alert.decision}${details}`;
      }),
    });
    await snapshotLiveCotes(dateStr, race, current.participants);
    const meteo = await fetchMeteoHippodrome(race.hippodrome, race.heureDepart);
    if (meteo?.terrain_impact === "DEFAVORABLE") {
      const validRows = updatedRows.filter((row) => row.decision === "VALIDE");
      const impacted = validRows
        .map((row) => {
          const participant = current.participants.find((item) => item.numPmu === row.cheval_num);
          return participant && likesLightGround(participant.terrainPreference)
            ? `#${row.cheval_num} ${row.cheval_nom}`
            : null;
        })
        .filter((value): value is string => value !== null);

      if (impacted.length > 0) {
        await alerteTerrainChange(
          `R${race.reunion}C${race.course}`,
          race.hippodrome,
          meteo,
          impacted
        );
      }
    }

    return {
      race,
      updatedRows,
      alerts,
    };
  });

  const alerts = processed.flatMap((race) => race.alerts);
  if (alerts.length > 0 && isTelegramConfigured()) {
    await sendTelegramMessage(formatPreRaceTelegram(dateStr, alerts));
  }

  return {
    success: true,
    date: dateStr,
    scheduleMode: explicitTarget ? "manual" : "dynamic-windows",
    racesConsidered: candidateRaces.length,
    racesProcessed: processed.length,
    racesSkippedBySchedule: explicitTarget
      ? 0
      : scheduledRaces.filter((entry) => !entry.refresh.due).length,
    updatedPredictions: processed.reduce((sum, race) => sum + race.updatedRows.length, 0),
    alerts,
  };
}

export async function runResultSync(dateStr: string, options: RangeOptions = {}) {
  const parameters = await loadAlgoParameters();
  const explicitTarget =
    (options.reunion !== null && options.reunion !== undefined) ||
    (options.course !== null && options.course !== undefined);
  const isHistoricalDate =
    parsePmuDate(dateStr).getTime() < parsePmuDate(getTodayDateStrFromUtils()).getTime();
  const candidateRaces = (await getAllRaces(dateStr)).filter((race) =>
    keepRace(race, options)
  );
  const now = new Date();
  const scheduledRaces = candidateRaces.map((race) => ({
    race,
    refresh: getResultRefreshDecision(race, now),
  }));
  const races = isHistoricalDate
    ? candidateRaces
    : explicitTarget
    ? candidateRaces.filter(
        (race) => getMinutesUntilStart(race.heureDepart, race.dateStr) < -10
      )
    : scheduledRaces.filter((entry) => entry.refresh.due).map((entry) => entry.race);

  const processed = await processInBatches(races, async (race) => {
    const current = await processRace(dateStr, race, parameters, "RESULTAT");
    const baselineRows = await getRacePredictions(dateStr, race.reunion, race.course);
    const reports = await getFinalReports(dateStr, race.reunion, race.course);
    const participantByHorse = new Map(
      current.participants.map((participant) => [participant.numPmu, participant] as const)
    );

    const sourceRows = baselineRows.length > 0 ? baselineRows : current.rows;
    const settledRows = sourceRows.map((row) =>
      settlePredictionRow(row, participantByHorse.get(row.cheval_num), reports)
    );

    await persistProcessedRace(dateStr, current, settledRows, {
      outcomeRows: buildRunnerOutcomeRows(dateStr, race, current.participants, reports),
      stageSnapshotNotes: settledRows
        .filter((row) => row.resultat_gagnant || row.resultat_place)
        .slice(0, 3)
        .map(
          (row) =>
            `#${row.cheval_num} ${row.cheval_nom} ${
              row.resultat_gagnant ? "gagnant" : "place"
            }`
        ),
    });

    return {
      race,
      settledRows,
    };
  });

  return {
    success: true,
    date: dateStr,
    scheduleMode: isHistoricalDate
      ? "historical-backfill"
      : explicitTarget
        ? "manual"
        : "dynamic-windows",
    racesConsidered: candidateRaces.length,
    racesProcessed: processed.length,
    racesSkippedBySchedule: isHistoricalDate
      ? 0
      : explicitTarget
      ? Math.max(candidateRaces.length - races.length, 0)
      : scheduledRaces.filter((entry) => !entry.refresh.due).length,
    settledPredictions: processed.reduce((sum, race) => sum + race.settledRows.length, 0),
  };
}
