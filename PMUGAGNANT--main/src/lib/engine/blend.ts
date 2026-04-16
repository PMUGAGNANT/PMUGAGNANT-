import { logger } from "@/lib/server-logger";
import type { AlgoParameters, SegmentKey } from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function getSegmentMultiplier(
  probability: number,
  segmentKey: SegmentKey,
  parameters: AlgoParameters
) {
  const bins = parameters.probabilityCalibration.segments?.[segmentKey]?.bins;
  if (!bins || bins.length === 0) {
    return null;
  }

  const match = bins.find(
    (bin) => probability >= bin.min && (probability < bin.max || bin.max >= 1)
  );
  return match ? clamp(match.multiplier, 0.5, 1.8) : null;
}

export function blendScore(
  expertScore: number,
  segmentKey: SegmentKey,
  parameters: AlgoParameters
): number {
  const safeScore = clamp(expertScore, 0, 100);
  const estimatedProbability = clamp(safeScore / 100, 0, 1);
  const multiplier = getSegmentMultiplier(estimatedProbability, segmentKey, parameters);

  if (multiplier === null) {
    return expertScore;
  }

  const blendedProbability = clamp(estimatedProbability * multiplier, 0, 1);
  const blendedScore = round1(blendedProbability * 100);

  logger.debug("engine_v6.blend_applied", {
    segmentKey,
    expertScore: round1(safeScore),
    estimatedProbability: round1(estimatedProbability * 100),
    multiplier,
    blendedScore,
  });

  return blendedScore;
}
