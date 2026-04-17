import type { AlgoParameters, SegmentKey } from "@/lib/types";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getProbabilityCalibrationMultiplier(
  probability: number,
  parameters: AlgoParameters,
  segmentKey?: SegmentKey | null
) {
  const segmentBins =
    (segmentKey
      ? parameters.probabilityCalibration?.segments?.[segmentKey]?.bins
      : null) ?? null;
  const bins = segmentBins ?? parameters.probabilityCalibration?.bins ?? [];
  const match = bins.find(
    (bin) => probability >= bin.min && (probability < bin.max || bin.max >= 1)
  );

  return match ? clamp(match.multiplier, 0.5, 1.8) : 1;
}
