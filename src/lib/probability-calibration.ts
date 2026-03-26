import { getCachedBacktest, runBacktest } from "@/lib/backtesting";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import type { BacktestSummary, ParamHistoryRow } from "@/lib/types";

const MIN_SAMPLE_PER_BIN = 100;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseRange(label: string) {
  const [rawMin, rawMax] = label.replace("%", "").split("-");
  const min = Number(rawMin) / 100;
  const max = Number(rawMax) / 100;
  return { min, max };
}

function buildCalibrationPayload(backtest: BacktestSummary) {
  return {
    bins: backtest.calibration.map((bin) => {
      const { min, max } = parseRange(bin.label);
      const ratio =
        bin.sampleSize >= MIN_SAMPLE_PER_BIN && bin.averagePredicted > 0
          ? bin.actualWinRate / bin.averagePredicted
          : 1;

      return {
        min,
        max,
        multiplier: round2(clamp(ratio, 0.6, 1.5)),
        sampleSize: bin.sampleSize,
      };
    }),
  };
}

export async function runProbabilityCalibration(days = 90, referenceDate = new Date()) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(getSupabaseAdminConfigError());
  }

  const backtest =
    (await getCachedBacktest(days)) ?? (await runBacktest(days, referenceDate));
  const payload = buildCalibrationPayload(backtest);

  const { data: previousRow } = await admin
    .from("parametres")
    .select("value_json")
    .eq("key", "probabilityCalibration")
    .maybeSingle();

  const previousValue = previousRow?.value_json ?? null;

  const { error: upsertError } = await admin.from("parametres").upsert(
    {
      key: "probabilityCalibration",
      value_json: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (upsertError) {
    throw new Error(`Probability calibration upsert failed: ${upsertError.message}`);
  }

  const historyRow: ParamHistoryRow = {
    parameter_key: "probabilityCalibration",
    previous_value: JSON.stringify(previousValue),
    next_value: JSON.stringify(payload),
    reason: `Calibration probabiliste sur ${days} jours a partir des resultats reels`,
  };

  const { error: historyError } = await admin.from("param_history").insert(historyRow);
  if (historyError) {
    throw new Error(`Probability calibration history insert failed: ${historyError.message}`);
  }

  return {
    success: true,
    days,
    payload,
    sourceBacktest: {
      startDate: backtest.startDate,
      endDate: backtest.endDate,
      racesAnalyzed: backtest.racesAnalyzed,
      roi: backtest.roi,
    },
  };
}
