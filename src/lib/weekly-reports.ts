import { loadAlgoParameters } from "@/lib/config";
import { getWeekBounds } from "@/lib/date-utils";
import { listCourseRecordsBetween, listPredictionsBetween } from "@/lib/prediction-store";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import {
  formatWeeklyTelegram,
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/lib/telegram";
import type {
  AlgoParameters,
  ParamHistoryRow,
  PredictionRow,
  WeeklyReportRow,
} from "@/lib/types";

interface SegmentAccumulator {
  count: number;
  stake: number;
  gain: number;
}

interface Adjustment {
  parameterKey: "validation" | "lisibilite" | "value";
  previousValue: unknown;
  nextValue: unknown;
  reason: string;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toRoiRecord(map: Record<string, SegmentAccumulator>) {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => {
      const roi =
        value.stake > 0 ? round2(((value.gain - value.stake) / value.stake) * 100) : 0;
      return [key, roi];
    })
  );
}

function appendToSegment(
  map: Record<string, SegmentAccumulator>,
  key: string,
  row: PredictionRow
) {
  if (!map[key]) {
    map[key] = { count: 0, stake: 0, gain: 0 };
  }

  map[key].count += 1;
  map[key].stake += row.mise_simulee ?? 0;
  map[key].gain += row.gain_simule ?? 0;
}

function getConfidenceBucket(score: number) {
  if (score >= 7.5) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

function getTopSegmentLabel(segments: Record<string, SegmentAccumulator>) {
  return Object.entries(segments)
    .filter(([, value]) => value.count > 0)
    .map(([key, value]) => ({
      key,
      roi: value.stake > 0 ? ((value.gain - value.stake) / value.stake) * 100 : 0,
      count: value.count,
    }))
    .sort((left, right) => {
      if (right.roi !== left.roi) return right.roi - left.roi;
      return right.count - left.count;
    });
}

function buildAdjustments(
  parameters: AlgoParameters,
  decisionSegments: Record<string, SegmentAccumulator>,
  lisibiliteSegments: Record<string, SegmentAccumulator>,
  highValueSegment: SegmentAccumulator
) {
  const adjustments: Adjustment[] = [];

  const lowConfidenceDecision = decisionSegments.SURVEILLANCE;
  if (lowConfidenceDecision && lowConfidenceDecision.count >= 20) {
    const roi =
      lowConfidenceDecision.stake > 0
        ? ((lowConfidenceDecision.gain - lowConfidenceDecision.stake) /
            lowConfidenceDecision.stake) *
          100
        : 0;

    if (roi < -12) {
      const nextValue = {
        ...parameters.validation,
        confianceMin: round2(clamp(parameters.validation.confianceMin + 0.2, 6, 7.2)),
      };
      if (nextValue.confianceMin !== parameters.validation.confianceMin) {
        adjustments.push({
          parameterKey: "validation",
          previousValue: parameters.validation,
          nextValue,
          reason: "ROI SURVEILLANCE trop faible sur la semaine",
        });
      }
    } else if (roi > 8) {
      const nextValue = {
        ...parameters.validation,
        confianceMin: round2(clamp(parameters.validation.confianceMin - 0.1, 5.6, 7.2)),
      };
      if (nextValue.confianceMin !== parameters.validation.confianceMin) {
        adjustments.push({
          parameterKey: "validation",
          previousValue: parameters.validation,
          nextValue,
          reason: "ROI SURVEILLANCE solide, seuil de confiance legerement assoupli",
        });
      }
    }
  }

  const complexSegment = lisibiliteSegments.COMPLEXE;
  if (complexSegment && complexSegment.count >= 20) {
    const roi =
      complexSegment.stake > 0
        ? ((complexSegment.gain - complexSegment.stake) / complexSegment.stake) * 100
        : 0;
    const current = parameters.lisibilite.coefficients.COMPLEXE;
    let nextCoefficient = current;

    if (roi < -15) {
      nextCoefficient = round2(clamp(current - 0.05, 0.4, 0.8));
    } else if (roi > 10) {
      nextCoefficient = round2(clamp(current + 0.05, 0.4, 0.8));
    }

    if (nextCoefficient !== current) {
      adjustments.push({
        parameterKey: "lisibilite",
        previousValue: parameters.lisibilite,
        nextValue: {
          ...parameters.lisibilite,
          coefficients: {
            ...parameters.lisibilite.coefficients,
            COMPLEXE: nextCoefficient,
          },
        },
        reason: "Recalibrage du coefficient COMPLEXE selon le ROI hebdomadaire",
      });
    }
  }

  if (highValueSegment.count >= 20) {
    const roi =
      highValueSegment.stake > 0
        ? ((highValueSegment.gain - highValueSegment.stake) / highValueSegment.stake) * 100
        : 0;
    const current = parameters.value.maxCap;
    let nextCap = current;

    if (roi < -15) {
      nextCap = round2(clamp(current - 0.5, 3, 6));
    } else if (roi > 12) {
      nextCap = round2(clamp(current + 0.25, 3, 6));
    }

    if (nextCap !== current) {
      adjustments.push({
        parameterKey: "value",
        previousValue: parameters.value,
        nextValue: {
          ...parameters.value,
          maxCap: nextCap,
        },
        reason: "Ajustement du plafond de value selon le ROI des tickets a forte value",
      });
    }
  }

  return adjustments;
}

async function persistAdjustments(adjustments: Adjustment[]) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(getSupabaseAdminConfigError());
  }

  if (adjustments.length === 0) {
    return [];
  }

  const parameterRows = adjustments.map((adjustment) => ({
    key: adjustment.parameterKey,
    value_json: adjustment.nextValue,
    updated_at: new Date().toISOString(),
  }));

  const historyRows: ParamHistoryRow[] = adjustments.map((adjustment) => ({
    parameter_key: adjustment.parameterKey,
    previous_value: JSON.stringify(adjustment.previousValue),
    next_value: JSON.stringify(adjustment.nextValue),
    reason: adjustment.reason,
  }));

  const { error: parameterError } = await admin
    .from("parametres")
    .upsert(parameterRows, { onConflict: "key" });

  if (parameterError) {
    throw new Error(`Parameter auto-adjustment failed: ${parameterError.message}`);
  }

  const { error: historyError } = await admin.from("param_history").insert(historyRows);
  if (historyError) {
    throw new Error(`Param history insert failed: ${historyError.message}`);
  }

  return adjustments.map((adjustment) => adjustment.reason);
}

export async function runWeeklyReport(referenceDate?: Date) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(getSupabaseAdminConfigError());
  }

  const parameters = await loadAlgoParameters();
  const { startIso, endIso } = getWeekBounds(referenceDate);
  const [predictions, courses] = await Promise.all([
    listPredictionsBetween(startIso, endIso),
    listCourseRecordsBetween(startIso, endIso),
  ]);

  const playedRows = predictions.filter(
    (row) =>
      row.stage === "RESULTAT" &&
      row.decision !== "REJET" &&
      row.pari_conseille !== null &&
      row.pari_conseille !== undefined
  );

  const courseMap = new Map<string, (typeof courses)[number]>(
    courses.map((course) => [`${course.date}-${course.reunion}-${course.course}`, course])
  );

  const decisionSegments: Record<string, SegmentAccumulator> = {};
  const lisibiliteSegments: Record<string, SegmentAccumulator> = {};
  const hippodromeSegments: Record<string, SegmentAccumulator> = {};
  const disciplineSegments: Record<string, SegmentAccumulator> = {};
  const confidenceSegments: Record<string, SegmentAccumulator> = {};
  const pariSegments: Record<string, SegmentAccumulator> = {};
  const highValueSegment: SegmentAccumulator = { count: 0, stake: 0, gain: 0 };

  let totalStake = 0;
  let totalGain = 0;

  for (const row of playedRows) {
    totalStake += row.mise_simulee ?? 0;
    totalGain += row.gain_simule ?? 0;

    appendToSegment(decisionSegments, row.decision, row);
    appendToSegment(lisibiliteSegments, row.lisibilite, row);
    appendToSegment(hippodromeSegments, row.hippodrome, row);
    appendToSegment(confidenceSegments, getConfidenceBucket(row.confiance), row);
    appendToSegment(pariSegments, row.pari_conseille ?? "INCONNU", row);

    const courseKey = `${row.date}-${row.reunion}-${row.course}`;
    const course = courseMap.get(courseKey);
    if (course?.discipline) {
      appendToSegment(disciplineSegments, course.discipline, row);
    }

    if ((row.value ?? 0) >= 2) {
      highValueSegment.count += 1;
      highValueSegment.stake += row.mise_simulee ?? 0;
      highValueSegment.gain += row.gain_simule ?? 0;
    }
  }

  const bestDecision = getTopSegmentLabel(decisionSegments)[0] ?? null;
  const bestDiscipline = getTopSegmentLabel(disciplineSegments)[0] ?? null;
  const bestConfidence = getTopSegmentLabel(confidenceSegments)[0] ?? null;
  const bestPari = getTopSegmentLabel(pariSegments)[0] ?? null;

  const insights: string[] = [];
  if (bestDecision) {
    insights.push(
      `La meilleure decision de la semaine est ${bestDecision.key} (${round2(bestDecision.roi)}% sur ${bestDecision.count} tickets).`
    );
  }
  if (bestDiscipline) {
    insights.push(
      `Discipline la plus forte: ${bestDiscipline.key} (${round2(bestDiscipline.roi)}%).`
    );
  }
  if (bestConfidence) {
    insights.push(
      `Zone de confiance la plus rentable: ${bestConfidence.key} (${round2(bestConfidence.roi)}%).`
    );
  }
  if (bestPari) {
    insights.push(
      `Type de pari le plus fort: ${bestPari.key} (${round2(bestPari.roi)}% sur ${bestPari.count} tickets).`
    );
  }

  const adjustments = buildAdjustments(
    parameters,
    decisionSegments,
    lisibiliteSegments,
    highValueSegment
  );
  const adjustmentReasons = await persistAdjustments(adjustments);

  const report: WeeklyReportRow = {
    week_start: startIso,
    week_end: endIso,
    roi_total: totalStake > 0 ? round2(((totalGain - totalStake) / totalStake) * 100) : 0,
    roi_by_decision: toRoiRecord(decisionSegments),
    roi_by_lisibilite: toRoiRecord(lisibiliteSegments),
    roi_by_hippodrome: toRoiRecord(hippodromeSegments),
    roi_by_discipline: toRoiRecord(disciplineSegments),
    roi_by_confiance: toRoiRecord(confidenceSegments),
    roi_by_pari: toRoiRecord(pariSegments),
    sample_size: playedRows.length,
    recommendations: [...insights, ...adjustmentReasons],
  };

  const { error } = await admin
    .from("weekly_reports")
    .upsert(report, { onConflict: "week_start,week_end" });

  if (error) {
    throw new Error(`Weekly report upsert failed: ${error.message}`);
  }

  if (isTelegramConfigured()) {
    await sendTelegramMessage(formatWeeklyTelegram(report, insights, adjustmentReasons));
  }

  return {
    success: true,
    report,
    insights,
    adjustments: adjustmentReasons,
  };
}
