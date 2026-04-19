import { getSupabaseAdminClient } from "@/lib/supabase";

interface BacktestRunRow {
  id: string;
  date: string;
  reunion: number;
  course: number;
}

interface BacktestScoreRow {
  run_id: string;
  cheval_num: number;
  score_expert: number;
  score_v10?: number | null;
  score_v10_1?: number | null;
  blend_payload: Record<string, unknown>;
}

interface BacktestOutcomeRow {
  date: string;
  reunion: number;
  course: number;
  cheval_num: number;
  resultat_gagnant: boolean;
  resultat_place: boolean;
  rapport_gagnant?: number | null;
  rapport_place?: number | null;
}

export interface BacktestMetric {
  bets: number;
  winners: number;
  stake: number;
  gain: number;
  roi: number;
}

export interface BacktestV101Report {
  startIso: string;
  endIso: string;
  oldScoring: BacktestMetric;
  v10: BacktestMetric;
  v101: BacktestMetric;
  rolesV10: Record<string, BacktestMetric>;
  rolesV101: Record<string, BacktestMetric>;
}

const ROLE_KEYS = ["CHOIX", "PEPITE", "CHASSEUR", "PODIUM", "OUTSIDER"] as const;

function createMetric(): BacktestMetric {
  return { bets: 0, winners: 0, stake: 0, gain: 0, roi: 0 };
}

function finalizeMetric(metric: BacktestMetric) {
  return {
    ...metric,
    gain: Math.round(metric.gain * 100) / 100,
    stake: Math.round(metric.stake * 100) / 100,
    roi: metric.stake > 0 ? Math.round(((metric.gain - metric.stake) / metric.stake) * 1000) / 10 : 0,
  };
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function addBet(metric: BacktestMetric, outcome: BacktestOutcomeRow | undefined, betType: "GAGNANT" | "PLACE") {
  metric.bets += 1;
  metric.stake += 1;

  if (!outcome) {
    return;
  }

  const won = betType === "PLACE" ? outcome.resultat_place : outcome.resultat_gagnant;
  if (!won) {
    return;
  }

  metric.winners += 1;
  metric.gain +=
    betType === "PLACE"
      ? outcome.rapport_place ?? 2.5
      : outcome.rapport_gagnant ?? 2.5;
}

function selectTop(
  rows: BacktestScoreRow[],
  key: "score_expert" | "score_v10" | "score_v10_1"
) {
  return rows
    .filter((row) => {
      const value = row[key];
      return typeof value === "number" && Number.isFinite(value);
    })
    .sort((left, right) => Number(right[key] ?? 0) - Number(left[key] ?? 0))[0];
}

async function fetchBacktestRows(startIso: string, endIso: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin n'est pas configuré.");
  }

  const [{ data: runs, error: runsError }, { data: outcomes, error: outcomesError }] =
    await Promise.all([
      admin
        .from("race_engine_runs")
        .select("id,date,reunion,course")
        .gte("date", startIso)
        .lte("date", endIso)
        .eq("status", "COMPLETED"),
      admin
        .from("runner_outcomes")
        .select("date,reunion,course,cheval_num,resultat_gagnant,resultat_place,rapport_gagnant,rapport_place")
        .gte("date", startIso)
        .lte("date", endIso),
    ]);

  if (runsError) throw new Error(`Backtest runs fetch failed: ${runsError.message}`);
  if (outcomesError) throw new Error(`Backtest outcomes fetch failed: ${outcomesError.message}`);

  const runRows = (runs ?? []) as BacktestRunRow[];
  const scores: BacktestScoreRow[] = [];

  for (let index = 0; index < runRows.length; index += 200) {
    const chunk = runRows.slice(index, index + 200).map((run) => run.id);
    const { data, error } = await admin
      .from("runner_score_snapshots")
      .select("run_id,cheval_num,score_expert,score_v10,score_v10_1,blend_payload")
      .in("run_id", chunk);
    if (error) throw new Error(`Backtest score fetch failed: ${error.message}`);
    scores.push(...((data ?? []) as BacktestScoreRow[]));
  }

  return {
    runs: runRows,
    scores,
    outcomes: (outcomes ?? []) as BacktestOutcomeRow[],
  };
}

export async function runBacktestV101(
  startIso = "2024-04-10",
  endIso = "2026-04-07"
): Promise<BacktestV101Report> {
  const { runs, scores, outcomes } = await fetchBacktestRows(startIso, endIso);
  const scoresByRun = new Map<string, BacktestScoreRow[]>();
  for (const score of scores) {
    scoresByRun.set(score.run_id, [...(scoresByRun.get(score.run_id) ?? []), score]);
  }

  const outcomeByKey = new Map(
    outcomes.map((outcome) => [
      `${outcome.date}-${outcome.reunion}-${outcome.course}-${outcome.cheval_num}`,
      outcome,
    ] as const)
  );
  const oldScoring = createMetric();
  const v10 = createMetric();
  const v101 = createMetric();
  const rolesV10 = Object.fromEntries(ROLE_KEYS.map((role) => [role, createMetric()]));
  const rolesV101 = Object.fromEntries(ROLE_KEYS.map((role) => [role, createMetric()]));

  for (const run of runs) {
    const runScores = scoresByRun.get(run.id) ?? [];
    const oldPick = selectTop(runScores, "score_expert");
    const v10Pick = selectTop(runScores, "score_v10");
    const v101Pick = selectTop(runScores, "score_v10_1");

    if (oldPick) {
      addBet(
        oldScoring,
        outcomeByKey.get(`${run.date}-${run.reunion}-${run.course}-${oldPick.cheval_num}`),
        "GAGNANT"
      );
    }

    if (v10Pick) {
      addBet(
        v10,
        outcomeByKey.get(`${run.date}-${run.reunion}-${run.course}-${v10Pick.cheval_num}`),
        "GAGNANT"
      );
    }

    if (v101Pick) {
      addBet(
        v101,
        outcomeByKey.get(`${run.date}-${run.reunion}-${run.course}-${v101Pick.cheval_num}`),
        "GAGNANT"
      );
    }

    for (const score of runScores) {
      const outcome = outcomeByKey.get(`${run.date}-${run.reunion}-${run.course}-${score.cheval_num}`);
      const payload = getRecord(score.blend_payload);
      const roleV10 = getString(getRecord(payload?.v10)?.role);
      const roleV101 = getString(getRecord(payload?.v101)?.role);
      const betTypeV10 = getString(getRecord(payload?.v10)?.betType) === "PLACE" ? "PLACE" : "GAGNANT";
      const betTypeV101 = getString(getRecord(payload?.v101)?.betType) === "PLACE" ? "PLACE" : "GAGNANT";

      if (roleV10 && roleV10 in rolesV10) {
        addBet(rolesV10[roleV10], outcome, betTypeV10);
      }

      if (roleV101 && roleV101 in rolesV101) {
        addBet(rolesV101[roleV101], outcome, betTypeV101);
      }
    }
  }

  return {
    startIso,
    endIso,
    oldScoring: finalizeMetric(oldScoring),
    v10: finalizeMetric(v10),
    v101: finalizeMetric(v101),
    rolesV10: Object.fromEntries(
      Object.entries(rolesV10).map(([role, metric]) => [role, finalizeMetric(metric)])
    ),
    rolesV101: Object.fromEntries(
      Object.entries(rolesV101).map(([role, metric]) => [role, finalizeMetric(metric)])
    ),
  };
}
