import { getRaceTimestamp, getTodayDateStr, toIsoDate } from "@/lib/date-utils";
import {
  buildMorningHighlightNotification,
} from "@/lib/push-campaigns";
import { syncProgramToSupabase } from "@/lib/cron-program-sync";
import { getAllRaces } from "@/lib/pmu-api";
import {
  getRacePredictions,
  listPredictionsByDate,
} from "@/lib/prediction-store";
import {
  runMorningAnalysis,
  runPreRaceSecondPass,
  runResultSync,
} from "@/lib/prediction-pipeline";
import { sendPushNotificationToAll } from "@/lib/push-notifications";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";
import type { PredictionRow, RaceSummary } from "@/lib/types";

const PRE_RACE_MIN_MINUTES = 25;
const PRE_RACE_MAX_MINUTES = 35;

interface BetResultRow {
  race_date: string;
  reunion: number;
  course: number;
  cheval_num: number;
  cheval_nom: string;
  prediction_decision: string;
  bet_type: string | null;
  stake: number;
  odds: number | null;
  result_position: number | null;
  result_status: string;
  gain: number;
  profit: number;
  roi: number;
  updated_at: string;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPct(value: number) {
  return `${Math.round(value)}%`;
}

function getPrimaryPrediction(rows: PredictionRow[]) {
  return (
    rows.find((row) => row.decision === "VALIDE") ??
    rows.find((row) => row.decision === "SURVEILLANCE") ??
    rows[0] ??
    null
  );
}

function getScorePercent(row: PredictionRow) {
  const score = row.score_final_pari ?? row.score_blended ?? row.score_cheval;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getOdds(row: PredictionRow) {
  return row.cote_depart ?? row.cote_matin ?? null;
}

function getDisplayEdge(row: PredictionRow) {
  const odds = getOdds(row);
  if (!odds || odds <= 1) {
    return Math.max(0, row.value ?? 0);
  }

  const probability = getScorePercent(row) / 100;
  return Math.max(0, (probability * odds - 1) * 100);
}

async function sendTelegramIfConfigured(message: string) {
  if (!isTelegramConfigured()) {
    return;
  }

  await sendTelegramMessage(message);
}

function getMinutesUntilRace(race: RaceSummary, now: Date) {
  return (getRaceTimestamp(race.dateStr, race.heureDepart).getTime() - now.getTime()) / 60000;
}

function isInPreRaceWindow(race: RaceSummary, now: Date) {
  const minutes = getMinutesUntilRace(race, now);
  return minutes >= PRE_RACE_MIN_MINUTES && minutes <= PRE_RACE_MAX_MINUTES;
}

function buildPreRaceMessage(race: RaceSummary, prediction: PredictionRow) {
  const odds = getOdds(prediction);
  const edge = getDisplayEdge(prediction);
  const stake = Math.max(1, Math.min(25, Math.round(prediction.mise_simulee || 1)));

  return [
    `🏇 DANS 30 MIN — ${race.hippodrome} R${race.reunion}C${race.course}`,
    `🥇 JOUER: ${prediction.cheval_nom} N°${prediction.cheval_num} — Cote ${odds ? odds.toFixed(1) : "n/d"} — Mise ${stake}€`,
    `📊 Confiance: ${formatPct(getScorePercent(prediction))} — Edge: ${formatPct(edge)}`,
  ].join("\n");
}

function getRaceHorseKey(row: Pick<PredictionRow, "reunion" | "course" | "cheval_num">) {
  return `${row.reunion}:${row.course}:${row.cheval_num}`;
}

function predictionToBetResult(
  row: PredictionRow,
  updatedAt: string,
  resultPosition: number | null
): BetResultRow {
  const stake = Math.max(0, row.mise_simulee ?? 0);
  const gain = roundCurrency(row.gain_simule ?? 0);
  const profit = roundCurrency(gain - stake);
  const roi = stake > 0 ? roundCurrency((profit / stake) * 100) : 0;
  const won = row.pari_conseille === "PLACE" ? row.resultat_place : row.resultat_gagnant;
  const resultStatus = row.non_partant ? "VOID" : won ? "WON" : "LOST";
  const odds =
    row.pari_conseille === "PLACE"
      ? row.rapport_place ?? row.cote_depart ?? row.cote_matin
      : row.rapport_gagnant ?? row.cote_depart ?? row.cote_matin;

  return {
    race_date: row.date,
    reunion: row.reunion,
    course: row.course,
    cheval_num: row.cheval_num,
    cheval_nom: row.cheval_nom,
    prediction_decision: row.decision,
    bet_type: row.pari_conseille ?? null,
    stake,
    odds,
    result_position: resultPosition,
    result_status: resultStatus,
    gain,
    profit,
    roi,
    updated_at: updatedAt,
  };
}

async function upsertBetResultsForDate(dateStr: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      rows: [] as BetResultRow[],
      totalStake: 0,
      totalGain: 0,
      totalProfit: 0,
      roi: 0,
      skipped: true,
    };
  }

  const updatedAt = new Date().toISOString();
  const { data: outcomeData, error: outcomeError } = await admin
    .from("runner_outcomes")
    .select("reunion,course,cheval_num,ordre_arrivee")
    .eq("date", toIsoDate(dateStr));

  if (outcomeError) {
    throw new Error(`Runner outcomes fetch failed: ${outcomeError.message}`);
  }

  const positionsByHorse = new Map(
    ((outcomeData ?? []) as Array<Record<string, unknown>>).map((row) => [
      `${Number(row.reunion)}:${Number(row.course)}:${Number(row.cheval_num)}`,
      typeof row.ordre_arrivee === "number" ? row.ordre_arrivee : null,
    ])
  );
  const rows = (await listPredictionsByDate(dateStr))
    .filter((row) => row.stage === "RESULTAT" && row.decision !== "REJET")
    .map((row) =>
      predictionToBetResult(row, updatedAt, positionsByHorse.get(getRaceHorseKey(row)) ?? null)
    );

  if (rows.length > 0) {
    const { error } = await admin.from("bet_results").upsert(rows, {
      onConflict: "race_date,reunion,course,cheval_num",
    });

    if (error) {
      throw new Error(`Bet results upsert failed: ${error.message}`);
    }
  }

  const totalStake = roundCurrency(rows.reduce((sum, row) => sum + row.stake, 0));
  const totalGain = roundCurrency(rows.reduce((sum, row) => sum + row.gain, 0));
  const totalProfit = roundCurrency(totalGain - totalStake);

  return {
    rows,
    totalStake,
    totalGain,
    totalProfit,
    roi: totalStake > 0 ? roundCurrency((totalProfit / totalStake) * 100) : 0,
    skipped: false,
  };
}

function buildResultTelegram(rows: BetResultRow[]) {
  const playable = rows.filter((row) => row.stake > 0);
  const firstWin = playable.find((row) => row.result_status === "WON");
  const firstLoss = playable.find((row) => row.result_status === "LOST");
  const row = firstWin ?? firstLoss ?? playable[0] ?? null;

  if (!row) {
    return "RESULTATS TURFEDGE - Aucun pari valide a noter.";
  }

  if (row.result_status === "WON") {
    return `✅ GAGNÉ: ${row.cheval_nom} 1er — +${Math.max(0, row.profit).toFixed(2)}€`;
  }

  return `❌ RATÉ: ${row.cheval_nom} ${row.result_position ?? "position inconnue"}ème`;
}

function buildRichResultTelegram(rows: BetResultRow[]) {
  if (process.env.PMU_LEGACY_RESULT_TELEGRAM === "1") {
    return buildResultTelegram(rows);
  }

  const playable = rows.filter((row) => row.stake > 0);

  if (playable.length === 0) {
    return [
      "🏁 Résultats TurfEdge",
      "━━━━━━━━━━━━━━",
      "Aucun pari valide à noter.",
    ].join("\n");
  }

  const totalStake = roundCurrency(playable.reduce((sum, row) => sum + row.stake, 0));
  const totalGain = roundCurrency(playable.reduce((sum, row) => sum + row.gain, 0));
  const totalProfit = roundCurrency(totalGain - totalStake);
  const roi = totalStake > 0 ? roundCurrency((totalProfit / totalStake) * 100) : 0;
  const won = playable.filter((row) => row.result_status === "WON");
  const lost = playable.filter((row) => row.result_status === "LOST");
  const topRows = [...playable]
    .sort((left, right) => right.profit - left.profit)
    .slice(0, 5)
    .map((row) => {
      const icon = row.result_status === "WON" ? "🟢" : "🔴";
      const position = row.result_position ? `${row.result_position}e` : "position inconnue";
      return `${icon} R${row.reunion}C${row.course} #${row.cheval_num} ${row.cheval_nom}\n🎯 ${row.bet_type ?? "PARI"} · ${position} · ${row.profit >= 0 ? "+" : ""}${row.profit.toFixed(2)}€`;
    });

  return [
    "🏁 Résultats TurfEdge",
    "━━━━━━━━━━━━━━",
    `${totalProfit >= 0 ? "🟢" : "🔴"} Gain net : ${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}€`,
    `📊 ROI : ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
    `🎟️ Tickets : ${playable.length} · Gagnés : ${won.length} · Perdus : ${lost.length}`,
    `💶 Mises : ${totalStake.toFixed(2)}€ · Gains : ${totalGain.toFixed(2)}€`,
    "━━━━━━━━━━━━━━",
    ...topRows,
  ].join("\n");
}

export async function runCronMorningJob(dateStr = getTodayDateStr()) {
  const program = await syncProgramToSupabase(dateStr);
  const summary = await runMorningAnalysis(dateStr);
  const racesProcessed =
    typeof summary.racesProcessed === "number" ? summary.racesProcessed : 0;
  const predictionsStored =
    typeof summary.predictionsStored === "number" ? summary.predictionsStored : 0;
  const [races, rows] = await Promise.all([
    getAllRaces(dateStr),
    listPredictionsByDate(dateStr),
  ]);
  const morningPush = buildMorningHighlightNotification(dateStr, races, rows);
  const pushDelivery = morningPush
    ? await sendPushNotificationToAll(morningPush)
    : { sent: 0, removed: 0, skipped: true };

  await sendTelegramIfConfigured(
    `✅ ${racesProcessed} courses analysées, ${predictionsStored} partants scorés`
  );

  return {
    date: dateStr,
    coursesProcessed: racesProcessed,
    runnersScored: predictionsStored,
    program,
    summary,
    push: pushDelivery,
  };
}

export async function runCronPreRaceJob(dateStr = getTodayDateStr()) {
  const now = new Date();
  const races = (await getAllRaces(dateStr)).filter((race) => isInPreRaceWindow(race, now));
  const results = [];
  let predictionsUpdated = 0;

  for (const race of races) {
    const summary = await runPreRaceSecondPass(dateStr, {
      reunion: race.reunion,
      course: race.course,
    });
    const rows = await getRacePredictions(dateStr, race.reunion, race.course);
    const primary = getPrimaryPrediction(rows);

    if (primary) {
      await sendTelegramIfConfigured(buildPreRaceMessage(race, primary));
    }

    predictionsUpdated +=
      typeof summary.updatedPredictions === "number" ? summary.updatedPredictions : 0;
    results.push({
      race: `R${race.reunion}C${race.course}`,
      hippodrome: race.hippodrome,
      minutesUntilStart: Math.round(getMinutesUntilRace(race, now)),
      summary,
      selection: primary
        ? {
            chevalNum: primary.cheval_num,
            chevalNom: primary.cheval_nom,
            score: getScorePercent(primary),
            edge: roundCurrency(getDisplayEdge(primary)),
            stake: Math.max(1, Math.min(25, Math.round(primary.mise_simulee || 1))),
          }
        : null,
    });
  }

  return {
    date: dateStr,
    coursesProcessed: races.length,
    predictionsUpdated,
    results,
  };
}

export async function runCronResultsJob(dateStr = getTodayDateStr()) {
  const summary = await runResultSync(dateStr);
  const betResults = await upsertBetResultsForDate(dateStr);

  await sendTelegramIfConfigured(buildRichResultTelegram(betResults.rows));

  return {
    date: dateStr,
    coursesProcessed:
      typeof summary.racesProcessed === "number" ? summary.racesProcessed : 0,
    summary,
    betResults: {
      rows: betResults.rows.length,
      totalStake: betResults.totalStake,
      totalGain: betResults.totalGain,
      totalProfit: betResults.totalProfit,
      roi: betResults.roi,
      skipped: betResults.skipped,
    },
  };
}

export async function runCronHealthJob(dateStr = getTodayDateStr()) {
  const admin = getSupabaseAdminClient();
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  if (!admin) {
    checks.supabase = {
      ok: false,
      detail: "Configuration Supabase admin absente",
    };
    await sendTelegramIfConfigured("⚠️ ALERTE TURFEDGE: Configuration Supabase admin absente");
    return {
      status: "degraded",
      date: dateStr,
      checks,
    };
  }

  const isoDate = toIsoDate(dateStr);
  const { count: predictionCount, error: predictionError } = await admin
    .from("predictions")
    .select("*", { count: "exact", head: true })
    .eq("date", isoDate);

  const { data: runData, count: runCount, error: runError } = await admin
    .from("race_engine_runs")
    .select("id", { count: "exact" })
    .eq("date", isoDate)
    .eq("status", "COMPLETED")
    .limit(200);
  const runIds = ((runData ?? []) as Array<{ id?: string | null }>)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const { count: scoreCount, error: scoreError } =
    runIds.length > 0
      ? await admin
          .from("runner_score_snapshots")
          .select("*", { count: "exact", head: true })
          .in("run_id", runIds)
      : { count: 0, error: null };

  checks.supabase = {
    ok: !predictionError && !runError && !scoreError,
    detail: predictionError?.message ?? runError?.message ?? scoreError?.message ?? "OK",
  };
  checks.predictions = {
    ok: (predictionCount ?? 0) > 0,
    detail: `${predictionCount ?? 0} predictions du jour`,
  };
  checks.scores = {
    ok: (scoreCount ?? 0) > 0,
    detail: `${scoreCount ?? 0} scores sur ${runCount ?? 0} analyses moteur terminées`,
  };
  checks.telegram = {
    ok: isTelegramConfigured(),
    detail: isTelegramConfigured() ? "Telegram configure" : "Telegram non configure",
  };

  const failed = Object.entries(checks).filter(([, check]) => !check.ok);
  if (failed.length > 0) {
    await sendTelegramIfConfigured(
      `⚠️ ALERTE TURFEDGE: ${failed
        .map(([name, check]) => `${name}: ${check.detail}`)
        .join(" | ")}`
    );
  }

  return {
    status: failed.length > 0 ? "degraded" : "ok",
    date: dateStr,
    checks,
  };
}
